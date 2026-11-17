# Spec Delta

## Purpose
A host-neutral skill that runs health cover conversations through the grounded tools with careful intake, factual wording and a clear disclosure.

## ADDED Requirements

### Requirement: Intake without health conditions
The skill SHALL have the host collect state, household type, age bands, cover type, wanted clinical categories by name and maximum excess before searching, and SHALL NOT ask for medical conditions, treatments, medications, member numbers or contact details.

#### Scenario: Person volunteers a condition
- **WHEN** a person describes a diagnosis
- **THEN** the host does not pass it to any tool, asks which clinical categories they want covered, and does not judge what cover they need

### Requirement: Income only when needed
The skill SHALL have the host ask for income only when the question concerns the rebate or the Medicare levy surcharge, and SHALL say it is used for that answer only and is not stored.

#### Scenario: Plain product search
- **WHEN** a person asks for hospital cover in Queensland for a couple
- **THEN** the host does not ask about income

### Requirement: Factual wording
The skill SHALL forbid "best", "right for you", "should", "recommend", "worth it" and promises of saving, and SHALL give replacement wording that states the filter used.

#### Scenario: Person asks for the best policy
- **WHEN** a person asks which policy is best
- **THEN** the host explains that it compares published facts, offers the lowest premium among the person's filters as a fact, and does not name a best policy

### Requirement: Calculations framed as information
The skill SHALL have the host present the surcharge test as two figures and their difference with the ATO and the insurer as the final word, and SHALL have the host describe a proposed rebate change as proposed and not law.

#### Scenario: Surcharge question
- **WHEN** a person asks whether hospital cover is cheaper than the surcharge
- **THEN** the host quotes both figures with their sources and dates and does not say whether to buy cover

### Requirement: Disclosure
The skill SHALL have the host state in the first reply of a health cover conversation that Ask Righto is a free information tool, takes no commission, is not an insurer, broker or adviser, and that price and cover must be confirmed with the insurer.

#### Scenario: First reply
- **WHEN** a person starts a health cover conversation
- **THEN** the first reply contains the disclosure

### Requirement: Not-found relayed plainly
The skill SHALL have the host relay `data_unavailable`, `NotEstimated` and `not_in_dataset` outcomes with the official link and SHALL NOT have the host supply a figure from its own knowledge.

#### Scenario: Rules out of range
- **WHEN** a calculation tool returns `rules_out_of_range`
- **THEN** the host says the rules for that date are not held and links to the ATO page

### Requirement: Out-of-scope redirects
The skill SHALL have the host decline to compare general insurance, overseas student or visitor cover, and to advise on switching, cancelling or buying, and SHALL point to the official source instead.

#### Scenario: Switching question
- **WHEN** a person asks whether to switch funds
- **THEN** the host does not advise, explains what the tools can show, and links to the Ombudsman for complaints and the insurer for terms

### Requirement: Unlisted until promotion
The skill SHALL stay out of the public marketplace entry until the `health-cover` vertical is promoted.

#### Scenario: Marketplace check
- **WHEN** the marketplace file is checked before promotion
- **THEN** the skill is not listed and the check passes
