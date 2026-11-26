# Spec Delta

## Purpose

Packages that pass the directory checks and install by zip upload.

## ADDED Requirements

### Requirement: Listing metadata complete
The Claude manifest SHALL set `license`, `author`, `icon`, `privacyPolicyUrl`, `supportUrl`, `termsOfServiceUrl` and `documentationUrl`; the ChatGPT manifest SHALL set the `interface` fields within OpenAI's length limits; both SHALL come from the config.

#### Scenario: Directory validation
- **WHEN** `claude plugin validate --profile directory ./plugin` runs
- **THEN** it reports no blocking finding and no missing licence, icon or privacy URL

### Requirement: Installable zips
`npm run plugin:build` SHALL write one zip each for Claude, ChatGPT and the Gemini CLI, and a checker SHALL unzip each and fail on a wrong layout, an oversize file, a hook or `userConfig`, an internal route URL or a course skill.

#### Scenario: Internal skill added
- **WHEN** a course skill is copied into `plugin/skills`
- **THEN** the build fails

### Requirement: One host
Every generated file SHALL name only the configured server host.

#### Scenario: Old domain
- **WHEN** any tracked plugin file contains `askrighto.com.au`
- **THEN** the test fails

### Requirement: Google domain file
`GET /.well-known/google-connected-apps` SHALL return the JSON in `ASKRIGHTO_GOOGLE_CONNECTED_APPS` with status 200, or 404 when unset.

#### Scenario: Unset
- **WHEN** the variable is empty
- **THEN** the route answers 404
