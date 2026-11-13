# Spec Delta

## Purpose

Lets a person find the electricity and gas plans published for their postcode and read any one plan's rates, charges and conditions as the retailer published them, with the source and date attached.

## ADDED Requirements

### Requirement: Search plans by postcode
The `search_energy_plans` tool SHALL take a four-digit Australian postcode and return the current residential plans available there, each with plan id, retailer, plan name, fuel type, plan type, tariff type, distributors and the time the source last updated it.

#### Scenario: Plans exist for the postcode
- **WHEN** the tool is called with a postcode that has plans
- **THEN** it returns the matching plans with the listed fields, the total number of matches and the result-level source and as-of date

#### Scenario: Postcode has no plans in the data
- **WHEN** the tool is called with a valid postcode that has no plans
- **THEN** it returns `found: false` with reason `outside_coverage` and names the states the data covers

#### Scenario: Invalid postcode
- **WHEN** the tool is called with a value that is not a four-digit postcode
- **THEN** it returns an input error that says what a valid postcode looks like

### Requirement: Narrow a search
The tool SHALL accept optional filters for fuel type, retailer name, distributor, plan type, and whether the plan has a solar feed-in tariff or a controlled load rate, and SHALL apply all filters given.

#### Scenario: Filter by fuel and solar
- **WHEN** the tool is called with fuel type electricity and solar feed-in required
- **THEN** every returned plan is an electricity plan with a feed-in tariff

#### Scenario: Retailer name is not exact
- **WHEN** the retailer filter matches no brand exactly but is close to one or more brand names
- **THEN** the tool returns the plans for the closest brand and states which brand it matched

### Requirement: Postcodes with more than one distributor
When a postcode is served by more than one distributor for the requested fuel and no distributor was given, the tool SHALL say so, list the distributors and group the plans by distributor.

#### Scenario: Two electricity distributors
- **WHEN** the tool is called for a postcode two electricity distributors serve
- **THEN** the result names both distributors, groups plans under each and tells the host to ask the user which one is on their bill

### Requirement: Bounded, neutral result lists
The tool SHALL return at most a stated number of plans per call with a way to get the next page, and SHALL order them by retailer name then plan name, with no retailer favoured.

#### Scenario: More plans than the limit
- **WHEN** more plans match than the limit
- **THEN** the result contains the first page, the total count and the value to pass for the next page

### Requirement: Show one plan in full
The `get_energy_plan` tool SHALL take a plan id and return the plan's supply charges, usage rates with blocks and time-of-use windows, controlled load rates, solar feed-in tariffs, discounts with their conditions, fees, incentives, contract terms, eligibility conditions and the plan's own link.

#### Scenario: Known plan
- **WHEN** the tool is called with a plan id in the data
- **THEN** it returns the full details with amounts shown including GST and labelled as such, the plan link when the source gives one and the time the source last updated the plan

#### Scenario: Unknown plan id
- **WHEN** the tool is called with a plan id that is not in the data
- **THEN** it returns `found: false` with reason `not_in_dataset` and suggests searching by postcode

#### Scenario: Plan is not fully understood
- **WHEN** the plan is flagged as having a shape the system does not fully understand
- **THEN** the result shows what was understood, names what was not and points to the plan link

### Requirement: Conditions stay attached to prices
Any discount, incentive or fee shown SHALL be shown with its published condition, such as pay on time or direct debit, and conditional discounts SHALL NOT be folded into a headline rate.

#### Scenario: Pay-on-time discount
- **WHEN** a plan has a discount that applies only when bills are paid on time
- **THEN** the discount is listed separately with that condition and the usage rates are shown without it

### Requirement: Data outage is reported plainly
When the stored plan data cannot be reached, each energy tool SHALL return `found: false` with reason `data_unavailable` and a message saying energy data is temporarily unavailable, and SHALL NOT return any plan figures.

#### Scenario: Database is down
- **WHEN** an energy tool is called while the plan store is unreachable
- **THEN** the result says energy data is temporarily unavailable and contains no plan or price figures

### Requirement: Energy results carry a standard notice
Every energy tool result SHALL include a notice that the figures come from published plan data for general information, are not a recommendation, and should be confirmed with the retailer before switching.

#### Scenario: Any energy tool returns data
- **WHEN** an energy tool returns a found result
- **THEN** the notice appears in both the structured and text forms

### Requirement: Results draw as components where the host supports them
Search results SHALL be returned in a form that hosts supporting MCP Apps draw as an interactive table, with the same content available as markdown for text-only hosts.

#### Scenario: Host draws components
- **WHEN** the tool runs in a host that supports MCP Apps
- **THEN** the plans appear as a table with the source shown

#### Scenario: Text-only host
- **WHEN** the tool runs in a host that does not draw components
- **THEN** the same plans appear as a markdown table with the source line
