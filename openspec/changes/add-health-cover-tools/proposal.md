## Why

With product data (`add-health-cover-data`) and dated rules (`add-health-cover-rates`) in place, hosts need tools to filter policies by stated cover, show what a premium costs after the rebate, test whether hospital cover beats the Medicare levy surcharge, and estimate the Lifetime Health Cover loading. This is the factual comparison the roadmap's Phase 5 describes. It is a comparison and a calculation, not a recommendation.

## What Changes

- New vertical `health-cover`, added to `KNOWN_VERTICALS`, served only on `/mcp-internal/<token>` until promoted.
- Seven read-only tools: `search_health_cover_products`, `get_health_cover_product`, `compare_health_cover_products`, `estimate_premium_after_rebate`, `check_levy_surcharge_breakeven`, `estimate_lifetime_health_cover_loading`, `get_health_cover_rules`.
- Every result carries source, file or rules date, the CC BY attribution, a notice, and an explicit not-found; calculated figures are labelled "calculated" and say the insurer's quote governs.
- Inkview components: a policy table and a comparison, with the usual text fallback.
- Compliance wording in the vertical's instructions: factual comparison only, no recommendation, no medical advice, no commission, no purchase or switching, high-risk-category handling.

Hosts affected: Claude, ChatGPT and Gemini (internal route only at first). Tool schemas follow the strictest rules: verb-first names, flat inputs, read-only annotations.

Out of scope: skills (`add-health-cover-skills`), evaluation and promotion (`add-health-cover-evaluation`), purchase, quoting, switching, extras limits modelling beyond showing the published limits, overseas student and visitor cover, any recommendation or "best policy" ranking, health conditions as input.

## Capabilities

### New Capabilities
- `health-cover-tools`: the seven tools, inputs, outputs, limits and refusals.

### Modified Capabilities
None.

## Impact

- New `src/tools/health-tools.ts`, `src/health/vertical.ts`, `src/health/instructions.ts`, `src/health/calc.ts`; registration in `src/server/route.ts`; `health-cover` in `src/verticals.ts`.
- `list_data_sources` describes the two new datasets and their attribution on routes that serve the vertical.
- Public route unchanged.
