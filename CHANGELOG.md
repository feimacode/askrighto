# Changelog

One section per release, newest first. The release notes on GitHub are this section. Every section starts with its listing impact, so whoever releases knows what to do in the directories ([docs/releasing.md](docs/releasing.md#4-update-the-listings)):

- `none`: same tools, same listing text. Nothing to do.
- `rescan`: a public tool was added, removed or changed its schema or annotations. Rescan or sync tools in each directory.
- `resubmit`: listing text, skills, icon or manifest changed. Upload the new ChatGPT zip and update the other listings.

## [0.1.0]

**Listing impact:** resubmit (first listing)

- First release of the hosted server at `askrighto.feimacode.com/mcp`: Australian electricity and gas plans from public retailer data (search, plan details, cost comparison from a bill, interval readings or typical usage, current-plan lookup), each figure with its source and as-of date.
- Plugin packages for Claude, ChatGPT and the Gemini CLI with six energy skills, the listing metadata, icon, privacy policy and terms.
- Courses, health cover and home loans stay on the internal route and are not in any package.
