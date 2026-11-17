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

## energy-bill-comparison

| Kind | Prompt | Expect |
| --- | --- | --- |
| Positive | Could I pay less for electricity? | Asks postcode, then kWh and days |
| Positive | Compare power plans for my house. | Does not assume usage |
| Missing usage | What is the cheapest plan? | Asks for a bill figure; no compare call with assumed usage |
| Several distributors | (postcode with two networks) | Asks which is on the bill |
| Time-of-use | I'm on a time-of-use plan. | Asks for the peak, shoulder and off-peak split |
| Negative | How do solar panels work? | Skill not used |
| Negative | What is the weather in Melbourne? | Skill not used |
| Negative | Help me write an email to my landlord. | Skill not used |

## vce-course-research and intl-course-finder (internal plugin)

Use the D and I prompt sets in `docs/use-case-comparison/prompts.md`, including D06 (aggregate to ATAR), D12 (will I get in) and a visa question for the international skill. Run only on the internal route.

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
