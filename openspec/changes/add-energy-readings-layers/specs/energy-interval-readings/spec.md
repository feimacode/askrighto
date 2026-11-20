# Spec Delta

## ADDED Requirements

### Requirement: Layered ways to supply readings
The instructions SHALL tell the agent to paste small readings files unchanged to the summary tool, upload large files where the host allows it, and otherwise build the profile by the published recipe.

#### Scenario: Small file
- **WHEN** the file is about 30 KB or less
- **THEN** the agent passes its text unchanged to `summarise_interval_readings`

#### Scenario: Large file, no upload
- **WHEN** the file is large and upload is not possible
- **THEN** the agent builds the profile by the recipe and passes it to `compare_energy_plans`, and the answer says it was built by the assistant and not verified by Ask Righto

### Requirement: Profiles carry their provenance
The server SHALL sign profiles it builds and SHALL label a profile it did not sign as unverified after revalidating it.

#### Scenario: Changed profile
- **WHEN** a signed profile's text has been altered
- **THEN** it fails and the tool asks for the file or a fresh profile

### Requirement: Descriptions say why and how much
The summary tool's description SHALL say it exists to match each plan's own windows, give the size limit, and say what to do past it.

#### Scenario: File over the cap
- **WHEN** the text is over the cap
- **THEN** the result asks for a shorter period or 30-minute intervals

### Requirement: No code in tool results
Tool results SHALL NOT tell the model to run code or fetch addresses it was not given.

#### Scenario: Any result
- **WHEN** a tool returns
- **THEN** it contains data and plain guidance only
