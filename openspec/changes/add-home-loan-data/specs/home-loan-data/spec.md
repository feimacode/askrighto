# Spec Delta

## Purpose

Holds a current, traceable copy of residential mortgage products published through the Consumer Data Right, so Ask Righto tools can list and compare them without calling lenders during a chat.

## ADDED Requirements

### Requirement: Products come only from the CDR product data APIs
The system SHALL obtain home loan data only from lenders' CDR banking product reference endpoints (Get Products and Get Product Detail) and SHALL NOT read it from comparison websites or lender web pages.

#### Scenario: Sync runs
- **WHEN** a home loan sync runs
- **THEN** every outbound request goes to a base URI listed in the checked-in lender list, on a product reference data path

### Requirement: Residential mortgages only
The stored set SHALL contain products whose category is `RESIDENTIAL_MORTGAGES`. Products of other categories SHALL be dropped, and a residential mortgage that appears to be a construction, bridging or reverse loan SHALL be kept but flagged not understood.

#### Scenario: A lender returns mixed categories
- **WHEN** a list response contains a personal loan and a home loan
- **THEN** only the home loan is fetched in detail and stored

### Requirement: Rates are stored as published
The system SHALL store each rate, comparison rate, tier, fee and condition exactly as the lender published it, and SHALL NOT compute, round, average, repair or infer any rate, comparison rate or fee.

#### Scenario: A product has no comparison rate
- **WHEN** a lender omits `comparisonRate`
- **THEN** the stored rate has no comparison rate and the system does not calculate one

### Requirement: Unknown shapes are kept and flagged
A product with an unmapped rate type, an unknown tier unit, a fixed rate without a readable term or a category mismatch SHALL be stored with `understood = false` and reasons, and SHALL NOT be offered for comparison.

#### Scenario: Fixed rate with no term
- **WHEN** a fixed rate has no readable term
- **THEN** the product is flagged `fixedRate:no_term` and kept with its raw payload

### Requirement: Cover every listed lender and report failures
The system SHALL sync every active lender in its list and SHALL record per lender whether the last sync succeeded, the product count and the time. A failing lender SHALL keep its previously stored products with their original `verified_at`.

#### Scenario: One lender fails
- **WHEN** one lender's endpoint errors during a sync
- **THEN** the other lenders are synced, the failing lender's products stay with their old verified time, and the failure is recorded

### Requirement: Freshness is the verified time
The as-of date the system reports for a product SHALL be the time it was last verified against the lender's endpoint, not the time of the last run.

#### Scenario: Lender silent for a week
- **WHEN** a lender has not answered for seven days
- **THEN** its products report a verified time seven days old and the registry names the lender as failing

### Requirement: Gentle on lenders
The sync SHALL cap requests per lender, honour `Retry-After`, run overnight, and run only one sync at a time across instances.

#### Scenario: Throttled lender
- **WHEN** a lender returns 429 with `Retry-After`
- **THEN** that lender's requests pause for the stated time and other lenders are unaffected

### Requirement: Reserve Bank cash rate is quoted with its source
The system SHALL store the RBA cash rate target with its effective date, source URL and the attribution "Source: Reserve Bank of Australia", and SHALL NOT state or imply that the RBA endorses Ask Righto.

#### Scenario: Rate read
- **WHEN** a tool reads the cash rate
- **THEN** it receives the value, the effective date, the source URL and the attribution text

### Requirement: Rights status gates serving
Home loan datasets SHALL be recorded in the rights register as `cleared_pending_legal_view` until the legal view is done, and in production a public route SHALL NOT serve them while that status holds.

#### Scenario: Public route in production
- **WHEN** `home-loans` is listed in the public verticals while a dataset is `cleared_pending_legal_view` and the environment is production
- **THEN** `npm run release:check` fails and tools answer `data_unavailable` on the public route

### Requirement: Shared CDR sync core
The home loan sync SHALL use a CDR client, limiter, lock and report module shared with the energy sync, and extracting it SHALL NOT change energy behaviour.

#### Scenario: Energy tests after the move
- **WHEN** the existing energy test suite runs after the extraction
- **THEN** it passes without edits to its expectations
