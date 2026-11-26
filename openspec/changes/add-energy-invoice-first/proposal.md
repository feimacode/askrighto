# Proposal

## Why

A recent invoice is the best single thing a person can give: it carries the usage, the current plan, the rates, the network and the split between bands. In the first live test (19 Nov 2026) the agent did not ask for the invoice; it summed the household's readings itself and applied one made-up peak window to every plan. A bill split is also easy to misuse: it describes use against **the current plan's own hours**, which differ between plans (in the 17 Nov 2026 data there are **228 distinct band-hour layouts** across 6,501 time-of-use plans, and the most common covers only 14 per cent of them).

Iven (19 to 20 Nov 2026) decided: ask for the invoice up front, even when the user has a readings file; do not match the current plan by name but show the user a short list to pick from, and fall back to band hours only; ask the user which customer type applies (residential or small business; large customers are not in the data); and a household that is moving house has no readings or invoice for the new place.

## What Changes

- **Instructions** (server instructions, tool descriptions, energy skill): ask for the latest invoice before anything else; read these fields from it and show them to the user to confirm: retailer and plan name, usage kWh and days, kWh in each band, the rates and daily supply charge, solar export, the network. Never put the name, address, account number or NMI into any tool. Ask the user to pick the customer type; do not infer it.
- **Moving house or moving in:** skip the invoice and readings questions; ask the household size and use typical usage (labelled); for a small business moving in, ask for an estimate of use from the user.
- **New tool `list_current_plan_options`** (flat inputs: postcode, fuel, customer type, retailer, optional network and optional invoice hints: supply charge, rates, whether the rates include GST): returns a short pick list of distinct options for that retailer and network (plans with identical rates and hours merged), each in plain words with its rates and band hours. The agent shows it and the user picks one or "none of these".
- **Fallback by hours only:** when the plan is not in the data or the user cannot pick, the same tool returns the band-hour layouts that retailer uses on that network (a median of 2, at most 9, in the 17 Nov data) to pick from, or the user states the hours.
- **`compare_energy_plans` takes the chosen plan** (`currentPlanId`, or `hoursLayoutId` from the fallback). A bill split is then applied **exactly** to plans with the same band hours as the current plan and labelled **approximate** for the rest, instead of being applied to every plan alike. With readings, nothing changes: readings fit every plan exactly.
- Readings still come first in accuracy; the order of asking is invoice, then readings.

Data source: the same AER Consumer Data Right plan data, same licence (CDR rule 2.6) and refresh as `energy-plans`; every option and layout carries the data's source link and as-of date. The user's invoice is read by the host and never sent to us: only the fields above reach a tool. Hosts affected: Claude, ChatGPT and Gemini; one new tool and two optional inputs on `compare_energy_plans`.

Out of scope:

- Reading the invoice ourselves (a file or photo), storing any invoice field, or any tool that takes a name, address, account number or NMI.
- Checking our estimate against the invoice amount (decided: the estimate is annual and the invoice is monthly).
- Concessions, discounts shown on the invoice, solar tariffs beyond what the plan data already costs, controlled load and demand charges.
- Large customers (not in the data).

## Capabilities

### New Capabilities

- `energy-current-plan-match`: a short pick list of the retailer's plans, or of its band-hour layouts, for the user's network.

### Modified Capabilities

- `energy-plan-comparison`: a bill split is applied exactly to plans with the same hours as the current plan and labelled approximate for the others.

## Impact

- New: `src/tools/list-current-plan-options.ts`, `src/energy/layouts.ts` (band-hour layouts and their ids), tests, evals, `docs/energy-invoice.md`.
- Changed: `src/tools/compare-energy-plans.ts`, `src/energy/calc.ts` (a per-estimate note), server instructions, the energy skill, `docs/energy-estimates.md`.
- No migration. Depends on `add-energy-business-plans` (merged) and `add-energy-per-band-shares` (so plans with several shoulder bands work).
