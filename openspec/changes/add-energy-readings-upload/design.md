## Context

The real file (checked 19 Nov 2026, aggregates only, kept local):

- NEM12 interval data. One `200` line: `200,<NMI>,E1,E1,E1,,<meter serial>,KWH,30,` (NMI, configuration, register, suffix `E1`, a blank data stream id, serial, unit, interval length). 364 `300` lines: date `CCYYMMDD`, 48 values, quality flag (`A` or `V`), empty reason code and description, an update timestamp, an empty load timestamp. Six `400` lines after two `V` days, giving interval ranges with a flag and a reason (`79` is a power outage).
- No `100` header and no `900` end line, so it is a distributor portal export (the file name ends `_UNITEDENERGY_VEC.csv`), not a full MDP file. The last line has 54 fields, not 55 (no trailing comma).
- 17 Feb 2026 has no record. Interval times are market time (Australian Eastern Standard Time, no daylight saving).
- 17,472 values, none empty or negative, about 2,665 kWh, about 7.3 kWh a day. A rough time-of-day split of this household is 9% midnight to 7am, 36% 7am to 3pm, 39% 3pm to 9pm and 16% 9pm to midnight (AEST clock).

How hosts pass data matters: tool inputs are flat strings and numbers (the strictest of the three hosts' rules), and a model that reads a 117 KB file and adds it up would break the rule that every figure comes from a lookup or a calculation the server owns.

## Decisions

1. **Two steps, one stateless server.** `summarise_interval_readings` turns the file text into a **profile string**; `compare_energy_plans` takes that string back as `readingsProfile`. The server keeps nothing between the two calls: the host carries the profile. This keeps rule 3 (no user data stored) and gives the model small, checkable numbers. A profile is about 1,100 numbers, not 17,000.
2. **What the profile holds.** For each calendar month and for weekdays and weekends: 48 half-hourly averages in kWh per half hour, in market time, plus the number of days that went into each. Also the period start and end, days present, missing dates (listed, at most 31), annual total kWh as measured, controlled load (`E2`) and export (`B1`) totals if those registers were in the file, and a count of intervals with a non-`A` quality flag or outage event. No NMI, no serial, no per-day values. It is encoded as compact JSON and passed as a single string with a format version; it is not signed or secret, and the server revalidates it on every use (ranges, counts, version).
3. **Costing from the profile.** Each plan's time-of-use windows (days and clock times) are converted from the household's local clock to market time using the postcode's state rules (no daylight saving in QLD; NSW, VIC, ACT and TAS shift an hour in summer; SA has its own half-hour offsets), and the share of use in each window is summed from the profile for each tariff period's dates. That gives the same `shares` the estimate already takes from a bill, so `calc.ts` keeps its maths; only the way shares are found changes, and plans whose windows cannot be mapped stay "not estimated" with the reason.
4. **Honesty about the period.** If the readings cover less than 365 days, the annual figure is scaled by days present, and the result says so, including missing dates. If they cover under 90 days, or miss a whole season of the plan's tariff periods, the tool says seasonal plans are less certain (no refusal, just the label).
5. **Basis and wording.** `Usage.basis` gains `"readings"`. The notice reads "from the household's own interval readings, 18 Nov 2025 to 17 Nov 2026", never "typical". The readings note from #45 is not shown when the basis is `readings`.
6. **Parsing rules.** Tolerant of what real exports do: missing `100` and `900`, a missing trailing field, blank reason fields, `V` days with `400` records, several `200` blocks. Strict about what would make figures wrong: a unit other than kWh, Wh or MWh (kVArh and similar are ignored, and Wh and MWh are converted), an interval length other than 5, 15 or 30 minutes (finer values are summed to 30 minutes), a value that is not a number, a `300` line without the right number of values for its `200` block, duplicate dates, and more than one NMI in one file (refused: one household at a time). Register mapping: suffix starting `E` is consumption (`E1` general; `E2` controlled load by convention, labelled as an assumption), `B` is export. `Q` and `K` are ignored.
7. **Refusals.** NEM13 (`250` records): "this is an accumulation (meter reading) file with no half-hourly figures; ask for interval data". No consumption register, over the size cap (default 600,000 characters, about five times a year of data), or not NEM12: `needs_input` with what to ask for, no figures.
8. **Privacy.** The tool never logs its input (the framework already logs only error messages), returns no identifier, and the NMI is dropped before anything is built. Errors name the line number and the problem, never the content. The tool is read-only and `openWorldHint` false.
9. **Grounding.** The result's source is "The household's own interval readings, supplied by the user" with the as-of date set to the last interval date, and the parser's rules cite the MDFF specification (AEMO), re-stated in our own words. Figures are computed by the server, not narrated by the host.
10. **What it does not do.** No recommendation; the output stays "lowest estimate for the readings". Direct file upload waits until hosts offer it; the paste route is the only one.

## Risks / Trade-offs

- A 117 KB paste may be beyond some hosts' tool-argument limits or too long for a model to copy faithfully. Mitigation: the size cap and a clear error; open question on whether a host can pass the file another way. A model that truncates the text would give a short, labelled period, not wrong figures: the days-present count is shown.
- The profile is only as good as the model passes it on. It is revalidated server-side, but a changed profile is undetectable. This is information for one person's own comparison, not a stored record.
- Daylight saving and window conversion are easy to get wrong. Tests will use a synthetic file with known peaks across a daylight saving change and check each state.
- Averages by month and weekday hide holidays. Accepted for v1; labelled.
- Solar households: `B1` export is reported, but export feed-in credit is only costed where the plan's feed-in is a single rate (as now).

## Open Questions

- Can each host pass a 100 KB tool argument? If not, a second form (a small summary the person or host computes) is needed. To test on the three hosts or the MCP Inspector.
- Is `E2` always controlled load? Distributors differ; v1 treats it as controlled load and says so. Ask Iven whether a second file from a household with controlled load or solar is available.
- Which retailers and distributors also give NEM12 with a `100` header and `900` end line? Those files are a superset of this one; the parser handles both, but only this one has been seen.
- Does the person want the profile kept for later? Out of scope (rule 3), but a "copy this summary for next time" text could be offered without storing it.
