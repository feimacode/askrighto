# Spec Delta

## Purpose

Packages the skills together with the MCP server for each distribution channel from one source, so users install both at once and the server URL changes in one place.

## ADDED Requirements

### Requirement: Single source of plugin metadata
The repository SHALL hold one config file with the plugin name, description, version, public server URL, links and public skill list, and every generated package SHALL take those values from it.

#### Scenario: Domain change
- **WHEN** the server URL in the config changes
- **THEN** after a rebuild every generated package uses the new URL and none contains the old host

### Requirement: Claude package bundles the server
The Claude build SHALL produce a plugin with a manifest, `.mcp.json` pointing at the configured remote server, and the public skills.

#### Scenario: Install test
- **WHEN** the Claude package is installed and enabled
- **THEN** the Ask Righto tools are available and the skills load without a separate connector step

### Requirement: ChatGPT package
The ChatGPT build SHALL produce a zip with `plugin.json`, `mcp.json` (`streamable-http`, no auth) and the public skills, and SHALL fail if the package contains hooks, `userConfig` or Claude-only fields.

#### Scenario: Forbidden field
- **WHEN** a source file adds `userConfig`
- **THEN** the build fails and names the field

### Requirement: Public package excludes internal routes and skills
Generated packages SHALL contain no internal route URL, token or internal-only skill.

#### Scenario: Secret scan
- **WHEN** tests scan the generated packages
- **THEN** none contains `mcp-internal` or a course skill

### Requirement: Repo marketplace is generated
The committed marketplace and plugin manifests SHALL be generated from the same source, and CI SHALL fail when they are stale.

#### Scenario: Manual edit
- **WHEN** a generated manifest is edited by hand
- **THEN** the check fails
