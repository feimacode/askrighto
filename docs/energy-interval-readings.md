# Interval readings (NEM12)

Change: `add-energy-readings-upload`. A household that has asked its retailer or distributor for interval readings (see `docs/energy-readings.md`) can have its own file read, and plans costed from its own half-hourly use. Time-of-use plans can be estimated this way for the first time.

## How it works

1. `summarise_interval_readings` takes the pasted text of a NEM12 file, parses it in memory and returns the period, days present and missing, measured and yearly kWh, solar export if there is a `B` stream, quality counts, what was left out, and a **profile string**.
2. The host passes the profile string, unchanged, as `readingsProfile` to `compare_energy_plans`. The server revalidates it on every use (version, ranges, size). It keeps nothing between the two calls.

The profile holds, for each calendar month, the average kWh in each of the 48 half hours for weekdays and for weekends (about 1,100 numbers), plus the period, day counts and totals. It carries no NMI, meter serial or per-day value.

## The file (NEM12, AEMO Meter Data File Format specification v2.7, Dec 2025)

A real distributor export (United Energy, 18 Nov 2025 to 17 Nov 2026, checked 19 Nov 2026; the file itself is never committed): one `200` record (NMI, register, suffix `E1`, unit KWH, 30-minute intervals), a daily `300` record of 48 values plus a quality flag, and `400` event records for a day flagged `V`. It has no `100` header and no `900` end record, its last line lacks the trailing field and one date has no record. Times are market time, Australian Eastern Standard Time all year.

The reader accepts all of that. It refuses (and returns no figures): NEM13 accumulation files, numbered (type 6) streams, more than one NMI, no consumption stream, a value that is not a number or is negative, a day with too few values, a date repeated in one stream, and text over 600,000 characters. Errors name the line number and the problem, never the line. Units: kWh, Wh and MWh are used (converted); kVArh and other units are ignored. Intervals of 1, 5 or 15 minutes are summed to 30.

## Streams (AEMO NMI Procedure V5.1, August 2009, section 7, Table 1; Iven, 19 Nov 2026)

Names are from the grid's side, so "import" is the household's export. A suffix starting `E` is energy delivered to the household: **main consumption**. A suffix starting `B` is energy sent into the grid: **solar export**. The second character numbers the meter or element; streams with the same first character are summed (`E1` and `E2`). Check (`C`, `F`) and average (`A`, `D`) variants are used only if the master stream of that kind is absent, and never added to it. A net stream (`N`) is used only when there is no `E` stream; consumption is then net of the household's own solar and export cannot be separated, and the result says so. Reactive power, apparent energy, power factor and volts streams are ignored.

**Controlled load is a gap by decision.** A controlled load circuit on its own element (often `E2`) cannot be told from main consumption by suffix, so it is counted as main consumption and charged at the general rate; the result says controlled load is not costed separately.

Iven confirmed the 2009 edition of the NMI Procedure is still the relevant one. Not yet seen: a real file with a `B` stream (solar), and one with `100` and `900` records.

## Costing

- Annual kWh is the measured total scaled to 365 days by days present. Under 300 days or fewer than 9 months, the result is labelled partial; under 90 days no yearly estimate is given.
- For each time-of-use plan and tariff period, each half hour of each day in the period is assigned to the plan's own time-of-use rate by its windows. Plan windows are local clock time; the profile is in market time. Daylight saving: NSW, VIC, ACT and TAS are an hour ahead of market time from the first Sunday in October to the first Sunday in April; SA is half an hour ahead of market time in summer and half an hour behind in winter; QLD does not shift. The postcode decides the state. The weekday shift for the hour either side of midnight in summer is ignored.
- Windows are matched on weekdays and weekends only. A window for single days, only one weekend day, or public holidays cannot be matched to the profile, so the plan is listed as **not estimated** with the reason. So is a plan whose windows overlap or leave part of the day uncovered (no remainder is assumed to be off-peak).
- Solar export is the yearly `B` total, costed as for a stated export figure (single-rate feed-in only).
- Months missing from the file use the average of the months present.

## Privacy

The file, the profile and anything derived are never stored. The framework logs only error messages, and errors never contain input. A test checks that neither the NMI nor the meter serial appears in a result, and that a failing parse logs nothing from the input.

## Open

- Whether each host can pass a ~100 KB tool argument (task 1.3); the size cap of 600,000 characters is a placeholder until that is tested.
- A survey of how many stored plans have complete, non-overlapping windows (task 1.2 of the change); expect plans written with a gap to be "not estimated".
- A file with a `B` stream and a full MDP file with `100` and `900`.
