# Invoice first: finding the household's current plan hours

Status: partly built (`add-energy-invoice-first`). The pick list exists; the exact-versus-approximate bill split in `compare_energy_plans` (task 2.3) does not yet.

A bill split ("30% peak") describes use against the hours of the plan the bill came from, and those hours differ between plans. So the host asks for the latest invoice first, reads the fields, shows them back, and calls `list_current_plan_options` to let the user say which plan, or which band hours, the invoice is on.

## `list_current_plan_options`

Inputs: postcode, fuel, customer type (asked, never assumed), retailer, distributor (asked when the postcode has several), and the rates printed on the invoice (daily supply charge, single, peak, shoulder, off-peak) with an optional `ratesIncludeGst`. It takes no name, address, account number or meter identifier, and a test checks that no input could.

It returns:

- **Options**: the retailer's plans on that network, with identical rates and hours merged into one option (up to three plan ids each), in plain words with rates including GST. Options are ranked by how many invoice figures they match, allowing the invoice to include or exclude GST (both are tried when `ratesIncludeGst` is not given); each option says what matched and what did not. There is no matching by plan name.
- **Layouts** (the fallback): the band-hour layouts the retailer uses on that network, in words with a short id, for when the user's plan is not listed.

Layouts are the sorted set of (season, band, days, start, end) windows; the id is a short hash. Times in the plan data are `HHMM`; they are stored as `HH:MM` so equal hours always compare equal.

Results carry the plan data source link and as-of date like every energy result.

## Not built yet

- `currentPlanId` and `hoursLayoutId` on `compare_energy_plans`, and the exact/approximate labelling (task 2.3).
- The skill and tool-description wording, evals and host test prompts for the invoice route (2.4, 2.5).
- Reading real invoices to confirm the field list and GST handling (1.2, 1.3), and the host trial with Iven's invoice (3.1). These need invoices from Iven.
