# Spec Delta

## Purpose

Estimates what the energy plans available at a postcode would cost for the usage a person states, and presents them in order of estimated cost with every figure, assumption and omission shown, so the comparison is factual and repeatable.

## ADDED Requirements

### Requirement: Compare plans for stated usage
The `compare_energy_plans` tool SHALL take a postcode, a fuel type and the person's usage, and SHALL return an estimated yearly cost for each available plan it can estimate.

#### Scenario: Electricity usage given per year
- **WHEN** the tool is called with a postcode, electricity and a yearly kWh figure
- **THEN** it returns the plans with an estimated yearly cost each, including GST

#### Scenario: Usage given from a bill
- **WHEN** the tool is called with the kWh and the number of days from one bill
- **THEN** it scales that usage to a year, states that it did so and returns the estimates

#### Scenario: No usage given
- **WHEN** the tool is called without any usage figure
- **THEN** it returns an input error telling the host to ask for the kWh and days on a recent bill, and makes no estimate

### Requirement: Estimates are calculated only from published rates
Each estimate SHALL be computed from the plan's published supply charge, usage rates, controlled load rates, feed-in tariffs, unconditional discounts and recurring fees, by a fixed calculation that gives the same result for the same inputs and data.

#### Scenario: Same inputs twice
- **WHEN** the tool is called twice with the same inputs against the same stored data
- **THEN** both results are identical

#### Scenario: Single-rate plan
- **WHEN** a plan has one usage rate and a daily supply charge
- **THEN** the estimate equals the supply charge for 365 days plus usage times the rate, plus GST where the published amounts exclude it

#### Scenario: Block rates
- **WHEN** a plan charges a higher or lower rate above a usage threshold per period
- **THEN** the estimate applies each rate to the usage in its block, spreading yearly usage evenly across periods

### Requirement: Each estimate shows its breakdown
Each estimate SHALL show the supply charge total, the usage charge total, controlled load charges, solar feed-in credit, discounts applied, fees included and GST, which together equal the estimated total.

#### Scenario: Breakdown adds up
- **WHEN** an estimate is returned
- **THEN** its listed components sum to the estimated yearly cost to the cent

### Requirement: Conditional discounts are shown separately
The estimated cost used for ordering SHALL exclude discounts that depend on the person's behaviour, and each such discount SHALL be shown with its condition and the lower cost that would apply if the condition is met.

#### Scenario: Pay-on-time discount
- **WHEN** a plan offers a discount for paying on time
- **THEN** the ordering uses the cost without it and the result also shows the cost with it and the condition

### Requirement: Time-of-use plans need a usage split
The tool SHALL estimate time-of-use plans only when the person gives the share of usage in peak, shoulder and off-peak times, and SHALL otherwise list those plans as not estimated with that reason.

#### Scenario: Split provided
- **WHEN** peak, shoulder and off-peak shares are given and sum to 100 percent
- **THEN** time-of-use plans are estimated using those shares

#### Scenario: Split not provided
- **WHEN** only total usage is given
- **THEN** single-rate and block plans are estimated, and time-of-use plans are listed as not estimated because a usage split is needed

### Requirement: Solar and controlled load are optional inputs
The tool SHALL accept yearly solar export kWh and yearly controlled load kWh, SHALL apply feed-in credits and controlled load rates when given, and SHALL state when a plan has no feed-in tariff or controlled load rate for an input that was given.

#### Scenario: Solar export given
- **WHEN** yearly solar export is given
- **THEN** each estimate subtracts the plan's feed-in credit and shows it as its own line

#### Scenario: Controlled load given but plan has none
- **WHEN** controlled load usage is given and a plan has no controlled load rate
- **THEN** the plan is listed as not estimated with that reason

### Requirement: Plans that cannot be estimated are listed, not guessed
Plans with demand charges, plans flagged as not fully understood and plans missing a rate needed for the inputs SHALL be returned in a separate not-estimated list with the reason for each, and SHALL NOT be given a cost.

#### Scenario: Demand tariff
- **WHEN** an available plan has a demand charge
- **THEN** it appears in the not-estimated list with reason `demand_tariff` and no cost

#### Scenario: Counts are reported
- **WHEN** a comparison is returned
- **THEN** it states how many plans were available, how many were estimated and how many were not

### Requirement: Neutral ordering
Estimated plans SHALL be ordered by estimated yearly cost from lowest to highest, with ties broken by retailer name then plan id. No plan SHALL be labelled recommended or best, and no payment or relationship SHALL affect the order.

#### Scenario: Two plans cost the same
- **WHEN** two plans have equal estimated cost
- **THEN** they are ordered by retailer name, then plan id

#### Scenario: Result wording
- **WHEN** a comparison is returned
- **THEN** it describes the first plan as the lowest estimate for the stated usage and contains no recommendation

### Requirement: Assumptions and limits are stated
Every comparison SHALL state the usage it assumed, that usage was spread evenly across the year, the GST treatment, what was left out (such as one-off fees, sign-up credits, concessions and eligibility restrictions) and the date of the stored data.

#### Scenario: Comparison returned
- **WHEN** a comparison is returned
- **THEN** the assumptions and omissions are listed in both the structured and text forms

#### Scenario: Plan has an eligibility restriction
- **WHEN** an estimated plan is restricted, for example to seniors card holders or new customers
- **THEN** the restriction is shown beside that plan's estimate

### Requirement: Comparison scope can be narrowed
The tool SHALL accept an optional list of plan ids, retailer, distributor and plan type to limit which plans are compared, and a limit on how many estimates are returned.

#### Scenario: Compare three named plans
- **WHEN** three plan ids are given
- **THEN** only those plans are estimated or listed as not estimated

#### Scenario: More than one distributor and none given
- **WHEN** the postcode has more than one distributor for the fuel and none was given
- **THEN** the tool returns the distributors and asks for one instead of mixing plans from different networks

### Requirement: Each compared plan is traceable
Each plan in a comparison SHALL carry its plan id, retailer, plan link when available and the time the source last updated it, and the result SHALL carry the dataset source and as-of date.

#### Scenario: User wants to check a figure
- **WHEN** a comparison is returned
- **THEN** each plan row has a link or id the user can use to check it and the date its data was current

### Requirement: Comparison draws as a component where supported
Comparison results SHALL be returned in a form that hosts supporting MCP Apps draw as an interactive table, with the same content as markdown for text-only hosts.

#### Scenario: Host draws components
- **WHEN** the tool runs in a host that supports MCP Apps
- **THEN** the estimates appear as a sortable table with the source shown

#### Scenario: Text-only host
- **WHEN** the tool runs in a host that does not draw components
- **THEN** the estimates appear as a markdown table followed by the assumptions and source line
