# Spec Delta

## ADDED Requirements

### Requirement: Prompt set covers the proxy
The prompt set SHALL include prompts for the proxy tools, including an ambiguous lender name, freshness of a rate, a partly read product list, a request for an arbitrary address and a question about storage, each with mechanical checks.

#### Scenario: Registered tools only
- **WHEN** the prompt tests run
- **THEN** every expected tool is registered and every `arg:` check names a real argument

### Requirement: Fractions traced as percentages
The number trace SHALL accept a lender fraction shown as the percentage that has the same digits, and SHALL flag any other figure absent from the prompt and tool results.

#### Scenario: Rounded rate
- **WHEN** a tool result has 0.0599 and the answer says 6%
- **THEN** the figure is flagged

### Requirement: Live check of the Register and lenders
The project SHALL provide a check that reads the real Register and one list and one detail from each of three lenders, and SHALL NOT run it on a schedule or in `npm test`.

#### Scenario: Default test run
- **WHEN** `npm test` runs
- **THEN** no request is made to the Register or any lender

### Requirement: Nothing stored is tested
A test SHALL show that a lender response reaches the caller and no log or output stream, and that the proxy module imports no file or database access.

#### Scenario: Marker response
- **WHEN** a lender returns a unique marker
- **THEN** the caller sees it and no output stream contains it
