## Context

Stored plan ids carry a source suffix: `@EME` for plans from the national CDR retail data and `@VEC` for Victorian plans from Victorian Energy Compare, for example `ENG1112028MRE1@EME` and `COV763326SR@VEC`. Iven's example offer id has no suffix (`ENG1207222MRE`). The CDR records hold no plan link, and the Register brand record has no website we can read without a certificate.

## Decisions

1. **Build, don't store.** The link is computed when a result is formed from `planId`, the person's postcode and the brand, so a rule change needs no data reload. `plan_url` keeps whatever the retailer published.
2. **EME rule.** For a plan whose id ends in `@EME`, offerId is the id with the suffix removed. The postcode must be one the person gave; if there is none (for example `get_energy_plan` without a postcode), the link omits nothing silently: the tool asks for the postcode or shows the EME search page for the retailer instead. Task 1.2 confirms on real offers that the page opens, and confirms how an offer id with a trailing version digit behaves (`ENG1112028MRE1` versus the example `ENG1207222MRE`).
3. **Victoria.** `@VEC` plans get the brand's website only, labelled "Retailer website", with the sentence that the plan's rate sheet is found there. No other link is offered.
4. **Website map.** `retailers.json` gains `website` and `websiteCheckedAt`. A brand with no checked website gets no link, not a guess. A test fails if an active brand has none.
5. **Wording.** Links are never called "the plan page" unless it is the EME page for that offer. Output notice: links go to official or retailer pages we do not read or store; check the rate sheet there.
6. **Rights.** No new dataset. `docs/data-rights.md` gets a line that EME and retailer links are links only.

## Risks / Trade-offs

- The EME URL pattern is not a published API and may change. A pre-ship check and a one-off test on a sample of offers guard it; the label does not promise more than "Energy Made Easy page".
- Postcode on the link is the person's postcode, not necessarily one the plan covers; the plan list already limits plans to that postcode.
- A retailer website can move; `websiteCheckedAt` shows its age.

## Open Questions

- Does EME accept offer ids with and without the trailing digit, and do gas offers use the same pattern?
- Is every non-Victorian plan id `@EME`? Task 1.2 counts suffixes across the stored plans.
