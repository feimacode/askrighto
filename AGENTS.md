# Ask Righto

Ask Righto (askrighto.com.au) answers everyday Australian "local life" questions, such as
which uni course fits a student's subjects or which health cover suits a family, using
public data. It ships as one hosted remote MCP server, listed in the Claude directory
(connector plus plugin bundle), the ChatGPT plugin directory, and Gemini Connected Apps.

See `ROADMAP.md` for the phased plan and where each item came from.

## Non-negotiable rules

1. **Every fact traces to a data lookup or an official page.** Tools return the figure, its
   source URL and its as-of date, or an explicit not-found. The host model narrates; it never
   invents a number. One other source is allowed: where our tools hold no checked facts (for
   example an index-only course), they may hand the host official links and a reading checklist,
   and the user's own browsing assistant may read the official page on the user's behalf. Such
   facts must be quoted with the page link and the time read, labelled as read by the assistant
   rather than from Ask Righto's data, and never sent back to, stored by or republished by our
   server. The assistant never gets past a bot check. (Iven, 16 Nov 2026.)
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

CDR payload shapes (energy plans now, banking products later) come from the Data Standards
Body's JSON schemas in `ConsumerDataStandardsAustralia/dsb-schema-tools`, one folder per
standards version. See `docs/cdr-schemas.md` for how to read them and what they settle.

## Data store

PostgreSQL (shared Azure instance), `DATABASE_URL` plus `DATABASE_SCHEMA=askrighto`, small connection pool, versioned SQL migrations. `feimacode/feima-api` (Python) is the reference for these conventions; do not copy its code. Credentials are secrets and never go in the repo or the image.

## Conventions

- Commit messages say why, not only what. If a commit reverses a roadmap decision, say so.
- Confirm before destructive actions.
