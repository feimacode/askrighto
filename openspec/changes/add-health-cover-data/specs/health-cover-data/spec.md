# Spec Delta

## Purpose
A rebuildable monthly store of private health insurance products loaded from the PHIO dataset, with provenance, attribution and honest nulls.

## ADDED Requirements

### Requirement: Monthly load from the PHIO file
The system SHALL load insurers, products, cover by clinical category, general treatment services, waiting periods, excesses, premiums and hospital agreements from the PrivateHealth.gov.au monthly ZIP into `health_*` tables, and SHALL record the source file name, file date and hash of each load.

#### Scenario: Load replaces previous data
- **WHEN** `health:load` runs on a newer ZIP
- **THEN** all health rows are replaced in one transaction and the stored file date is the new file's date

#### Scenario: Failed load keeps old data
- **WHEN** the ZIP or an XML file cannot be parsed
- **THEN** the previous rows remain and the command exits with an error

#### Scenario: Rollback
- **WHEN** an operator runs the rollback command after a bad load
- **THEN** the previous load's rows and file date are served again

### Requirement: Source codes kept as published
The system SHALL store hospital tier, clinical category and service by the code and label the file uses together with the schema version, and SHALL NOT rely on a fixed list of tier names or category counts.

#### Scenario: New tier code
- **WHEN** a file contains a tier code not seen before
- **THEN** the code is stored as published and reported by `health:validate`

### Requirement: Facts as published
The system SHALL store premiums, excesses, limits and waiting periods exactly as the file states them and SHALL store null where the file does not publish a value.

#### Scenario: Missing premium
- **WHEN** a product variant has no published premium
- **THEN** the stored premium is null and no premium is estimated

### Requirement: Dataset only
The system SHALL NOT scrape, frame or fetch any page of the privatehealth.gov.au website, and SHALL load data only from the dataset published on data.gov.au.

#### Scenario: Product link
- **WHEN** a result needs a link to a policy's information statement
- **THEN** it uses an address carried by the file, or no link when the file has none

### Requirement: Attribution and as-of date
The system SHALL attach the CC BY attribution text from the rights register and the file's date to every result built from this dataset.

#### Scenario: Result returned
- **WHEN** any health product result is returned
- **THEN** it names the Private Health Insurance Ombudsman as the owner, the licence, the dataset URL and the file date

### Requirement: Coverage stated as loaded
The system SHALL report the number of insurers and products in the loaded file and SHALL NOT describe the data as covering all funds or the whole market.

#### Scenario: Coverage question
- **WHEN** a caller asks what the data covers
- **THEN** the answer is "products in the PHIO file dated <date>" with the loaded insurer and product counts

### Requirement: Staleness after a premium change
The system SHALL warn that prices may be out of date when the loaded file is dated before the most recent 1 April or 1 July.

#### Scenario: Old file after 1 April
- **WHEN** the stored file is dated 15 March and today is 10 April
- **THEN** results carry a warning that premiums may have changed on 1 April

### Requirement: Rights gate
The system SHALL return `data_unavailable` for health product data in production unless the `health-cover-products` rights entry is cleared or cleared pending legal view.

#### Scenario: Entry pending
- **WHEN** the rights entry is `pending` and the environment is production
- **THEN** every health product tool returns `data_unavailable`
