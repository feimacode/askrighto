# Evals

The prompt sets in `docs/use-case-comparison/`, `docs/energy-evaluation/` (energy, `E01`-`E31`) (domestic `D01`-`D42`, international `I01`-`I20`, health cover `H01`-`H20`) and `docs/home-loan-evaluation/` (home loans, `H01`-`H31`) can be run without a person pasting each one into a host. A small runner gives each prompt to a model over an OpenAI-compatible chat API with the Ask Righto tools as function tools, then scores the answer.

This is **not** Claude, ChatGPT or Gemini. It checks the tools, their instructions and the grounding rules behind one model, the same way each time, so it can be repeated before a change and after it. The hand protocol (`use-case-comparison/protocol.md`, the answer-review skill) stays the way to see a real host, including browsing assistants.

## What is scored

Per run, mechanically:

- **Tools.** Every tool in the prompt's "Expected tools" was called; for `(none)`, no tool was called.
- **Untraced figures.** Every figure in the answer appears in the prompt or a tool result (`scripts/trace-numbers.mjs`, deliberately strict).
- **Flagged wording.** "best", "recommended", odds of entry, an aggregate turned into an ATAR. Flags are for a person to read in context (a refusal may quote the word); they do not fail a run.

A run passes on the first two and on its row's checks (below). The "A grounded answer must" column is not scored: the report repeats it next to each answer for a person to tick. A set of 20 gives a direction, not statistics; model output varies, so use `repeat`.

## Mechanical checks (prompt table column 5)

A row may carry a fifth column, `Checks`: `arg:TOOL.KEY=VALUE` (the model called that tool with that argument, compared as text), `says:A/B` (the answer contains a phrase), `never:A/B` (it contains none) and `result:A/B` (a tool result contains one). Phrases are plain text, matched without case, with no `|`, `;` or `/` inside. A failed check fails the run and is listed in the report. `test/intl/prompts.test.ts` checks that every check parses and that `arg:` names a real tool and argument.

D21 to D42 and I21 to I30 (regions, a two-state provider, ambiguous names, HSC and QCE not built, VTAC not applied to NSW, no figures for index-only courses, diplomas and VET) rely on this. They need the real CRICOS loads; against the CI fixtures they only test not-found handling. Cross-cutting checks that need no model: the public route lists no course or international tools (`test/courses/tools.test.ts`), the untraced-figure check runs on every run, and `courses:validate` and `intl:validate` run clean from the command line.

## Run it from GitHub

Actions → Evals → Run workflow. Needs no production database: the job starts a throwaway PostgreSQL service, applies the migrations and loads what the repo holds (VIC course index and VCE data from `data/`, the sample CRICOS sheet and health cover files from `test/fixtures/`). It never runs on a pull request, because every run spends model tokens.

Set once under Settings → Secrets and variables → Actions:

| Name | Kind | What |
|---|---|---|
| `EVALS_BASE_URL` | variable | the OpenAI-compatible base URL (`/chat/completions` is added) |
| `EVALS_MODEL` | variable | the model id at that endpoint |
| `EVALS_API_KEY` | secret | the endpoint's key |

Inputs: `set` (default `domestic,international,health`), `only` (e.g. `D01,H07`), `repeat` (default 1) and a `label`. The report is on the run's summary page; the report and every answer (with its tool results) are uploaded as an artifact for 30 days.

Not in the default sets: **energy** (named with `--set energy`; it runs on invented fixture plans and benchmark numbers, so it checks behaviour, links, notices and wording, not real prices) and **home loans** (`H01`-`H31`, version 2). Home loans need no database: the proxy tools relay each lender's live Consumer Data Right answer, so the job only needs outbound internet to the CDR Register and the lenders. Answers are real, change over time and spend requests on lenders' servers, so run the set by hand and keep `repeat` low. For steady, repeatable runs use `--mock-cdr` (the default `mock_cdr` input in the Actions workflow): the server then answers the Register and lenders from invented fixtures built into it (`src/homeloans/mock-cdr.ts`, only when `ASKRIGHTO_CDR_MOCK=1` and not in production), so there are no requests to lenders and no real prices; it checks behaviour and wording only. A lender being down shows as "data unavailable", which is the behaviour the set scores.

## Run it locally

```sh
export EVALS_BASE_URL=… EVALS_MODEL=… EVALS_API_KEY=…
export DATABASE_URL=postgres://localhost/askrighto_dev   # optional; without it every data tool says unavailable
npm run evals -- --dry-run                               # list the prompts
npm run evals -- --set health --only H07,H09 --repeat 2
```

The runner starts `dist/askrighto.js` on a free port with the sets' verticals loaded on the internal route (the same route the hand protocol uses), or uses `EVALS_MCP_URL` if you point it at a server already running. Results go to `evals/runs/<time>/` (git-ignored): `REPORT.md` and one JSON per run in the `{ prompt, toolResults, answer }` form the answer-review skill and `trace-numbers.mjs` read. Data work and database tests normally run on the WSL environment; point `DATABASE_URL` there for data-heavy sets.

## Known gaps

- Course prompts that name "Test University" run against the real VIC index in CI, where that provider does not exist; they score how the tools handle "not found", not the fixture answer.
- No browsing assistant is involved, so index-only answers are scored on what the tools return.
- Home loan prompts that name "product X" or "lender Y" (H03, H04, H11, H14, H15) need a person to name a real product or lender; the others name real lenders and run unattended. A lender that fails on purpose (every version refused, unreachable) cannot be forced from here: that is a mock-lender unit test (`test/homeloans/proxy.test.ts`).
- The live check of the proxy against real lenders is `npm run homeloans:smoke` (weekly in the "Home loan proxy smoke" workflow), not a prompt eval.

## The energy set

`docs/energy-evaluation/prompts.md` has twenty-five prompts on the plan search, plan detail, comparison, current plan pick list and interval readings tools: bills, typical usage, time-of-use, links (Energy Made Easy outside Victoria, retailer website in Victoria), the readings note, refusals (WA, NEM13, two NMIs, no distributor, no household size, a large customer), the invoice route (pick list, invoice first, moving house) and the upload address for a large readings file and wording. Data: `scripts/evals/load-energy-fixtures.mjs` serves `test/fixtures/energy` from a small in-process stand-in for the CDR API through the real `sync-energy` command (plan ids get the `@EME` and `@VEC` suffixes real data has) and loads `test/fixtures/benchmarks` through `benchmarks:load`. Prompts name `{{NEM12:3days}}`, `{{NEM12:2nmi}}` and `{{NEM13}}`: the runner pastes small synthetic files with invented identifiers. Locally, point `DATABASE_URL` and `DATABASE_SCHEMA` at a throwaway database (for example `askrighto_evaltmp`), run `node dist/askrighto.js migrate`, then the loader, then `npm run evals -- --set energy`.

What only a host can answer (can it run a program, how big a paste works, how tables render) is in `docs/energy-readings-host-test.md`.

Known gaps: a comparison with no estimable plan has no Inkview table (a component needs at least one row); the fixtures give a few plans per postcode, so the lists are short.
