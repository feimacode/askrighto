# Proposal

## Why

Ask Righto ships four things that must move together: the server image, the Claude plugin, the ChatGPT plugin and the Gemini extension. Today the version is `0.1.0` in three files by hand, there is no changelog, tags only build an image, the plugin zips are attached by a separate workflow, and nothing says when a directory listing must be updated or how to roll back. Iven (26 Nov 2026) asked for a release process, using `feimacode/open-design-agent-kit` (`docs/contributing/releasing.md`, `scripts/bump-version.mjs`, `release.yml`) as the reference.

Hosts affected: Claude, ChatGPT, Gemini (listings follow releases).

## What Changes

- **One version** for the server, the plugin config, the generated manifests and the internal plugin. `npm run release:bump -- <x.y.z|x.y.z-beta.N> [--dry-run]` sets it everywhere, regenerates the plugin files, checks `CHANGELOG.md` has the section, commits and tags locally, and never pushes.
- **`CHANGELOG.md`** with one section per version, including a "Listing impact" line (none, rescan, resubmit).
- **Release workflow** (`release.yml`) on a `v*` tag, or by hand with a version input where tags cannot be pushed: checks the tag matches every version, runs the checks (typecheck, lint, test, guidance, plugin, release:check), builds and smoke-tests the image `ghcr.io/feimacode/askrighto:<version>`, builds and checks the plugin zips, and creates the GitHub release (pre-release for `-beta.N`) with the zips, `SHA256SUMS` and the changelog section. `image.yml` keeps `main` builds only. `plugin-release.yml` keeps the pull-request check only.
- **Deploy and verify** stay manual: pin the version in feima-infra and run the playbook, then `npm run release:smoke -- https://askrighto.feimacode.com <version>` checks `/healthz` reports the version and `/mcp` lists only the public tools, each annotated read-only.
- **Listing updates** by change type: patch (no tool or listing change) needs nothing; tool or schema change needs a rescan in each directory; listing text, skills or icon change needs a new zip upload or resubmission.
- **Rollback**: redeploy the previous image tag; the listings keep the same URL. A bad plugin version is replaced by releasing a fixed version, never by moving a tag.
- `docs/releasing.md` holds the process; the listing kit links to it.

Out of scope: vertical promotion (stays in `docs/promotion-checklist.md`), npm publishing (we publish no package), automated deploys, a staging instance.

## Capabilities

### New Capabilities
- `release-process`: version bump, release build, smoke check, listing-impact rules.

### Modified Capabilities
- `plugin-listing` (from `add-plugin-listing-readiness`): zips are attached by the release workflow.

## Impact

New `scripts/bump-version.mjs`, `scripts/smoke-remote.mjs`, `.github/workflows/release.yml`, `CHANGELOG.md`, `docs/releasing.md`; edits to `image.yml`, `plugin-release.yml`, `package.json`, `plugin/askrighto.config.json`, tests.
