## 1. Coverage report

- [ ] 1.1 Add a `health-cover` case to `compare:usecases` printing file date and age, insurer and product counts, share of products with a published premium and an after-rebate premium, counts by hospital tier code, each rule row's effective range and review date, and rights status of both datasets
- [ ] 1.2 Make the report fail loudly when the file predates the last 1 April or 1 July, or a rule row is overdue

## 2. Prompts and scorecard

- [ ] 2.1 Write about 20 prompts in `docs/use-case-comparison/health-prompts.md` with expected tools and what a grounded answer must contain, including the refusal and edge prompts
- [ ] 2.2 Extend `docs/use-case-comparison/scorecard.md` with the two health measures (rule currency, wording safety) and the health-specific checks
- [ ] 2.3 Extend `scripts/trace-numbers.mjs` and the answer-review skill with dollar, percentage and date tracing and the health banned-phrase list

## 3. Gates

- [ ] 3.1 Add the health cover section to `docs/promotion-checklist.md` with the eight draft gates above
- [ ] 3.2 Add the calculator accuracy check procedure (sample products, how to obtain the insurer's published figure, how to record differences) to `docs/health-cover-tools.md`
- [ ] 3.3 Check the data licences (data.gov.au record, ATO pages) and the directory policies are still current when the scorecard is run

## 4. Run

- [ ] 4.1 Run the prompt set in Claude on the internal route against a real loaded file and record the scorecard (requires `add-health-cover-data` task 1.1 done and a real load)
- [ ] 4.2 Repeat in ChatGPT once its plugin conversion exists; mark Gemini untested until Connected Apps access exists
- [ ] 4.3 Summarise the result for Iven with the gates ticked or open; do not promote
