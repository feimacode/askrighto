# Invoice first: finding the household's current plan hours

Status: built except the checks that need real invoices (`add-energy-invoice-first`): the pick list, the exact-versus-approximate bill split in `compare_energy_plans`, the instructions, the skill and the eval prompts E21 to E24.

A bill split ("30% peak") describes use against the hours of the plan the bill came from, and those hours differ between plans. So the host asks for the latest invoice first, reads the fields, shows them back, and calls `list_current_plan_options` to let the user say which plan, or which band hours, the invoice is on.

## `list_current_plan_options`

Inputs: postcode, fuel, customer type (asked, never assumed), retailer, distributor (asked when the postcode has several), and the rates printed on the invoice (daily supply charge, single, peak, shoulder, off-peak). It takes no name, address, account number or meter identifier, and a test checks that no input could.

It returns:

- **Options**: the retailer's plans on that network, with identical rates and hours merged into one option (up to three plan ids each), in plain words with rates including GST. Options are ranked by how many invoice figures they match, with invoice figures taken as GST inclusive (Iven, 20 Nov 2026) and compared with stored rates plus 10 per cent; each option says what matched and what did not. There is no matching by plan name.
- **Layouts** (the fallback): the band-hour layouts the retailer uses on that network, in words with a short id, for when the user's plan is not listed.

Layouts are the sorted set of (season, band, days, start, end) windows; the id is a short hash. Times in the plan data are `HHMM`; they are stored as `HH:MM` so equal hours always compare equal.

Results carry the plan data source link and as-of date like every energy result.

## `compare_energy_plans` with the household's hours

With a bill split (peak, shoulder and off-peak percentages) the host passes `currentPlanId` (the plan id of the option the user picked) or `hoursLayoutId` (the layout the user picked when their plan was not listed), never both. The server compares each time-of-use plan's layout id with the household's:

- **Same hours**: the split is applied and the estimate is ranked in the main table.
- **Different hours**: the estimate is made with the split but labelled "approximate: different hours" and listed in a separate "Approximate" table, never ranked with the exact ones.
- **Hours unknown** (no id given): every time-of-use estimate is labelled approximate, in the same separate table, and the result says the household's own hours are not known.
- **Interval readings or typical usage**: no hours are needed and nothing is labelled approximate for this reason; ids given with them are not used.

Plans with no time-of-use rates (single rate, block rates) are unaffected. The structured result carries `approximateHours`, `hoursBasis` and `counts.approximate`. In Inkview the main table carries a footnote saying how many plans were estimated only approximately; the separate table is in the text result.

Invoice rates always include GST (decided by Iven, 20 Nov 2026), for homes and small businesses alike, so `list_current_plan_options` converts them against the stored GST-exclusive rates and takes no includes-GST flag.

## Not done

- Reading real invoices to confirm the field list (1.2) and the GST handling against them (1.3), and the host trial with Iven's invoice (3.1). These need invoices from Iven.
- The Inkview output shows one table, so the approximate table is text only there.
