# Spec Delta

## Purpose
Dated, sourced tax and loading rules for health cover calculations, with a hard rule that proposed changes are never used as numbers.

## ADDED Requirements

### Requirement: Rules as dated data
The system SHALL hold the rebate tiers and percentages by age band, the Medicare levy surcharge tiers and rates, the Lifetime Health Cover parameters and the MLS-exempt excess limits as data rows, each with an effective-from date, an effective-to date, a status, a source URL, the source page's updated date and the date we read it.

#### Scenario: Row without a source
- **WHEN** `health:rates-load` meets a row with no source URL or read date
- **THEN** the load fails and names the row

### Requirement: Rules selected by date
The system SHALL choose the rules in force on the date asked about, and SHALL return `NotEstimated` with reason `rules_out_of_range` when no stored rule covers that date.

#### Scenario: Date across a rebate change
- **WHEN** a calculation is asked for 15 March and again for 15 April of the same financial year
- **THEN** each uses the rebate percentages effective on its own date

#### Scenario: Date beyond stored rules
- **WHEN** a calculation is asked for a date after the last stored rule's effective-to date
- **THEN** no figure is returned and the reason is `rules_out_of_range`

### Requirement: Proposed changes never become numbers
The system SHALL NOT use a row with status `proposed` in any calculation, and SHALL say that the change is proposed and not law when a result concerns a date after its proposed start.

#### Scenario: Rebate for people 65 and over after 1 April 2027
- **WHEN** a cost is requested for a person aged 70 for a date after 1 April 2027, no in-force rate is stored for that date and the change is still `proposed`
- **THEN** no figure is returned, the reason is `rules_out_of_range`, and the result states that a lower rate is proposed from that date and is not law, with the Department of Health link

### Requirement: Review dates enforced
The system SHALL fail `release:check` when a stored rule's review date has passed.

#### Scenario: Overdue review
- **WHEN** today is after a rule's review date
- **THEN** `release:check` fails and names the rule

### Requirement: Sources and as-of on every rule shown
The system SHALL return, with any rule it states, the source URL and the source page's updated date as the as-of date.

#### Scenario: Rule requested
- **WHEN** a caller asks for the MLS thresholds
- **THEN** the result lists each tier with the source URL, the page's updated date and the effective dates

### Requirement: Rights gate
The system SHALL return `data_unavailable` for rules in production unless the `health-cover-rates` rights entry is cleared or cleared pending legal view.

#### Scenario: Entry pending
- **WHEN** the entry is `pending` in production
- **THEN** rate tools return `data_unavailable`
