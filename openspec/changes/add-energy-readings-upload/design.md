## Context

The sample file's records: `200,<NMI>,E1,E1,E1,,<serial>,KWH,30,`, then `300,<CCYYMMDD>,<48 values>,A|V,,,<update time>,` and, for a V day, `400,<start interval>,<end interval>,<quality>,<reason code>,`. The two V days carry reason code 79 (power outage alarm) on single intervals. Interval times are Australian Eastern Standard Time all year, so a summer "3pm to 9pm" window is 4pm to 10pm in the file. Plan time windows in CDR data are local time.

## Decisions

1. **Parse and summarise in one call, store nothing.** Rule 3 (stateless) and rule 1 (figures come from code, not the model): the host passes the text, the server parses and returns only aggregates. The NMI and serial are dropped at parse time and never logged; a test asserts they appear nowhere in the output or in log lines.
2. **Tolerant reader, strict about meaning.** Missing 100/900 records and a short last line are accepted (the real file has both). A day with no usable values, an unknown interval length, a negative value or a wrong value count is reported in the summary, not guessed. Quality flag A is used as is; V uses the 400 records (an outage-flagged interval is used as the file states it and counted); E, F, S and N are used and counted separately, so the person sees how much of the year is estimated.
3. **Costing from the plan's own windows.** For each plan, each interval is assigned to a band by the plan's time windows (converted from local time with daylight saving; Sydney and Melbourne share the rule, and Brisbane has no daylight saving, so the state of the postcode decides). A plan whose windows leave an interval uncovered or overlapping is not estimated, with that reason, never defaulted.
4. **A year from part of a year.** Days present are scaled to 365 by their own months so a missing February day does not skew a summer-heavy year; the estimate states how many days were used and the date range. Under 300 days, or fewer than 9 distinct months, the result is labelled partial and the scaling is stated; under 90 days it is not offered as a yearly estimate.
5. **Summary shape, not raw data, as the carrier.** A year is about 17,000 numbers (the sample is 117 KB), which some hosts cannot pass as an argument. The summary (monthly by hour of day, 12 by 24 values, with day counts) is compact enough to pass between the two tools and is all the costing needs, because plan windows align to the hour or half hour. If a plan has windows on half hours, the summary keeps 48 slots instead of 24.
6. **Size cap.** The reader refuses text over a stated cap (start at 1 MB) with a plain message, and never truncates silently.
7. **Wording.** Results say "your readings, 18 Nov 2025 to 17 Nov 2026, 364 days" and that estimates still exclude things the plan data does not give. The readings prompt is not shown when readings were used.

## Risks / Trade-offs

- A host model passing 117 KB of text may truncate it. The tool counts days and values and fails loudly if the file ends mid-record, and the message tells the person to try a shorter date range.
- One household's year is one year: usage may change. The result says so once.
- Distributor exports differ (United Energy's "VEC" file lacks the 100/900 records). More real files would help; the tolerant reader is tested against the sample and against the spec's own examples.
- Time-of-use windows in plan data may be incomplete or odd (AGL labels both bands SHOULDER). Those plans are costed only if their windows are complete and non-overlapping, otherwise not estimated with the reason.

## Open Questions

- Which hosts can pass a 100 KB tool argument today? If none, the fallback is the person pasting a shorter range, or a summary built by the host's own file tools. Test in Claude, ChatGPT and Gemini before shipping.
- Does Iven want the summary tool exposed as its own tool, or folded into `compare_energy_plans` as a `readingsText` argument? The design assumes a separate tool; folding in needs only a thin wrapper.
- Confirm the 400 record handling against a second real file that has flags other than A and V.
