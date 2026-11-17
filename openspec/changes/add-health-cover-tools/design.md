## Context

The cost question has three parts the person cannot easily combine: the product's premium (from the PHIO file), the rebate (income tier and age, from the rules) and the surcharge or loading (income and history, from the rules). Energy sets the pattern: a pure calculator that returns `NotEstimated` with a reason rather than a guess, wrapped by `defineTool` so the envelope cannot omit source or date.

## Decisions

1. **Seven tools, no ranking engine.** Search is a filter; ordering is a user-chosen sort (premium, excess), never "best". Same rule as the international finder.
2. **`search_health_cover_products`** inputs (all flat): `state`, `household` (single, couple, family, single_parent), `cover_type` (hospital, general_treatment, combined), `hospital_tier` (the file's own tier codes, listed by the tool), `required_categories` (clinical category names the person wants covered, never conditions), `max_excess`, `max_monthly_premium`, `insurer`, `sort` (premium_asc, excess_asc), `limit`. Returns up to 20 products with insurer, product name, tier, excess, premium as published, the categories that are `covered`, `restricted` or `not covered` for the requested ones, and the count of matches. Reports how many matches had no published premium.
3. **`get_health_cover_product`** returns every stored field for one product variant: premiums, excess, all clinical categories with their cover state, general treatment services and limits, waiting periods, hospital agreement flag, the PHIS link if the file carries one.
4. **`compare_health_cover_products`** 2 to 4 variants side by side on stored fields, through Inkview comparison. Differences are shown, not judged.
5. **`estimate_premium_after_rebate`** inputs: a product variant, `income_tier` or `income` and `household` (used for this call only), `age_band`, `as_at` date. Output: published premium, rebate percentage from the rules, the calculated premium after rebate (cents rounded once) and the rules' source and dates. If the file already publishes a premium after a stated tier, that figure is shown as published and the tool does not recalculate it. If the file's rebate basis, the product's eligibility or the rules are unclear, it returns `NotEstimated` with a reason.
6. **`check_levy_surcharge_breakeven`** inputs: `income_for_mls` (a number the person gives, not stored or logged), `household`, `children`, product variant or `premium`. Output: the surcharge for that income in that tier (rate times income), the premium after rebate of the chosen cover, and which is lower, with the difference. It states the excess-limit condition and its source and says the ATO's own calculator governs. It never says "you should buy" or "you should not".
7. **`estimate_lifetime_health_cover_loading`** inputs: `age_at_first_hospital_cover` and `years_of_continuous_cover`. Output: percent loading by the stored parameters. Cases the ATO page says change the base day return `NotEstimated` with a link. The loading applies to the hospital component of the premium; where the file cannot split a combined premium, the tool shows the percent only and does not multiply.
8. **`get_health_cover_rules`** returns the rebate, MLS and LHC tables in force on a date, their status, effective dates and sources, and any proposed change flagged as proposed and not law.
9. **Intake is ephemeral.** Income, age and household are request arguments only. They are not logged (the access log holds tool name only), not stored and not echoed beyond the result. No tool accepts a name, date of birth, member number, address or medical condition.
10. **Result wording.** Fixed phrases: "lowest premium among the products matching your filters" (never "best"); "calculated, using ATO rates effective <date>; your insurer's quote governs"; "confirm price and cover with the insurer before acting". Banned words list extended with "best", "right for you", "should", "recommend", "cheapest overall", "save" as a promise, "worth it".
11. **Not-found outcomes** reuse the envelope reasons: `not_in_dataset`, `no_data_loaded`, `data_unavailable`, `needs_input`, plus calculator reasons `rules_out_of_range`, `rebate_basis_unclear`, `cannot_split_hospital_component`, `base_day_unclear`.
12. **Counters.** Existing metadata-only counters per tool and route; outcome labels only. A calculation cannot be reconstructed from the counters.
13. **Vertical.** `health-cover`, added to `KNOWN_VERTICALS`, absent from `ASKRIGHTO_PUBLIC_VERTICALS` until promotion. Its instructions text states: facts and calculations only, never advice; no commission or referral; high-risk insurance category handling; do not ask for medical conditions.
14. **Regulatory fence.** Health cover is excluded from the financial product definition (Corporations Act s765A(1)(c); desk reading, legal view pending), so the AFSL concern behind AGENTS.md rule 5 is narrower here, but the tool still stays on factual comparison. Rule 5 itself is unchanged and general insurance remains out. A one-line note in `AGENTS.md` clarifying that rule 5's example list covers general insurance, not health cover, is deferred until the legal view confirms it.

## Risks / Trade-offs

- A premium after rebate that differs from the insurer's by a few cents or by how the insurer applies the rebate (reduced premium versus tax return). Mitigated by labelling and by preferring published figures.
- Showing "which is lower" on the MLS test may read as advice. Mitigated by showing both figures and the conditions, and by banning directive wording; the legal view reviews the wording before promotion.
- Large product tables: the search runs over an in-memory snapshot cached for five minutes as the course tools do; the variant count (tens of thousands of rows) is checked in task 1.3.
- Hosts may combine a tool result with their own medical commentary. The skills change and the answer-review prompts cover that.

## Open Questions

- Should `search_health_cover_products` accept an `insurer` exclusion list, or is that a preference that edges toward recommendation?
- Hospital-only, extras-only and combined launch scope: extras limits vary widely; start with hospital and combined, show extras limits as published, model none.
- Does the file's household type cover single parent families, which the rebate and MLS treat as families?

## Implementation notes (17 Nov 2026)

- Calculator reasons (`rules_out_of_range`, `rebate_basis_unclear`, `base_day_unclear`, `needs_input`) cannot be envelope reasons, which are a closed list. They travel as `details.calcReason` on an `outside_coverage` or `needs_input` not-found.
- Where the in-force rates end (31 March 2027) and a change is only proposed, the tool answers `rules_out_of_range`, names the proposed change as not law and shows no figure, rather than reusing the old rate for a later date.
- The surcharge exemption excess limit is not stored because it was not confirmed on the ATO page; results point to the ATO.
- Source names are kept under 80 characters because Inkview rejects longer ones.
