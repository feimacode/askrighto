# Proposal

## Why

With the plan data in place, people still have no way to use it from a chat. This change adds the tools that let someone ask "what electricity plans can I get at 3000?" and "which is cheapest for my usage?" in Claude, ChatGPT or Gemini, and get figures that are calculated from published rates, with the source, date and assumptions shown.

## What Changes

- Add `search_energy_plans`: list the plans available at a postcode, filtered by fuel, retailer, distributor, plan type and features such as solar feed-in or controlled load.
- Add `get_energy_plan`: show one plan in full: supply charge, usage rates, time-of-use periods, controlled load, solar feed-in, discounts and their conditions, fees, contract terms, eligibility and the plan link.
- Add `compare_energy_plans`: estimate the yearly cost of each plan at a postcode for the usage the person gives, and return the plans in order of estimated cost with a breakdown of each figure.
- Add a deterministic cost calculator for single-rate, block and time-of-use electricity plans, gas plans, controlled load and solar feed-in credits, with GST handled explicitly.
- Return, for each estimate, the assumptions used and anything left out, and list plans that could not be estimated with the reason instead of guessing.
- Render search and comparison results with Inkview components (table and comparison) in hosts that draw MCP Apps, with a markdown form for text-only hosts.
- Add a standard notice on every energy result: an estimate from published rates for the stated usage, not advice, and to confirm with the retailer.

Data source: the `energy-plan-data` snapshot of AER Consumer Data Right product reference data. Reuse basis: CDR Rules, rule 2.6. Refresh cadence: daily, inherited from that capability. This change adds no new data source.

Hosts affected: Claude, ChatGPT and Gemini all get the three tools. Inkview components draw in Claude and ChatGPT; Gemini is untested until preview access opens and falls back to text if it does not draw them.

Out of scope:

- Recommending a plan or saying which is "best". Results are ordered by estimated cost only.
- Switching, sign-up, referral links with tracking, commissions or any sponsored ordering.
- Demand tariffs and any plan flagged as not fully understood. They are listed as not estimated.
- Guessing usage from household size, or usage benchmarks. The person supplies usage.
- Reading a bill photo or PDF, and smart meter interval data.
- Comparison with the Default Market Offer or Victorian Default Offer reference price.
- Business plans, Western Australia and the Northern Territory.
- Concession and rebate eligibility.

## Capabilities

### New Capabilities

- `energy-plan-lookup`: finding the plans available at a location and showing one plan's published details.
- `energy-plan-comparison`: estimating what plans would cost for a stated usage and presenting them in a neutral, explained order.

### Modified Capabilities

None.

## Impact

- New code: `src/energy/tools/` (three tools), `src/energy/cost/` (calculator), `src/energy/render.ts` (Inkview and markdown output).
- New dependencies: `@feimacode/inkview-sdk` and its peer `@modelcontextprotocol/ext-apps`.
- Depends on `add-mcp-server-core` (tool wrapper, grounded results) and `add-energy-plan-data` (store, confirmed GST basis).
- Server instructions gain guidance on when to call each energy tool and what to ask the user first.
- Open legal point from the roadmap: whether energy plan comparison carries accuracy or disclosure obligations. The tools are built to be factual and commission-free, and the legal view is a gate before public listing, not before development.
