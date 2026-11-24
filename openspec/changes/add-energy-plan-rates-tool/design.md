## Context

`get_energy_plan` already renders one plan's rates, band hours, discounts, fees and link from the store, with GST added where the published rates exclude it (`incGst`, `fmtRate`). The new tool does the same for 2 to 5 plans at once and lines up the rows.

## Decisions

1. **A tool, not a mode.** See the proposal. The name is verb-first and says what it returns. We considered extending `get_energy_plan` with `planIds`, but its single-plan output and Inkview entity card would have to change shape, which would break existing prompts.

2. **Rows.** These rows are the same for every plan, and a missing figure is shown as "not offered" rather than left blank:
   - supply charge per day;
   - usage rates per band, with hours;
   - controlled load rate;
   - feed-in;
   - discounts (conditional ones marked with their condition);
   - fees;
   - contract length;
   - eligibility.

   Seasonal rates are shown per season. Plans with block rates show each block with its threshold.

3. **Validation.**
   - 2 to 5 distinct ids.
   - Every id must be found, or the tool refuses and lists the unknown ids.
   - All plans must share a fuel and a distributor that covers the postcode, or the tool refuses and names the mismatch.
   - A `currentPlanId` must be one of `planIds`.

4. **No totals.** The result has no cost field, and a test checks that no dollar total per year appears. It ends with one line: "These are published rates only. For a yearly cost, give usage from a bill or readings."

5. **Current plan.** If `currentPlanId` is given, that column is labelled "your current plan". Nothing else changes, and no row is marked better or worse.

6. **Inkview.** Uses `show_comparison` with each plan as an option and each row as a criterion. The recommendation field is never set, which follows the no-advice rule.

7. **Source and date.** Each plan carries its plan link (Energy Made Easy rate sheet, or the retailer page in VIC, as in `links.ts`). The result carries the `energy-plans` source link, licence and as-of date (`asOfFor`).

## Risks / Trade-offs

- A host could total the rates itself. The skill and the result's closing line say not to, and the answer-review skill flags any total not found in a tool result.
- Long rows for plans with many bands. Five plans with seasonal time-of-use rates make a wide table, so the text output lists bands per plan below the table when a plan has more than four.
