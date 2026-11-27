# Tasks

Planning only. Nothing below is started. Order matters: infra and dev first (1 and 2 need no code change), cleanup after testers have moved (3 to 5).

## 1. Decisions and infra preparation (Iven and admin)

- [ ] 1.1 Iven decides the four open choices in the proposal PR (dev access, dev redeploy mechanism, dev hostname, VM headroom); record the answers in `design.md`
- [ ] 1.2 Check headroom on the shared VM (`docker stats`, free memory) for one more container; verify the dev limits (0.5 CPU, 768 MB) fit
- [ ] 1.3 On the VM (admin psql): create database `askrighto_dev` and role `askrighto_dev` (own password), same pattern as `easystudy_dev`; verify the role cannot connect to the production database
- [ ] 1.4 Cloudflare: add the dev hostname pointing at the VM, like the production host; verify TLS works
- [ ] 1.5 Generate dev secrets (`openssl rand -base64 32 | tr '+/' '-_' | tr -d '='` for the access token; a separate profile key) and put them in `global_dev/vault.yml`; verify nothing is copied from the production vault

## 2. feima-infra (separate repo, see `infra-handoff.md`)

- [ ] 2.1 `global_dev/main.yml`: `askrighto_*` variables (domain, port 8321, deploy path `/opt/feima/dev/askrighto`, network `askrighto_dev_network`, database URL from the dev vault, channel `dev`, all verticals, access token, `latest`, sync rate and time); add the vault example entries
- [ ] 2.2 `deploy-askrighto.yml`: make `hosts` a variable (default `global_prod`) so `-l global-au-dev` works; verify both targets with `--check`
- [ ] 2.3 Role: render `ASKRIGHTO_VERTICALS`, `ASKRIGHTO_CHANNEL`, `ASKRIGHTO_ACCESS_TOKEN` from explicit variables instead of the course-token switch; run `load-all` when `askrighto_load_data_on_deploy` is true; verify a production render with no course variables is identical to today's energy-only render
- [ ] 2.4 Production: pin `askrighto_version` to the current release in `global_prod/main.yml`, default the role to `stable`; verify a bare production run changes nothing
- [ ] 2.5 (If chosen) dev auto-deploy timer in the role: pull `latest`, compare digest, migrate, recreate, health check; verify a failed migration leaves the old container running
- [ ] 2.6 First dev deploy from the existing image, with courses and home loans loaded through the existing internal path; verify `/readyz`, `load-all` and `sync-energy` on dev and that production is untouched

## 3. Server cleanup (this repo; own pull requests after the testers have moved)

- [ ] 3.1 `src/verticals.ts`: one list, `ASKRIGHTO_CHANNEL`, failure tolerance on dev only, drop `ASKRIGHTO_PUBLIC_VERTICALS`; unit tests for each start-up rule
- [ ] 3.2 `src/main.ts` and `src/server/internal.ts`: remove the internal paths; add `ASKRIGHTO_ACCESS_TOKEN` (`/mcp/<token>`, `/metrics/<token>`, 404s, noindex, masked log); `/healthz` reports the channel; dev instruction notice; HTTP and log tests
- [ ] 3.3 Collapse the route-aware tool sets and the `route` label; counters report per deployment; test that a deployment lists exactly its verticals' tools
- [ ] 3.4 Update `test/e2e/server.test.ts` and `scripts/evals/run.mjs` to the dev channel; verify the evals still run without the internet (mock lender mode)
- [ ] 3.5 Check the data licence entries are still current for the datasets dev serves (config rule), and that the rights gate applies on both channels

## 4. Packages, smoke and docs

- [ ] 4.1 Rename `plugin-internal` to `plugin-dev`, the marketplace entry to `askrighto-dev`, add `dev.serverHost` to `plugin/askrighto.config.json`; update `scripts/plugin.mjs`, `scripts/check-plugin-zips.mjs`, `test/plugin-packaging.test.ts`; verify no public package names the dev host or a token path
- [ ] 4.2 `scripts/smoke-remote.mjs`: add `--channel dev --token`; verify against a local dev-channel server
- [ ] 4.3 Docs: replace the internal route section in `docs/deploying.md`; update `docs/releasing.md` (pin, dev deploy), `docs/architecture.md`, `docs/areas/platform.md`, `docs/promotion-checklist.md` (gate 4 reads dev metrics), the home loan and course docs, `ROADMAP.md`; verify setting names match the code
- [ ] 4.4 Release `0.2.0` with listing impact `none` (production serves the same energy tools)

## 5. Cutover and cleanup

- [ ] 5.1 Send testers the dev URL directly; verify a tester call on dev with each vertical
- [ ] 5.2 Production: remove the course variables and the internal token from the vault, redeploy pinned, run the production smoke check; verify `/mcp-internal/<old token>` is 404
- [ ] 5.3 With Iven's explicit go (destructive): remove course rows from the production database; verify energy tools and `/readyz` afterwards
- [ ] 5.4 Archive `add-canary-release` with its internal-route requirements dropped, and this change; the main specs then hold `deployment-environments`
