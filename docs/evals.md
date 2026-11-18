# Evals

The prompt sets in `docs/use-case-comparison/` (domestic `D01`-`D20`, international `I01`-`I20`, health cover `H01`-`H20`) and `docs/home-loan-evaluation/` (home loans, `H01`-`H24`) can be run without a person pasting each one into a host. A small runner gives each prompt to a model over an OpenAI-compatible chat API with the Ask Righto tools as function tools, then scores the answer.

This is **not** Claude, ChatGPT or Gemini. It checks the tools, their instructions and the grounding rules behind one model, the same way each time, so it can be repeated before a change and after it. The hand protocol (`use-case-comparison/protocol.md`, the answer-review skill) stays the way to see a real host, including browsing assistants.

## What is scored

Per run, mechanically:

- **Tools.** Every tool in the prompt's "Expected tools" was called; for `(none)`, no tool was called.
- **Untraced figures.** Every figure in the answer appears in the prompt or a tool result (`scripts/trace-numbers.mjs`, deliberately strict).
- **Flagged wording.** "best", "recommended", odds of entry, an aggregate turned into an ATAR. Flags are for a person to read in context (a refusal may quote the word); they do not fail a run.

A run passes on the first two. The "A grounded answer must" column is not scored: the report repeats it next to each answer for a person to tick. A set of 20 gives a direction, not statistics; model output varies, so use `repeat`.

## Run it from GitHub

Actions → Evals → Run workflow. Needs no production database: the job starts a throwaway PostgreSQL service, applies the migrations and loads what the repo holds (VIC course index and VCE data from `data/`, the sample CRICOS sheet and health cover files from `test/fixtures/`). It never runs on a pull request, because every run spends model tokens.

Set once under Settings → Secrets and variables → Actions:

| Name | Kind | What |
|---|---|---|
| `EVALS_BASE_URL` | variable | the OpenAI-compatible base URL (`/chat/completions` is added) |
| `EVALS_MODEL` | variable | the model id at that endpoint |
| `EVALS_API_KEY` | secret | the endpoint's key |

Inputs: `set` (default `domestic,international,health`), `only` (e.g. `D01,H07`), `repeat` (default 1) and a `label`. The report is on the run's summary page; the report and every answer (with its tool results) are uploaded as an artifact for 30 days.

Not in the default sets: **energy** (no prompt set yet) and **home loans**, which need live CDR payloads that the job does not load. `home-loans` can be named in `set`, but its answers will say the data is unavailable.

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
- Prompt rows with placeholders (home loan "product X") need a person to fill them in.
