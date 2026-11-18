# Spec Delta

## ADDED Requirements

### Requirement: Optional concession input
`compare_energy_plans` SHALL accept an optional answer to whether anyone in the household holds a concession card (`yes`, `no` or not said). It SHALL NOT accept or ask for a card type, card number, name or other personal detail, and SHALL NOT store the answer.

#### Scenario: Concession card held
- **WHEN** the tool is called with `concessionCard: yes` for a postcode whose state has a current rule for that fuel
- **THEN** each estimate also shows a cost after concession, the concession's name, its official link and checked date

#### Scenario: Not said
- **WHEN** the tool is called without the concession answer
- **THEN** the estimates are unchanged and the result notes that concession holders may pay less, with the state's official concessions link

### Requirement: Concessions do not change the ordering
The ordering SHALL stay on the estimated cost before concession, and the result SHALL say that the cost after concession assumes the household is eligible and that the retailer applies the concession.

#### Scenario: Ordering with a concession
- **WHEN** the tool is called with `concessionCard: yes`
- **THEN** the plans are in the same order as without it, and the after-concession figure is shown beside each
