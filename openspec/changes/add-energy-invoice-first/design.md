## Context

Numbers from the 17 Nov 2026 data (10,552 current electricity plans, 6,501 with a time-of-use tariff):

- Exactly identifying a plan is hard: brand, network and rates identify a single plan for 6 per cent of plans; brand, network and plan name for 25 per cent. Many plan ids share rates.
- Finding the **hours** is easy: 99 per cent of groups with the same brand, network and rates share identical windows (1,548 of 1,564 time-of-use groups).
- 228 distinct band-hour layouts overall; the most common covers 14 per cent of time-of-use plans and the top ten 45 per cent. For a retailer on one network the median is 2 layouts, 77 per cent of pairs have 3 or fewer, the most is 9.
- Invoice rates usually include GST; the stored rates are as published (exclusive).

## Decisions

1. **A pick list, not a match.** No automatic choice by name. `list_current_plan_options` groups plans with identical rates and hours into one option and ranks them by agreement with any rates the invoice gave (allowing for GST either way) and by the name words, then the user picks. Each option carries a stable `optionId` and up to three plan ids.
2. **Hours by layout.** A layout is the sorted set of (season, band type, days, start, end) windows; its id is a short hash. The fallback lists the layouts a retailer uses on that network, described in words ("Peak 3pm to 9pm weekdays; shoulder 7am to 3pm weekdays and 7am to 9pm weekends; off-peak otherwise").
3. **What a bill split means.** `compare_energy_plans` takes `currentPlanId` or `hoursLayoutId`. A split is applied exactly only to plans whose layout equals the current one; every other time-of-use plan is estimated with the same split and labelled "approximate: this plan's hours differ from the current plan's" (and a count is said in the summary). Without a reference layout, all time-of-use plans from a bill split are labelled approximate and the result says the hours of the household's own plan are unknown.
4. **Readings win.** If readings are given, the split and the layout are not used.
5. **Customer type first.** The agent asks (residential or small business), passes `customerType`, and the pick list covers only that type.
6. **Privacy.** The tool takes only the fields listed. A test checks that no input accepts free text longer than a plan name and that the instructions forbid sending identifiers; no invoice text is logged (the framework logs only error messages).
7. **Moving.** The instructions route "moving in, no readings" to typical usage for a household and to a stated estimate for a small business; no invoice step.
8. **Wording.** "Approximate" is said in the result, in the estimate's notes, and in the summary; no estimate from a different-hours plan is presented as the household's own.

9. **Source and date.** The pick list and the layouts are results like any other: they carry the `energy-plans` source link, licence and as-of date (the last sync), and a not-found says so plainly.

## Risks / Trade-offs

- A bill split is a weak input for plans with different hours; readings are the fix and the agent asks for both, invoice first.
- The agent's extraction from an invoice can be wrong, so it shows the fields back for confirmation before calling a tool.
- A user on a legacy plan not in the data picks "none of these" and the hours fallback gives only the layouts; if the user's layout is not listed either, estimates stay approximate.
- GST: matching on rates allows a tolerance both ways; a wrong guess is shown in the option's "matched on" text, not hidden.

## Open Questions

- Do invoices state the band hours? Often not (the Momentum example showed bands without hours); the fallback assumes the user can read them from the retailer's fact sheet or the plan page, which our tool links to.
- Should "approximate" estimates be ranked with exact ones or listed in a separate table? Proposal: separate table, so a different-hours plan is never ranked beside an exact one.
