# Skills and plugins

Ask Righto ships two kinds of guidance to the host model: **server instructions** (sent on every
MCP `initialize`) and **skills** (`SKILL.md` files in two plugin bundles). Both exist because hosts
differ in how well they honour server instructions, and a skill can carry multi-turn intake and
wording the instructions cannot. Skills carry **no data and no tools**; every fact still comes from
a tool result.

Notes marked **(inferred)** are my reading of the code; **(unverified)** means the code or docs
leave it open. Read at commit `ff220c9` (PR #17 merged); nothing was run. Specs:
`openspec/changes/add-host-guidance`, `add-energy-bill-skill`, `add-course-skills`,
`add-answer-review-skill`. Activation tests to run by hand: [`../skills/activation-prompts.md`](../skills/activation-prompts.md).

## 1. What is in the repo and how it is refreshed

```mermaid
flowchart TB
  SH["src/guidance/shared.ts<br/>BASE_RULES, BROWSED_FACT_RULES"] -->|baseInstructions| SI["src/server/instructions.ts<br/>serverInstructions()"]
  SH -->|renderRulesReference| GEN["scripts/guidance.mjs<br/>npm run guidance:generate"]
  GEN -->|writes| RULES["plugin/skills/ask-righto-grounding/<br/>references/rules.md"]
  GEN -.->|"--check in CI and test/guidance.test.ts"| RULES
  VI["Vertical instructions<br/>ENERGY_INSTRUCTIONS, COURSE_INSTRUCTIONS,<br/>INTL_INSTRUCTIONS"] --> SI

  subgraph PUB["plugin/ (public, name askrighto)"]
    G["ask-righto-grounding"]
    E["energy-start, energy-current-plan, energy-readings,<br/>energy-compare, energy-plan-rates<br/>(+ references/read-your-bill.md, worked-example.md)"]
  end
  subgraph INT["plugin-internal/ (name askrighto-internal, testers only)"]
    V["vce-course-research"]
    I["intl-course-finder"]
  end
  MKT[".claude-plugin/marketplace.json<br/>lists both plugins"] --> PUB
  MKT --> INT
  E -->|"says: follow"| G
  V -->|"says: follow"| G
  I -->|"says: follow"| G
  RULES --- G
  MAINT[".claude/skills/ask-righto-answer-review<br/>maintainer only, not in any plugin"]
```

| Piece | Path | Notes |
| --- | --- | --- |
| Public plugin | `plugin/.claude-plugin/plugin.json`, `plugin/skills/` | Name `askrighto`, version 0.1.0. Skills: `ask-righto-grounding` and the five energy journey skills. Safe to list: energy is the only public vertical. |
| Internal plugin | `plugin-internal/.claude-plugin/plugin.json`, `plugin-internal/skills/` | Name `askrighto-internal`. Skills: `vce-course-research`, `intl-course-finder`. Its manifest says it is for testers while the course tools are internal-only, to be installed alongside the public plugin. Not for public listing. |
| Marketplace | `.claude-plugin/marketplace.json` | One marketplace named `askrighto` with both plugins as relative sources (`./plugin`, `./plugin-internal`). |
| Maintainer answer-checker | `.claude/skills/ask-righto-answer-review/SKILL.md`, `scripts/trace-numbers.mjs` | Project-level skill for people working in this repo; it is not in either plugin, so users never get it. See [`review-and-comparison.md`](review-and-comparison.md). |
| Shared rules | `src/guidance/shared.ts` | The single source of the base rules sent as server instructions **and** written into the grounding skill's reference. |
| Generator | `scripts/guidance.mjs` | Bundles `shared.ts` with esbuild, imports it, and writes (or with `--check`, compares) `plugin/skills/ask-righto-grounding/references/rules.md`. |

How it is refreshed: edit `src/guidance/shared.ts`, run `npm run guidance:generate`, commit both
files. CI runs `npm run guidance:check` and `test/guidance.test.ts` runs the same check, so a stale
`rules.md` fails the build. The vertical instruction texts and the skill steps are **separate hand-
written copies** of similar advice (for example "ask for kWh and days"); only the base rules are
generated. **(inferred)** these can drift, and the tests below catch only some kinds of drift.

Plugins are copied to a cache when installed, so a plugin folder must not reference paths outside
itself (`add-host-guidance` design); that is why `rules.md` is generated into the plugin rather than
linked to `src/`.

There is no runtime loading: skills are files the host reads after the user installs the plugin.
Installation, listing in the Claude directory, the ChatGPT plugin ZIP and Gemini registration are
packaging steps that are **(unverified)** in this repo; project notes say activation prompts have not
been run on real hosts and the ChatGPT conversion is untried.

## 2. How the pieces are linked

```mermaid
flowchart LR
  Q["User question"] --> HOST["Host model"]
  HOST -->|"description match"| SK["Skill loaded<br/>(grounding + topic skill)"]
  HOST -->|"initialize"| INS["Server instructions<br/>base rules + served verticals' text"]
  SK -->|"steps tell it which tool to call"| TOOLS["MCP tools"]
  INS --> TOOLS
  TOOLS -->|"found / notFound + source + as-of"| HOST
  HOST --> ANS["Answer: quotes tool results only"]
```

- **Skill to skill**: each topic skill states "follow the `ask-righto-grounding` skill for how to
  quote results"; the grounding skill points to `references/rules.md` for the rules about facts read
  from an official page (`BROWSED_FACT_RULES`).
- **Skill to tool**: skills name tools in backticks. `test/guidance.test.ts` checks that every
  `get_`/`search_`/`compare_`/`list_`/`check_`/`estimate_` name in any skill markdown exists among the
  registered tools (energy tools plus the course and international verticals' tools).
- **Skill to vertical**: the energy skill is public because the energy vertical is; the course
  skills sit in the internal plugin because those verticals are internal-only. A test asserts the
  public bundle has no skill whose name contains "course".
- **User first**: every skill says "If the user gives different instructions, follow the user"; the
  grounding skill is tested for it.

## 3. The skills and what each does

| Skill | Triggers on (from its `description`) | Process it drives |
| --- | --- | --- |
| `ask-righto-grounding` | Any time an Ask Righto result is about to be quoted, summarised or compared, or a tool found nothing | Call the tool before saying anything factual; quote figures exactly with source name, link and as-of date; relay `found: false` plainly and give any official link; describe what the data shows, never "best" or "recommended"; for pages the host reads for the user, follow `references/rules.md`. |
| `energy-start` | Electricity or gas plans, a power bill, paying less, retailers in Australia | Home or business (never assumed); latest invoice first; postcode, fuel, distributor; routes to the other journeys |
| `energy-current-plan` | Someone has an invoice or says which plan they are on | Read and confirm the invoice fields; `list_current_plan_options` (or `planName` with no invoice); the user picks; carry `currentPlanId` on |
| `energy-readings` | Interval meter readings (NEM12) to compare on their own use | `summarise_interval_readings` up to about 30 KB; `get_readings_upload_link` for long files; the sum-by-hours fallback as `assistant_readings`; never own peak hours |
| `energy-compare` | The yearly cost of plans for the user's usage, or whether a plan costs less than their own | Choose `usageSource`; call `compare_energy_plans`; lead with the accuracy sentence; baseline wording; conditions table; follow `nextSteps` |
| `energy-plan-rates` | Named plans to line up with no usage, or a business with no bill or readings | `compare_energy_plan_rates`; no total or ranking; say a cost needs usage |
| `vce-course-research` (internal) | Victorian VCE student or parent asking about courses, prerequisites, entry figures, VTAC dates, early entry, aggregate | `search_domestic_courses` first; ask studies before `check_domestic_course_prerequisites`; scores only for a scored check or aggregate; quote figures with kind and intake year; an aggregate is not an ATAR; describe early entry, never say eligible; never "will get in", odds, or choosing subjects; index-only courses: links, and if browsing, read only the checklist, university page first, then Course Seeker, never VTAC; stop at a bot check. |
| `intl-course-finder` (internal) | International student or family asking about CRICOS courses, providers, fees, duration, entry checklists | `search_international_courses` first; `get_international_course` and `compare_international_courses`; fees always "indicative, as published in CRICOS" with file date; never convert currency or add fees; use `get_international_entry_checklist` for what Ask Righto does not hold; no visa, migration, work-rights or post-study advice (point to Home Affairs); no ranking. |

### 3.1 Server instructions (the other half)

`serverInstructions(verticalTexts)` in `src/server/instructions.ts` joins `baseInstructions()` (the
four `BASE_RULES`), then the instruction text of each vertical **the route serves**, then any text
added with `addInstructions`. The public route therefore receives only the energy guidance; the
internal route also receives the course and international guidance. Skills reinforce this but the
instructions are the part that every host receives with the connector, even without the plugin.

### 3.2 What the tests lock in (`test/guidance.test.ts`)

- Both plugin manifests and the marketplace entry exist; no `agents/` or `hooks/` folder and no
  `userConfig`, `hooks` or `agents` in the manifest (skills-only, per the decision recorded in the
  `add-host-guidance` change).
- Every skill's `name:` equals its folder name and has a description of at least 20 characters.
- Skill files contain no host brand names (provider-neutral so they convert to other hosts).
- The base rules appear in the server instructions; `rules.md` matches the generator.
- The VCE skill keeps the "will get in", "never convert" and "bot check" wording; the international
  skill keeps "visa, migration" and "indicative".

## 4. Known limits and open items

- **Not run on real hosts**: the positive, negative and indirect activation prompts in
  `docs/skills/activation-prompts.md`, and the real answer-review run, are pending (project notes,
  `tasks.md` of each change).
- **ChatGPT**: needs at least one skill in an upload and does not carry agents over; conversion is
  untried. Claude `SKILL.md` frontmatter keys beyond `name` and `description` are an open question in
  the `add-host-guidance` design.
- **Drift risk** between vertical instructions, skill steps and `docs/course-tools.md` examples
  **(inferred)**: only the base rules are generated.
- **Deferred**: a Claude-only course-page-reader agent, until guided browsing is tested in Claude in
  Chrome.

## 3.2 Energy guidance: one source per journey (split-energy-host-guidance)

Each channel has one job, with no text in two places:

| Channel | Holds | Budget |
| --- | --- | --- |
| Tool description | the contract: what it returns, what each input means, what must come first | 500 characters each (test) |
| Server instructions (energy) | core rules: home or business, invoice first, never assume, no identifiers, neutral wording, readings route, where the steps are | 1.5 KB (test) |
| Tool result | what to ask or offer next: `needs_input` messages and a short `nextSteps` list on compare and rates results | 300 characters a step (test) |
| Skill (plugin) | one journey's steps, loaded when the journey begins | none; under 3.5 KB (5 KB for readings) |
| `get_energy_guide` | the same text as the skill, for hosts without the plugin | same |

The source of each journey is `src/guidance/energy/<journey>.md` (one `description` line of frontmatter, then the steps). `npm run guidance:generate` writes `plugin/skills/<journey>/SKILL.md` and `src/guidance/energy/journeys.generated.ts` (which `get_energy_guide` reads); `npm run guidance:check` and `test/guidance.test.ts` fail when either is stale. A tool, not an MCP prompt or resource, because tool calls work in Claude, ChatGPT and Gemini and prompts are usually user-triggered. The tool is read-only and returns guidance, not facts.
