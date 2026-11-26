# Proposal

## Why

`add-energy-readings-prompt` (PR #45) tells people they can ask their retailer or distributor for interval readings, and says Ask Righto cannot read the file yet. The reason to ask is that readings are the most accurate usage input and the only fair way to compare time-of-use plans: a benchmark or one bill cannot say when a household uses power.

Iven (19 Nov 2026) supplied a real file from his own household (United Energy, Victorian Energy Compare export, 18 Nov 2025 to 17 Nov 2026) and the AEMO MDFF specification (NEM12 and NEM13, Doc Ref 1 December 2025). Reading both settled the format: **the file is NEM12 (interval data), not NEM13 (accumulation data)**. It has one `200` record (one NMI, register `E1`, kWh, 30-minute intervals), 364 daily `300` records of 48 values and six `400` event records, with no `100` header and no `900` end record. A year is about 17,500 numbers; a household cannot be expected to add them up, and the host model must not (grounding: every figure comes from a lookup or a deterministic calculation the server owns).

## What Changes

- Add a read-only tool `summarise_interval_readings` that takes the text of a NEM12 file the person has downloaded from their distributor or retailer, parses it in memory, and returns a compact, validated **profile** and plain facts about the file: period covered, days present and missing, total kWh, a note on quality flags and outages, and which registers were found. The NMI, meter serial and any other identifier are dropped and never returned, logged or stored.
- Extend `compare_energy_plans` with an optional `readingsProfile` input (the string the first tool returned). When given, usage comes from the readings: annual kWh from the profile (every `E` stream counts as main consumption), solar export from the `B` streams if present, and **time-of-use plans are estimated for the first time** because the share of use in each plan's peak, shoulder and off-peak windows is worked out from the half-hourly profile, not asked for.
- Mark the usage basis `"readings"` and label every result "from the household's own interval readings, period X to Y", with the missing days and the scaling to a full year stated.
- Tell the host, in the tool description, server instructions and energy bill skill, when to offer the upload (only after the readings note, only when the person has a file) and what not to do: never ask for a file to be sent anywhere else, never read the figures out of the file itself.
- Refuse clearly: NEM13 accumulation files (no intervals), files with no consumption register, files over the size cap, text that is not a NEM12 file.

Data source: the person's own readings, supplied in the request. No dataset is loaded. The file format is the AEMO Meter Data File Format Specification (NEM12 & NEM13, v2.7, Doc Ref 1 December 2025), re-stated in our own words. Licence: not applicable to user data; the specification is cited, not copied. Refresh: none; the parser is re-checked when AEMO publishes a new MDFF version.

Hosts affected: Claude, ChatGPT and Gemini, through one new tool and one optional input. Flat inputs only: the profile travels as a single string, not an object.

Out of scope:

- Storing readings, a profile or anything derived from them, on any route, even for a session. No account, no history.
- Requesting data for the person, authorisation forms, or any CDR data recipient role.
- NEM13 accumulation data, gas, and business customers.
- Recommending a plan or a usage change; the result stays "lowest estimate for the usage in your readings".
- Controlled load. A controlled load circuit that a meter reports as its own `E` stream (usually `E2`) cannot be told apart from main consumption by its suffix, so it is counted as main consumption and the result says controlled load is not costed separately (a gap, listed as an omission). Also out: demand charges and solar export time-of-use beyond what the profile can support (listed as not estimated, as today).
- Direct file upload (hosts differ; revisited when they offer it).

## Capabilities

### New Capabilities

- `energy-interval-readings`: reading a NEM12 file into a validated, identifier-free, compact profile, without storing it.

### Modified Capabilities

- `energy-plan-comparison`: usage may come from a readings profile, and time-of-use plans are estimated from it.

## Impact

- New: `src/energy/readings/` (parser, profile encoding, window shares), `src/tools/summarise-interval-readings.ts`, `docs/energy-interval-readings.md`, a synthetic NEM12 fixture under `test/fixtures/readings/` (built to the same layout; Iven's own file is never committed).
- Changed: `src/tools/compare-energy-plans.ts` (the input, the basis `readings`, wording), `src/energy/calc.ts` (`UsageBasis`, no maths change), server instructions, the energy bill skill, the readings note wording from #45.
- No migration and no database change. Depends on `add-energy-benchmark-usage` and `add-energy-readings-prompt` (both merged).
