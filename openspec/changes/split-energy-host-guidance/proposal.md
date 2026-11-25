# Proposal

## Why

The energy guidance is written three times over, and it's too long in each place. As of 24 Nov 2026:

- The energy server instructions (`src/energy/instructions.ts`) are about 8 KB.
- The energy tool descriptions run from 371 to 1,675 characters. `summarise_interval_readings` is 1,675, `get_readings_upload_link` 922, `compare_energy_plans` 824 and `list_current_plan_options` 742.
- The plugin skill `energy-bill-comparison` is 9.7 KB.

The readings recipe, invoice-first steps and typical-usage rules appear in more than one of these. Every host pays for the server instructions and descriptions on every turn, whether or not the user is talking about energy.

Iven (24 Nov 2026): "solo MCP is too limited; plugins look a more reasonable option". So the guidance becomes plugin-first. Skills drive the multi-step workflows, loaded only when a journey starts. The bare server stays safe for hosts without the plugin: Gemini Connected Apps (no skill bundle as of the 16 Nov plan, to recheck), and anyone who adds only the connector in the Claude or ChatGPT directories.

## What Changes

Each channel gets one job, with no text in two places.

- **Tool descriptions: the contract only.** What the tool returns, what each input means, and what must come first (for example "needs a plan id from list_current_plan_options"). Each is at most 500 characters, with no workflow steps.
- **Server instructions: the core rules only.**
  - Figures come only from tool results, with source and date.
  - Never assume customer type, usage or household size.
  - No name, address, account number or NMI in any tool.
  - Neutral wording, not advice.
  - For energy, ask home or business, then ask for the latest invoice.

  The energy part is at most 1.5 KB, about 2 KB with the shared rules.
- **Tool results steer the next step.** Every `needs_input` message already says what to ask. Each success result also gains a short `nextSteps` list when there's a better level to reach. For example, a single-bill result offers the readings route, and a rates result says usage gives a yearly cost. This is the one channel every host reads, at the moment it matters.
- **Fine-grained skills** (plugin, Claude and ChatGPT) replace the single `energy-bill-comparison` skill:
  - `energy-start`: home or business, postcode, distributor, fuel, and which journey applies;
  - `energy-current-plan`: read the invoice, confirm fields, pick the current plan;
  - `energy-readings`: summarise, the upload link, and the NEM12 fallback recipe;
  - `energy-compare`: choose the usage source, call compare, explain the levels, the baseline and the tables;
  - `energy-plan-rates`: named plans with no usage, and a business with no usage.

  Each is loaded only when its journey begins.
- **`get_energy_guide` tool** for hosts without the plugin. It takes `journey` (one of the five above) and returns that skill's steps as text. One source file per journey, under `src/guidance/energy/`, generates both the skill body and this tool's output. The existing `guidance:check` fails on drift.
- **Budget tests** fail the build when a description or the server instructions exceed their limits.

Data source: none. This is guidance only, and the server's data and licences are unchanged.

Hosts affected:

- Claude and ChatGPT with the plugin get the skills.
- Claude and ChatGPT connector-only installs, and Gemini, get the short instructions, result guidance and `get_energy_guide`.

Out of scope:

- Directory listing.
- Plugin packaging for ChatGPT upload (covered by `add-host-guidance`).
- Course, health and home loan guidance. The same split can follow once energy proves it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-bundle`: shared guidance has one source per journey, served both as a plugin skill and through `get_energy_guide`, with size budgets on descriptions and instructions.
- `energy-skill`: the single energy skill is split into five journey skills.

## Impact

- New: `src/guidance/energy/*.md` (five journeys), `src/tools/get-energy-guide.ts`, five `plugin/skills/energy-*/SKILL.md`, and budget tests.
- Changed: every energy tool description, `src/energy/instructions.ts`, `scripts` behind `guidance:check`, `docs/areas/skills-and-plugins.md`, `docs/skills/activation-prompts.md`, and `docs/energy-evaluation/journeys.md`.
- Removed: `plugin/skills/energy-bill-comparison/`, whose content moves into the journey skills.
- Depends on `restructure-energy-compare-usage`, `add-energy-current-plan-baseline` and `add-energy-plan-rates-tool`, so the guidance is written once against the final schemas.
