# Invoice first: finding the household's current plan hours

Status: built except the checks that need real invoices (`add-energy-invoice-first`): the pick list, and the exact-versus-approximate bill split in `compare_energy_plans`.

A bill split ("30% peak") describes use against the hours of the plan the bill came from, and those hours differ between plans. So the host asks for the latest invoice first, reads the fields, shows them back, and calls `list_current_plan_options` to let the user say which plan, or which band hours, the invoice is on.

## `list_current_plan_options`

Inputs: postcode, fuel, customer type (asked, never assumed), retailer, distributor (asked when the postcode has several), and the rates printed on the invoice (daily supply charge, single, peak, shoulder, off-peak). It takes no name, address, account number or meter identifier, and a test checks that no input could.

It returns:

- **Options**: the retailer's plans on that network, with identical rates and hours merged into one option (up to three plan ids each), in plain words with rates including GST. Options are ranked by how many invoice figures they match, with invoice figures taken as GST inclusive (Iven, 20 Nov 2026) and compared with stored rates plus 10 per cent; each option says what matched and what did not. There is no matching by plan name.
- **Layouts** (the fallback): the band-hour layouts the retailer uses on that network, in words with a short id, for when the user's plan is not listed.

Layouts are the sorted set of (season, band, days, start, end) windows; the id is a short hash. Times in the plan data are `HHMM`; they are stored as `HH:MM` so equal hours always compare equal.

Results carry the plan data source link and as-of date like every energy result.

## `compare_energy_plans` with the current plan

With a peak, shoulder and off-peak split from the invoice, the host passes `currentPlanId` (the plan the user picked) or `hoursLayoutId` (the layout, when none of the plans fitted).

- A plan whose layout id equals the current one is estimated with the split and ranked as usual.
- Any other time-of-use plan is estimated with the same split but listed in a separate **Approximate** table (`approximate` in the data), with a note, and is never ranked beside an exact one. The summary says how many.
- With a split and neither id, every time-of-use plan is approximate and the note says the household's own hours are unknown.
- With readings, typical usage, or no split, nothing changes and nothing is labelled approximate for this reason.
- An unknown `currentPlanId` returns not found and asks the host to pick again; a plan with no time-of-use hours asks the user to check the invoice.

## Evals

Prompts E21 to E23 in `docs/energy-evaluation/prompts.md` cover a matched plan, an unmatched plan (hours fallback) and a customer moving house. A business prompt waits for a business plan in the eval fixtures.

## Not done

- Reading real invoices to confirm the field list and the GST handling (tasks 1.2, 1.3), and the host trial with Iven's invoice (3.1). These need invoices from Iven.
- A business-customer eval prompt (needs business fixtures).
