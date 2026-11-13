# Design

## Context

`add-mcp-server-core` supplies `defineTool`, the `Grounded<T>` envelope and the flat-schema rule. `add-energy-plan-data` supplies a PostgreSQL-backed store of normalised residential plans with integer money, a per-contract `gstBasis`, an `understood` flag and per-plan `sourceLastUpdated` and `planUrl`. Inkview's SDK (`registerInkview`, `inkview.table`, `inkview.comparison`) draws results in MCP Apps hosts and returns markdown for the rest; its provenance fields are `source.name`, `source.url` and `retrievedAt`. See proposal.md for motivation and the two specs for behaviour.

## Goals / Non-Goals

**Goals:**

- Three tools a host model can chain: search, then detail or compare.
- A cost calculator that is a pure function of (plan, usage), easy to test against hand-worked examples.
- Output where every dollar figure can be traced to published rates and stated assumptions.

**Non-Goals:**

- Modelling a household's real load shape, seasons or tariff reassignment.
- Any ranking signal other than estimated cost.
- Custom UI. Only stock Inkview components are used.

## Decisions

**1. Three tools with flat inputs.**

| Tool | Inputs (all scalars or scalar lists) |
| --- | --- |
| `search_energy_plans` | `postcode`, `fuelType?`, `retailer?`, `distributor?`, `planType?`, `hasSolarFeedIn?`, `hasControlledLoad?`, `limit?` (default 20, max 50), `cursor?` |
| `get_energy_plan` | `planId` |
| `compare_energy_plans` | `postcode`, `fuelType`, `annualUsageKwh?` or `billUsageKwh?` + `billDays?`, `peakSharePct?`, `shoulderSharePct?`, `offPeakSharePct?`, `controlledLoadAnnualKwh?`, `solarExportAnnualKwh?`, `distributor?`, `retailer?`, `planType?`, `planIds?`, `limit?` (default 10, max 25) |

Gas usage is given in MJ through `annualUsageMj` or `billUsageMj`. All tools are `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`, since they read only our snapshot. Alternative: one `energy` tool with a `mode` argument. Rejected: OpenAI's guidelines ask for atomic, verb-first tools, and separate tools give hosts clearer selection.

**2. The calculator is a pure function, `estimateAnnualCost(plan, usage) → Estimate | NotEstimated`.**

```
supply      = Σ over tariff periods (dailySupplyCharge × days in period)
usage       = Σ over tariff periods (rate blocks applied to that period's share of usage)
controlled  = controlled load kWh × controlled load rate + its supply charge
feedIn      = − export kWh × feed-in rate            (shown separately, GST-free)
discounts   = unconditional percent or fixed discounts on the base they name
fees        = recurring fees only (annual, monthly membership)
gst         = 10% of taxable components when gstBasis is EXCLUSIVE
total       = sum of the above
```

Yearly usage is spread evenly by day. Block thresholds are applied per the block's stated period (day, month, quarter, year) on that even daily usage. Seasonal tariff periods get usage in proportion to their days. All arithmetic uses the store's integer money and rounds once, at the end, to cents. Alternative: simulate half-hourly load from a standard profile. Rejected: no open, licensed load profile has been checked, and it would add invented data.

**3. Time-of-use needs explicit shares.** With `peakSharePct`, `shoulderSharePct` and `offPeakSharePct` the calculator maps shares onto each plan's rate types; a plan with no shoulder rate gets the shoulder share added to peak, and this is stated in the assumptions. Without shares, time-of-use plans go to the not-estimated list with reason `needs_time_of_use_split`. Alternative: assume a typical split. Rejected: that is a free-generated fact. The host model can ask the user or the user can read the split from their bill.

**4. Not-estimated reasons are an enum:** `demand_tariff`, `needs_time_of_use_split`, `not_fully_understood`, `no_controlled_load_rate`, `gst_basis_unknown`, `missing_rate`. A plan with `gstBasis: UNKNOWN` is never costed, which makes the GST check in the data change a hard gate.

**5. Ordering uses the cost without conditional discounts.** A discount is conditional when its type is pay on time, direct debit, e-billing or otherwise depends on behaviour; guaranteed discounts are applied. Each estimate also carries `totalIfConditionsMet`. Alternative: order by the best-case cost. Rejected: it flatters plans whose headline depends on behaviour, which is the practice regulators have criticised in comparison sites.

**6. Postcode with several distributors.** `search_energy_plans` groups by distributor. `compare_energy_plans` returns `found: false` with reason `needs_distributor` and the list, because network tariffs differ and a mixed ranking would mislead.

**7. Retailer matching is by normalised brand name** (case and punctuation removed, then prefix or edit distance of at most two). The matched brand is always echoed. More than one equally close match returns the candidates instead of choosing.

**8. Output through Inkview with source attached.** Search uses `inkview.table` (columns: retailer, plan, tariff type, plan type, distributor, updated). Comparison uses `inkview.table` with money columns (estimated yearly cost, supply, usage, feed-in credit, cost if conditions met) and a link column to the plan; a comparison of at most five named plans uses `inkview.comparison`. Each call passes `source: { name, url, retrievedAt }` from the grounded envelope, so the provenance strip shows the AER source and snapshot time. Plan detail is markdown plus an `inkview.entityCard` with the plan link. Text-only hosts get the SDK's markdown plus our assumptions and source footer. Alternative: build our own widget. Rejected: Iven asked for Inkview as the UI layer, and it already carries provenance.

**9. Standard notice and wording live in one module.** The notice text, the "lowest estimate for the usage you gave" phrasing and the list of omissions are constants, tested for presence in every energy result, so later edits cannot drop them.

**10. Server instructions for hosts.** Add: search first when the user has not named plans; ask for kWh and days from a recent bill before comparing; ask which distributor is on the bill when told there are several; never state a price that is not in a tool result; say "lowest estimate", not "best".

**11. Data outages surface as a clear answer.** When the store reports `data_unavailable`, every energy tool returns it unchanged as `found: false` with the plain message that energy data is temporarily unavailable, and the host is told not to estimate from memory.

## Risks / Trade-offs

- [Even-spread usage misstates block and seasonal plans for real households] → State the assumption on every result and show the breakdown; keep interval data out of scope.
- [Many plans are time-of-use, so users without a split see fewer estimates] → Report counts by reason and tell the host exactly what to ask for.
- [A calculation error would be a wrong price shown with an official-looking source] → Hand-worked golden cases for each pricing model, a property test that components sum to the total, and three fixture plans checked against the retailer's own published estimate where one exists.
- [Energy comparison may carry disclosure or accuracy obligations] → Neutral ordering, no commissions, the standard notice, and a legal view before public listing (roadmap Phase 0).
- [Inkview SDK is young and its API may shift] → Wrap it in one render module and pin the version.
- [Host models may add their own advice on top] → Instructions and result wording steer away from "best"; listing review test cases will include a prompt asking "which should I pick?".

## Open Questions

- Whether Gemini draws Inkview components. It affects only presentation, since the markdown form is always present.
