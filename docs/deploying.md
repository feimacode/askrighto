# Deploying Ask Righto

Same pattern as Inkview: a Docker image on GHCR, run by Ansible from `feimacode/feima-infra`
(`ansible/roles/askrighto`, `playbooks/deploy-askrighto.yml`) behind Traefik and Cloudflare on the
shared Azure VM. State lives in the shared Azure PostgreSQL, schema `askrighto`.

## The image

`.github/workflows/image.yml` builds the `Dockerfile` and pushes `ghcr.io/feimacode/askrighto`:
`:latest` and `:sha-<commit>` on every push to `main`, `:<version>` on `v*` tags. The workflow then
starts the image without a database and checks `/healthz`. A new GHCR package starts **private**:
make it public in the package settings (the repo is public), or set `askrighto_ghcr_private` in
feima-infra.

The container runs as the unprivileged `node` user on a read-only filesystem. It contains one bundled
file and the commands `migrate` and `sync-energy`.

## First deploy

1. **Database** (once, admin): on the Australia East server `feimacode.postgres.database.azure.com`,
   create the `askrighto` role and database (the app creates its own `askrighto` schema when it
   migrates). The server is private to the VM's VNet, so run the admin `psql` from the VM, not from a
   laptop or cloud sandbox. Same pattern as `easystudy_dev` in feima-infra `docs/AZURE_AU_MIGRATION.md`.
2. **Secret**: in feima-infra, `ansible-vault edit inventory/group_vars/global_prod/vault.yml` and add
   `vault_askrighto_database_url` (see `vault.yml.example`).
3. **DNS**: point `askrighto.feimacode.com` (internal test domain, set in `group_vars/global_prod/main.yml`; switch to askrighto.com.au later) at the
   VM through Cloudflare, like `inkview.feimacode.com`. Cloudflare terminates TLS.
4. **Deploy**: `ansible-playbook playbooks/deploy-askrighto.yml -l global-au-prod`. It pulls the image,
   applies migrations (only inside the `askrighto` schema), starts the container, registers the
   Traefik route and checks health.
5. **First plan load** (once; the server never starts it by itself):
   `docker exec prod-askrighto node askrighto.js sync-energy`
   It prints a sync report: requests, throttled responses per retailer, plans per retailer and
   pricing model, plans not fully understood. Run a single retailer first with
   `sync-energy --retailer agl`.
6. **Check**: `https://<domain>/healthz` is 200 always; `/readyz` is 503 `no_data_loaded` until
   step 5 has run, then 200. The connector URL is `https://<domain>/mcp`.

After the first load the daily refresh runs inside the server at 02:30 Australia/Sydney.

## Roll back

Stateless server, so redeploy an older tag:
`ansible-playbook playbooks/deploy-askrighto.yml -l global-au-prod -e askrighto_version=sha-<commit>`.
Migrations are additive; there are no down migrations. To start the data over, drop the `askrighto`
schema and repeat steps 4 and 5.

## Known limits of this deployment

- `gstBasis` is `EXCLUSIVE` since 16 Nov 2026 (`docs/cdr-schemas.md`). Plans loaded before that
  carry `UNKNOWN` until `node dist/askrighto.js renormalise-energy` is run once after deploy (then
  restart); until then the server shows no cost estimates for them.
- Azure PostgreSQL requires TLS; the server verifies the certificate. If the connection fails with a
  certificate error, the Azure CA chain is not in Node's bundle: tell us, and we add it through
  `NODE_EXTRA_CA_CERTS`.
- The retailer list holds all 92 CDR energy retailer paths (`docs/energy-data.md`), but the server never starts a first load: run `sync-energy` once on the VM to load the retailers added since AGL.

## Internal route, verticals and promotion

One image, one instance, two routes. Which verticals load and which each route serves is set by environment variables, so promoting or rolling back a vertical is a settings change and a redeploy, with no code change.

| Setting | Meaning |
| --- | --- |
| `ASKRIGHTO_VERTICALS` | Verticals the process loads. Default `energy`. Example: `energy,courses-domestic`. Verticals: `energy`, `courses-domestic`, `cricos` (courses for international students). The earlier ids `courses` and `international` are still accepted with a warning. |
| `ASKRIGHTO_PUBLIC_VERTICALS` | Verticals `/mcp` serves. Must be a subset of the loaded list. Default: all loaded. Example: `energy`. |
| `ASKRIGHTO_INTERNAL_TOKEN` | At least 43 characters (32 random bytes, base64url). Turns on `/mcp-internal/<token>`, `/readyz-internal/<token>` and `/metrics-internal/<token>`. With no token those paths do not exist (404). |
| `ASKRIGHTO_ENV=production` | The data rights gate applies on both routes (pending datasets answer `data_unavailable`). `NODE_ENV=production` has the same effect. |
| `ASKRIGHTO_DATA_DIR` | Where `data/` lives. The image sets `/app/data`. |

Start-up fails on an unknown vertical name, an empty list, or a public vertical that is not loaded. An internal-only vertical that fails to start is marked failed: its tools answer `data_unavailable` on the internal route and `/mcp` keeps working. Its database queries run under a 2 second statement timeout.

**Infra handoff (feima-infra, `askrighto` role):** set `ASKRIGHTO_VERTICALS=energy,courses-domestic`, `ASKRIGHTO_PUBLIC_VERTICALS=energy`, `ASKRIGHTO_ENV=production`, and a vault secret `vault_askrighto_internal_token` mapped to `ASKRIGHTO_INTERNAL_TOKEN`. Generate the token with `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`. After deploy, `/mcp` should list energy tools only and `/mcp-internal/<token>` should list the course tools.

**Token handling:** the token lives in ansible-vault. Rotate it when a tester leaves and at least every 90 days (change the secret, redeploy, send the new URL directly to the named testers). The access log writes `/mcp-internal/***`. The URL never goes in the repo, docs, plugin bundles or listings.

**Loading course data:** run `node askrighto.js migrate`, then `courses:load` (optionally `--cricos FILE.csv`, the CRICOS course list exported to CSV) and `vce:load` from the VM. The scaling and study grouping tables load only from a permitted file; until VTAC's permission is recorded they exist only as git-ignored copies in `data/local/` and stay `data_unavailable` in production.

**Promotion:** a vertical joins `ASKRIGHTO_PUBLIC_VERTICALS` only through a change that records every gate in [promotion-checklist.md](promotion-checklist.md). **Rollback:** remove it from the list and redeploy.

### Tester note (share with the named testers only)

The course tools are a work in progress. Answers may be incomplete: many courses show only links and a reading checklist. After an announced update, disconnect and reconnect the connector so your host reloads the tool list. Report problems to Iven with the question you asked and what you saw (do not include personal details). Do not share the URL.

## Private health cover (internal vertical)

Add `health-cover` to `ASKRIGHTO_VERTICALS` (not to `ASKRIGHTO_PUBLIC_VERTICALS`) to serve it on the internal route. Each month: unzip the PrivateHealth.gov.au ZIP, `health:validate --dir FOLDER`, then `health:load --dir FOLDER` (open products only; add `--include-closed` to keep closed ones; allow a few minutes and about 1 GB of memory for the full file) (see [health-cover-columns.md](health-cover-columns.md)). After each 1 April and 1 July run `health:rates-validate`. Rates are read from `data/health/rates.yaml`, which the image already copies.
