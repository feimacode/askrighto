# Ask Righto

**Everyday Aussie decisions, backed by public data.** [askrighto.feimacode.com](https://askrighto.feimacode.com)

Ask Righto lets you ask your AI assistant plain-English questions about everyday Australian
choices and get answers built from official public data, with the source and date shown. You ask
in Claude (ChatGPT and Gemini are planned); Ask Righto supplies the figures; your assistant
explains them.

> **Status: pilot.** Energy plan comparison is the first thing available. Directory listings
> (Claude first) are in progress, so it may not yet appear where you look.

## What you can ask today: electricity and gas plans

Compare residential electricity and gas plans using the rates retailers publish through the
government's Consumer Data Right (CDR) energy data. For example:

- "What energy plans are available at 3000?"
- "Compare electricity plans at 3000 on CitiPower. I used 1,000 kWh over 90 days."
- "Same, but I have solar and export 500 kWh a year."

You get a yearly cost estimate per plan, worked out from the plan's published supply and usage
rates and the usage you give it (from your latest bill, or typical household use if you have no bill), plus a link to each plan's
official rate sheet where one exists. For a more accurate comparison, especially for time-of-use plans, you can ask your electricity distributor for your smart meter readings and share a summary with your assistant. Plans are ordered by estimated cost only. There are no ads or sponsored placements.

## Coming later

Uni course choice (what your subjects rule in or out, and what last year's cut-offs were), health
cover, home loans and careers are being built and tested internally. They are not available to
the public yet.

## How to use it

Ask Righto is an [MCP](https://modelcontextprotocol.io) connector. Once listed, add **Ask Righto** from the connector directory in Claude (Settings, then Connectors). While the listing is in progress, you can add the server URL `https://askrighto.feimacode.com/mcp` as a custom connector (check it is live first). Then ask your question as you would
anyone. An optional plugin adds skills that help your assistant read an energy bill and answer
sensibly.

## What to know about accuracy

- **Every figure comes from a data lookup**, with its source and as-of date. If Ask Righto has
  no data, it says so rather than guessing. Your assistant explains the result but should not
  invent numbers.
- **Estimates, not quotes.** Costs come from published rates and the usage you provide. Real bills
  also depend on things we do not model: concessions and rebates, one-off fees, sign-up credits,
  demand tariffs and your actual meter data. Check a plan's official rate sheet before switching.
- **Discounts.** Discounts guaranteed by the plan are applied. Conditional ones (pay on time,
  direct debit) are shown separately, with their conditions, as a second ordering.
- **Time-of-use plans** need your peak, shoulder and off-peak split. Some plans cannot be
  estimated yet; Ask Righto lists these with the reason instead of skipping them silently.
- **Where it applies.** Eastern and southern states on the National Electricity Market (NSW, ACT,
  QLD, VIC, SA, TAS). WA and NT have their own regimes and are out of scope.
- **Plan data is refreshed daily** from retailers' published product data, residential only.
- **Comparison, not advice.** Ask Righto does not recommend a plan, and does not cover insurance
  or credit products that need a financial services licence.

## Install the plugin by hand

Zips for Claude, ChatGPT and Gemini CLI, and the steps to add the server in each host: [docs/install-plugin.md](docs/install-plugin.md). Submitting to the directories: [docs/listing/directory-listings.md](docs/listing/directory-listings.md).

## Privacy

See the full [privacy policy](docs/legal/privacy.md) and [terms](docs/legal/terms.md). Ask Righto has no accounts, keeps no conversations and builds no profiles. What you ask is
used to answer the question and is not stored. Server logs record only technical facts such as
which tool ran, when and for how long, never the details of your question. The only data held is public reference
data (such as published energy plans).

## Data sources

Open data only: the AER's Consumer Data Right energy plan data, and other public sources with clear reuse terms. Reuse basis for
each dataset: [docs/data-rights.md](docs/data-rights.md).

## Feedback

Found a wrong figure or a plan that should work and doesn't? Please [open an issue](https://github.com/feimacode/askrighto/issues) with the question you asked and what you saw, leaving out personal details.

## For contributors

How it fits together: [docs/architecture.md](docs/architecture.md). Running, configuring and
testing locally: [docs/development.md](docs/development.md). Working rules for people and agents:
[AGENTS.md](AGENTS.md). Plan: [ROADMAP.md](ROADMAP.md). Feature specs: [openspec/](openspec/).
