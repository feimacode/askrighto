## 1. Guards

- [ ] 1.1 Extend `release:check` so a public `home-loans` with any home loan dataset not `cleared` fails; verify tests for each status
- [ ] 1.2 Add the production start-up guard requiring `docs/legal/home-loans-view.md` with reviewer, date and scope when `home-loans` is public; verify tests for missing file, file without scope, and a valid file
- [ ] 1.3 Add `ASKRIGHTO_HOME_LOAN_TOOLS` so the public route registers only the tools named in the marker scope; verify the calculator is absent when not in scope

## 2. Corrections and retraction

- [ ] 2.1 Extend `docs/permissions/log.md` corrections process for wrong rates (five business day target, one business day removal for a confirmed error); verify the page names who reads the reports
- [ ] 2.2 Implement `ASKRIGHTO_HOME_LOAN_EXCLUDE` applied at read time; verify a test that an excluded lender's products disappear from search, get and compare, and that the coverage block counts them

## 3. Checklist and drafts

- [ ] 3.1 Add the home loan gates to `docs/promotion-checklist.md` with evidence fields; verify the checklist links the evaluation thresholds
- [ ] 3.2 Write `docs/legal/README.md` and a marker template, with the seven legal questions from `docs/home-loans-research.md`; verify the template has fields for reviewer, date, scope and conditions
- [ ] 3.3 Draft listing text for Claude, ChatGPT and Gemini in `docs/listing-drafts/home-loans.md`, marked draft; verify it contains the notices and the "no advice" statement and check each host's current category and policy text before use (mark any not checked)
- [ ] 3.4 Add review dates for the home loan rights entries (1 March, 1 September) and verify `overdueReviews` reports them when past

## 4. Decision requests

- [ ] 4.1 Post the three open questions to Iven in the pull request and record his answers in this change's design; verify AGENTS.md is edited only if he asks
- [ ] 4.2 Re-read the CDR operative rule, RBA terms and ASIC comparison-site guidance before the first promotion decision and record the date
