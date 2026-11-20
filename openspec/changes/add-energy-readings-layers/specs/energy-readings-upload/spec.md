# Spec Delta

## Purpose

Lets a host's code sandbox send a large readings file to us without the model writing it out, with nothing stored.

## ADDED Requirements

### Requirement: A short-lived signed upload address
`get_readings_upload_link` SHALL return an address valid for five minutes with a size limit, signed so it cannot be forged or lengthened.

#### Scenario: Valid address
- **WHEN** a file is sent to the address within five minutes and under the limit
- **THEN** the endpoint returns the summary and a signed profile

#### Scenario: Expired or forged address
- **WHEN** the address has expired or its signature is wrong
- **THEN** the endpoint refuses and reads nothing

### Requirement: Nothing is stored or logged
The endpoint SHALL read the body in memory, enforce its size limit while reading, store nothing and log nothing from the body.

#### Scenario: Over the limit
- **WHEN** the body exceeds the limit
- **THEN** reading stops and the endpoint answers that the file is too large

#### Scenario: Parsing fails
- **WHEN** the file is not a usable NEM12 file
- **THEN** the endpoint answers with the plain reason and a line number, never the content
