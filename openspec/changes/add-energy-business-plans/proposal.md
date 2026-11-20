## Why

The sync stores residential plans only, so a business or small-business customer finds no plan to compare. Iven (20 Nov 2026): include business customers, compare them only with business plans, and exclude large customers, who are a different market.

## What Changes

- The sync stores plans whose CDR customer type is RESIDENTIAL or BUSINESS. Plans with any other or missing type are still skipped.
- Plans carry their customer type; postcode searches filter on it and default to RESIDENTIAL, so a household never sees business plans by accident and the reverse.
- `search_energy_plans` and `compare_energy_plans` take `customerType` (RESIDENTIAL default, BUSINESS). The agent asks the user to pick; it never infers it from a bill.
- A business customer has no typical-usage route (benchmarks are household figures): `compare_energy_plans` with BUSINESS and no usage asks for a bill or readings.
- `renormalise-energy` keeps each stored plan's customer type.

## Not in this change

- **Large customers are out of scope.** Iven (20 Nov 2026): every plan in the CDR data is for residential or small-business customers, so the BUSINESS type means small business and no threshold logic is needed. The instructions still tell the agent that large customers are not compared.
- Demand-charge tariffs (more common for business) stay "not estimated" with a reason.
- The invoice-first flow and per-band shares are separate changes.

## Impact

Reload needed after deploy: `sync-energy` adds business plans (about 15 to 30 percent more plans per retailer, estimated from listed counts). Existing stored plans are residential and unaffected.
