# Home loan evaluation protocol

1. Load data on a test database (`homeloans:sync`, `homeloans:cash-rate`) and run `npm run report:homeloans`; keep the output. It must show no problems.
2. Start the server with `ASKRIGHTO_VERTICALS=energy,home-loans`, `ASKRIGHTO_INTERNAL_TOKEN` set and `home-loans` not public. Connect each host to `/mcp-internal/<token>` with the internal plugin installed.
3. For each prompt in `prompts.md`: note the outcome counts at `/metrics-internal/<token>`, paste the prompt into a fresh chat (run H16 to H22 three times), and score the answer in `scorecard.md`: tools called, every figure traced to a tool result (use the answer-review skill and `scripts/trace-numbers.mjs`), banned wording seen (quote it), notices present, refusal correct.
4. Run the accuracy check (`accuracy-check.md`) and the calculator check (below).
5. Compare with `thresholds.md`.

## Calculator check

Take at least three independent worked examples (a lender calculator or published example each) and record source, date, inputs and the published figure. `calculate_home_loan_repayments` must match each payment within one cent. The unit tests already pin $500,000 at 6% over 30 years to $2,997.75 and $600,000 at 6.5% over 25 years to $4,051.24 (checked against an independent decimal calculation); real lender examples are still to be collected.

## Known gaps

- No live lender payload has been read; early coverage numbers may reflect data shape problems, not the product.
- A 24-prompt set gives direction, not statistics.
- Browsing assistants on lender pages are untested.

## Proxy checks (version 2, `add-home-loan-proxy-evals`)

Before the hand run in a host, run these; both need no database.

1. `npm test` (mock-lender proxy tests and the prompt-set tests) and `npm run homeloans:live-check` (the real Register and three lenders). Keep the output.
2. `npm run evals -- --set home-loans --repeat 3`, or Actions → Evals with `set` = `home-loans`. Mechanical scoring covers tools called, untraced figures and the row checks; the "A grounded answer must" column is still ticked by a person. Home loan data is live, so note the date and re-run a failing row once before reading anything into it.
3. In the hand run, H16 to H23 and H30 run three times; H25 and H27 need a person to confirm the answer says how much of the list was read.
