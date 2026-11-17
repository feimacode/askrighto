## Context

`docs/health-cover-research.md` section 1 records the figures read on 17 Nov 2026: 2026-27 thresholds (single $105,000, $123,000, $164,000; family $210,000, $246,000, $328,000), rebate percentages by age band for 1 July 2026 to 31 March 2027, MLS rates 0, 1, 1.25 and 1.5 per cent, LHC 2 per cent a year over 30 capped at 70 per cent and removed after ten years of continuous paid cover. Energy already shows the pattern: rates are data with a source, a date and an explicit refusal when a case is not understood.

## Decisions

1. **Rules are data, not code constants.** `data/health/rates.yaml` holds each rule family (`rebate`, `mls`, `lhc`, `mls_exempt_excess`) as rows with `effectiveFrom`, `effectiveTo`, `status`, `source` (URL, `pageUpdatedOn`, `readOn`) and `reviewBy`. The loader writes `health_rates` and the evaluator reads only the loaded rows. Numbers in this repo's docs are examples, not inputs.
2. **Status is a hard gate.** Only `in_force` rows, and `legislated_future` rows whose `effectiveFrom` is on or before the date asked about, feed a calculation. `proposed` rows are never used for a number. The 1 April 2027 change for people 65 and over is stored as `proposed`; a tool asked about a cost after that date says that the rule is proposed and not law, shows the current rate, and links to the Department of Health page. When the bill passes, a data edit flips the row to `legislated_future` with the legislated dates and the same source.
3. **Date handling.** The calculator takes an "as at" date (default today). Rebate rates change on 1 April and thresholds on 1 July, so one financial year can have two rebate rate sets; the evaluator picks by date. If the date is outside any stored rule range it returns `NotEstimated` with reason `rules_out_of_range`.
4. **Integer arithmetic.** Rebate percentages are stored as integers in millionths of a per cent (24.118 per cent is 24118000) or as fixed decimal strings parsed to integers, and money as cents; the calculator rounds once, at the end, to the cent, and says "calculated". Insurers apply the rebate in their own way; a tool result says the insurer's quote governs.
5. **Rebate only on eligible cover.** The rebate applies to premiums for hospital and general treatment cover, not to ambulance-only products, and the file's own flags may not show that. Where the product data cannot say, the calculator returns `NotEstimated` rather than assume. (Unverified rule: confirm with the legal view and the ATO page.)
6. **MLS exempt excess.** The MLS is avoided only by hospital cover with an excess at or under a limit (about $750 single, $1,500 family; unverified, confirm on the ATO page) that meets the requirements. Stored as `mls_exempt_excess` with a source. Tools state the limit with its source and do not decide eligibility beyond comparing the excess.
7. **LHC.** Stored as parameters (percent per year, start age, cap, years to remove). The tool takes the age at which hospital cover started and years of continuous cover, and returns `NotEstimated` with a link for the cases the ATO page says change the base day (for example being overseas on the base day, or migrants), because the research read that page only in summary.
8. **Review rhythm.** Each row has `reviewBy`: next 1 April or 1 July. `release:check` fails on an overdue row, as it does for rights. The check compares stored thresholds with the ATO page by hand each time; nothing fetches the ATO page automatically (a fetch would add a scraping-style dependency for a few numbers a year).
9. **Rights.** Entry `health-cover-rates`, basis `own_words_facts` (numbers and rules re-keyed with source links; no ATO text copied), status `cleared_pending_legal_view`, review by 2027-04-01. Condition: licence of ATO and Department of Health pages recorded when confirmed.

## Risks / Trade-offs

- A missed 1 July update makes every estimate wrong while looking confident. Mitigation: `reviewBy`, the release check, and the date-range refusal.
- A proposed rule that becomes law with different dates than reported. Mitigation: the row stays `proposed` until a person checks the enacted text.
- Hand-maintained data has a person dependency (Iven or a delegate must do two reviews a year); the tasks add a calendar entry and a docs checklist.

## Open Questions

- Does the ATO MLS income definition ("income for MLS purposes") need its own stored description, or only a link?
- Should we carry state or territory adjustments at all? Assumed no.
