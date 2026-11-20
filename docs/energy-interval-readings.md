# Interval readings (NEM12)

A household can ask its retailer or distributor for its interval readings (use in half-hour steps from a smart meter). Ask Righto reads such a file to estimate plans from the household's own use, which also lets time-of-use plans be costed. Change: `add-energy-readings-upload`. Asking for the readings is covered in [`energy-readings.md`](energy-readings.md); Ask Righto does not request them for the household.

## How it works

1. The person gets a NEM12 file (a CSV) from their distributor or retailer.
2. `summarise_interval_readings` takes the file text unchanged and the postcode. It reads the file in memory, drops the NMI and meter serial, and returns the period, days present and missing dates, total and annual kWh, any solar export, data quality notes and a **profile string**.
3. `compare_energy_plans` takes that string unchanged as `readingsProfile`. The server keeps nothing between the two calls: the host carries the profile.

The profile (version 1, about 8 KB) is JSON: the postcode's state, the period, totals, the streams used, and for each month and for weekdays and weekends the kWh in each half hour **of the household's local clock** (daylight saving applied for the state). It holds no identifier and no per-day value. It is revalidated on every use (version, ranges, shape, and that the half-hour table adds up to the total).

## The format (checked 19 Nov 2026)

NEM12 is interval data: records 100 (header), 200 (NMI and stream), 300 (one day of values: date, 48 half-hour values, quality flag, reason, update time), 400 (events inside a day flagged `V`), 500, 900. NEM13 is accumulation data (250 records) and is refused: it has no half-hourly figures. Source: AEMO *Meter Data File Format Specification NEM12 & NEM13*, v2.7 (Doc Ref 1 December 2025). Real distributor exports can lack the 100 and 900 records and the last field of a line; the reader accepts that.

Rules the reader follows:
- 5, 15 and 30 minute intervals are summed to half hours; Wh and MWh are converted to kWh.
- More than one NMI, no consumption stream, a non-numeric value, a short interval line, a duplicate date or more than 250,000 characters is refused, naming the line and the problem, never the content.
- **Streams** (AEMO *National Metering Identifier Procedure*, section 7, Table 1; the 2009 edition still applies, per Iven, 19 Nov 2026). The first character says the kind and is named from the grid's side: **`E` is energy delivered to the household (main consumption) and `B` is energy the household puts into the grid (solar export)**, the opposite of how "import" and "export" read from the home. All `E` streams are summed as main consumption and all `B` streams as solar export. Averaged and check variants (`D`, `F` for consumption, `A`, `C` for export) are used only when the master stream is absent. A net stream `N` (E minus B) is used only when neither is present, and then solar export cannot be separated. Reactive, apparent and other streams are ignored.
- **Controlled load is a gap.** A controlled load circuit reported as a separate `E` stream (usually `E2`) cannot be told from main consumption by its suffix, so it is counted as main consumption and costed at the general rate. The result says so.

## How plans are costed from it

- Annual use is the measured total scaled from the days present to 365 days, and spread evenly over tariff periods, as for a bill.
- For a time-of-use plan, the share of use in each band is taken from the profile for the months each tariff period covers, using the plan's windows (days and times, local clock). A plan with several shoulder bands (SHOULDER1, SHOULDER2) gets each band's own share. Windows may end at 20:59 or 21:00; weekday windows must cover all of Monday to Friday and weekend windows both days; overnight windows are read across midnight. A plan whose windows leave half hours uncovered, overlap, fall off a half hour, or cover only some weekdays is listed as **not estimated**, with the reason. One band with no windows takes the rest of the day.
- Solar export (the `B` total, scaled) is costed at the plan's single feed-in rate; a time-varying or capped feed-in stays not estimated, as with a bill.
- Public holidays are treated as ordinary days. The change-over day for daylight saving uses the new offset for the whole day, a small error on two days a year.
- The result is labelled "the household's own interval readings", with the period, days present and any scaling. It rests on one past year of use, and the readings prompt and typical-usage notice are not shown with it.

## Size limits

- **Our server:** the HTTP request body is limited to 256 KB (`ASKRIGHTO_BODY_LIMIT`, default `256kb`). Anything larger is refused by the transport before any tool runs, with a `Request body over 256kb` error. Tested 19 Nov 2026: 251 KB was read, 439 KB was refused.
- **The tool:** the text is limited to 250,000 characters, just under that, so a too-long paste gets a plain message (`needs_input`: the size, the limit, and "send a shorter period or ask for 30-minute intervals"), not a transport error. The limit holds a year of 30-minute data with a solar export stream (about 230,000 characters); one stream for a year is 114 KB; a year of 5-minute data is about 630-730 KB and does not fit, but about four months does.
- **5-minute and 15-minute data are read as they are** and summed to half hours, so the profile is the same size (about 8 KB) however fine the interval. Fine precision adds nothing for plan windows, which fall on the hour or half hour.
- **The real bottleneck is the model:** to paste a file it must write it out, roughly 50-70 thousand tokens for a year of 30-minute data. The hosts' own limits on tool arguments are not known; see `energy-readings-host-test.md`. A route where the host's own code or a file reference carries the file would avoid it (proposed, not built).

## Privacy

The file text and the profile are never stored or logged (the framework logs only error messages, and errors carry a line number and a problem, never content). The NMI and meter serial are dropped before anything is built, so they appear in no result. Nothing is kept between calls (rule 3). The data is the person's own, not a dataset; see the `energy-plans` entry in `data-rights.md`.

## Tested with

Synthetic files built in the tests (invented NMI and serial), and Iven's real file on a developer machine only (not committed): an independent calculation gave the same total, annual figure and band shares to four decimals. The file's layout: one NMI, register `E1`, kWh, 30-minute intervals, 364 daily records with one missing day, two variable days with power-outage events, no 100 or 900 record. Not yet tried with a solar (`B`) file, nor on the three hosts or the MCP Inspector (the cap and the profile size, about 8 KB, should be checked there).
