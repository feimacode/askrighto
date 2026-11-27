# Proposal

## Why

Today one deployment does two jobs. The public route `/mcp` serves energy only. A secret path `/mcp-internal/<token>` on the same container serves everything that is not yet public (domestic courses, CRICOS courses, and the CDR home loan proxy, which is internal-only until the credit legal view is recorded). That was the right call on 16 Nov 2026 for a handful of testers (`add-canary-release`), but it has limits:

- The internal route is a path on the public host, so it ships in the same image, runs in the same process and shares the same database, secrets and release cadence as the thing directories will list. A bad course load, a slow query or a mistake in a promotion setting touches production.
- The public deployment is not pinned. `image.yml` pushes `:latest` on every merge to `main`, and the Ansible default is `askrighto_version: latest`, so "production" follows `main` unless someone remembers `-e askrighto_version=<release>`. Directory reviewers could see unreleased code.
- Testers cannot try a new build before it reaches production, because the route split is per vertical, not per build.
- The internal route needs special code (a token path, internal readiness and metrics paths, a loaded-vs-public list, log masking, a tool stub for failed verticals) that exists only to hide things from the public route.

Iven (27 Nov 2026): "Instead of having internal endpoint, we really need a whole dev endpoint which is a dedicated deployment of internal version (not pinned)."

## What Changes

- **A second deployment, "dev", of the same image.** It runs on the same shared Azure VM behind the same Traefik and Cloudflare, as its own container (`dev-askrighto`), on its own host (proposed `askrighto-dev.feimacode.com`), with its own database (`askrighto_dev`), role, secrets and settings. It loads every vertical and serves them all on its own `/mcp`. It tracks the latest `main` build (`:latest`), not a release tag.
- **Production is pinned.** `askrighto.feimacode.com` is deployed only from a released version (`-e askrighto_version=<x.y.z>`, with the pinned version recorded in feima-infra), and the Ansible default no longer follows `main`. It loads and serves energy only.
- **One list of verticals per deployment.** `ASKRIGHTO_VERTICALS` is what the process loads and what `/mcp` serves. The second list `ASKRIGHTO_PUBLIC_VERTICALS` and the split between loaded and public go away. **Promotion** becomes: a vertical joins production's `ASKRIGHTO_VERTICALS` in feima-infra after the gates in `docs/promotion-checklist.md`. **Rollback** is removing it and redeploying.
- **A deployment channel setting**, `ASKRIGHTO_CHANNEL=stable|dev` (default `stable`):
  - `/healthz` reports it, so smoke checks can tell the two apart.
  - On `dev`, an unready vertical is marked failed (its tools answer `data_unavailable`) instead of stopping start-up; on `stable`, any failing vertical stops start-up.
  - On `dev`, the server instructions open with a short notice that answers may be incomplete.
- **Access to dev** (decision for Iven; recommendation: a path token on dev only). `ASKRIGHTO_ACCESS_TOKEN`, when set, moves the MCP route to `/mcp/<token>` (plain `/mcp` and wrong tokens answer 404) and turns on `/metrics/<token>`. Production sets no token and keeps plain `/mcp`. This reuses today's constant-time token check and log masking, so the unreleased course data and the live home loan relay are not open to anyone who finds the hostname.
- **Remove the internal route.** `/mcp-internal/<token>`, `/readyz-internal/<token>`, `/metrics-internal/<token>`, `ASKRIGHTO_INTERNAL_TOKEN`, `ASKRIGHTO_PUBLIC_VERTICALS` and the route-aware tool sets (`setFor`, public vs internal) are deleted once dev is live and the testers have moved. The tests, evals (`scripts/evals/run.mjs`) and docs that use the internal path move to the dev route or to an in-process dev-channel server.
- **Plugin builds know about two channels.** The public plugin and the three listing packages keep pointing at the production URL and carry only public skills and tools. The internal plugin becomes the **dev plugin** (`askrighto-dev` in the marketplace file): all skills, versioned with the release, with the dev host as its connector host and no token in the repo (the tester adds the connector URL by hand, as today).
- **Smoke checks per channel.** `npm run release:smoke` gains a `--channel dev` mode that expects `/healthz` to report channel `dev` and every tool of every known vertical on `/mcp`; the production mode is unchanged (exactly `publicTools`).
- **Deploy trigger.** Production: manual, by version, as today (`docs/releasing.md`). Dev: the Ansible role gains a dev mode that deploys `:latest` (so the same playbook runs with `-l global-au-dev`) and, recommended, a small pull-based timer on the VM that redeploys dev when `:latest` changes after a merge to `main`. No GitHub secret or inbound SSH is added.
- **feima-infra changes** (handed off in `infra-handoff.md`, not made here): a `global_dev` group entry for `askrighto_*`, the playbook's `hosts` made a variable, the role's course-token gating replaced by explicit per-environment variables, the dev env file, a vault entry, a database and DNS record, and the production version pin.

Data source: none new. This change governs where datasets are served. The rights gate (`ASKRIGHTO_ENV` / `NODE_ENV=production`) stays on in both deployments: dev is not a development machine, it serves real testers.

Hosts affected: none publicly. Claude, ChatGPT and Gemini listings point only at the production URL. Testers use the dev URL as a custom connector (Claude, ChatGPT developer mode) or the dev plugin.

Out of scope: user accounts or OAuth for dev (a later option if the tester group grows), a third staging environment, traffic splitting, a second VM, changing the data licensing decisions, and any implementation (this is the proposal only).

## Capabilities

### New Capabilities
- `deployment-environments`: how the production and dev deployments differ (verticals, channel, version, database, secrets, access), how each is deployed, and how a vertical is promoted from one to the other.

### Modified Capabilities
- `release-channels` (from `add-canary-release`, not yet archived): its internal-route requirements are superseded. Archive `add-canary-release` with them dropped, or fold its still-valid requirements (promotion gates, outcome counts without user content, rights gate on both) into `deployment-environments`, when this change is applied.
- `release-process` (from `add-release-process`): the deploy step pins the version and the smoke check gains a channel.
- `plugin-packaging`: the internal plugin becomes the dev plugin.

## Impact

- Code (later, in implementation): `src/verticals.ts` (single list, channel, failure tolerance), `src/main.ts` (drop internal paths, add the access-token route and `/metrics/<token>`), `src/server/internal.ts` (rename to access-token helpers), `src/server/create-server.ts` and `src/tools/*` (one tool set per process), `scripts/smoke-remote.mjs`, `scripts/plugin.mjs`, `plugin-internal/` (renamed dev plugin), `scripts/evals/run.mjs`, tests (`test/e2e/server.test.ts`, `test/plugin-packaging.test.ts`), `.github/workflows/image.yml` (unchanged tags, comment only).
- Docs: `docs/deploying.md` (replace "Internal route, verticals and promotion"), `docs/releasing.md`, `docs/architecture.md`, `docs/areas/platform.md`, `docs/promotion-checklist.md` (gate 4 reads dev metrics), `docs/home-loan-evaluation/*`, `docs/intl-course-data.md`.
- Infra (feima-infra): see `infra-handoff.md`.
- Cost: no new VM. One more container (the role's default ceiling is 0.5 CPU and 768 MB) on the shared VM, one more database on the existing Azure PostgreSQL flexible server (a few hundred MB with courses loaded), one Cloudflare DNS record. GHCR and CI are unchanged.

## Decisions for Iven (with recommendations)

1. **Access to dev.** Open at the hostname, or a secret token in the path? Recommend the **token**: dev serves data still awaiting a legal view and a live relay to lenders, and hostnames are public through certificate logs.
2. **How dev redeploys.** Manual playbook run, or an automatic pull on the VM after each merge to `main`? Recommend the **VM timer** (no GitHub secrets, no inbound SSH), with the manual run always available.
3. **Dev hostname.** Recommend `askrighto-dev.feimacode.com` (one level under the zone, covered by Cloudflare's certificate, same shape as `api-study-dev.feimacode.com`).
4. **Capacity.** Confirm the shared VM has room for a second 0.5 CPU / 768 MB container before the first deploy (a check, not a design choice). Also confirm the later destructive step of removing course rows from the production database (task 5.3).
