# Spec Delta

## Purpose

Holds a current, traceable copy of the residential electricity and gas plans published through the Consumer Data Right, so Ask Righto tools can look up and compare plans across all retailers without calling the source during a chat.

## ADDED Requirements

### Requirement: Plans come only from the CDR product data API
The system SHALL obtain energy plan data only from the AER's Consumer Data Right energy product reference data API and SHALL NOT read plan data from the Energy Made Easy or Victorian Energy Compare websites.

#### Scenario: Sync runs
- **WHEN** a sync runs
- **THEN** every outbound request goes to the CDR product reference data API paths for Get Generic Plans or Get Generic Plan Detail

### Requirement: Cover every listed retailer
The system SHALL sync plans for every retailer in its retailer list and SHALL record, per retailer, whether the last sync succeeded, how many plans it returned and when.

#### Scenario: A retailer's endpoint fails
- **WHEN** one retailer's API returns errors during a sync
- **THEN** the sync continues with the other retailers, keeps that retailer's previously stored plans, and records the failure with its time

#### Scenario: Coverage is reported
- **WHEN** the data source registry is read
- **THEN** it reports the number of retailers and plans held and names any retailers whose last sync failed

### Requirement: Keep only current residential plans
The stored set SHALL contain plans that are currently effective and offered to residential customers, for electricity, gas and dual fuel, across standing, market and regulated plan types.

#### Scenario: Plan is withdrawn at the source
- **WHEN** a plan stored earlier is no longer returned as current by its retailer's list
- **THEN** the next successful sync of that retailer removes it from the stored set

#### Scenario: Business plan is listed
- **WHEN** a retailer lists a plan for business customers only
- **THEN** the plan is not stored

### Requirement: Daily refresh with change detection
The system SHALL refresh the stored set at least once every 24 hours and SHALL fetch a plan's detail only when the plan is new or its last-updated time at the source has changed.

#### Scenario: Nothing changed since the last sync
- **WHEN** a sync finds a plan whose last-updated time matches the stored one
- **THEN** it makes no detail request for that plan

#### Scenario: Plan prices change
- **WHEN** a plan's last-updated time at the source is later than the stored one
- **THEN** the sync fetches its detail and replaces the stored record

### Requirement: Polite use of the source
The sync SHALL limit concurrent requests, SHALL send the required version headers, SHALL identify itself with a generic client name and SHALL back off and retry on HTTP 429 and 5xx responses before recording a failure.

#### Scenario: Source asks the client to slow down
- **WHEN** the API answers HTTP 429
- **THEN** the sync waits and retries with increasing delays, up to a fixed number of attempts

### Requirement: Plan records are traceable
Each stored plan SHALL carry its source plan identifier, retailer brand, the time the source last updated it, the time Ask Righto fetched it, and the plan's own information link when the source gives one.

#### Scenario: A tool reads a plan
- **WHEN** a plan record is read from the store
- **THEN** it includes plan id, brand, source last-updated time, fetched time and, when the source gave one, the plan link

### Requirement: Plan records keep prices as published
Each stored plan SHALL hold its supply charges, usage rates with their blocks and time-of-use periods, controlled load rates, solar feed-in tariffs, discounts, fees, incentives and eligibility conditions with the amounts, units and GST basis the source published, plus the original source values.

#### Scenario: Time-of-use plan
- **WHEN** a plan with peak, shoulder and off-peak rates is stored
- **THEN** the record holds each rate with its period type, days and time windows as published

#### Scenario: Block rates
- **WHEN** a plan charges different rates above a usage threshold
- **THEN** the record holds each block's rate, its volume threshold and the period the threshold applies to

#### Scenario: Source uses a shape the normaliser does not know
- **WHEN** a plan has a pricing model or charge type the system does not recognise
- **THEN** the plan is stored with its original values and flagged as not fully understood, and it is not dropped

### Requirement: Find plans by location
The store SHALL return the plans available at a given postcode, optionally narrowed by fuel type, distributor, retailer and plan type, applying the source's included and excluded postcodes.

#### Scenario: Postcode served by two distributors
- **WHEN** plans are requested for a postcode that two electricity distributors serve
- **THEN** the store returns plans for both and names each plan's distributors

#### Scenario: Postcode outside coverage
- **WHEN** plans are requested for a postcode with no plans in the stored set
- **THEN** the store returns no plans and the caller can tell coverage is absent

### Requirement: Serve from the last good snapshot
The server SHALL answer from the most recent complete snapshot while a sync is running or after a sync fails, and SHALL start with a usable snapshot before its first sync completes.

#### Scenario: Server restarts while the source is down
- **WHEN** the server starts and the API is unreachable
- **THEN** it serves the last saved snapshot and results carry the staleness warning once the snapshot is older than its allowed age

#### Scenario: Sync fails part-way
- **WHEN** a sync is interrupted
- **THEN** readers continue to see the previous snapshot unchanged

### Requirement: Dataset is registered with its reuse basis
The dataset SHALL appear in the data source registry with the AER as publisher, the Consumer Data Right product data rule as the reuse basis, the API documentation URL, the states covered and the last refresh time.

#### Scenario: User asks where energy data comes from
- **WHEN** `list_data_sources` is called after a sync
- **THEN** it lists the energy plan dataset with publisher, reuse basis, URL, coverage and last refresh time
