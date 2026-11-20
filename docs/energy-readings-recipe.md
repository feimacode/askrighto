# The fallback when the file cannot be passed (layer 3)

`summarise_interval_readings` is the first choice: it reads the file and signs the profile it returns. This recipe is for the case where the assistant cannot pass the file text to the tool (the file is too long to write out, or the tool is not reachable). The assistant then builds the same profile itself and passes it as `readingsProfile`. Ask Righto accepts it after the same shape and totals checks, and **labels every estimate from it "not verified by Ask Righto"**, because the server cannot tell whether the arithmetic was done correctly.

Never sum the readings and apply peak or off-peak hours of your own: the point of the profile is that Ask Righto matches each plan's own windows.

## Rules for reading a NEM12 file

Source: AEMO Meter Data File Format Specification NEM12 and NEM13 (MDFF), and the AEMO National Metering Identifier Procedure (v5.1, 2009, section 7, Table 1) for stream suffixes. Check the current versions on aemo.com.au before relying on them.

1. `200` records start a stream (NMI, suffix, interval length in minutes). `300` records hold one day of interval values for the stream above them (`CCYYMMDD`, then 1440 / interval values, then a quality flag and other fields). `400` records qualify intervals inside the day. `250` records mean an accumulation (NEM13) file: stop, interval data is needed.
2. **Consumption** is every stream whose suffix starts with `E` (E1, E2, ...). **Solar export** is every stream whose suffix starts with `B`. Other suffixes are ignored unless there is no E stream, in which case a net stream (`N`) is the only usable one and the result says so. Controlled load is not separated: every E stream counts as main consumption.
3. Use more than one NMI? Stop: a profile is for one meter.
4. Sum intervals into half hours: 5-minute values six at a time, 15-minute two at a time. Values are kWh per interval.
5. Meter dates and times are in market time, AEST (UTC+10) all year, with no daylight saving.
6. **Never include the NMI, meter serial or any per-day value in the profile.**

## The profile

One JSON object, passed as the `readingsProfile` string:

| Field | Meaning |
| --- | --- |
| `v` | `1` |
| `state` | `NSW`, `VIC`, `QLD`, `SA`, `TAS` or `ACT`, from the property postcode |
| `from`, `to` | first and last date with interval data, `YYYY-MM-DD` |
| `daysPresent` | number of days with consumption data |
| `missing`, `missingCount` | dates between `from` and `to` with no data (list at most 31), and how many |
| `totalKwh` | total consumption over the days present |
| `exportKwh` | total solar export over the days present, omitted if there is no B stream |
| `netOnly` | `true` only when the only stream was net |
| `streams` | `{ "consumption": [suffixes], "export": [suffixes] }` |
| `nonActualDays`, `variableDays`, `outageIntervals` | counts of days or intervals not marked as actual data (use 0 if you cannot tell) |
| `sums` | 24 rows of 48 numbers, see below |

`sums` holds kWh summed over all days present. Row `= month * 2 + dayType`, where `month` is 0 (January) to 11 (December) and `dayType` is 0 for Monday to Friday and 1 for Saturday and Sunday. Column `= local half hour of the day`, 0 for 00:00 to 00:29 up to 47 for 23:30 to 23:59. **Month, day type and column all use the household's local clock**, not market time: add the state's offset to each half hour before placing it.

Local offset from market time: QLD +0. NSW, VIC, ACT and TAS +1 hour from the first Sunday in October to the day before the first Sunday in April, otherwise +0. SA +30 minutes in that period and -30 minutes otherwise. The offset for a whole calendar date is taken at the start of that date, so the two change-over days are slightly off.

Checks the server makes: the sums add up to `totalKwh` (within 0.5%), every value is a number in range, 24 rows of 48, dates in order. A wrong result passes these checks only if it is wrong in a way they cannot see, which is why the estimate is labelled.

## Signed profiles

Profiles built by `summarise_interval_readings` carry a `sig` field. Pass the string back unchanged: changing any character, including the order of numbers, makes the signature fail and the estimate is labelled not verified. A profile built by hand has no `sig`, and is accepted and labelled the same way.

The server key is set with `ASKRIGHTO_PROFILE_KEY` (see `docs/deploying.md`).

## Fallback A: sum by the current plan's hours and pass a bill (Iven, 20 Nov 2026)

Models are now able to do this reliably when the instructions are clear, so the fallback gives the model the rules and the hours instead of asking it to produce a profile. It reads the file by the rules above (NEM12: `200`, `300`, `250` stop, one NMI, E consumption, B export), moves times from market time to the local clock, puts every interval of every day in exactly one band using the **band hours of the user's current plan** (the option or hours layout picked from `list_current_plan_options`, in local time), and calls `compare_energy_plans` with `billUsageKwh` (whole-file total), `billDays`, the three share fields and `currentPlanId` or `hoursLayoutId`. Plans on the same hours are then exact and others approximate, labelled as such. The model must say it summed the file itself. A sample or part of the days is never used.

Fallback B (below, building the profile by the rules above) matches each plan on its own hours and so is better when the model can do it; Fallback A is simpler and is what the instructions lead with.

No script is supplied (Iven, 20 Nov 2026): the agent is given instructions and does the work itself. A reference script with a test that it matched the server was built and then removed for that reason; it is in git history (PR #67) if wanted again.
