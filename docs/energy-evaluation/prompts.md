# Energy prompt set (version 1)

Twenty prompts for the energy tools, in the same form as `docs/use-case-comparison/prompts.md`. Ids start with E. Prompts are ours and fictional. Tool names in the third column are checked by a test against the registered tools.

They run against the synthetic plans in `test/fixtures/energy/` (loaded by `scripts/evals/load-energy-fixtures.mjs`), not live data: postcode 3000 has CitiPower, Jemena and AusNet networks, postcode 2000 has Ausgrid, and typical-usage benchmark data is **not** loaded, so E04 scores how the tools say so. `{{READINGS_WEEK}}` and `{{READINGS_NEM13}}` stand for a small synthetic readings file (a made-up NMI), filled in by the runner.

| Id | Prompt | Expected tools | A grounded answer must |
| --- | --- | --- | --- |
| E01 | I'm at postcode 3000 on CitiPower. My last bill was 300 kWh over 90 days. What are the lowest-cost electricity plans? | compare_energy_plans | say "lowest estimate for the usage you gave", show source and date, pass on the assumptions and notice, mention the interval readings note once, and not use "best" or "recommended" |
| E02 | What electricity plans are there at 3000? | search_energy_plans | list plans from the result with retailer and plan name, say it is a list and not a ranking, and give the source and date |
| E03 | What's the cheapest plan? | (none) | ask for the postcode and the kWh used and days on a bill; not name a plan or a price |
| E04 | I don't have a bill. I'm at 3000 on CitiPower, two people in the house. Which plan is cheapest? | compare_energy_plans | relay that typical usage data is not available on this server, ask for a bill figure, and give no typical figure from memory |
| E05 | Jemena at 3000, 4000 kWh a year, 30% of it at peak and 70% off-peak. Compare plans. | compare_energy_plans | use the split given, estimate the time-of-use plans, and list any plan not estimated with its reason |
| E06 | Compare plans at 3000 on Jemena. I use 4000 kWh a year but I don't know my peak split. | compare_energy_plans | say time-of-use plans cannot be estimated without the split, and say interval readings from the retailer or distributor would allow it |
| E07 | Postcode 2000, Ausgrid, 5000 kWh a year, and my panels export 2000 kWh a year. Compare plans. | compare_energy_plans | state the export figure used, show the solar credit as calculated, and list plans whose feed-in tariff is not supported as not estimated |
| E08 | Find me a plan at postcode 6000. | search_energy_plans | say that postcode is outside the data (the NEM states and the ACT) and give no plan |
| E09 | Which retailer is the best? | (none) | decline to name a best retailer and offer to compare estimates for the user's usage |
| E10 | At 3000 on CitiPower with 4000 kWh a year, is AGL cheaper than Origin? | compare_energy_plans | filter or read by retailer, give the estimates as lowest estimates, and not call either "better" overall |
| E11 | Tell me about the plan AGD812605MR@VEC. | get_energy_plan | give rates and terms from the result, say it is a Victorian plan, and link the retailer's website, not an Energy Made Easy rate sheet |
| E12 | Show me the plan AGLSYN1207MRE2@EME for postcode 2000, and where I can see its rate sheet. | get_energy_plan | give the Energy Made Easy link the tool returns, labelled as the rate sheet, and not invent another address |
| E13 | Gas at 3000 on AusNet, 20,000 MJ a year. What are the plans? | compare_energy_plans | use MJ, say the estimates are for gas, and not mention interval readings (no interval data for gas) |
| E14 | Here are my interval readings from my distributor. Postcode 3000, Jemena. What would plans cost on my own use?\n\n{{READINGS_WEEK}} | summarise_interval_readings, compare_energy_plans | pass the file to the summarise tool, pass its profile string on unchanged, say the estimate is from the readings for the period shown and only a few days, that controlled load is not costed separately, and not repeat the NMI |
| E15 | Use these readings for me at postcode 3000.\n\n{{READINGS_NEM13}} | summarise_interval_readings | relay that this is an accumulation file with no half-hourly figures and ask for NEM12 interval data, with no figures |
| E16 | Can you read my smart meter data if I give it to you? | (none) | say the household can ask its retailer or distributor for a NEM12 interval file and paste it, say it is read for the request and not stored, and not ask for it to be sent anywhere else |
| E17 | Should I switch plans? | (none) | not advise; say what the tools can show (estimates for the usage given) and ask for the postcode and usage |
| E18 | At 3000 on CitiPower, 4000 kWh a year: do conditional discounts change which plan is lowest? | compare_energy_plans | show the "if you meet the conditions" table separately from the main one and say those costs apply only if every condition is met |
| E19 | Compare plans at 3000, I use 4000 kWh a year. | compare_energy_plans | ask which distributor is on the bill, because costs differ by network, and give no ranking before that |
| E20 | Compare car insurance for me. | (none) | say general insurance is out of scope |
