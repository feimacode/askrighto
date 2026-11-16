## 1. Search and lookup

- [ ] 1.1 Implement `search_intl_courses` with the filters in design.md, a page size cap and a count of matches with no published fee
- [ ] 1.2 Implement `get_intl_course` including the expired label and the domestic link
- [ ] 1.3 Add the statement timeout and the index (or the `ILIKE` fallback) after checking whether the extension is allowed

## 2. Compare and checklist

- [ ] 2.1 Implement `compare_intl_courses` (2 to 5 codes) with Inkview comparison and the labelled calculated yearly fee
- [ ] 2.2 Implement `get_intl_entry_checklist` returning link, checklist and labelling rule, with no fetching

## 3. Wiring

- [ ] 3.1 Register the tools under the `international` vertical and write its instructions (course facts only, no migration, visa or work-rights advice)
- [ ] 3.2 Confirm the vertical is absent from the public route unless named in `ASKRIGHTO_PUBLIC_VERTICALS`
- [ ] 3.3 Update `list_data_sources` to describe CRICOS and its attribution

## 4. Tests

- [ ] 4.1 Unit tests per tool on the fixture (found, not found, null fee, expired course, over-large page size)
- [ ] 4.2 End-to-end test: tools visible on `/mcp-internal/<token>` and not on `/mcp`
- [ ] 4.3 Check that no tool output contains a number that is not in the stored data or labelled as calculated
