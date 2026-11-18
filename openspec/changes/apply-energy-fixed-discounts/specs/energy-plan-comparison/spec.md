# Spec Delta

## ADDED Requirements

### Requirement: Fixed-amount discounts with a known frequency are applied
A fixed-amount discount SHALL be applied to the yearly estimate only when how often it applies is known from the published data. A yearly amount SHALL count once, a monthly amount twelve times, and a one-off amount SHALL NOT be in the yearly cost. A guaranteed discount SHALL reduce the ordering cost; a conditional one SHALL appear only in the cost if conditions are met.

#### Scenario: Guaranteed yearly credit
- **WHEN** a plan has a guaranteed fixed discount of $50 described as applying each year
- **THEN** the estimate is $50 lower than without it and the breakdown shows the discount

#### Scenario: Conditional monthly credit
- **WHEN** a plan has a $5 discount each month for paying by direct debit
- **THEN** the ordering cost does not include it and the cost if conditions are met is $60 lower

### Requirement: Discounts with an unknown frequency are shown, not applied
A fixed-amount or threshold discount whose frequency or period is not known SHALL NOT change any cost, and SHALL be shown beside the plan with its published amount and the statement that its frequency is not published.

#### Scenario: Frequency not published
- **WHEN** a plan has a guaranteed $100 discount with no frequency in its data
- **THEN** the estimate is unchanged and the plan lists "$100 discount, frequency not published"

### Requirement: Expired discounts are not applied
A discount whose published end date has passed SHALL NOT be applied, and one that ends within the next twelve months SHALL be shown with its end date.

#### Scenario: Discount ending soon
- **WHEN** a guaranteed discount ends in three months
- **THEN** the estimate applies it and the plan notes the end date
