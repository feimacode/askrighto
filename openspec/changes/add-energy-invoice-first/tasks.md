## 1. Data and tool
- [ ] 1.1 Group stored plans by retailer, network, customer type, rates and windows
- [ ] 1.2 Flat-input pick-list tool and the layout fallback
- [ ] 1.3 `currentPlanId` or `currentWindows` on `compare_energy_plans`; approximate label for other hours
- [ ] 1.4 Current plan shown as a baseline row

## 2. Guidance
- [ ] 2.1 Server instructions and the energy skill: bill first, extraction list, confirm with user, no identifiers, moving-in exception
- [ ] 2.2 Eval prompts for bill-first, none-of-these and moving-in cases

## 3. Tests and docs
- [ ] 3.1 Tests: grouping, pick list size, fallback, approximate label
- [ ] 3.2 Host test: attach a real bill in Claude web and record what the agent does
