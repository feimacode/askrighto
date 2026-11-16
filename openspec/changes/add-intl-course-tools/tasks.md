## 1. Search and lookup

- [x] 1.1 Implement `search_intl_courses` with the filters in design.md, a page size cap and a count of matches with no published fee
- [x] 1.2 Implement `get_intl_course` including the expired label and the domestic link
- [x] 1.3 Add the statement timeout and the index (or the `ILIKE` fallback) after checking whether the extension is allowed (not needed: the store keeps a cached in-memory snapshot like the domestic one, so search is a filter over rows and no `pg_trgm` or `ILIKE` index is used)

## 2. Compare and checklist

- [x] 2.1 Implement `compare_intl_courses` (2 to 5 codes) with Inkview comparison and the labelled calculated yearly fee
- [x] 2.2 Implement `get_intl_entry_checklist` returning link, checklist and labelling rule, with no fetching

## 3. Wiring

- [x] 3.1 Register the tools under the `international` vertical and write its instructions (course facts only, no migration, visa or work-rights advice)
- [x] 3.2 Confirm the vertical is absent from the public route unless named in `ASKRIGHTO_PUBLIC_VERTICALS`
- [x] 3.3 Update `list_data_sources` to describe CRICOS and its attribution

## 4. Tests

- [x] 4.1 Unit tests per tool on the fixture (found, not found, null fee, expired course, over-large page size)
- [x] 4.2 End-to-end test: tools visible on `/mcp-internal/<token>` and not on `/mcp`
- [x] 4.3 Check that no tool output contains a number that is not in the stored data or labelled as calculated (asserted for fees and the calculated yearly figure on the fixture)
