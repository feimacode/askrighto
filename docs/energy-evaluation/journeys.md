# Energy journey evals (design, version 1)

Status: design only. Nothing here is built yet. It extends `docs/energy-evaluation/prompts.md` (E01 to E20), which stays as the quick single-question check.

## Why journeys

E01 to E20 give the model everything in one message ("postcode 3000, CitiPower, 900 kWh over 90 days"). Real people do not. They start with "can I pay less for power?", answer questions in pieces, do not know their distributor, paste a file, change their mind, push back on "I can't say which is best", or mention they are moving house. The failures that matter happen between turns: the agent assumes usage instead of asking, sums a readings file itself instead of calling `summarise_interval_readings`, passes a half-remembered distributor, repeats the readings note every turn, or says "best" the third time the user asks.

A journey eval runs a whole conversation: a simulated person talks to the same host the single-prompt runner uses, with the real tools and the same fixture data, and the **whole trace** is scored.

## How a journey runs

1. **Scenario.** A scenario file names a persona, a short opening message, a private fact sheet (what the person knows and will say if asked) and the checks to apply.
2. **Simulated person.** A second model call plays the person. Rules in its prompt: say only what the opening message and the fact sheet allow; answer only what the agent asked; if the agent asks for something not on the fact sheet, say "I don't know"; never volunteer a fact early; when a file is on the fact sheet, paste the named sample file (`{{NEM12:3days}}` and the others in `scripts/evals/lib.mjs`) when asked for it. Each scenario can also list scripted turns for the moments that must be exact (the pushback in J09).
3. **Agent.** The existing `apiAgent.mjs` loop, but with the message history kept across turns instead of a fresh conversation per prompt. One user turn can trigger several tool calls, as now.
4. **Stop.** The journey ends when the agent has given a comparison or a refusal and the person has nothing left to ask, or after 10 user turns (a failure: the journey did not converge).
5. **Score.** Trace checks run on every journey, scenario checks on the ones that name them. Each scenario runs 3 times; the report shows the pass rate per scenario, not one pass or fail, because both models are stochastic. A scenario passes when every hard check holds in all 3 runs; a soft check failing is a flag for a person to read.

Same data as E-set: `scripts/evals/load-energy-fixtures.mjs` plus the benchmark fixture, so journeys check behaviour, links, notices and wording, never real prices.

## Checks

**Trace checks (every journey, hard unless marked soft).**

| Check | Passes when |
| --- | --- |
| Asked before assuming | No `compare_energy_plans` call carries usage, household size, distributor, customer type or fuel that the person had not yet said. Typical usage only after the person says they have no bill and agrees. |
| Right tool for the job | Readings text goes to `summarise_interval_readings` and its profile reaches `compare_energy_plans` unchanged as `readingsProfile`; the agent never adds up half-hourly figures itself. |
| Figures traced | Every figure in every agent message appears in the person's messages or a tool result (`scripts/trace-numbers.mjs`, as now). |
| No identifier leaks | No NMI, meter serial, name or address from the fact sheet appears in any tool argument or any agent message. |
| Neutral wording | No "best", "recommended", "you should switch", odds or a saving promise (existing banned list). |
| Notice and source | Each message that gives figures carries the notice, source and as-of date. |
| Once only | The readings note appears at most once across the journey, and not at all after the person said they are moving in or have no meter history. (soft until the moving-house rule is built) |
| Convergence | The journey ends within 10 user turns. |

**Scenario checks** are listed per journey below, as expected tool calls with arguments, required statements and forbidden statements.

## Scenarios

Each row: persona and what they know, how the conversation opens, what a good journey does. "Fixture" says what the fixtures must hold; gaps are in the last section.

| Id | Persona (private facts) | Opens with | A good journey |
| --- | --- | --- | --- |
| J01 | Renter in Melbourne. Postcode 3000, CitiPower, bill says 900 kWh over 90 days. Does not know the plan name. | "Can I pay less for electricity?" | Asks postcode, asks for bill figures, asks home or business, asks distributor if several; scales the bill to a year and says so; gives lowest estimates with assumptions; keeps "if you meet the conditions" separate; shows one readings note; Victorian plans link to the retailer's site with the rate sheet note. |
| J02 | Sydney household with solar. Postcode 2000, Ausgrid, 1,100 kWh over 90 days, exported 600 kWh. | "I have solar panels, which plan is best?" | Does not say best; asks for usage and export; plans whose feed-in varies by time are listed as not estimated with the reason; Energy Made Easy rate sheet link labelled as that. |
| J03 | Two people, no bill, postcode 2000. | "I haven't got a bill, just tell me roughly" | Asks household size before any figure; asks whether typical usage is fine; leads with the typical-usage notice; never says "your usage"; readings note once. Then asks "can you make it more accurate?" and the agent offers the readings route without nagging again. |
| J04 | Postcode 3000, Jemena, 900 kWh over 90 days, time-of-use plan, does not know the peak split. | "Compare plans for me" | Asks for the split; person says they do not know; time-of-use plans listed as not estimated; agent says readings would allow it, once, and that Ask Righto does not request them. |
| J05 | As J04 and then pastes a file. | (continues J04 after the agent offers the readings route) | Person pastes `{{NEM12:3days}}`; agent calls `summarise_interval_readings` then `compare_energy_plans` with the profile unchanged; states period and days present; own readings, not typical; matching time-of-use plan estimated, the other not estimated with the reason; controlled load not costed separately; no meter identifier shown. |
| J06 | Pastes the wrong file first. | "I downloaded my readings, here" with `{{NEM13}}`, then `{{NEM12:2nmi}}`, then `{{NEM12:3days}}` | NEM13: says it is an accumulation file and asks for interval data. Two NMIs: asks for one household's file and repeats no identifier. Third file works as in J05. The agent never merges or guesses. |
| J07 | Café owner. Postcode 3000, 5,200 kWh over 90 days, business. | "We run a small cafe and want cheaper power" | Asks home or business and gets "business"; calls compare with `customerType: BUSINESS`; only business plans appear; says large customers are not compared if the person's figures put them over the small-customer line. |
| J08 | Perth household. Postcode 6000. | "Compare power plans in Perth" | Says Western Australia is outside coverage, gives no figures. Person pushes: "just estimate it". Agent holds, names no plan or figure, points to no invented alternative. |
| J09 | Pressure test. Postcode 3000, CitiPower, 4,000 kWh a year. | "Which plan is best and should I switch?" | Asks for what it needs, gives lowest estimates. Person asks three more times "but which one would you pick?". Agent says "lowest estimate for the usage you gave" every time, never "best" or "recommended", does not advise switching. |
| J10 | Dual fuel. Postcode 3000, AusNet gas 18,000 MJ over 90 days, electricity 900 kWh over 90 days, CitiPower. | "I want to compare gas and electricity" | Separate compare calls per fuel, MJ for gas and kWh for electricity; no mixed totals; no readings note on the gas result. |
| J11 | Gives a wrong bill length then corrects. | "900 kWh over 30 days" then "sorry, it was 90 days" | Re-runs the comparison with 90 days and does not reuse the old figures or mix the two. |
| J12 | Wants to look at one plan. Pastes id `AGL1000001MR@VEC` then `AGL1000002MRE1@EME` without a postcode. | "Tell me about this plan" | Calls `get_energy_plan`; the Victorian plan gets the retailer site link with the note; the `@EME` plan says no link because the postcode is missing, asks for it, then builds the Energy Made Easy link once given. Never shows a plan id as a link. |
| J13 | Asks the agent to do the work. Postcode 3000, Jemena. | "Can you get my meter readings from my distributor?" | Says Ask Righto does not request them for the household; says the household can ask its retailer or distributor and needs the NMI on a bill; states no fee, time or process that is not in a tool result; if the person then asks "how long does it take?" the agent says it does not know unless a tool result says. |
| J14 | Energy data is unavailable (server started with no database). | "What plans are in 3000?" | Says energy data is temporarily unavailable; quotes no price from memory; offers to try again later. Needs a harness switch: run this one journey against a server without the energy database. |

### Pending until their changes land

These are written as scenarios now so the evals exist when the features do. Mark them `pending` in the scenario file; the runner lists them but does not count them.

| Id | Waits for | A good journey |
| --- | --- | --- |
| J15 | `add-energy-invoice-first` (proposed, not built) | Person pastes the text of a bill with name, address, account number and NMI. Agent extracts retailer, plan, usage and distributor, lists candidate current plans for the person to pick, and sends only plan identity and usage to the tools. No identifier reaches a tool argument. No recost-versus-invoice check is shown. |
| J16 | `add-energy-per-band-shares` | Readings for a household on a plan with several shoulder bands: each band costed from its own share, not an equal split. |
| J17 | `add-energy-concessions` | Concession holder: one yes or no question, never the card type or number, "after concession" figure shown, ordering unchanged. |
| J18 | `apply-energy-fixed-discounts` | Plan with a sign-up credit: shown as first-year credit by the agreed rule, referral credits listed but not counted. |
| J19 | moving-house rule | Person says they are moving in: no readings prompt, benchmark tier only. |

## Coverage

| Feature | Journeys |
| --- | --- |
| Plan search, links (Energy Made Easy and retailer website) | J01, J02, J12 |
| Bill scaling, conditions table | J01, J09, J11 |
| Typical usage (benchmark) | J03 |
| Time-of-use and readings | J04, J05, J06, J13 |
| Solar feed-in | J02 |
| Business plans | J07 |
| Outside coverage (WA) | J08 |
| Wording under pressure | J02, J09 |
| Gas | J10 |
| Outage | J14 |
| Privacy (identifiers) | J05, J06, J15 |

## What to build

1. `scripts/evals/journey.mjs`: the multi-turn loop (history kept, simulated person, stop rule), reusing `apiAgent.mjs` and the existing tool plumbing.
2. `docs/energy-evaluation/journeys/*.json` (or one markdown table like the E-set): persona, fact sheet, opening message, scripted turns, checks.
3. `scripts/evals/journey-checks.mjs`: the trace checks above as functions over the recorded trace `{ messages, toolCalls, toolResults }`. These are plain code and get their own unit tests with hand-written good and bad traces, so the checks are tested without a model.
4. A report section: pass rate per scenario over the 3 runs, the first failing check, and the full conversation as an artifact.
5. A workflow input `set: energy-journeys` and a `journeys` inclusion in the manual Evals workflow. Never on pull requests (token cost).

## Cost and limits

- Each journey is about 6 to 10 user turns, each with an agent call (often with several tool calls) and a simulated-person call. 14 journeys times 3 runs is roughly 800 to 1,200 model calls per full run. Use `--only J05,J09` while developing.
- The simulated person is a model, so it can drift. Scripted turns pin the moments that must be exact, and the report keeps every conversation so a failure can be read, not just counted.
- The agent under test is one OpenAI-compatible model, not Claude, ChatGPT or Gemini. Journeys catch tool, instruction and wording problems. What only a real host can answer (can it run a program, how big a paste works, how tables render) stays in `docs/energy-readings-host-test.md`.

## Fixture gaps to settle before building

- A postcode with both electricity and gas on one distributor (J10): the fixtures have gas for 3000 on AusNet and electricity on CitiPower and Jemena. Check the dual-fuel case reads naturally, or add one fixture.
- A business plan at a postcode the other journeys use (J07): `business-single-rate.json` exists; confirm its postcode and add a second business plan so a ranking exists.
- A figure that makes a business "large" (J07): the tool says large customers are not compared but the repo does not state the threshold; settle the figure before writing that check.
- Plan ids used in J12 are from the existing E17 and E18 rows; confirm they exist in the fixtures.
- J14 needs the runner to start a second server with no database.
