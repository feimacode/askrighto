# Spec Delta

## ADDED Requirements

### Requirement: Usage is carried per band
Costing SHALL assign usage to each tariff band the plan defines, including plans with more than one shoulder band.

#### Scenario: Readings and a two-shoulder plan
- **WHEN** a readings profile is costed against a plan with SHOULDER1 and SHOULDER2 windows
- **THEN** each half hour is assigned to the band whose window contains it and the plan is estimated

#### Scenario: Bill split and a two-shoulder plan
- **WHEN** only a three-band bill split is given and the plan has two shoulder bands
- **THEN** the shoulder share is divided equally between them and the result marks that plan's split as approximate

### Requirement: Unestimable plans keep a reason
A plan SHALL be listed as not estimated, with a reason, when its windows have gaps, overlaps or odd times, or it has demand charges.

#### Scenario: Window gap
- **WHEN** a plan's windows leave part of the week uncovered
- **THEN** the plan is not estimated and the reason names the gap
