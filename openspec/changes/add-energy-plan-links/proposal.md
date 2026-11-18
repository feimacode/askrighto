# Proposal

## Why

`plan_url` is empty for all 10,552 stored electricity plans. A check on 18 Nov 2026 of the stored records and live CDR responses found that retailers publish no plan link: no plan has `additionalInformation` or `applicationUri` (both optional in CDS 1.35.0), and the only URL-like field seen is a generic Energy Made Easy home page on 25 ENGIE plans. The normaliser reads the right fields, so the data is empty, not the code. Results therefore show a plan id and no way to see the retailer's rate sheet.

Iven (18 Nov 2026) supplied the rule: outside Victoria, the Energy Made Easy (EME) page for an offer is `https://www.energymadeeasy.gov.au/plan?id=<offerId>&postcode=<postcode>`, for example `plan?id=ENG1207222MRE&postcode=2000`, and it holds the rate sheet. Victoria has no unified rate sheet page, so people must be sent to the retailer's website.

## What Changes

- Derive a plan link at read time (nothing new stored from the retailer): for plans whose id ends in `@EME`, link to the EME plan page using the offer id (the part before `@`) and the postcode the person gave. For plans ending `@VEC` (Victoria), link to the retailer's website from a hand-checked map and say it is the retailer's site, not the plan page.
- Add `website` (official retailer home page, hand-checked, with the date checked) to each brand in `src/energy/retailers.json`.
- Where the retailer published its own plan link, keep using it first.
- Label every link by what it is: "Rate sheet on Energy Made Easy", or "Retailer website (find the rate sheet for this plan there)". No link is shown as a plan page unless it is one.
- When no link can be built (no postcode, no website), say so instead of showing the plan id as a link.
- Add the links to `search_energy_plans`, `get_energy_plan` and `compare_energy_plans` in both the markdown and Inkview output.

Data source: Energy Made Easy plan page URL pattern given by Iven, and each retailer's own public website. No page is fetched, scraped or stored by the server; the server only builds a link. Licence: not applicable (links, not data). Refresh: the website map is re-checked when a retailer is added; the pattern is checked by the pre-ship task below.

Hosts affected: Claude, ChatGPT and Gemini, through the three existing tools; no new inputs except an optional `postcode` on `get_energy_plan`.

Out of scope:

- Reading or republishing anything from EME or retailer pages. AGENTS.md rule 2 keeps EME off the list of sites we scrape, and a link is not a scrape.
- Per-plan retailer pages for Victoria (not derivable).
- Gas plan links beyond the same pattern (checked in task 1.2; included only if the pattern holds).
- Deep links into a retailer's sign-up or switch flow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `energy-plan-lookup`: plans show a labelled link to the rate sheet or the retailer's site.

## Impact

- Changed: `src/energy/retailers.json` (website per brand), a new `src/energy/links.ts`, the three tools' rendering, `docs/energy-data.md`.
- No migration; `plan_url` stays as published and is usually null.
- Needs a person to hand-check about 40 retailer websites (cloud sessions cannot reach most of them), so task 1.1 runs on a machine that can.
