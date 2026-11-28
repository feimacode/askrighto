# Design

## Context

- One image (`ghcr.io/feimacode/askrighto`) is run by the `askrighto` role in feimacode/feima-infra on one shared Australia East VM, behind Traefik (file provider) and Cloudflare. The inventory lists that VM twice: `global_dev` (compose project `dev`, used only by easystudy today) and `global_prod` (project `prod`: inkview, open-design-gateway, askrighto). `deploy-askrighto.yml` targets `global_prod` only.
- `image.yml` pushes `:latest` and `:sha-<commit>` on every push to `main`; `release.yml` pushes `:<version>` and, for stable versions, `:stable`. The role's default `askrighto_version` is `latest`, so production follows `main` unless a version is passed.
- Production today serves energy on `/mcp` and, with a vault token, loads the course verticals and serves them on `/mcp-internal/<token>`; the home loan proxy (`home-loans`) is internal-only too. All of it shares one database (`askrighto` schema in the `askrighto` database), one `ASKRIGHTO_PROFILE_KEY`, and one process.
- Claude and ChatGPT custom connectors take a URL and optionally OAuth; they cannot send custom headers, so a secret in the path is the only simple shared-key option (the reasoning in `add-canary-release` still holds).
- The server never starts a first data load or migration by itself: Ansible runs `migrate` in a one-shot container before the new version starts, and `load-all` (courses) runs after the health check.

## Goals / Non-Goals

**Goals:**
- A dev deployment with the full internal feature set that tracks `main`, and a production deployment pinned to released tags.
- Complete separation of data and secrets: a mistake on dev cannot change production data, and a dev secret never works on production.
- Production holds no unreleased vertical, code path or data.
- Promotion and rollback stay one setting and a redeploy.

**Non-Goals:**
- Strong per-user authentication, a staging tier between dev and production, a second VM.

## Decisions

### 1. How the two deployments differ

| | production | dev |
| --- | --- | --- |
| Host | `askrighto.feimacode.com` (later `askrighto.com.au`) | `askrighto-dev.feimacode.com` |
| Compose project, container | `prod`, `prod-askrighto` | `dev`, `dev-askrighto` |
| Image tag | pinned release (`0.1.1`), never `latest` | `latest` (every merge to `main`) |
| `ASKRIGHTO_CHANNEL` | `stable` | `dev` |
| `ASKRIGHTO_VERTICALS` | `energy` | `energy,courses-domestic,cricos,home-loans` (add `health-cover`, `career-outcomes` as they land) |
| MCP path | `/mcp` | `/mcp/<token>` (see 4) |
| Database | `askrighto` database, schema `askrighto`, role `askrighto` | `askrighto_dev` database, schema `askrighto`, role `askrighto_dev` |
| Secrets | prod vault | dev vault, no value shared (database URL, profile key, access token) |
| Listings and plugin | the Claude, ChatGPT and Gemini listings, the public plugin | none; the dev plugin, by hand |
| Failing vertical | stops start-up | marked failed, tools answer `data_unavailable` |

Rights gate: `NODE_ENV=production` (set by the image) applies on both. Dev serves real testers, so `pending` datasets stay `data_unavailable` there too (this is `add-canary-release` decision 5, kept).

A vertical list per process replaces the loaded-vs-public pair. `ASKRIGHTO_VERTICALS` keeps today's validation (unknown name, empty list stop start-up) and its default `energy`. Because production's list is `energy`, course code is in the image but never loaded, registered or reachable there. Nothing about courses is in production's database content.

Alternatives: (a) keep the two lists on both deployments, so production could still hold a hidden route. Rejected: that is the structure Iven asked to remove, and it keeps the special code. (b) A separate image for dev. Rejected: dev would no longer be what production is built from; one image with different settings is the point.

### 2. Channel setting

`ASKRIGHTO_CHANNEL=stable|dev`, default `stable`, unknown value stops start-up. It only does three things: `/healthz` returns it (`{"ok":true,"version":"…","channel":"dev"}`), a failing vertical is tolerated on `dev` only, and `dev` prefixes the MCP `initialize` instructions with one sentence: "This is the Ask Righto dev endpoint; answers may be incomplete." It never changes data rights, tool schemas or tool behaviour, so dev results mean what production results will mean.

The release smoke check and the evals read the channel to choose their expectations (decision 8).

### 3. Deploy trigger and version policy

**Production** stays the existing release flow: a `v*` tag runs `release.yml` (validate, build, image `:<version>` and `:stable`, GitHub release), then a person runs `ansible-playbook playbooks/deploy-askrighto.yml -l global-au-prod -e askrighto_version=<x.y.z>` and `npm run release:smoke`. Two changes: the role default becomes `stable`, and `global_prod/main.yml` pins `askrighto_version` to the released number, so a bare run redeploys what is already live and never `main`.

**Dev** deploys `:latest`. Options:
- A. Manual: `ansible-playbook playbooks/deploy-askrighto.yml -l global-au-dev`. Safe and simple; relies on someone remembering.
- B. Pull-based timer on the VM (recommended). The role, in dev mode, installs a systemd timer (every 10 minutes) that pulls `:latest`, compares the digest with the running container and, when it changed, runs the same steps as the playbook: `migrate` in a one-shot container, recreate, wait for `/healthz`. No credentials leave the VM, GitHub needs no SSH access, and a failed migration leaves the old container running. Latency after a merge is the image build (about 5 minutes) plus up to 10 minutes.
- C. A GitHub Actions job after `image.yml` that SSHes to the VM. Rejected: it needs an SSH key in GitHub secrets and an inbound path to the VM for a dev convenience.

A broken `main` can briefly break dev; that is what dev is for. `image.yml` already smoke-tests the image without a database before pushing `:latest`, which stops the worst case.

### 4. Access control for dev

Options: A. open at the hostname; B. a path token on dev only; C. Cloudflare Access.

- A is the simplest but exposes datasets that are `cleared_pending_legal_view` and a live relay to lender CDR endpoints to anyone who finds the host (certificate transparency logs publish hostnames). Serving uncleared data to the world is the distribution `add-course-data-permissions` is meant to prevent, and the unmetered relay is a small abuse surface.
- C needs a service token header or a login, which Claude and ChatGPT custom connectors cannot send or complete.
- **B (recommended)**: `ASKRIGHTO_ACCESS_TOKEN` (at least 43 characters, as today). With it set, the MCP route is `/mcp/<token>`; plain `/mcp` and wrong tokens answer 404 with `X-Robots-Tag: noindex`, the token is compared in constant time and masked in the access log, `/metrics/<token>` is served, `/readyz` and `/healthz` stay open (they carry no data). With no token set (production) the route is plain `/mcp` and no `/metrics` path exists. This is today's mechanism applied to the whole host, so almost all of its code and tests carry over.

Token handling is unchanged from `docs/deploying.md`: ansible-vault, rotate when a tester leaves and at least every 90 days, the URL is never in the repo, plugin bundles or listings. A leak exposes unfinished answers over public reference data, not private data, which is why a shared secret is acceptable.

Open question for Iven: choose A or B (decision 1 in the proposal summary).

### 5. Data and secrets separation

- **Database:** a separate database `askrighto_dev` and role on the same flexible server, as `easystudy_dev` already is. The role cannot connect to the production database. Migrations run on both; they are additive and the schema name stays `askrighto`, so no code change. Dev data is always rebuildable: `load-all` (courses) and `sync-energy` (energy plans) from public sources.
- **Energy sync on dev:** the daily refresh stays on but at a lower rate (`ASKRIGHTO_SYNC_PER_RETAILER_RPS=1`) and later in the night (`ASKRIGHTO_SYNC_AT=04:00`), so dev adds a second, gentler load on retailers' CDR endpoints and the two syncs do not overlap. The first dev load is `docker exec dev-askrighto node askrighto.js sync-energy`, run by hand.
- **Course data:** `load-all` runs after each dev deploy, as it does now for the internal route. Production loads no course data; the existing course rows in the production database (loaded for the internal route) are removed after cutover (a destructive step, so it needs Iven's go: see tasks 5.3).
- **Secrets:** `vault_askrighto_dev_database_url`, `vault_askrighto_dev_profile_key`, `vault_askrighto_dev_access_token` live in `global_dev/vault.yml` (dev file, separate from production's). Profiles signed on dev do not verify on production and the reverse. The OpenAI challenge and Google Connected Apps values are set on production only. `ASKRIGHTO_ALLOWED_HOSTS` and `ASKRIGHTO_PUBLIC_URL` are per deployment (upload links point at the right host). No token or password goes in the repo, the image or this PR.

### 6. What happens to the `/mcp-internal` code and tests

Sequence matters: the existing image already supports everything needed to stand dev up (set `ASKRIGHTO_VERTICALS` to all verticals and leave `ASKRIGHTO_PUBLIC_VERTICALS` unset so `/mcp` serves them, with `/mcp-internal/<token>` as the protected path), so infra and dev go first with no code change. Cleanup comes after testers have moved.

Removed: `INTERNAL_PATH` and the `/mcp-internal`, `/readyz-internal`, `/metrics-internal` handlers, `ASKRIGHTO_INTERNAL_TOKEN`, `ASKRIGHTO_PUBLIC_VERTICALS`, `flags.public` vs `flags.loaded`, `setFor` for two sets, the route label passed to `createServer`, and their tests. Kept and renamed: `tokenMatches` and `maskInternalPath` (now `maskAccessPath`, masking `/mcp/<token>`, `/metrics/<token>` and `/readings-upload/<token>`), the failed-vertical stub (dev channel only), and the outcome counters in `src/core/metrics.ts` (they now report per deployment, not per route). The readings-upload path is gated on the energy vertical being loaded, as now. Tests that exercised "public route hides course tools" become "a deployment lists exactly the tools of its verticals" (energy-only list on a stable instance, everything on a dev instance). `scripts/evals/run.mjs` starts an in-process server with `ASKRIGHTO_CHANNEL=dev` and the access token instead of building an internal URL. `test/plugin-packaging.test.ts` and `scripts/check-plugin-zips.mjs` keep asserting that no packaged file names a token path, now `/mcp/<token>`-shaped and the dev host.

### 7. Plugin and listing implications

- **Public plugin and listing packages** are unchanged: they hold only `publicSkills` and the production `serverUrl`. The release workflow and `check-plugin-zips` keep asserting that the dev host and token paths appear in none of them.
- **Dev plugin:** `plugin-internal/` becomes `plugin-dev/` and the marketplace entry `askrighto-dev`. It carries every skill (public and course, health, home loan) at the release version and is not built into any zip for a directory. Its connector is added by hand (the URL holds the token), as today. `plugin/askrighto.config.json` gains `dev.serverHost` (`askrighto-dev.feimacode.com`) so docs and checks have one source for the host, and `marketplace.internalDescription` becomes `devDescription`.
- **Tracking `main`:** the GitHub marketplace file lives on `main`, so testers on the dev plugin get unreleased skills by design, while the public plugin entry should follow release tags. If the marketplace schema supports pinning a plugin source to a ref, pin `askrighto` to the latest release tag in the release step; otherwise note that the public entry follows `main`, which is already the case today and does not leak data, only skills for public tools (`plugin:check` enforces that).
- Listing updates (rescan/resubmit) are triggered only by production deploys; dev never touches a directory.

### 8. Smoke checks and evals per channel

`npm run release:smoke -- <url> <version> [--channel dev --token <t>]`: default is today's check (`/healthz` reports the version, `/mcp` lists exactly `publicTools`, each read-only). With `--channel dev` it expects `/healthz` to report `"channel":"dev"` and `/mcp/<token>` to list every tool of every vertical in the dev list, each read-only and not destructive. The home loan proxy smoke (`homeloans-smoke.yml`) keeps running against the real CDR Register from CI and is unaffected.

### 9. Counters and promotion gates

Outcome counters (metadata only, no arguments or ids) are served at `/metrics/<token>` on dev, so gate 4 of `docs/promotion-checklist.md` ("two weeks of internal counts") reads the dev counters. Production has no metrics path until a reason appears. The five gates are unchanged; only the mechanics change: promotion is a feima-infra change to production's `ASKRIGHTO_VERTICALS` (and a release that contains the vertical's public tools in `publicTools`), recorded in the promotion pull request.

### 10. Rollout (no big bang)

1. **Infra prep** (admin, on the VM): create the `askrighto_dev` database and role; Cloudflare DNS for the dev host; generate the dev secrets in the dev vault.
2. **feima-infra change:** `global_dev` variables for askrighto, playbook `hosts` as a variable, env template driven by explicit variables, dev auto-deploy timer (optional), production pin to the current release and default `stable`.
3. **Stand dev up from the existing image** (no code change): deploy `-l global-au-dev`, run `load-all` and `sync-energy`, connect a tester through the temporary `/mcp-internal/<token>` path or open `/mcp` per decision 4.
4. **Implement the cleanup** in this repo (access token route, channel, one list, smoke/evals/plugin/doc changes) as its own pull requests, released as `0.2.0` with listing impact `none`.
5. **Cut over:** move testers to the dev URL, remove the course variables and the internal token from production (rotate by deleting the vault entry), redeploy production pinned, run the production smoke check, then (with Iven's go) remove course rows from the production database.
6. Archive `add-canary-release` (superseded parts dropped) and this change.

## Risks / Trade-offs

- [Dev and production share one VM, so a runaway dev container can starve production] → CPU and memory ceilings on the dev container (0.5 CPU, 768 MB, as production), check `docker stats` headroom before enabling; Traefik and Docker already isolate networks.
- [Both deployments share one Azure PostgreSQL server] → separate databases and roles; dev connection pool is 3; a heavy dev load can still slow the server, so the first big dev loads run off-peak.
- [Auto-deploy ships a broken `main` to testers] → image smoke test before `:latest`, migrations run before the swap, rollback is `-e askrighto_version=sha-<commit>` on dev.
- [Dev access token leaks] → rotate; same exposure as today's internal token; OAuth later.
- [Two environments drift (settings, data)] → the only differences are the table in decision 1, all as role variables in feima-infra; the dev smoke check asserts the channel and tool list.
- [Dev doubles load on retailers' CDR endpoints and CRICOS downloads] → half the per-retailer rate, a different hour; CRICOS refresh only when the dataset changes.
- [Production loses the ability to hold a hidden vertical] → intended; a new vertical now stays on dev until promoted.
- [Hostname depth and TLS] → `askrighto-dev.feimacode.com` is one level under the zone, covered by Cloudflare's universal certificate; `dev.askrighto.feimacode.com` would not be.

## Open Questions

Listed for Iven with recommendations in the proposal PR: access to dev (token vs open), how dev redeploys (timer vs manual), the dev hostname, and confirming the shared VM has headroom for a second container.
