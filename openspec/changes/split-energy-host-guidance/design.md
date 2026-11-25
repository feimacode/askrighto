## Context

`add-host-guidance` (merged in PR #16/#17) set up the plugin, the grounding skill, shared rules in `src/guidance/shared.ts`, and `guidance:check`. The energy guidance then grew in the server instructions and the skill in parallel. The plugin skills have never been run in a real Claude or ChatGPT session (`docs/skills/activation-prompts.md` is unrun), so this change starts with that test.

## Decisions

1. **What goes where.**

   | Channel | Who reads it | Holds | Budget |
   |---|---|---|---|
   | Tool description | every host, every turn | contract: returns, inputs, prerequisites | 500 chars each |
   | Server instructions | hosts that honour them, every turn | core rules and the first two questions | energy 1.5 KB |
   | Tool result | every host, when called | what to ask or offer next (`needs_input`, `nextSteps`) | 300 chars per step |
   | Skill | plugin users, on demand | one journey's steps and wording | none set; aim for under 3 KB |
   | `get_energy_guide` | non-plugin hosts, on demand | the same text as the skill | same |

2. **One source per journey.** `src/guidance/energy/<journey>.md` holds the steps. A build step writes each `plugin/skills/energy-<journey>/SKILL.md` (frontmatter plus the shared rules reference plus the body), and `get_energy_guide` reads the same file. `guidance:check` fails if a generated skill differs from its source.

3. **Why a tool and not MCP prompts or resources.** Prompts are user-triggered in most hosts, and resource support differs across Claude, ChatGPT and Gemini, while tool calls work in all three. The tool is read-only and returns guidance text, not facts, so the grounding rule isn't at stake. Its description says to call it at the start of an energy journey when no Ask Righto skill is loaded.

4. **`nextSteps` in results.** This is a short list of plain sentences, added by `rank` and the rates tool from the usage level:
   - `bill` without a split offers the split or readings;
   - `typical` offers a bill;
   - single-bill electricity offers readings, which replaces the current "More accurate comparison" note's place in the instructions;
   - a rates result offers a cost comparison.

   Results never carry the long recipes. Those stay in the guide.

5. **Server instruction contents (energy).**
   - Ask home or business.
   - Ask for the latest invoice first.
   - Never assume usage, household size or customer type.
   - Never pass an identifier.
   - Say "lower estimate", not "best".
   - Show the conditions table apart.
   - If an Ask Righto energy skill is not loaded, call `get_energy_guide` with the journey.

   Everything else moves out.

6. **Testing.**
   - Budget tests on descriptions and instructions.
   - `guidance:check` for drift.
   - Run the activation prompts on Claude and ChatGPT with the plugin, and the journeys on a connector-only Claude session to confirm `get_energy_guide` is called. Recheck whether Gemini Connected Apps supports skills, and record it.

7. **Source and date.** No figures live in guidance. The existing test that skill files hold no unsourced figures extends to the journey sources and the guide tool's output.

## Risks / Trade-offs

- Hosts may not call `get_energy_guide`. The core rules and result guidance still keep a session safe, and the evals measure how often the guide is called without the plugin.
- Five skills could trigger wrongly or not at all. Their descriptions are tested with the activation prompts before the old skill is removed.
- Shorter instructions could lower answer quality on hosts that relied on them. Run the energy eval set before and after, and compare.

## Open Questions

- Does Gemini Connected Apps accept any skill or instruction bundle as of today? To check in task 1.2.
