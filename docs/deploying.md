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

- `gstBasis` is `UNKNOWN` until confirmed from real data (`docs/energy-data.md`), so the live server
  shows no cost estimates and withholds dollar amounts in plan details. Search works.
- Azure PostgreSQL requires TLS; the server verifies the certificate. If the connection fails with a
  certificate error, the Azure CA chain is not in Node's bundle: tell us, and we add it through
  `NODE_EXTRA_CA_CERTS`.
- The retailer list currently holds only AGL, Origin and EnergyAustralia.
