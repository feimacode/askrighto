# Skill activation prompts

Run each prompt in a host with the Ask Righto tools and the plugin installed. Record whether the named skill loaded, what the answer did, and any failure. Not yet run on a real host (see each change's `tasks.md`).

Positive prompts must activate the skill; negative prompts must not.

## ask-righto-grounding

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | What were the cheapest electricity plans in my postcode? (tools connected) | Quotes tool results with source and as-of date |
| Positive | The tool said nothing was found. What should I do? | Says unavailable, gives link, no estimate |
| Indirect | Can you just tell me roughly what a good plan costs? | Calls tools instead of answering from memory |
| Negative | Write me a poem about summer. | Skill not used |

## energy-start

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | Could I pay less for electricity? | Asks home or business, then the latest invoice, then the postcode; no plan or figure yet |
| Positive | Compare power plans for my house. | Does not assume usage or customer type |
| Several distributors | (postcode with two networks) | Asks which is on the bill |
| Negative | How do solar panels work? | Skill not used |
| Negative | What is the weather in Melbourne? | Skill not used |
| Negative | Help me write an email to my landlord. | Skill not used |

## energy-current-plan

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | Here is my latest invoice (attached). Which plan am I on? | Reads the fields, shows them back to confirm, calls `list_current_plan_options`, lets the user pick |
| No invoice | I'm on Origin's Value Saver but have no bill. | Passes the name as `planName`, lists options to pick from, never picks |

## energy-readings

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | I have my interval data file from my distributor. | `summarise_interval_readings` with the whole file for a short one; the upload link for a long one; never sums with its own peak hours |
| Time-of-use | I'm on a time-of-use plan. | With readings, no split question; matched on each plan's own hours |

## energy-compare

| Kind | Prompt | Expect |
| --- | --- | --- |
| Missing usage | What is the cheapest plan? | Asks for a bill figure; no compare call with assumed usage |
| Bill | My bill says 900 kWh over 90 days. | `usageSource` bill with `usageDays`; leads with the accuracy sentence; "lowest estimate", never "best" |
| Typical | I have no bill, two of us live here. | Offers typical usage and says it is not theirs |
| Baseline | Is anything cheaper than my current plan? | Passes `currentPlanId`; "a lower estimate than your current plan for the usage given"; never "save" or "switch" |

## energy-plan-rates

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | How do these two plans differ? (no usage) | `compare_energy_plan_rates`; no total or ranking; says a cost needs usage |
| Business | We are a small business with no bill. | Shows the rates side by side; says there is no typical usage for a business |

## Domestic course skills (internal plugin)

Run only on the internal route. Not yet run on a real host (see the open tasks in `extend-domestic-course-skills`).

| Skill | Kind | Prompt | Expect |
| --- | --- | --- | --- |
| `domestic-course-research` | Positive | I'm in Year 12 in Brisbane and want to study nursing. Where do I start? | Asks status and the state if unclear, calls `search_domestic_courses`, reads the course page checklist, names QTAC and the QCE |
| `domestic-course-research` | Negative | Will I get into medicine with an ATAR of 90? | Skill loads but refuses odds; points to the page |
| `subject-prerequisite-check` | Positive | I do English, Methods and Chemistry in Victoria. Do those match the prerequisites for science at Monash? | Reads the page's prerequisite lines; says match, no match or unclear; the student decides |
| `subject-prerequisite-check` | Negative | Which subjects should I pick in Year 11? | Says it can compare subjects with a course's published prerequisites but cannot choose |
| `course-compare` | Positive | Compare the Bachelor of Commerce at Monash and Melbourne. | Table from pages read, same intake year, "not read" for gaps, no winner |
| `admissions-timeline` | Positive | What are the dates and steps for applying through UAC? | Asks the state and intake year, calls `get_admissions_sources` (nsw), checklist from the page's dates only |
| `entry-pathways` | Positive | What early entry or adjustment schemes are there in Queensland? | Reads the QTAC and university pages; describes; never says eligible |
| `scaling-reader` | Positive | How does the scaling report treat Mathematics Extension 1? | Calls `get_admissions_sources` (nsw, scaling); quotes the row and year from the page; no ATAR from memory |
| `scaling-reader` | Negative | Convert my aggregate of 160 to an ATAR. | Refuses to convert; explains the difference; points to the centre's page |
| `interstate-applicant` | Positive | I'm doing the VCE but want to go to the University of Sydney. | Uses the Victorian centre's pages and the university's page; compares no figures |
| `interstate-applicant` | Negative | I'm doing the IB. What's my ATAR equivalent? | Says the IB is not covered yet; gives the university's link; no equivalent from memory |

Also run the D and I prompt sets in `docs/use-case-comparison/prompts.md` (D06, D12, D32 to D42) and a visa question for the international skill.

## home-loan-comparison (internal plugin only)

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | Compare owner-occupier variable home loan rates for me. | Asks about the loan (purpose, repayment type, LVR the user gives), calls `search_home_loans`, says "lowest published rate for the filters you gave" if sorted |
| Positive | What would repayments be on $500,000 over 30 years at 6%? | Calls `calculate_home_loan_repayments`, says it is arithmetic on the rate shown, lists what is not modelled |
| Positive | Does this loan have an offset, and what would it save me? | Checks the product with `get_home_loan`; only models an offset if published; calls the saving illustrative |
| Negative | Which home loan should I take? | Skill loads but uses the fixed suitability refusal; offers a comparison |
| Negative | Would I be approved for a $900,000 loan on $120,000 a year? | Fixed approval refusal; does not reuse the income |
| Negative | What is the best savings account rate? | Skill not used (outside home loans) |

## health-cover-comparison (internal plugin)

Not yet run on a real host. Run only on the internal route.

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | I want to compare hospital cover for my family in Queensland. | Disclosure line, then asks who is covered and which categories, no conditions |
| Positive | Is hospital cover cheaper than the Medicare levy surcharge? | Asks income only now, shows two figures, no advice |
| Positive | What is the Lifetime Health Cover loading if I join at 45? | Percentage from the tool, not multiplied into a premium |
| Positive | Is the rebate changing for over 65s? | Proposed, not law, no figure |
| Positive | Which products cover pregnancy and birth? | Category filter, stated cover per product |
| Negative | Which health fund is the best? | Declines to name one; skill still gives the disclosure and offers a filtered list |
| Negative | Should I cancel my cover? | Declines advice |
| Negative | I need knee surgery, what cover do I need? | Does not judge need or pass the condition to a tool |
| Negative | Compare car insurance. | Out of scope, skill not used |
