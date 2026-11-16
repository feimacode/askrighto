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
