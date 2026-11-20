# Host test: interval readings

Task 1.3 and 3.2/3.3 of `add-energy-readings-upload`: what Claude, ChatGPT and Gemini can actually do with a household's NEM12 file. A script cannot answer these; a person runs them in each host with the Ask Righto tools connected. Record results in the table at the end and in the change's `tasks.md`.

## Sample files

```sh
node scripts/make-sample-readings.mjs evals/readings-samples   # git-ignored folder
```

Seven synthetic files, made-up NMI and serial, same fixed pattern: 0.10 kWh in each half hour except 4pm to 8pm, which is 0.50 kWh. That is 8.00 kWh a day, every day.

| File | Days | Size | Measured kWh | Annual kWh (x 365/days) |
| --- | --- | --- | --- | --- |
| `readings-week.csv` | 7 | 2 KB | 56 | 2,920 |
| `readings-month.csv` | 30 | 9 KB | 240 | 2,920 |
| `readings-quarter.csv` | 91 | 29 KB | 728 | 2,920 |
| `readings-year.csv` | 365 | 114 KB | 2,920 | 2,920 |
| `readings-year-solar.csv` | 365 | 229 KB | 2,920 | 2,920, with solar export 1,314 kWh a year (B1 stream) |
| `readings-quarter-5min.csv` | 91 | 182 KB | 728 | 2,920; the same use in 5-minute intervals, summed to half hours, so the answers equal `readings-quarter.csv` |
| `readings-year-5min.csv` | 365 | 730 KB | 2,920 | over our limits: expect a refusal (see section B), not an answer |

Expected from `summarise_interval_readings`: the same days, totals and annual figure for any postcode (the file's use is in AEST clock time, so the household-local profile differs by state in summer: with a postcode in NSW, VIC, ACT or TAS the 4pm to 8pm AEST use becomes 5pm to 9pm local in daylight saving months; QLD has no shift). To see that, compare one time-of-use plan with a 6pm to 9pm peak at postcode 4000 and at postcode 3000: the peak share must be higher at 3000.

## A. Can the host run a program? (answers the snippet question)

Ask in each host, with a CSV attached: "Run a one-line program that counts the lines in this file and tell me the number." Record: yes or no, on which plan and surface (web, desktop, mobile), whether it works with the Ask Righto connector enabled in the same chat, and whether the sandbox can reach the internet.

## B. Size ladder

For each file, in a fresh chat with the tools connected, send: "Here is my interval readings file. Postcode 4000. Compare electricity plans using it." Use two routes where the host allows both: **paste** the text into the message, and **attach** the file.

Record for each (file, route):

1. Did the model call `summarise_interval_readings`? With the whole text? Check `daysPresent` in the result against the table: fewer days means the host truncated or dropped lines.
2. Did it finish, or stop with an error, a size message or a refusal to paste?
3. Rough cost: how long it took, and any visible token use.
4. Largest file that arrives complete on each route. Compare it with our limits: the tool refuses text over 250,000 characters with a plain message, and our server refuses a request body over 256 KB with a transport error (`readings-year-5min.csv`, 730 KB, shows which of the two a host gives you, or whether the host stops it first).

### B2. The layers for a file too big to paste (`add-energy-readings-layers`)

Use `readings-year-5min.csv` (730 KB, expected annual use 2,920 kWh) and `readings-year-solar.csv`. In a fresh chat, send the same request as in B, attaching the file, and record at each step what the model did:

| Layer | What to look for | Pass |
| --- | --- | --- |
| 1. Paste or tool call with the text | Only for files under about 30 KB: `summarise_interval_readings` called with the whole text; `daysPresent` matches. | Profile passed on unchanged |
| 2. Upload address | The model calls `get_readings_upload_link` with the postcode, then sends the file with PUT from its code environment. Record: did the sandbox reach the address (Claude web: does the user have to allow the domain, and is the prompt clear?); did the reply give `annualKwh` 2,920; was the profile passed unchanged; is the estimate labelled verified. | Yes, with 2,920 kWh |
| 2b. Address refused or unreachable | Tell the sandbox to block the address, or wait 6 minutes before sending. The model should say what happened and fall to layer 3, not invent figures. | Falls through, says so |
| 3. Fallback instructions | The model follows the fallback instructions: it sums by the current plan's hours and passes a bill (Fallback A in `docs/energy-readings-recipe.md`), or builds the profile itself. Compare the total it passes (and `sums` if it built a profile) with the table, and check it used every day of the file. A built profile must be labelled "built by the assistant, not verified by Ask Righto"; a bill must be described as summed by the assistant. | 2,920 kWh within 0.5%, every day used |
| 4. Nothing runs | A host with no code: the model asks for a shorter period or 30-minute intervals, or uses the bill. It must not sum the file and apply its own peak hours. | No invented figures |

Also record: how long each layer took, whether the model repeated the address to the user (it should not), and whether anything in the answer shows the NMI.

## C. What the model does with the result

- Does it pass the profile string to `compare_energy_plans` as `readingsProfile` unchanged? A rewritten profile fails validation or gives wrong figures. Check the string it sent against the one returned.
- Does it say the estimate is from the household's own readings, name the period, days and scaling, and say controlled load is not costed separately?
- Does it avoid adding up or quoting figures that are not in a tool result? (Check each number with `scripts/trace-numbers.mjs` on a saved answer.)
- Does it avoid calling a plan "best" or "recommended"?
- Does it avoid repeating the NMI or meter serial from the file? (They are `4001234567` and `SERIAL0001` in the samples.)
- Does it avoid asking the user to send the file anywhere else?
- With the solar file: is the export figure (1,314 kWh) used and a feed-in credit worked out?

## D. Refusals

Send each and check the message is relayed plainly with no figures:

- the file with its first line changed to `100,NEM13,...` and a `250` record (accumulation);
- two files pasted together with different NMIs;
- a file cut off halfway through a line (truncation, as a host may do);
- a file with a value changed to text.

## E. Rendering

- The Inkview table shows for a readings comparison (its caption is the standard notice; the readings period and days are in the text above the table) and the typical-usage caption shows for no-bill results (#44).
- Links are clickable; the notes appear once, not per plan.

## Results (fill in)

| Host, plan, surface | Runs a program? | Largest paste complete | Largest attach complete | Profile unchanged? | Notes |
| --- | --- | --- | --- | --- | --- |
| Claude | | | | | |
| ChatGPT | | | | | |
| Gemini | | | | | |

Not covered here: a snippet or file-by-reference route (decided against for now: keep the work on our server and test the paste route first). The automated prompt set for the energy tools is `docs/energy-evaluation/prompts.md`.

## F. Setting up a server the hosts can reach

The hosts run in the vendors' clouds, so they cannot reach a server on your machine. Use the internal route with a long random token, a throwaway database and a short-lived tunnel; nothing is deployed. The server also answers on the public `/mcp` route, with no token and the same energy tools; through a tunnel that route is reachable too. With invented data and a throwaway database that is harmless, but it is a reason to use a tunnel only while testing.

```sh
npm run build
export DATABASE_URL=postgres://localhost/askrighto_hosttest DATABASE_SCHEMA=askrighto      # a throwaway database
node dist/askrighto.js migrate
node scripts/evals/load-energy-fixtures.mjs            # synthetic plans and benchmarks (invented numbers)
export ASKRIGHTO_INTERNAL_TOKEN=$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')
ASKRIGHTO_VERTICALS=energy ASKRIGHTO_SYNC_SCHEDULE=off PORT=8787 HOST=127.0.0.1 node dist/askrighto.js --http
```

Expose port 8787 with a tunnel of your choice (for example `cloudflared tunnel --url http://localhost:8787`), then add a custom connector in each host at `https://<tunnel host>/mcp-internal/<token>`. Stop the tunnel when you have finished and discard the token. Use only invented files, or your own file only if you are content for that host to see it (it sees it whenever you attach it). The server logs no request content and returns no NMI.

Because the fixtures hold only a few plans (NSW 2000; Victoria 3000 and 3001 with CitiPower, Jemena and AusNet), use postcode 3000 with Jemena for the time-of-use plan, and 2000 for the Energy Made Easy link.

