# Tasks

## 1. Evidence first

- [ ] 1.1 (NOT DONE in the implementing session: no Claude or ChatGPT session with the plugin there) On the WSL, run `docs/skills/activation-prompts.md` for the current plugin in Claude (and ChatGPT if the plugin can be loaded) and record whether the energy skill loads
- [ ] 1.2 (NOT DONE: the implementing session had no check of the live Gemini page) Check whether Gemini Connected Apps accepts skills or an instruction bundle today, and record the answer with the page link and date
- [ ] 1.3 (NOT DONE: no model keys) Run the energy eval set on the current guidance and keep the report as the baseline

## 2. Build

- [x] 2.1 Write the five journey sources in `src/guidance/energy/` from the current instructions and skill, against the schemas of the three earlier changes. Every rule appears once
- [x] 2.2 Generate the five skills and extend `guidance:check` to them. Remove `energy-bill-comparison`
- [x] 2.3 Add `get_energy_guide` (journey enum, read-only) serving the same sources. Tests check it matches the skill bodies
- [x] 2.4 Cut every energy tool description to the contract (at most 500 characters) and the energy instructions to the core rules (at most 1.5 KB). Add the budget tests
  - Instructions are about 1.1 KB. The profile-by-hand layout ("Fallback B") was in `summarise_interval_readings`'s description and is no longer in any guidance: the journey teaches the `assistant_readings` fallback only. The server still accepts a hand-built profile and labels it not verified; the layout stays in `docs/energy-readings-recipe.md`.
- [x] 2.5 Add `nextSteps` to compare and rates results. Tests cover each usage level
- [x] 2.6 Update `docs/areas/skills-and-plugins.md`, the activation prompts (one per journey) and `docs/energy-evaluation/journeys.md`

Note: the sources are `.md` files; `npm run guidance:generate` also writes `src/guidance/energy/journeys.generated.ts`, because the bundled server cannot read the `.md` files at run time. The old skill's `references/` moved to `energy-current-plan` (read-your-bill) and `energy-compare` (worked example). `nextSteps` is added to compare and rates results.

## 3. Before shipping

- [ ] 3.1 Rerun the activation prompts and the energy eval set with the plugin, and on a connector-only session, and compare with the baselines from 1.1 and 1.3
- [ ] 3.2 Check the data licences named in the energy instructions (CDR rule 2.6, AER benchmarks CC BY 4.0) are still current
