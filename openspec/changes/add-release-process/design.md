# Design

## Reference and what we copy

From open-design-agent-kit: one version across artefacts, a bump script that commits and tags but never pushes, a tag-driven build that validates versions first, a manual `workflow_dispatch` with a version input for sessions that cannot push tags, the changelog section as release notes, `-alpha.N` / `-beta.N` as GitHub pre-releases, and "build is automatic, publish is manual". We drop npm, VS Code and `.mcpb` publishing (we ship none) and add an image and a remote smoke check, because our product is the hosted server.

## Decisions

- **Version pattern** `x.y.z` or `x.y.z-(alpha|beta).N`, same regex as the reference. Pre-1.0 while listings are pending.
- **What a version bump means for listings.** Directories snapshot the tool list. Classify each release in the changelog: `Listing impact: none` (server-only fix, same tools), `rescan` (a tool added, removed or its schema or annotations changed: Claude rescans per commit it follows, OpenAI rescans hosted servers daily and holds new tools until approved, Gemini needs **Sync tools**), `resubmit` (listing text, skills, icon or manifest changed: upload the new ChatGPT zip, the Claude directory picks up the commit, Gemini fields edited in the console). A tool removal is a breaking change for a listing and needs Iven's go.
- **Image built in `release.yml`**, not by `image.yml` on tags: a tag created by the workflow's own token does not start other workflows, so the dispatch path would otherwise produce no image. `image.yml` keeps `main` pushes.
- **Claude directory follows tags** (`v*`) if the portal offers it, else `main`; documented, set by Iven in the portal.
- **Deploy stays manual** in feima-infra (`askrighto_version=<version>`), then the smoke script. No automated deploy: the shared VM and the database belong to feima-infra.
- **Public tool list** lives in the plugin config (`publicTools`); the smoke check fails if `/mcp` lists any other tool, so an internal vertical cannot leak through a settings slip.

## Risks

- The tag-on-dispatch path needs `contents: write`; it is limited to `main`.
- `release:check` lists datasets awaiting a legal view as notes, not failures; the release does not block on them, the listing does.
