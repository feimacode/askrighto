# Spec Delta

## ADDED Requirements

### Requirement: Usage may come from the household's interval readings
`compare_energy_plans` SHALL accept an optional `readingsProfile` string from `summarise_interval_readings`, SHALL revalidate it, and when valid SHALL use it for annual usage with the basis marked `readings`.

#### Scenario: Readings given
- **WHEN** a valid `readingsProfile` is given with no other usage figure
- **THEN** the estimates use the profile's annual kWh, the result states the period and any scaling to a full year, and the basis is readings

#### Scenario: Stated usage and readings
- **WHEN** both a bill figure and a profile are given
- **THEN** the profile is used and the result says the bill figure was not used

#### Scenario: Invalid profile
- **WHEN** the profile string is malformed, of an unknown version or out of range
- **THEN** the tool returns an input error asking the host to call `summarise_interval_readings` again and makes no estimate

### Requirement: Time-of-use plans are estimated from the profile
With a readings profile the tool SHALL work out the share of use in each time-of-use plan's windows from the profile, converting the plan's local clock times to market time for the postcode's state, and SHALL estimate those plans.

#### Scenario: Time-of-use plan with mappable windows
- **WHEN** a time-of-use plan's windows can be mapped to the profile
- **THEN** it is estimated using the shares from the profile and the result names the windows used

#### Scenario: Daylight saving
- **WHEN** the postcode is in a state that observes daylight saving
- **THEN** summer windows are shifted by one hour before shares are taken

#### Scenario: Unmappable windows
- **WHEN** a plan's windows cannot be mapped (overlaps, gaps or an unknown band)
- **THEN** the plan is listed as not estimated with that reason

### Requirement: Solar export and controlled load from readings
With a readings profile the tool SHALL use the `B` stream total as the solar export figure, and SHALL treat controlled load as not costed separately.

#### Scenario: Solar household
- **WHEN** the profile has a `B` stream
- **THEN** the solar export figure used is that stream's annual total and the feed-in credit is worked out as for a stated export figure

#### Scenario: Controlled load left out
- **WHEN** the profile has more than one `E` stream
- **THEN** all are main consumption and the omissions say controlled load is not costed separately

### Requirement: Readings results are labelled as the household's own
When the basis is readings the result SHALL state the period, the days present and the missing dates, SHALL NOT use the typical-usage notice or the readings prompt, and SHALL say the estimate rests on one past year of use.

#### Scenario: Short or gappy period
- **WHEN** the readings cover under 365 days or miss dates
- **THEN** the result says how many days were present and that the figure was scaled

#### Scenario: Short period under 90 days
- **WHEN** the readings cover under 90 days
- **THEN** the result adds that seasonal plans are less certain
