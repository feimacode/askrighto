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

## Narrowing the list

Listing every plan of a retailer is not a choice a person can make (Momentum has 30 plans in 7 groups on one network), so the tool narrows by what the invoice shows:

- **No figures at all**: it answers `needs_input` and asks for the daily supply charge, the usage rate or rates and the plan or offer code. `showAllOptions: true` lists everything, for a user who can give none.
- **Plan code** (`planCode`, for example `MOM799904MR`): matches the plan id exactly, ignoring the `@VEC` or `@EME` suffix; a code printed on an invoice or fact sheet is the best way to find the plan.
- **Figures**: only the options that agree with them are listed, all that agree on every figure given, else those that agree on the most. An invoice rate matches any rate of its kind, so a plan with several SHOULDER bands is found by any of their rates.
- **How close is a match**: two figures agree when they differ by no more than half a unit of the last digit given, because an invoice prints a rounded figure (1.1187 within 0.00005; 1.12 within 0.005). A fixed loose tolerance made Momentum's Standing Offer and Bill Boss plans, a tenth of a cent apart, look identical.
- **Bands the invoice names differently**: an invoice says peak, shoulder and off-peak, but a plan whose bands are all labelled SHOULDER has no such band; the rate then matches any rate of the plan's bands.
- **Too many left**: more than four equally good options is not shown as a form; the result asks the agent to ask the user for more from the invoice and call again.
- **Nothing agrees**: no options, the band hours the retailer uses, and a note to check the figures (invoice rates include GST) or fall back to the hours.

## How the pick list is shown

The result is drawn as a form (Inkview `form`): a select of the options and, for a plan that is not listed, a select of the band hours the retailer uses, each with a "none of these" answer. Form choices are capped at 80 characters, so each carries only a headline (the first plan name and how many more, the daily supply charge and the range of rates, "matches" when the invoice agreed); the full text beside the form carries every rate, its hours, the plan ids and what matched. The agent waits for the user's choice and never picks for them.

A plan whose bands are all labelled SHOULDER (told apart only by their hours) is shown with each band's own hours and rate, not one rate for all; an invoice rate matches when it agrees with any rate of that kind.

## A stated plan name

A user with no invoice can state their plan name. `list_current_plan_options` takes it as `planName` (up to 80 characters), splits it into words (ignoring filler such as "plan" and "energy") and, with no invoice figures or code, lists the retailer's options on the network whose plan names share a word with it, most shared words first, each marked "words of the plan name you gave". The user still picks. With invoice figures the name only breaks ties and never rescues options the figures rule out. With no shared word the result says so and offers the band-hour layouts. A name never selects a plan by itself (the 20 Nov 2026 decision not to match by name stands).

## `compare_energy_plans` with the household's hours

With a split (peak, shoulder and off-peak percentages) on a `bill`, `yearly` or `assistant_readings` usage source, the host passes `currentPlanId` (the plan id of the option the user picked) or `hoursLayoutId` (the layout the user picked when their plan was not listed), never both. The server compares each time-of-use plan's layout id with the household's:

- **Same hours**: the split is applied and the estimate is ranked in the main table.
- **Different hours**: the estimate is made with the split but labelled "approximate: different hours" and listed in a separate "Approximate" table, never ranked with the exact ones.
- **Hours unknown** (no id given): every time-of-use estimate is labelled approximate, in the same separate table, and the result says the household's own hours are not known.
- **`assistant_readings`**: the hours the readings were banded by are required, so one of the two ids must be given; without one the call is refused.
- **Interval readings (`readings`) or typical usage**: no hours are needed and nothing is labelled approximate for this reason. Typical usage refuses the ids; a `bill` or `yearly` figure with no split, or `readings`, keeps an id and `warnings` says the hours were not needed.

Plans with no time-of-use rates (single rate, block rates) are unaffected. The structured result carries `approximateHours`, `hoursBasis` and `counts.approximate`. In Inkview the main table carries a footnote saying how many plans were estimated only approximately; the separate table is in the text result.

Invoice rates always include GST (decided by Iven, 20 Nov 2026), for homes and small businesses alike, so `list_current_plan_options` converts them against the stored GST-exclusive rates and takes no includes-GST flag.

## Not done

- Reading real invoices to confirm the field list (1.2) and the GST handling against them (1.3), and the host trial with Iven's invoice (3.1). These need invoices from Iven.
- The Inkview output shows one table, so the approximate table is text only there.

## Tests against recorded plans

`test/energy/current-plan-invoices.test.ts` runs the lookup against the 30 recorded Momentum Energy electricity plans on United Energy at postcode 3128 (the AER's data of 17 Nov 2026, `test/fixtures/energy/recorded/momentum-united-energy-3128.json`, public plan data). The first case is Iven's invoice from the 20 Nov 2026 trial: the plan is "NAB Goodies" (time of use), supply $1.1187 a day with GST, and a lookup with its figures must return the one option that lists NAB Goodies. Further cases cover the same plan with the rates named as peak, shoulder and off-peak, the single rate NAB Goodies, a plan code, the Standing Offer, retailer names written six ways, an unknown retailer, figures that match nothing, and a supply charge alone. To add an invoice, add a row to `INVOICES` in that file with the figures printed on it (never a name, address, account number or meter identifier) and what must come back. Other retailers need their own recorded plans: record them with `sync-energy --record` or from a local copy of a sync.
