# Host test: interval readings

Task 1.3 and 3.2/3.3 of `add-energy-readings-upload`: what Claude, ChatGPT and Gemini can actually do with a household's NEM12 file. A script cannot answer these; a person runs them in each host with the Ask Righto tools connected. Record results in the table at the end and in the change's `tasks.md`.

## Sample files

```sh
node scripts/make-sample-readings.mjs evals/readings-samples   # git-ignored folder
```

Five synthetic files, made-up NMI and serial, same fixed pattern: 0.10 kWh in each half hour except 4pm to 8pm, which is 0.50 kWh. That is 8.00 kWh a day, every day.

| File | Days | Size | Measured kWh | Annual kWh (x 365/days) |
| --- | --- | --- | --- | --- |
| `readings-week.csv` | 7 | 2 KB | 56 | 2,920 |
| `readings-month.csv` | 30 | 9 KB | 240 | 2,920 |
| `readings-quarter.csv` | 91 | 29 KB | 728 | 2,920 |
| `readings-year.csv` | 365 | 114 KB | 2,920 | 2,920 |
| `readings-year-solar.csv` | 365 | 229 KB | 2,920 | 2,920, with solar export 1,314 kWh a year (B1 stream) |

Expected from `summarise_interval_readings`: the same days, totals and annual figure for any postcode (the file's use is in AEST clock time, so the household-local profile differs by state in summer: with a postcode in NSW, VIC, ACT or TAS the 4pm to 8pm AEST use becomes 5pm to 9pm local in daylight saving months; QLD has no shift). To see that, compare one time-of-use plan with a 6pm to 9pm peak at postcode 4000 and at postcode 3000: the peak share must be higher at 3000.

## A. Can the host run a program? (answers the snippet question)

Ask in each host, with a CSV attached: "Run a one-line program that counts the lines in this file and tell me the number." Record: yes or no, on which plan and surface (web, desktop, mobile), whether it works with the Ask Righto connector enabled in the same chat, and whether the sandbox can reach the internet.

## B. Size ladder

For each file, in a fresh chat with the tools connected, send: "Here is my interval readings file. Postcode 4000. Compare electricity plans using it." Use two routes where the host allows both: **paste** the text into the message, and **attach** the file.

Record for each (file, route):

1. Did the model call `summarise_interval_readings`? With the whole text? Check `daysPresent` in the result against the table: fewer days means the host truncated or dropped lines.
2. Did it finish, or stop with an error, a size message or a refusal to paste?
3. Rough cost: how long it took, and any visible token use.
4. Largest file that arrives complete on each route. Set the size cap from this (the cap is 600,000 characters until then).

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

- The Inkview table shows with the readings caption ("From your own readings ...") and the typical-usage caption still shows for no-bill results (#44).
- Links are clickable; the notes appear once, not per plan.

## Results (fill in)

| Host, plan, surface | Runs a program? | Largest paste complete | Largest attach complete | Profile unchanged? | Notes |
| --- | --- | --- | --- | --- | --- |
| Claude | | | | | |
| ChatGPT | | | | | |
| Gemini | | | | | |

Not covered here: an automated prompt set for the energy tools (`docs/evals.md` says there is none yet) and a snippet route for hosts that can run code. Both are proposals for Iven.
