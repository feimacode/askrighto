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

### Requirement: Keep only residential plans that are offered
The stored set SHALL contain residential electricity, gas and dual fuel plans of the standing, market and regulated types that are currently effective or have a future start date, and SHALL NOT offer a plan to readers outside its effective period.

#### Scenario: Plan is withdrawn at the source
- **WHEN** a plan stored earlier is no longer returned by its retailer's list
- **THEN** the next successful sync of that retailer removes it from the stored set

#### Scenario: Business plan is listed
- **WHEN** a retailer lists a plan for business customers only
- **THEN** the plan is not stored

#### Scenario: Plan starts in the future
- **WHEN** a plan has an effective-from date after today
- **THEN** it is stored but is not returned to readers until that date

#### Scenario: Plan has passed its end date
- **WHEN** a stored plan's effective-to date has passed
- **THEN** readers no longer receive it, even before the next sync removes it

### Requirement: Daily refresh with change detection
The system SHALL refresh the stored set at least once every 24 hours and SHALL fetch a plan's detail only when the plan is new or its last-updated time at the source has changed.

#### Scenario: Nothing changed since the last sync
- **WHEN** a sync finds a plan whose last-updated time matches the stored one
- **THEN** it makes no detail request for that plan, unless the plan is due for its rolling re-check

#### Scenario: Plan prices change
- **WHEN** a plan's last-updated time at the source is later than the stored one
- **THEN** the sync fetches its detail and replaces the stored record

### Requirement: Rolling re-check of unchanged plans
Every day the sync SHALL re-fetch and compare the detail of the plans that have gone longest without verification, enough that every stored plan is verified at least every seven days, and SHALL record any plan whose content changed while its last-updated time did not.

#### Scenario: Silent change is found
- **WHEN** a re-checked plan's content differs from the stored one but its last-updated time is unchanged
- **THEN** the stored record is replaced and the change is counted in the sync report

#### Scenario: All plans verified within a week
- **WHEN** seven daily syncs have completed
- **THEN** every stored plan has a verification time within the last seven days

### Requirement: Polite use of the source
The sync SHALL cap its request rate and concurrency separately for each retailer, SHALL cap total requests in flight, SHALL slow a retailer that signals throttling without slowing the others, SHALL send the required version headers, SHALL identify itself with a generic client name and SHALL back off and retry on HTTP 429 and 5xx responses, honouring `Retry-After`, before recording a failure.

#### Scenario: Source asks the client to slow down
- **WHEN** the API answers HTTP 429
- **THEN** the sync waits and retries with increasing delays, up to a fixed number of attempts

#### Scenario: Request rate stays under the cap
- **WHEN** a full first sync runs
- **THEN** the requests sent to any one retailer in any one second do not exceed the configured per-retailer cap

#### Scenario: One retailer throttles
- **WHEN** one retailer answers HTTP 429 repeatedly
- **THEN** its request rate is reduced and its sync may be marked failed, while the other retailers sync at their normal rate

### Requirement: Sync report
Each sync SHALL produce a report with the number of requests made, requests throttled or failed (in total and for each retailer), elapsed time, plans added, changed, silently changed and removed, plans per retailer, plans per pricing model, plans not fully understood by reason, and the size of the stored data.

#### Scenario: Operator reads the report
- **WHEN** a sync finishes
- **THEN** the report is stored with its start and end times and printed by the command-line sync

### Requirement: Plan records are traceable
Each stored plan SHALL carry its source plan identifier, retailer brand, the time the source last updated it, the time Ask Righto fetched it and last verified it, and the plan's own information link when the source gives one.

#### Scenario: A tool reads a plan
- **WHEN** a plan record is read from the store
- **THEN** it includes plan id, brand, source last-updated time, fetched time, verified time and, when the source gave one, the plan link

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

### Requirement: Data lives in PostgreSQL and holds no user data
The system SHALL keep plan data in a PostgreSQL schema dedicated to Ask Righto, created and changed only by versioned migrations, and SHALL NOT store any user-supplied or conversation data in it.

#### Scenario: Fresh database
- **WHEN** the migrations are applied to an empty database
- **THEN** the schema, tables and indexes needed by the sync and the readers exist, and nothing else in the database is changed

#### Scenario: Inspect stored content
- **WHEN** every table is inspected
- **THEN** it holds only public plan data, retailer status and sync reports

### Requirement: Readers see consistent data during a sync
A sync SHALL change each retailer's plans in a single transaction, so readers see either the previous or the new set for that retailer and never a partial one.

#### Scenario: Reader queries during a sync
- **WHEN** a tool reads plans while a sync is writing
- **THEN** the read returns complete plan records for every retailer, none half-updated

#### Scenario: Sync fails part-way through a retailer
- **WHEN** a retailer's write fails
- **THEN** that retailer's previously stored plans remain unchanged

### Requirement: One sync at a time
When several server instances share the database, only one SHALL run a sync at any moment, and the others SHALL skip their scheduled run and carry on serving.

#### Scenario: Two instances reach the schedule together
- **WHEN** two instances start their scheduled sync at the same time
- **THEN** one runs it and the other skips it without error

### Requirement: Serve the last good data when the source is unavailable
Readers SHALL keep answering from the stored data when the AER API is down or a sync fails, and results SHALL carry the staleness warning once the data is older than its allowed age.

#### Scenario: Source is down for days
- **WHEN** syncs fail for more than the allowed age
- **THEN** tools still answer from the stored plans and each result carries a warning with the last successful refresh time

### Requirement: Database outage is reported, not guessed around
When the database is unreachable, energy tools SHALL return `found: false` with reason `data_unavailable` and SHALL NOT answer from any other source or from memory.

#### Scenario: Database unreachable
- **WHEN** a tool is called while the database cannot be reached
- **THEN** the result says energy data is temporarily unavailable and contains no plan figures

### Requirement: Readiness endpoint
The server SHALL answer `GET /readyz` with HTTP 200 only when the database is reachable and holds energy plans, and with HTTP 503 and the reason otherwise. The liveness check at `/healthz` SHALL NOT depend on the database.

#### Scenario: Database down
- **WHEN** the database cannot be reached
- **THEN** `/readyz` returns 503 and `/healthz` still returns 200

#### Scenario: Database empty before the first sync
- **WHEN** the database is reachable but holds no plans
- **THEN** `/readyz` returns 503 with reason `no_data_loaded`

### Requirement: Dataset is registered with its reuse basis
The dataset SHALL appear in the data source registry with the AER as publisher, the Consumer Data Right product data rule as the reuse basis, the API documentation URL, the states covered and the last refresh time.

#### Scenario: User asks where energy data comes from
- **WHEN** `list_data_sources` is called after a sync
- **THEN** it lists the energy plan dataset with publisher, reuse basis, URL, coverage and last refresh time
