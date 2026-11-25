# Tasks

## 1. Evidence first

- [ ] 1.1 On the WSL, run `docs/skills/activation-prompts.md` for the current plugin in Claude (and ChatGPT if the plugin can be loaded) and record whether the energy skill loads
- [ ] 1.2 Check whether Gemini Connected Apps accepts skills or an instruction bundle today, and record the answer with the page link and date
- [ ] 1.3 Run the energy eval set on the current guidance and keep the report as the baseline

## 2. Build

- [ ] 2.1 Write the five journey sources in `src/guidance/energy/` from the current instructions and skill, against the schemas of the three earlier changes. Every rule appears once
- [ ] 2.2 Generate the five skills and extend `guidance:check` to them. Remove `energy-bill-comparison`
- [ ] 2.3 Add `get_energy_guide` (journey enum, read-only) serving the same sources. Tests check it matches the skill bodies
- [ ] 2.4 Cut every energy tool description to the contract (at most 500 characters) and the energy instructions to the core rules (at most 1.5 KB). Add the budget tests
- [ ] 2.5 Add `nextSteps` to compare and rates results. Tests cover each usage level
- [ ] 2.6 Update `docs/areas/skills-and-plugins.md`, the activation prompts (one per journey) and `docs/energy-evaluation/journeys.md`

## 3. Before shipping

- [ ] 3.1 Rerun the activation prompts and the energy eval set with the plugin, and on a connector-only session, and compare with the baselines from 1.1 and 1.3
- [ ] 3.2 Check the data licences named in the energy instructions (CDR rule 2.6, AER benchmarks CC BY 4.0) are still current
