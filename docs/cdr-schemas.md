# Consumer Data Standards schemas

The Data Standards Body publishes the Consumer Data Right (CDR) payload schemas as JSON Schema in
[ConsumerDataStandardsAustralia/dsb-schema-tools](https://github.com/ConsumerDataStandardsAustralia/dsb-schema-tools),
one folder per standards version (`1.11.0` to `1.35.0` as of 16 Nov 2026), each with
`schemas/<sector>/`. The human-readable standards are at
<https://consumerdatastandardsaustralia.github.io/standards/>.

- Energy: `1.35.0/schemas/energy/` (plans, accounts, billing, usage, DER).
- Banking: `1.35.0/schemas/banking/`. Use this the same way when bank product data
  (Get Products, Get Product Detail) becomes a vertical.
- Older versions stay in the repo, which helps when a data holder still serves a retired
  endpoint version: compare `1.33.0` (last with `EnergyPlanSolarFeedInTariffV2`) and `1.35.0`.

Schema files are named by payload and endpoint version. The `x-v` header we send picks the
version: plan list `x-v: 1` is `EnergyPlanListResponse`; plan detail `x-v: 3` is
`EnergyPlanResponseV3` → `EnergyPlanDetailV3` → `EnergyPlanContractFullV3`, which uses
`EnergyPlanTariffPeriodV2`, `EnergyPlanControlledLoadV2` and `EnergyPlanSolarFeedInTariffV3`.

To read one sector without the whole repo:

```
git clone --depth 1 --filter=blob:none --sparse https://github.com/ConsumerDataStandardsAustralia/dsb-schema-tools.git
cd dsb-schema-tools && git sparse-checkout set 1.35.0/schemas/energy
```

The schemas are the contract data holders must follow, not proof of what they send. Treat them
as the first reference for shapes and units, and check real payloads before relying on a field.

## Energy plans: field check against 1.35.0 (16 Nov 2026)

What `src/energy/normalise.ts` reads, compared with `EnergyPlanDetailV3`:

| Field | Standards (1.35.0) | Ours before this check | Now |
| --- | --- | --- | --- |
| `solarFeedInTariff[].timeVaryingTariffs` | **Array** of tariffs, each with `displayName`, `type` (PEAK, OFF_PEAK, SHOULDER; absent = all periods), `period`, `rates[]`, `timeVariations[]` (days, start, end). Was a single object in v2 | Read as an object, so every v3 time-varying feed-in was `solarFeedIn:unknown_shape` (the 21 AGL plans in #8, most likely) | Read as an array (v2 object still accepted), with windows, into `FeedIn.timeVaryingTariffs` |
| `solarFeedInTariff[].tariffUType` | `singleTariff` or `timeVaryingTariffs` | Ignored | Used to pick the shape; other values flagged |
| `solarFeedInTariff[]` `startDate`, `endDate`, `description` | Optional | Dropped | Kept |
| `controlledLoad[].singleRate.dailySupplyCharge` | The controlled load supply charge sits **inside** `singleRate` (and each `timeOfUseRates[]` item) | Read at the controlled load's top level, so it was always missing and estimates left out the controlled load supply charge | Read from the rate block |
| `controlledLoad[].rateBlockUType` | `singleRate` or `timeOfUseRates` | Ignored | Used; a load with no rates is flagged |
| `controlledLoad[].timeOfUseRates[].type` | Adds `SOLAR_SPONGE` | Kept as text | Same |
| `period` of block rates | On the rate block (`singleRate.period`, `timeOfUseRates[].period`, feed-in tariffs), defaults to `P1Y` except for tariff `singleRate` (no default) | Read on each rate, where the standards never put it, so real block rates would have no period and the estimate would stop | Read from the block and copied to each block rate; schema default applied where stated |
| `tariffPeriod[].dailySupplyCharge` | Named `dailySupplyCharge` in every version | Read `dailySupplyCharges` first (not in the standards; our synthetic fixtures used it) | Reads `dailySupplyCharge`, still accepts the other; a period with no supply charge is flagged `tariffPeriod:no_supply_charge` |
| `tariffPeriod[].dailySupplyChargeType` = `BAND`, `bandedDailySupplyCharges[]` | Banded supply charges by volume | Not read; the supply charge was silently missing | Bands kept, plan flagged `tariffPeriod:banded_supply_charge`, not costed |
| `tariffPeriod[].timeZone`, contract `timeZone` (default AEST) | Time zone for time-of-use windows | Not read | Not read. Estimates use the user's own split, not windows |
| `demandCharges[]` | Amount, measure unit, periods, min/max demand | Only `hasDemandCharges` | Same; demand tariffs are not costed |
| `singleRate.generalUnitPrice` (QUOTA) | Price above the included usage, **inclusive** of GST | QUOTA flagged not understood | Same |
| `greenPowerCharges[]`, `intrinsicGreenPower`, `meteringCharges[]`, `additionalFeeInformation`, `variation`, `onExpiryDescription` | Optional extras | Not read (kept in raw) | Same. Candidates for `get_energy_plan` later |
| `measureUnit` | Enum `KWH, KVA, KVAR, KVARH, KW, DAYS, METER, MONTH` (no `MJ`) | Defaults to KWH, any text kept | Same. Our gas fixture uses `MJ`; real gas plans must show which unit retailers send |
| Discounts, fees, incentives, eligibility | Match what we read | OK | OK |

The synthetic fixtures were corrected to the standards' shapes and
`test/fixtures/energy/solar-time-varying.json` was added.

Plans already stored are not re-normalised by a sync unless their source changes. After
deploying a normaliser fix, run (no API calls):

```
node dist/askrighto.js renormalise-energy --dry-run --show solarFeedIn
node dist/askrighto.js renormalise-energy
```

The dry run prints the reason counts before and after, and the raw fragment of any plan still
flagged with the given reason prefix. Restart the server afterwards so its cache is cleared.

## GST: what the standards settle

The standards' own field descriptions say:

- **Exclusive of GST**: usage `unitPrice` (single rate, time of use, block rates), tariff period
  `dailySupplyCharge`, banded supply charges, demand charge `amount`, controlled load
  `unitPrice` and `dailySupplyCharge`, and solar feed-in `unitPrice`.
- **Inclusive of GST**: `singleRate.generalUnitPrice` for QUOTA plans (the one exception).
- **Not stated**: fee `amount`, discount `fixedAmount.amount`, green power charges, metering
  charges, incentives.

So every component the estimate prices today (supply, usage, controlled load, feed-in) is
documented as GST exclusive. Feed-in credits paid to a household that is not registered for GST
carry no GST, so the estimate and `get_energy_plan` show them as published, without adding 10%.

What real data still has to confirm before `GST_BASIS` changes:

1. That retailers follow the description: one or more recorded AGL plans whose unit price times
   1.1 matches the GST-inclusive price on the retailer's fact sheet (Basic Plan Information
   Document) or Energy Made Easy. A single example settles the common case.
2. The basis of recurring fees and fixed discounts, which the estimate includes but the
   standards do not describe. Until checked, treat them as GST exclusive like the rates, or
   leave them out of the GST line.
3. The feed-in rate on the fact sheet equals the published `unitPrice` (no GST either side).

A quick way to pull the raw prices of one stored plan on the server:

```
SELECT plan_id, display_name, plan_url,
       raw->'electricityContract'->'tariffPeriod' AS periods,
       raw->'electricityContract'->'solarFeedInTariff' AS feed_in
  FROM askrighto.plans WHERE retailer_slug = 'agl' LIMIT 1;
```
