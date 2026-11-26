# Spec Delta

## Purpose

Lets the ChatGPT portal verify that the submitted endpoint belongs to Ask Righto.

## ADDED Requirements

### Requirement: Challenge route
The server SHALL answer `GET /.well-known/openai-apps-challenge` with the token in `ASKRIGHTO_OPENAI_CHALLENGE` as plain text, and with 404 when the variable is unset.

#### Scenario: Token set
- **WHEN** the variable is set and the route is requested
- **THEN** the response is 200 with exactly the token

#### Scenario: Token unset
- **WHEN** the variable is not set
- **THEN** the response is 404

### Requirement: Token is not stored in the repo
The token SHALL come only from the environment and SHALL NOT appear in logs, files or the image.

#### Scenario: Log check
- **WHEN** the route is requested
- **THEN** the access log records the path and status but not the token
