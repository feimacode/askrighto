# Releasing

One version covers the hosted server image, the Claude plugin, the ChatGPT plugin and the Gemini CLI extension. A release has two halves, as in `feimacode/open-design-agent-kit`: **build** is automatic (a tag runs `release.yml`) and **publish** is manual (deploy the image, then update the listings). A tag alone never changes what users get. Change: `add-release-process`.

## Versions

- `x.y.z` for a release, `x.y.z-beta.N` (or `-alpha.N`) for a pre-release. We stay below `1.0.0` until the first listing is live.
- Patch: fixes with the same public tools and listing. Minor: a public tool added or changed, a new skill, new listing text. Major (after 1.0): a public tool removed or its meaning changed. Removing a public tool needs Iven's go, because listed hosts may still call it.
- The version lives in `package.json` (the server reports it at `/healthz`), `package-lock.json`, `plugin/askrighto.config.json` (it flows into every manifest) and `plugin-internal/.claude-plugin/plugin.json`. Never edit them by hand; use the bump script.

## 1. Write the changelog

Add a section to `CHANGELOG.md` at the top:

```markdown
## [0.2.0]

**Listing impact:** rescan

- What changed, in words a user would understand.
```

Listing impact is `none`, `rescan` or `resubmit` (see step 4). The bump script refuses to tag without it, and the section becomes the GitHub release notes.

## 2. Bump and tag

```bash
npm run release:bump -- 0.2.0 --dry-run    # preview
npm run release:bump -- 0.2.0              # sets every version, regenerates the plugin files, commits, tags v0.2.0 locally
git push origin main --follow-tags
```

It never pushes, and commits only the version files and regenerated manifests (other local changes stay as they are). When every file already has the version, as for the first release `0.1.0`, it tags the current commit without a commit. It refuses a tag that already exists. Do this on `main` after the release pull request is merged, or bump in the pull request with `--no-git` and tag after merging.

**Where tags cannot be pushed** (a cloud session): bump with `--no-git` in the pull request, merge it, then run the **Release** workflow by hand on `main` with the version. It creates the tag and the release at `main`'s head. Tick **dry run** to check the build without pushing an image or creating a release.

## 3. Release workflow (automatic)

`.github/workflows/release.yml`:

1. **validate**: the tag equals the version in every file, the pattern is valid and the changelog section has its listing impact.
2. **build**: `typecheck`, `lint`, `test`, `guidance:check`, `plugin:check`, `release:check`, then `plugin:build` (the three zips, checked by `scripts/check-plugin-zips.mjs`). The zips are renamed `askrighto-claude-plugin-<version>.zip` etc. and summed into `SHA256SUMS`.
3. **image**: builds the `Dockerfile`, starts it with no database and checks `/healthz` reports the version, then pushes `ghcr.io/feimacode/askrighto:<version>` and, for a stable version, `:stable`. (`image.yml` still builds `:latest` and `:sha-<commit>` on every push to `main`.)
4. **release**: a GitHub release named `v<version>` with the changelog section, the zips, `SHA256SUMS` and the Gemini registration sheet. A `-beta.N` or `-alpha.N` version is a pre-release, so "latest release" links skip it.

`release:check` notes datasets awaiting a legal view without failing; those block a public listing or promotion, not a release.

## 4. Deploy and verify (manual)

```bash
# in feimacode/feima-infra
ansible-playbook playbooks/deploy-askrighto.yml -l global-au-prod -e askrighto_version=0.2.0
# from this repo, anywhere with network access
npm run release:smoke -- https://askrighto.feimacode.com 0.2.0
```

The smoke check fails unless `/healthz` reports the version and `/mcp` lists exactly the tools in `publicTools` (`plugin/askrighto.config.json`), each read-only and not destructive. A course, health or home loan tool on the public route fails it by name. Add a tool to `publicTools` in the same pull request that makes it public. Then ask one real question in one host (for example "Which electricity plans are available for a home in postcode 3000?").

The playbook's default is `latest` (the head of `main`); always pass the release version for a release.

## 5. Update the listings

By the listing impact in the changelog:

| Impact | Claude | ChatGPT | Gemini |
| --- | --- | --- | --- |
| `none` | Nothing. The directory scans each commit it follows. | Nothing. OpenAI rescans hosted servers daily. | Nothing. |
| `rescan` | The directory picks up the commit it follows and scans it. Check the listing in https://claude.ai/directory/manage. | Portal: **Rescan** the MCP server. New tools stay unavailable until approved, and held updates keep the old metadata. | Connected Console: **Sync tools**, then **Send for review**. |
| `resubmit` | As `rescan`; if fields in the form changed, edit them there. The icon cannot change after the first submission. | Portal: upload `askrighto-chatgpt-plugin-<version>.zip` to the existing plugin, fix issues, **Submit for review**, then **Publish plugin**. One review at a time. | Edit the app details in Connected Console, then **Send for review**. |

Set the Claude directory to follow `v*` tags if the portal allows it, so a merge to `main` does not reach the listing before a release.

Users who installed by hand update by uploading the new zip from the release (same name overwrites in Claude), or by `/plugin marketplace update askrighto` in Claude Code.

## Roll back

- **Server:** redeploy the previous version (`-e askrighto_version=<previous>`), then run the smoke check with that version. The listings keep the same URL, so they follow at once. Migrations are additive (see [deploying.md](deploying.md#roll-back)).
- **Plugin or listing text:** release a fixed version (`0.2.1`) and update the listings as `resubmit`. Never move or reuse a tag.
- **A tool that broke for a listed host:** roll the server back first, then fix forward.

## Pre-releases

1. `npm run release:bump -- 0.2.0-beta.1` and push the tag. The release is marked pre-release; the image gets `:0.2.0-beta.1` and no `:stable`.
2. Test the zips by hand (Claude: Customize > Plugins > Upload plugin; ChatGPT: a portal draft). There is one production instance, so test a server beta on a local or tunnel run (`docs/development.md`), not by deploying it.
3. Fix and repeat with `-beta.2`. When it passes, release `0.2.0` from the same code.

## Checklist before tagging

- [ ] The changelog section is written, with its listing impact.
- [ ] `npm run typecheck`, `lint`, `test`, `plugin:check` pass locally.
- [ ] A new public tool is in `publicTools` and in the listing kit; a new skill is in `publicSkills`.
- [ ] Listing text and docs (`docs/install-plugin.md`, `docs/listing/directory-listings.md`) match the change.
- [ ] Optional: `claude plugin validate --strict --profile directory ./plugin`.
