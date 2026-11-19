# Proposal

## Why

`add-energy-readings-prompt` tells people to request interval readings from their retailer or distributor. Iven (19 Nov 2026) has now supplied a real file from his own distributor (United Energy, VIC), so the format is known instead of guessed. With half-hourly readings a time-of-use plan can be costed from the household's own use, and plans whose bands cannot be reduced to a peak/shoulder/off-peak split (AGL labels both bands SHOULDER) can be costed from their time windows.

The file is NEM12 (interval data), not NEM13 (accumulation reads), checked against the AEMO MDFF specification v27. It has one 200 record (one NMI, register E1, kWh, 30-minute intervals), 364 daily 300 records and six 400 records for the one day flagged V. It has no 100 header or 900 end record and the last line is one field short, so a strict parser would reject it. 17 Feb 2026 has no record at all. There is no export register, so no solar.

## What Changes

- Add a tolerant NEM12 reader. It accepts a file with or without the 100 and 900 records and a short final line, reads 200, 300 and 400 records, handles 5, 15 and 30 minute intervals and several registers, and reports gaps and unusable days instead of failing.
- Add a tool `summarise_energy_readings` that takes the pasted file text, parses it in memory, drops the NMI and meter serial before anything is returned, and returns a compact summary: days covered, missing days, quality counts, total kWh, and kWh by hour of day and month (AEST clock).
- Let `compare_energy_plans` accept that summary as usage. Plans are then costed from half-hourly use: time-of-use bands come from each plan's own windows (daylight saving handled: plan windows are local time, the file is AEST), and a year is rebuilt from the days present, scaled for missing days, with the scaling stated.
- Show the usage basis as "your readings" with the date range and the number of days used, and do not show the readings prompt when readings were used.
- Solar export is out of this change because the file has no export register. A file with a B1 register is read but its export is reported as not used.

Data source: the household's own file, given by the person. Nothing is stored, logged or sent anywhere (AGENTS.md rule 3). Tool results never repeat the NMI or the meter serial.

Hosts affected: Claude, ChatGPT and Gemini.

Out of scope:

- Storing readings, accounts, or uploading to our server outside the tool call.
- Becoming a CDR accredited data recipient.
- NEM13 accumulation files (one total per period, no time of day), which can only give an annual figure; it is a possible later change.
- Solar export costing and controlled load from readings.
- Gas (no interval data in this format).
- Business customers.

## Capabilities

### New Capabilities

- `energy-readings`: reading a NEM12 interval file and summarising it without keeping it.

### Modified Capabilities

- `energy-plan-comparison`: usage can be the summary of the person's own interval readings.

## Impact

- New: `src/energy/readings/nem12.ts`, `src/energy/readings/summary.ts`, `src/tools/summarise-energy-readings.ts`, `docs/energy-readings.md` section, an anonymised test file under `test/fixtures/energy/` (NMI and serial replaced, a few days only; the real file stays out of the repo).
- Changed: `src/energy/calc.ts` (interval costing), `src/tools/compare-energy-plans.ts`, server instructions, energy bill skill.
- No migration.
