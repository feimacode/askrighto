# Spec Delta

## Purpose
Keep the CRICOS-based course data current from its public dataset with one command or schedule, without manual file handling.

## ADDED Requirements

### Requirement: Fetch from the public dataset only
The system SHALL download the Courses, Course Locations and Institutions CSV resources of the CRICOS dataset from data.gov.au over HTTPS and SHALL refuse any resource URL on another host, including after a redirect.

#### Scenario: Foreign host
- **WHEN** a resource URL points to a host other than data.gov.au
- **THEN** the refresh aborts and the stored data is unchanged

### Requirement: No files left on disk
The system SHALL hold downloaded files in memory only and SHALL work with a read-only filesystem.

#### Scenario: Read-only container
- **WHEN** `cricos:refresh` runs in a read-only container
- **THEN** it completes without writing any file

### Requirement: As-of date from dataset metadata
The system SHALL record the date part of the Courses resource's last modified time as the source date and SHALL label it as the file date, never as the register's own as-at date.

#### Scenario: Source date stored
- **WHEN** a refresh loads data
- **THEN** the international load records that date as its source date

### Requirement: Idempotent refresh
The system SHALL leave the CRICOS data unchanged and download nothing when the resources' identifiers and modified times match the last load, and SHALL still re-merge the domestic course files from the stored CRICOS rows.

#### Scenario: Unchanged dataset
- **WHEN** the refresh runs twice with no change at data.gov.au
- **THEN** the second run downloads nothing and reports no change

### Requirement: Guards keep old data
The system SHALL abort and keep the previous data when a required column is missing, the as-of date is older than the stored one, kept international courses fall below 1,000 or drop more than 20 percent from the last load, or the merged domestic course count drops more than 20 percent from the last load, unless the run is forced, and SHALL never be forced past a missing column.

#### Scenario: Large drop
- **WHEN** the new file keeps 30 percent fewer international courses
- **THEN** the run aborts and says which guard fired

### Requirement: One-command setup
The system SHALL provide one command that applies migrations, loads the VCE data and refreshes the CRICOS data in that order.

#### Scenario: Fresh database
- **WHEN** `load-all` runs on an empty database
- **THEN** the course and international tables are loaded and the command prints the counts

### Requirement: Optional scheduled refresh
The system SHALL check for a newer dataset on a daily schedule only when `ASKRIGHTO_CRICOS_REFRESH` is on, SHALL let only one instance run it at a time, and SHALL log only counts, dates and resource identifiers.

#### Scenario: Two instances
- **WHEN** two instances reach the scheduled time
- **THEN** one runs the refresh and the other skips

### Requirement: Deploy never fails on a data refresh
The deployment SHALL run the refresh only when the internal route token is set and SHALL NOT fail the deployment or the energy service when the refresh fails.

#### Scenario: data.gov.au unreachable
- **WHEN** the post-deploy refresh cannot reach data.gov.au
- **THEN** the deploy still succeeds and a warning is printed
