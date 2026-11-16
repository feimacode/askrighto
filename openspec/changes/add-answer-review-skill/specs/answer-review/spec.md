# Spec Delta

## Purpose

Makes the grounding promise checkable on real host answers.

## ADDED Requirements

### Requirement: Number trace
The checker SHALL flag any figure in a host answer that appears neither in the recorded tool results nor in the user's prompt.

#### Scenario: Invented figure
- **WHEN** an answer states a price absent from the tool results
- **THEN** the checker reports it with its position

### Requirement: Scorecard fill
The review skill SHALL run a named prompt set, record per-prompt results and update the scorecard format in `docs/use-case-comparison/scorecard.md`.

#### Scenario: Run complete
- **WHEN** a 20-prompt set finishes
- **THEN** the scorecard lists a pass or fail with reason for every prompt
