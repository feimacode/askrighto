# Proposal

## Why

The sync drops business plans at the list stage (`isResidential`), so a business customer, or a household that a business invoice would match, finds nothing, and the plans tools say "residential" throughout. Iven (20 Nov 2026): include business and small business plans, have the agent ask which the user is, and compare a business only with business plans and a household only with residential plans. This is the first step of the invoice-first work (the current plan on an invoice can be a business plan).

This **reverses a line of `add-energy-plan-data`**, which stored residential plans only.

## What Changes

- Store plans whose CDR `customerType` is `RESIDENTIAL` or `BUSINESS` (any other or missing type is still dropped). The `plans.customer_type` column already exists, so there is no migration; plans already stored stay as they are, and the next sync adds the business plans.
- Add an optional `customerType` input (`RESIDENTIAL` default, or `BUSINESS`) to `search_energy_plans` and `compare_energy_plans`; every result states which kind it covers; `get_energy_plan` shows the plan's own type. Results never mix the two.
- No typical usage (AER benchmark) for a business: `useBenchmarkUsage` with `BUSINESS` returns an input error asking for a bill or interval readings, and the no-usage error does not offer typical usage.
- Business results carry an assumption line: amounts include GST (the breakdown shows it separately), business plans are compared only with business plans, and eligibility is not checked.
- Server instructions and the energy skill: ask whether the plans are for a home or a business (including small business), never assume.

Data source: the same AER Consumer Data Right energy product reference data, same licence and refresh as `energy-plans`; the business plans come from the same endpoints. Hosts affected: Claude, ChatGPT and Gemini, through the three existing tools; one new optional input.

Out of scope:

- **Large customers:** not in the data and not compared (Iven, 20 Nov 2026: every CDR plan is for a residential or a small business customer, and large customers are totally different, with negotiated contracts). `BUSINESS` means small business; the instructions tell the agent to say so and stop for a large customer.
- Costing demand tariffs (more common for business): they stay listed as not estimated with the reason.
- The invoice-first flow, per-band shares and readings layers (separate changes).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-data`: business plans are stored with their customer type.
- `energy-plan-comparison`: plans are compared within one customer type, and a business has no typical usage.

## Impact

- Changed: `src/energy/normalise.ts` (`isSupportedCustomer`), `types.ts`, `store.ts` (customer type filter and row mapping), `sync.ts`, `renormalise.ts`, the three tools, instructions and skill, `docs/energy-data.md`.
- No migration. Plan count grows (business is roughly 15 to 30 per cent more plans, by list size against stored size for four retailers); run `sync-energy` once after deploy.
- Depends on `add-energy-plan-data` and `add-energy-plan-tools`.
