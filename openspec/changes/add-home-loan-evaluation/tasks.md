## 1. Coverage report

- [x] 1.1 Implement `report:homeloans` with the measures in the proposal, table and JSON output; verify tests against the fixture set including a failing lender, a not-understood product and a tailored product
- [x] 1.2 Add rights status and verified-age lines; verify the report fails loudly when a dataset is `pending`

## 2. Accuracy check

- [x] 2.1 Write `docs/home-loan-evaluation/accuracy-check.md` with the sampling rule, the record template and the mismatch classes; verify it names at least 30 products drawn from the loaded data
- [ ] 2.2 Run the check (manually or by the user's browsing assistant, never by our server) and fill the table; verify every row has the read time and a verdict, and every mismatch has a class
- [ ] 2.3 Recheck each mismatch after 24 hours; verify the write-up separates real data errors from timing

## 3. Calculator check

- [ ] 3.1 Collect at least three independent worked examples (lender calculator or published example), each with source and date; verify `calculate_home_loan_repayments` matches within one cent per payment and the table records the sources

## 4. Prompt set and protocol

- [x] 4.1 Write `docs/home-loan-evaluation/prompts.md` (H01 to H24, expected tools, "must" column) and `protocol.md`; verify a test that every tool named in the table is registered
- [x] 4.2 Write `scorecard.md` with per-prompt and per-host summary tables
- [ ] 4.3 Run all prompts on Claude and ChatGPT (and Gemini if admitted), three runs for H16 to H22; verify results are recorded or the host is marked untested

## 5. Thresholds

- [x] 5.1 Write the proposed thresholds in `docs/home-loan-evaluation/thresholds.md` and link them from `docs/promotion-checklist.md` as a draft awaiting Iven's decision; verify the file states which are drafts
- [ ] 5.2 Check the CDR and RBA terms read dates are still current before the report is used for a promotion decision
