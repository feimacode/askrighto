# Spec Delta

## ADDED Requirements

### Requirement: Dual fuel filter
`search_energy_plans` SHALL accept `fuelType` `DUAL` and return only plans published as dual fuel. `ELECTRICITY` and `GAS` SHALL keep returning plans that include that fuel, dual fuel plans among them. The distributor question SHALL be decided from the postcode's single-fuel plans before any filter is applied.

#### Scenario: Dual fuel from one retailer
- **WHEN** a residential search at a postcode gives `fuelType` DUAL and `retailer` AGL
- **THEN** every returned plan has fuel type DUAL and brand AGL, and the result says how many electricity-only and gas-only AGL plans exist at the postcode and are not included

#### Scenario: Several networks, dual only
- **WHEN** the postcode has more than one electricity distributor and the filtered result holds only dual plans
- **THEN** `needsDistributor` is true and the result asks which distributor is on the bill

### Requirement: Retailer by alias or invoice name
The retailer filter SHALL match a brand by its published name, a curated alias, or an invoice entity name with legal words removed, before it falls back to edit distance. Several equal matches SHALL return candidates and ask the user.

#### Scenario: Invoice entity name
- **WHEN** `retailer` is "Origin Energy Electricity Limited"
- **THEN** the matched retailer is Origin Energy and `matchedRetailer` says so

#### Scenario: Ambiguous name
- **WHEN** a name fits two brands equally
- **THEN** the result is a needs-input naming both and no plans are returned

### Requirement: Free hours detected from published rates
With `freeHours` set, the tool SHALL match a plan only if an electricity time-of-use usage rate has every block priced at zero and a window of at least one hour and under 20 hours a day. It SHALL NOT use a plan or rate name to decide a match. `DAYTIME` SHALL match only windows inside the daytime span fixed in design. Each match SHALL return the window's days, hours and season, and any eligibility entries and conditional discounts on the plan.

#### Scenario: Zero rate in a midday window
- **WHEN** a plan has a usage rate of 0 on every day from 11:00 to 14:00
- **THEN** the plan matches `freeHours` DAYTIME and the row shows that window

#### Scenario: Name without a zero rate
- **WHEN** a plan is named "Midday Power Saver" and has no zero-priced window
- **THEN** it is not in the matches and is not counted in `total`; it may appear in `mentionedOnly` with the matched text

#### Scenario: Placeholder zero
- **WHEN** a usage rate of 0 applies all day on every day
- **THEN** the plan does not match and the result counts it as `zero_all_day`

#### Scenario: Contradicting windows
- **WHEN** a non-zero usage rate covers the same days and hours as a zero-priced window in the same tariff period
- **THEN** the plan does not match and the result counts it as `conflicting_windows`

#### Scenario: Capped free block
- **WHEN** only the first 10 kWh a day is priced at zero
- **THEN** the plan does not match `freeHours` and is listed in `mentionedOnly` as partly free

#### Scenario: Conditions kept
- **WHEN** a matching plan has a conditional discount or an eligibility entry
- **THEN** the plan stays in the matches and the condition is printed with the window

### Requirement: Time-varying feed-in filter
With `solarFeedIn` `TIME_VARYING`, the tool SHALL match a plan only if an eligible electricity feed-in has two or more windows with different rates. Feed-in entries paid by a government or under a premium scheme, outside their dates, or on a `FLEXIBLE` plan SHALL NOT be eligible, and SHALL be counted. Each match SHALL return the highest rate and its window, the lowest rate, any volume limit on the highest rate, and the scheme, with rates as published and no GST added.

#### Scenario: Evening peak feed-in
- **WHEN** a plan pays one rate from 16:00 to 21:00 and a lower rate at other times
- **THEN** it matches, and the row shows the evening window with its rate and the other rate

#### Scenario: Varying in shape only
- **WHEN** a feed-in is time-varying but every window has the same rate
- **THEN** the plan does not match `TIME_VARYING` and is counted as `varying_in_shape_only`

#### Scenario: Legacy scheme
- **WHEN** a feed-in has payer type GOVERNMENT
- **THEN** it is not eligible, is counted, and is never used to order results

#### Scenario: Time-of-use solar
- **WHEN** `pricingModel` is TIME_OF_USE and `solarFeedIn` is TIME_VARYING
- **THEN** only plans meeting both are returned

### Requirement: Ordering by feed-in is a figure ordering
With `sortBy` `FEED_IN_RATE`, plans SHALL be ordered by their highest eligible published feed-in rate, highest first, then by retailer and plan name, with plans without an eligible feed-in last. The result SHALL say it orders one published figure and not what a household receives, and SHALL NOT call any plan best or recommended.

#### Scenario: Ordering caveat
- **WHEN** `sortBy` is FEED_IN_RATE
- **THEN** the text and structured result carry the caveat and the volume limit of each rate

### Requirement: Features are not costs
A result that matches on free hours or feed-in SHALL state that a published rate is not a yearly cost, and SHALL point to `compare_energy_plans` for a cost.

#### Scenario: Caveat present
- **WHEN** any feature filter is used
- **THEN** the rendered result contains the not-a-cost line and the notice

### Requirement: Bounded result size
Feature evidence SHALL list at most 3 windows per plan and say how many more exist. When no retailer is named and results exceed one page, the result SHALL include a count per retailer. The largest page SHALL stay within the size budget set in tasks.

#### Scenario: Many windows
- **WHEN** a plan has five free windows
- **THEN** three are shown and the row says two more exist

#### Scenario: Count per retailer
- **WHEN** a search with no retailer has more than one page
- **THEN** `byRetailer` lists each retailer with its plan count

### Requirement: Planning data stays grounded
Every figure and window in a feature result SHALL come from the stored plan data, and the result SHALL carry the energy plan source, licence and as-of date.

#### Scenario: Source on every result
- **WHEN** a feature search is found
- **THEN** the result carries the source link, licence and as-of date
