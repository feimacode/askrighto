# Tasks

## 1. Version and changelog
- [x] 1.1 Add `CHANGELOG.md` with a `0.1.0` section and listing impact
- [x] 1.2 Add `scripts/bump-version.mjs` (`release:bump`) with tests for the version pattern, the dry run and the changelog check

## 2. Build
- [x] 2.1 Add `.github/workflows/release.yml` (tag or dispatch): version check, checks, image, zips, GitHub release
- [x] 2.2 Narrow `image.yml` to `main` and `plugin-release.yml` to pull requests

## 3. Verify and document
- [x] 3.1 Add `publicTools` to the config and `scripts/smoke-remote.mjs` (`release:smoke`); test it against the local e2e server
- [x] 3.2 Write `docs/releasing.md` (bump, tag, build, deploy, smoke, listing updates, rollback, pre-releases) and link it from the listing kit and deploying docs

## 4. First real release (Iven)
- [ ] 4.1 Release `v0.1.0`, deploy it, run the smoke check, record the result
- [ ] 4.2 Set the Claude directory to follow `v*` tags if the portal allows
