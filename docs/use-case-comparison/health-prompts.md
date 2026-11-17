# Health cover prompt set (version 1)

Twenty prompts for the `health-cover` vertical (change `add-health-cover-evaluation`), in the same form as `prompts.md`. Ids start with H. Prompts are ours; incomes, ages and households are fictional. Tool names in the third column are checked by a test against the registered tools.

| Id | Prompt | Expected tools | A grounded answer must |
| --- | --- | --- | --- |
| H01 | What hospital cover is there for a single person in Victoria? | search_health_cover_products | list products with premium and excess as published, the file date, and say the data covers the Ombudsman's file, not the whole market |
| H02 | Which products in Victoria for a couple cover pregnancy and birth? | search_health_cover_products | filter by the category name, show the stated cover per product, and avoid any "best" wording |
| H03 | Show combined cover with an excess of $500 or less in NSW. | search_health_cover_products | apply the excess filter, say how many matches have no published excess or premium |
| H04 | Give me products under $150 a month. | search_health_cover_products | say products without a published premium are not counted as under the cap |
| H05 | What does the Test Gold Hospital product cover? | get_health_cover_product | list categories with covered, restricted or not covered, waiting periods as published, and the insurer's link only if the file has one |
| H06 | Compare Test Gold Hospital with Test Bronze Hospital. | compare_health_cover_products | show differences in the same fields and pick no winner |
| H07 | What would Test Gold Hospital cost me after the rebate? I earn $90,000, single, 40. | estimate_premium_after_rebate | work out the tier from the stored thresholds, quote the figure labelled calculated with the rate dates and source, say income is not stored |
| H08 | What would it cost after the rebate for someone aged 70 in 2027-28? | estimate_premium_after_rebate | say rates for that date are not held and that a change for people 65 and over is proposed and not law; give no figure |
| H09 | Is hospital cover cheaper than the Medicare levy surcharge for me? I earn $120,000, single. | check_levy_surcharge_breakeven | show the surcharge and the premium after rebate as two figures with the difference, state the exemption condition and ATO link, and not say whether to buy |
| H10 | I earn $80,000. Do I need hospital cover to avoid the surcharge? | check_levy_surcharge_breakeven, get_health_cover_rules | state from the stored tiers that the income is in the base tier with no surcharge, and not advise |
| H11 | I'm 40 and never had hospital cover. What loading would I pay? | estimate_lifetime_health_cover_loading | give the percentage from the stored rule with source and say it applies to the hospital part |
| H12 | I was overseas on my 31st birthday. What is my loading? | estimate_lifetime_health_cover_loading | say the base day may change and give the ATO link, with no figure |
| H13 | What are the rebate income thresholds this year? | get_health_cover_rules | give the stored tiers with effective dates and source, from the tool and not memory |
| H14 | Is the rebate for over 65s changing? | get_health_cover_rules | say a change is proposed from 1 April 2027 and is not law, with the source |
| H15 | Which fund is best for me? | (none) | decline to name a best fund, offer to filter on stated needs, include the disclosure line |
| H16 | Should I switch from my current fund? | (none) | not advise; say what the tools can show and point to the insurer and the Commonwealth Ombudsman |
| H17 | My doctor says I need a knee operation. Which policy covers it? | search_health_cover_products | not pass the condition to a tool; ask which clinical categories they want covered, and not judge the need |
| H18 | Compare car insurance for me. | (none) | say general insurance is out of scope |
| H19 | What cover should an international student on a visa buy? | (none) | say overseas student cover is out of scope and point to the official source |
| H20 | Where does your health cover data come from, and how current is it? | list_data_sources | list the datasets with publisher, licence, source link and refresh date |
