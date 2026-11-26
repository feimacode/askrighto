# Spec Delta

## Purpose

One repeatable way to version, build, deploy, verify and roll back Ask Righto and keep the directory listings in step.

## ADDED Requirements

### Requirement: One version
The server, the plugin config, the generated manifests and the internal plugin SHALL carry the same version, and the release SHALL fail if the tag differs from any of them.

#### Scenario: Mismatch
- **WHEN** `v0.2.0` is tagged while `plugin/askrighto.config.json` says `0.1.0`
- **THEN** the release workflow fails before building anything

### Requirement: Bump script
`npm run release:bump -- <version>` SHALL set every version, regenerate the plugin files, require a `CHANGELOG.md` section for the version, commit and create the tag locally, and SHALL NOT push.

#### Scenario: Dry run
- **WHEN** it runs with `--dry-run`
- **THEN** it prints the changes and writes nothing

### Requirement: Release artefacts
A release SHALL produce the image tagged with the version, the three plugin zips with `SHA256SUMS`, and a GitHub release whose notes are the changelog section; a `-alpha.N` or `-beta.N` version SHALL be a pre-release.

#### Scenario: Beta
- **WHEN** `v0.2.0-beta.1` is released
- **THEN** the GitHub release is marked pre-release and the image has no `latest` tag

### Requirement: Remote smoke check
`npm run release:smoke -- <base url> [version]` SHALL fail unless `/healthz` reports the version and `/mcp` lists exactly the configured public tools, each with `readOnlyHint` true and `destructiveHint` false.

#### Scenario: Internal tool leaks
- **WHEN** the public route lists a course tool
- **THEN** the check fails and names it

### Requirement: Listing impact recorded
Every changelog section SHALL state its listing impact as `none`, `rescan` or `resubmit`.

#### Scenario: Missing line
- **WHEN** the section has no listing impact line
- **THEN** the bump script refuses to tag
