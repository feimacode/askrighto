# Changelog

One section per release, newest first. The release notes on GitHub are this section. Every section starts with its listing impact, so whoever releases knows what to do in the directories ([docs/releasing.md](docs/releasing.md#4-update-the-listings)):

- `none`: same tools, same listing text. Nothing to do.
- `rescan`: a public tool was added, removed or changed its schema or annotations. Rescan or sync tools in each directory.
- `resubmit`: listing text, skills, icon or manifest changed. Upload the new ChatGPT zip and update the other listings.

## [0.2.0-beta.1]

**Listing impact:** none (pre-release; the public energy tools and skills are unchanged)

- Internal only: domestic courses and home loans are now index-only (no source data stored); added the pass-through CDR home loan proxy (`list_home_loan_lenders`, `get_home_loan_products`) on the internal route; home loan evals and a weekly live smoke check.
- Internal only: dropped the retired VCE admissions load commands from CI.

## [0.1.1]

**Listing impact:** none (not yet listed; the ChatGPT zip changes)

- Fix: the ChatGPT zip now brings the Ask Righto server with it. Its `mcp.json` no longer carries an `extensions.com.openai.auth` block; with that block ChatGPT desktop installed the six skills but not the server, so the tools were missing.
- Fix: `release:bump` tags without a commit when every file already has the version, commits only the version files, and refuses an existing tag.
- Docs: where each ChatGPT install route works (uploaded zip: desktop app only; custom MCP server: web).

## [0.1.0]

**Listing impact:** resubmit (first listing)

- First release of the hosted server at `askrighto.feimacode.com/mcp`: Australian electricity and gas plans from public retailer data (search, plan details, cost comparison from a bill, interval readings or typical usage, current-plan lookup), each figure with its source and as-of date.
- Plugin packages for Claude, ChatGPT and the Gemini CLI with six energy skills, the listing metadata, icon, privacy policy and terms.
- Courses, health cover and home loans stay on the internal route and are not in any package.
