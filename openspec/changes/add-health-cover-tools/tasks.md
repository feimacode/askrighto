## 1. Search and lookup

- [x] 1.1 Implement `search_health_cover_products` with the filters in design.md, a limit cap, the count of matches, the count with no published premium and the file date
- [x] 1.2 Implement `get_health_cover_product` with all stored fields and the optional PHIS link
- [ ] 1.3 Check snapshot size and search speed on a real file; add an index or narrower snapshot if needed

## 2. Compare and calculate

- [x] 2.1 Implement `compare_health_cover_products` (2 to 4 variants) with Inkview comparison and text fallback
- [x] 2.2 Implement the pure calculator `src/health/calc.ts` for premium after rebate, surcharge break-even and loading, using rules from `rulesAt(date)`, integer cents and a single final rounding
- [x] 2.3 Implement `estimate_premium_after_rebate`, `check_levy_surcharge_breakeven`, `estimate_lifetime_health_cover_loading`, `get_health_cover_rules` with their `NotEstimated` reasons
- [x] 2.4 Make sure income, age and household are never logged, stored or returned beyond the call

## 3. Wiring and wording

- [x] 3.1 Register the tools under the `health-cover` vertical; add `health-cover` to `KNOWN_VERTICALS`; write its instructions text (facts only, no advice, no commission, do not ask for conditions, confirm with insurer)
- [x] 3.2 Extend the banned-phrase list and the notice text; add the "insurer's quote governs" line to every calculated result
- [x] 3.3 Confirm the vertical is absent from the public route unless named in `ASKRIGHTO_PUBLIC_VERTICALS`
- [x] 3.4 Update `list_data_sources` for the two datasets and their attribution

## 4. Tests and checks

- [x] 4.1 Unit tests per tool on the fixture: found, not found, null premium, unknown tier code, out-of-range date, proposed rule never used, hospital component unsplittable
- [x] 4.2 Calculator tests against hand-worked examples from the ATO pages (record the example and the page in the test)
- [x] 4.3 Tools visible on the internal route and not on the public one (in-memory test, plus a smoke run against a local PostgreSQL); no tool schema has a condition-like input
- [ ] 4.4 Number trace: no figure in tool text that is not in stored data or labelled calculated (not run; the unit tests assert the calculated figures by hand)
- [ ] 4.5 Check the data licences are still current (data.gov.au record, ATO pages) before shipping
- [x] 4.6 Add `docs/areas/health-cover.md` (area doc in the same three-part form as the others); there is no separate `docs/health-cover-tools.md`
