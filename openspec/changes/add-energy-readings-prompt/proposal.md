# Proposal

## Why

A comparison made from a benchmark or one bill is only as accurate as that usage. Interval readings (meter data in half-hour steps) are the most accurate input and the only way to compare time-of-use plans fairly. Ask Righto is not a CDR accredited data recipient (decision, Iven, 18 Nov 2026), so it cannot fetch readings itself.

Households do have a right to them. The AEMC's final rule on customer access to energy data (ERC0171, 6 Nov 2014; the rule numbers may have moved since) lets a small customer, or someone they authorise, get up to two years of consumption data from their **retailer or their distributor**, within 10 business days for a single request, with up to four free requests per 12 months from each. Distributors' own pages (Ausgrid, Energex and Essential Energy checked 19 Nov 2026) say the same: the NMI from the bill, name and address, a date range, usually free, NEM12 or CSV.

So the cheapest way to a more accurate comparison is to tell people they can ask for their readings, and show them where. Iven (19 Nov 2026) asked for exactly that prompt, and will supply a real readings file from his own distributor later to test with.

## What Changes

- Add a short, plain "more accurate comparison" note to `compare_energy_plans` results whose usage basis is a benchmark or a single bill: you can ask your retailer or your distributor for up to two years of interval readings, you will need the NMI from your bill, it is usually free and arrives within about 10 business days.
- When the distributor is known, link that distributor's own meter data request page. Links are hand-checked and dated, kept per distributor in a new `src/energy/distributors.json`. A distributor with no checked link gets no link and the note stays generic.
- For time-of-use plans listed as not estimated for needing a usage split, add that the readings are what would allow them to be compared.
- Add the same guidance to the energy bill skill and server instructions so the host offers it once, without nagging.
- Say what Ask Righto does not do: it does not request the data for the person, and it cannot read the file yet.

Data source: the AEMC final rule determination ERC0171 and each distributor's own request page (links and facts only, nothing stored from them but the link, the check date and a one-line fee/time note where the page states it). Licence: not applicable to links; facts are re-stated in our own words with the page link. Refresh: re-checked when a distributor is added and before shipping.

Hosts affected: Claude, ChatGPT and Gemini, through `compare_energy_plans`. No new inputs.

Out of scope:

- Uploading, parsing or storing readings (NEM12 or CSV). Parked until Iven has tested a real file; a later change.
- Becoming an accredited data recipient or any CDR data request.
- Requesting the data for the person, or an authorisation form.
- Western Australia and the Northern Territory (outside the NEM and AER regime).
- Business customers (the right described is for small customers).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-comparison`: results prompt people to request interval readings and show where.

## Impact

- New: `src/energy/distributors.json` (name, request page URL, checked date, optional fee and time note), `docs/energy-readings.md`.
- Changed: `src/tools/compare-energy-plans.ts` (the note, markdown and Inkview), the notice module, the energy bill skill, server instructions.
- No migration. Depends on `add-energy-benchmark-usage` (usage basis) and benefits from `add-energy-plan-links` (distributor names already in plan data).
- Distributor names in plan data (`geography.distributors`) must be matched to the new file; unmatched names get the generic note.
