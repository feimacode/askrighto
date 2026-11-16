# Proposal

## Why

Energy is the first public vertical, and its quality depends on intake: the right postcode and distributor, usage from a real bill, the time-of-use split, solar and controlled load. The tools say what to ask, but models skip steps or assume usage. A skill can carry the whole workflow, a worked example and a "how to read your bill" reference, and load only when someone asks about power bills.

## What Changes

- Add the skill `energy-bill-comparison` to the plugin bundle from `add-host-guidance`.
- Flow: ask postcode, `search_energy_plans`; resolve multiple distributors by asking which is on the bill; ask kWh and days (gas: MJ) from a recent bill, never assume; ask the peak, shoulder and off-peak split for time-of-use; ask about solar and controlled load; call `compare_energy_plans`; present results as "lowest estimate for the usage you gave" with assumptions, discount conditions and the notice.
- Handle plans that are not estimated (for example AGL time-of-use) by saying why and linking the plan, not by guessing.
- Add references: `read-your-bill.md` (where usage, days and tariff splits sit on a bill) and a worked example with made-up inputs.
- Add activation and output tests.

Out of scope: switching, commissions, referral, gas-specific edge cases beyond the existing tools, and any new tool.

## Capabilities

### New Capabilities

- `energy-skill`: the workflow, references and tests for the energy skill.

### Modified Capabilities

None.

## Impact

- New files under `plugin/skills/energy-bill-comparison/` and `docs/skills/`.
- Depends on `add-host-guidance` and the energy tools being live.
