# Proposal

## Why

A household with a pensioner, health care or DVA card gets a state government energy concession that can take hundreds of dollars a year off its bill, and traditional comparators ask about it up front. Ask Righto never asks, so a concession holder sees costs that are higher than what they would pay. The CDR plan data cannot fix this: it has no concession field, because concessions are paid by state governments through the retailer, not set by the plan.

## What Changes

- New reference dataset of state energy concessions for the states the energy data covers (NSW, QLD, SA, TAS, VIC, ACT): for each concession, who is eligible (card types, in plain terms), the fuel it applies to, how it is worked out (fixed yearly amount, daily amount, or percentage of the bill with any limits), the official page link and the date it was checked. Hand-keyed in our own words from official state government pages, with only the rules the official page states.
- `compare_energy_plans` takes an optional `concessionCard` answer (`yes`, `no`, `not_said`) and, when `yes` and the state's rule is held, adds the concession estimate per plan as a separate "after concession" figure with its source link. The ordering stays on the cost before concession.
- When the rule for the state is not held, or the user's eligibility depends on details the tool does not ask (for example a medical cooling concession), the result gives the official link and says the concession was not estimated.
- Host guidance (server instructions and the `energy-bill-comparison` skill) asks once whether anyone in the household holds a concession card, never asks which card or its number, and stores nothing.

Hosts affected: Claude, ChatGPT and Gemini all receive the new input and result fields; the skill change reaches Claude and ChatGPT through the plugin.

Data source: state government concession pages (for example Victoria's Department of Families, Fairness and Housing, services.dffh.vic.gov.au). Licence: each page's copyright notice is checked before its state ships; most state government sites publish under CC BY 4.0, which must be confirmed per state. Refresh: checked at least each 1 July (concession amounts change with the financial year) and when a state announces a change.

Out of scope: the Seniors Card and other plan-level eligibility filters (shown as restrictions, as now); one-off federal or state bill relief payments; medical, life support and excess-usage concessions beyond a link; checking that the user is actually eligible; storing the answer.

## Capabilities

### New Capabilities
- `energy-concessions`: the state energy concession rules, their source and as-of date, and how a concession estimate is worked out for a yearly cost.

### Modified Capabilities
- `energy-plan-comparison`: optional concession input and an "after concession" figure that does not change the ordering. (Its requirements are still in the unarchived `add-energy-plan-tools` change, so this delta only adds requirements.)

## Impact

- New: `data/energy-concessions.json` (or a migration-loaded table, see design), `src/energy/concessions.ts`, tests.
- Changed: `src/tools/compare-energy-plans.ts` (input, result fields, text table, Inkview column), `src/energy/instructions.ts`, `plugin/skills/energy-bill-comparison/`, `docs/energy-estimates.md`, `docs/areas/energy-plans.md`.
- No change to the CDR sync or the plans table.
