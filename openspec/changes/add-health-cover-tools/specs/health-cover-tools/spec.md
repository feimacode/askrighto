# Spec Delta

## Purpose
Read-only tools to find and compare private health insurance products and to calculate premium after rebate, surcharge break-even and loading, as facts with sources, never as advice.

## ADDED Requirements

### Requirement: Product search without ranking
The system SHALL provide `search_health_cover_products`, filtering by state, household type, cover type, hospital tier, required clinical categories, maximum excess, maximum premium and insurer, ordering only by a sort the caller chooses, and SHALL report the number of matches and how many have no published premium.

#### Scenario: Filtered search
- **WHEN** a caller asks for hospital products in Victoria for a couple that cover "Pregnancy and birth"
- **THEN** the result lists matching products with premium as published, excess, tier and the stated cover for each requested category, with the file date and attribution

#### Scenario: No match
- **WHEN** no product matches
- **THEN** the result is an explicit not-found with the filters used and no suggestion of a product

### Requirement: Product detail
The system SHALL provide `get_health_cover_product` returning every stored field for a product variant, with nulls shown as "not published", and a link to the insurer's information statement only when the file carries one.

#### Scenario: Unknown product
- **WHEN** the identifier does not exist
- **THEN** the result is `not_in_dataset`

### Requirement: Side-by-side comparison
The system SHALL provide `compare_health_cover_products` for two to four variants, showing differences in stored fields without judging them.

#### Scenario: Five variants
- **WHEN** five identifiers are given
- **THEN** the call is refused with `needs_input` and the limit

### Requirement: Premium after rebate
The system SHALL provide `estimate_premium_after_rebate`, which shows a published after-rebate premium as published when the file has one, and otherwise calculates it from the published premium and the rebate percentage in force on the as-at date, labelled "calculated", with the rules' source and dates and a statement that the insurer's quote governs.

#### Scenario: Calculated premium
- **WHEN** a caller gives a product, income tier, age band and date
- **THEN** the result shows the published premium, the rebate percentage and its effective date, and the calculated premium in cents rounded once

#### Scenario: Basis unclear
- **WHEN** the file does not say whether a premium is before or after rebate
- **THEN** the result is `NotEstimated` with reason `rebate_basis_unclear`

### Requirement: Surcharge break-even
The system SHALL provide `check_levy_surcharge_breakeven`, which shows the Medicare levy surcharge for the income given and the product's premium after rebate, states which is lower and by how much, states the excess-limit condition and its source, and SHALL NOT tell the caller to buy or not buy cover.

#### Scenario: Both figures shown
- **WHEN** income and a product are given
- **THEN** the result shows the surcharge amount, the premium after rebate, the difference and the ATO source, with no directive wording

#### Scenario: Income not stored
- **WHEN** the call completes
- **THEN** the income value is in no log, counter or stored row

### Requirement: Lifetime Health Cover loading
The system SHALL provide `estimate_lifetime_health_cover_loading`, calculating the percentage from the stored parameters, and SHALL return `NotEstimated` with a link when the case is one the ATO says changes the base day, and SHALL NOT multiply a combined premium when the hospital component is not published.

#### Scenario: Loading calculated
- **WHEN** a caller gives age 38 at first hospital cover
- **THEN** the result shows the loading percentage from the stored rule with the ATO source and date

### Requirement: Rules lookup
The system SHALL provide `get_health_cover_rules`, returning rebate, surcharge and loading tables in force on a date with sources, effective dates and status, flagging any proposed change as proposed and not law.

#### Scenario: Proposed change shown
- **WHEN** rules are requested for a date after 1 April 2027 and the 65-and-over change is still proposed
- **THEN** the in-force table is shown and the proposed change is listed separately as not law

### Requirement: No personal data
The system SHALL NOT accept a name, date of birth, member number, address, or any health condition as a tool input, and SHALL NOT log or store income, age or household values.

#### Scenario: Schema check
- **WHEN** the tool schemas are inspected
- **THEN** no input accepts a free-text medical condition and only clinical category names from the loaded file are accepted

### Requirement: Factual wording only
The system SHALL NOT use "best", "right for you", "should", "recommend" or promises of saving in tool output, and SHALL tell the caller to confirm price and cover with the insurer before acting.

#### Scenario: Output scan
- **WHEN** the end-to-end tests render every tool's output
- **THEN** none contains a banned phrase and each product result contains the confirm-with-insurer line

### Requirement: Internal route first
The system SHALL serve the `health-cover` vertical only on the internal route until it is named in `ASKRIGHTO_PUBLIC_VERTICALS`.

#### Scenario: Public listing
- **WHEN** a client lists tools on `/mcp`
- **THEN** no health cover tool appears
