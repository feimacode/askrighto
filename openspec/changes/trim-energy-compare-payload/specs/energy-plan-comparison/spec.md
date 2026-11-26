# Spec Delta

## ADDED Requirements

### Requirement: The list of plans not estimated is short by default
`compare_energy_plans` SHALL return at most 10 entries in `notEstimated` unless `notEstimatedLimit` (0 to 50) asks for more or fewer. `counts.notEstimated` and `notEstimatedByReason` SHALL always give the full number of plans not estimated and the reason for each group. The result SHALL say how many entries were returned and how many were left out.

#### Scenario: Many plans cannot be estimated
- **WHEN** 423 plans cannot be estimated and `notEstimatedLimit` is not given
- **THEN** `notEstimated` has 10 entries, `counts.notEstimated` is 423, `notEstimatedByReason` totals 423, and the result says 10 were shown and 413 left out

#### Scenario: A longer list is asked for
- **WHEN** `notEstimatedLimit` is 50
- **THEN** `notEstimated` has up to 50 entries, as before

#### Scenario: Counts only
- **WHEN** `notEstimatedLimit` is 0
- **THEN** `notEstimated` is empty and the counts and reasons are still returned

#### Scenario: Nothing else changes
- **WHEN** the same comparison is run with and without the change
- **THEN** `estimates`, `ifConditionsMet`, `current`, the counts and the summary are identical

### Requirement: The text view and the data agree on the cap
The text view of the comparison SHALL list the same number of not-estimated plans as `notEstimated` and SHALL end the list with the number left out.

#### Scenario: Text view
- **WHEN** 423 plans cannot be estimated and the default limit applies
- **THEN** the text lists 10 and ends "and 413 more", with the reasons summarised as in the data
