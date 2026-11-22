# Tasks

## 1. Fetch and check

- [x] 1.1 `src/cricos/source.ts`: CKAN lookup, resource picking by name, host and size guards, injected fetch; verify unit tests with a fake CKAN response, a foreign host, a redirect to another host, a missing resource and an oversize body
- [x] 1.2 `src/cricos/guards.ts`: pure guard checks with the constants in the design; verify a test per guard and for `--force`
- [x] 1.3 Check the real resources download and parse here (not in CI); verify counts against askrighto_dev and record them in `docs/cricos-columns.md`

## 2. Refresh

- [x] 2.1 `src/cricos/refresh.ts`: lock, fingerprint, download, parse, guards, domestic load then international load, recorded fingerprint and content hash; verify DB tests that a second run changes nothing, that a guard failure keeps old data, and that unchanged CRICOS still re-merges the YAML
- [x] 2.2 Read stored `cricos_raw` rows back as CRICOS courses; verify a round trip test
- [x] 2.3 CLI: `cricos:refresh [--dry-run] [--force]` and `load-all [--force]` in `src/main.ts` help and dispatch; verify `--dry-run` writes nothing

## 3. Schedule

- [x] 3.1 Optional daily check inside the server behind `ASKRIGHTO_CRICOS_REFRESH=on` with the advisory lock; verify a test that a held lock skips and that nothing runs when the variable is off

## 4. Infra and docs

- [ ] 4.1 feima-infra: post-deploy `docker exec ... load-all` gated on the token, never failing the deploy; verify syntax check and a render test
- [x] 4.2 Update `docs/deploying.md`, `docs/course-gaps.md`, the role README and the open design notes; verify the manual steps are gone from the deploy instructions
