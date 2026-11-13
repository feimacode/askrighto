# Ask Righto

Ask Righto (askrighto.com.au) answers everyday Australian "local life" questions, such as
which uni course fits a student's subjects or which health cover suits a family, using
public data. It ships as one hosted remote MCP server, listed in the Claude directory
(connector plus plugin bundle), the ChatGPT plugin directory, and Gemini Connected Apps.

See `ROADMAP.md` for the phased plan and where each item came from.

## Non-negotiable rules

1. **Every fact traces to a data lookup.** Tools return the figure, its source URL and its
   as-of date, or an explicit not-found. The host model narrates; it never invents a number.
2. **Open data only.** CC BY, Consumer Data Right product data, or written permission.
   No purchased data and no scraping of sites whose terms forbid it. Course facts are written
   in our own words with a link to the official page.
3. **Stateless for users.** No accounts, no stored conversations, no user profiles. The only database content is public reference data (energy plans first) in the shared Azure PostgreSQL, under its own `askrighto` schema, and it must be rebuildable from the source.
4. **No ads or sponsored placement** inside any host app.
5. **Factual comparison, not advice.** General insurance and credit products stay out until
   there is a legal view or a licensed partner.

## Spec-driven development (OpenSpec)

Feature work goes through [OpenSpec](https://github.com/Fission-AI/OpenSpec):

- `openspec/config.yaml` holds the project context every proposal is checked against.
- Start a feature with `/openspec-propose "<idea>"` (or `/openspec-explore` to think first).
  This creates `openspec/changes/<change-id>/` with proposal, design, specs and tasks.
- Implement with `/openspec-apply-change`, working from `tasks.md`; don't improvise scope.
- Finish with `/openspec-archive-change`, which merges the delta specs into `openspec/specs/`.
- Roadmap items in `ROADMAP.md` name their suggested change id.

## Reference material

The repos `ivenxu/vce-subject-planner`, `ivenxu/vce-parents-helper` and
`ivenxu/vce-subject-planner-ideas` are a previous, unpublished pilot. Port code from them
(the recommendation engine and tool schemas in particular), but do not depend on them,
and do not ship their scraped VTAC, UAC or QTAC CSVs.

## Data store

PostgreSQL (shared Azure instance), `DATABASE_URL` plus `DATABASE_SCHEMA=askrighto`, small connection pool, versioned SQL migrations. `feimacode/feima-api` (Python) is the reference for these conventions; do not copy its code. Credentials are secrets and never go in the repo or the image.

## Conventions

- Commit messages say why, not only what. If a commit reverses a roadmap decision, say so.
- Confirm before destructive actions.
