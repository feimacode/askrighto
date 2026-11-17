# Spec Delta

## Purpose

Tools that let a host assistant search, look up and compare published home loan products and run repayment arithmetic on a published or user-entered rate, with every figure sourced and no recommendation.

## ADDED Requirements

### Requirement: Search published home loans
The system SHALL provide `search_home_loans` filtering by purpose, repayment type, rate type, fixed term, the user's LVR figure, feature and lender, SHALL sort only by a field the user chose, and SHALL return a coverage block stating lenders in the list, lenders recently answering, products matched and products excluded with reasons.

#### Scenario: No sort requested
- **WHEN** a search has no `sortBy`
- **THEN** results are in lender-alphabetical order and the response says no ranking was applied

#### Scenario: LVR outside published tiers
- **WHEN** a product has no rate tier covering the LVR given
- **THEN** it is listed as having no published rate for that LVR and is not silently omitted

### Requirement: Rates are shown as published
Every rate, comparison rate and fee returned SHALL be the lender's published value with the lender's source link and a verified-as-of date, and the system SHALL NOT present a computed figure as a published one.

#### Scenario: Comparison rate absent
- **WHEN** a lender did not publish a comparison rate
- **THEN** the result shows none and does not calculate one

### Requirement: Tailored and not-understood products are labelled
A product flagged tailored SHALL be labelled as having a negotiated rate whose published figure is not a quote. A product that is not understood SHALL be returned only by `get_home_loan`, with its raw published rates and a notice, and SHALL be excluded from comparison and calculation.

#### Scenario: Not-understood product compared
- **WHEN** a not-understood product's id is passed to `compare_home_loans`
- **THEN** the tool answers `needs_input` naming the product and the reason

### Requirement: Compare side by side
`compare_home_loans` SHALL accept two to five products, show the matched rate, fees, features and links per product, and state when the products are not like for like.

#### Scenario: Mixed purposes
- **WHEN** one product's matching rate is owner-occupier and another's is investor
- **THEN** the result states that the rates apply to different purposes

### Requirement: Repayment calculation is deterministic and labelled
`calculate_home_loan_repayments` SHALL compute payment, total interest and, where asked, the effect of extra repayments or an offset balance, in integer cents, from a stored product's published rate or a user-entered rate, and SHALL list its inputs, formula, rounding and what it does not model.

#### Scenario: User-entered rate
- **WHEN** the caller supplies `userRatePercent`
- **THEN** the result labels the rate as entered by the user and makes no source claim for it

#### Scenario: Offset without the feature
- **WHEN** an offset balance is supplied for a product that does not publish the offset feature
- **THEN** the tool answers `needs_input` and explains

#### Scenario: Fixed term shorter than loan term
- **WHEN** the chosen rate is fixed for fewer years than the loan term
- **THEN** the result covers only the fixed period, reports the balance at its end and states the later rate is not assumed

### Requirement: Fees are not folded into repayments
Fees SHALL be shown as published beside any calculation and SHALL NOT be added into a repayment or a total-cost figure.

#### Scenario: Calculation for a product with an upfront fee
- **WHEN** a calculation is run for such a product
- **THEN** the fee appears separately with its source and is not part of the payment

### Requirement: Fixed notices cannot be dropped
Every result SHALL carry the notices that published rates may differ from what a lender offers a person, that a comparison rate is true only for the lender's example, which lenders the list covers, and that the result is not credit advice, attached by the tool wrapper.

#### Scenario: Notice present
- **WHEN** any home loan tool returns a result
- **THEN** the rendered text contains each notice

### Requirement: Information only
The tools SHALL NOT recommend, rank by suitability, assess eligibility or borrowing capacity, prepare or submit an application, or advise on switching, and their descriptions and instructions SHALL say so.

#### Scenario: Banned wording
- **WHEN** the banned-wording test scans tool descriptions, instructions and rendered text
- **THEN** it finds no recommendation or approval wording

### Requirement: Reference rate
`get_home_loan_reference_rates` SHALL return the RBA cash rate target with its effective date, source URL and attribution, and SHALL NOT forecast or relate it to any lender's rate.

#### Scenario: No rate loaded
- **WHEN** no cash rate is stored
- **THEN** the tool answers `no_data_loaded`

### Requirement: Internal route first
The `home-loans` vertical SHALL be served only on `/mcp-internal/<token>` unless it is named in `ASKRIGHTO_PUBLIC_VERTICALS`, and tools SHALL log no arguments.

#### Scenario: Public client
- **WHEN** a client lists tools on `/mcp` with the vertical not public
- **THEN** no home loan tool or dataset is visible
