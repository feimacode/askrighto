# Spec Delta

## Purpose

Ships Ask Righto's grounding rules to host models as a skill, in a folder both Claude and ChatGPT can load.

## ADDED Requirements

### Requirement: Skills-only plugin bundle
The repository SHALL contain a plugin folder with a manifest and a `skills/` directory, and SHALL NOT include agents, hooks or `userConfig` in it.

#### Scenario: Bundle converts for ChatGPT
- **WHEN** the plugin folder is packaged for a ChatGPT upload
- **THEN** it contains at least one `skills/<name>/SKILL.md` and nothing the OpenAI submission guide says must be removed

### Requirement: Grounding skill
The plugin SHALL include `ask-righto-grounding`, whose instructions tell the host to quote only values returned by Ask Righto tools, to show each fact's source link and as-of date, to report `found: false` as unavailable without estimating, and to avoid "best" or "recommended".

#### Scenario: Tool returns not-found
- **WHEN** a tool result has `found: false`
- **THEN** the skill tells the host to say the information is not available and to give the official link if one was returned

#### Scenario: Facts read by the user's browsing assistant
- **WHEN** the host reads an official page for the user
- **THEN** the skill tells it to quote with the page link and time read, label it as read by the assistant and not from Ask Righto's data, and never send it back to the server

### Requirement: Provider-neutral and user-first wording
Skill text SHALL avoid host product names and SHALL state that explicit user instructions take priority over the skill.

#### Scenario: Wording check
- **WHEN** the tests scan the skill files
- **THEN** none contains a host product name outside the manifest

### Requirement: No drift from server instructions
Rules shared by the skill and the server instructions SHALL come from one source file, and the build SHALL fail if the generated skill reference is out of date.

#### Scenario: Shared rule edited
- **WHEN** the shared source changes and the generated reference is not regenerated
- **THEN** the test suite fails
