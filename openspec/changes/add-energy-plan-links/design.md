## Context

Stored plan ids carry a source suffix: `@EME` for plans from the national CDR retail data and `@VEC` for Victorian plans from Victorian Energy Compare, for example `ENG1112028MRE1@EME` and `COV763326SR@VEC`. Iven's example offer id has no suffix (`ENG1207222MRE`). The CDR records hold no plan link, and the Register brand record has no website we can read without a certificate.

## Decisions

1. **Build, don't store.** The link is computed when a result is formed from `planId`, the person's postcode and the brand, so a rule change needs no data reload. `plan_url` keeps whatever the retailer published.
2. **EME rule.** For a plan whose id ends in `@EME` and a postcode that is not Victorian, offerId is the id without the suffix and without its trailing revision digits (stored `ENG1207222MRE2@EME` is offer `ENG1207222MRE`, Iven's example). The postcode must be one the person gave; with none (for example `get_energy_plan` without a postcode) the result says no link is available and asks for the postcode. Task 1.2 (below) settled the digit rule from the data and the example, not from the page, because a plain GET cannot tell a good offer from a bad one.
3. **Victoria.** `@VEC` plans, and any plan shown for a Victorian postcode, get the brand's website only, labelled "Retailer website", with the sentence that the plan's rate sheet is found there. No other link is offered. A plan id of any other shape also gets the website only.
4. **Website map.** `retailers.json` gains `website` and `websiteCheckedAt`, `brandWebsites` for the brands that share a path, or `noWebsite` with the reason it was left out. A brand with no checked website gets no link, not a guess. The consistency test fails if an active brand has neither a dated website nor a reason (this reads the spec's "missing website" scenario as "missing entry", because 47 of 92 brands could not be checked, see below).
5. **Wording.** Links are never called "the plan page" unless it is the EME page for that offer. Output notice: links go to official or retailer pages we do not read or store; check the rate sheet there.
6. **Rights.** No new dataset. `docs/data-rights.md` gets a line that EME and retailer links are links only.

## Risks / Trade-offs

- The EME URL pattern is not a published API and may change. A pre-ship check and a one-off test on a sample of offers guard it; the label does not promise more than "Energy Made Easy page".
- Postcode on the link is the person's postcode, not necessarily one the plan covers; the plan list already limits plans to that postcode.
- A retailer website can move; `websiteCheckedAt` shows its age.

## Findings (tasks 1.1 and 1.2, 19 Nov 2026)

**Suffix counts** (17 Nov 2026 load, 12,258 plans): `@EME` 7,808 (electricity 7,192, gas 616) and `@VEC` 4,450 (electricity 3,360, gas 1,090); no id without a suffix and none of another shape. Every `@EME` id ends in 1 or 2 revision digits (6,574 and 1,234); every `@VEC` id ends in a letter. So the rule is: strip `@EME`, then the trailing digits. Iven's example `ENG1207222MRE` is the stored plan `ENG1207222MRE2@EME` ("NSW- ENGIE - Perks Elec") without its digit.

**EME pages opened** (plain GET, 16 requests, one every 2 s, 19 Nov 2026): the offer pattern was requested for 8 electricity offers without the digit (ENGIE, AGL, EnergyAustralia, Origin, Red Energy, Momentum, Alinta, Amber), 3 of them also with it, 2 gas offers (ActewAGL, AGL) without and with it, and one made-up id as a control. **All 16 answered HTTP 206 with the same 40 KB shell and no page title**, including the made-up id. Energy Made Easy renders the offer in the browser, so a plain GET cannot show which form resolves to the rate sheet. What this proves: the URL pattern is served. What it does not: that an offer id opens its rate sheet. The digit rule rests on the example and the id shape, so **a person should open two or three links in a browser before release** (task 3.1) and check ENGIE `ENG1207222MRE` at postcode 2000 and one gas offer. Gas uses the same pattern; it is included, with that caveat.

**Websites** (one plain GET per site, 19 Nov 2026, no crawling): 45 of 92 brands have a checked website (answered 2xx and the page or its address named the brand; a few answered HTTP 206 or with an empty title in the first 60 KB and were accepted on the address alone: AGL, ENGIE, Lumo, Momentum, OVO). Four shared-path brands needed their own site (`brandWebsites`). 47 brands are left without one:

- `altogether` (Altogether): site did not respond
- `ampol` (Ampol Energy): ambiguous: the Ampol group home page, not an Ampol Energy page
- `arc-energy` (Arc Energy Group): ambiguous: the guessed address shows another brand (Energy Locals Urban)
- `arcstream` (Arcstream): not found (HTTP 404)
- `besy` (Besy): site did not respond
- `bright-spark` (Bright Spark Power): site did not respond
- `circular` (Circular Energy): page had no title, could not confirm the brand
- `cleanpeak` (CleanPeak Energy Retail): site did not respond
- `coles` (Coles Energy): ambiguous: redirects to the Coles supermarket home page
- `cpe-mascot` (CPE Mascot): site did not respond
- `ea-connect` (Ellis Air Connect): site did not respond
- `electricity-in-a-box` (Electricity in a Box): site did not respond
- `energy-locals` (Energy Locals Retail): blocked: bot check (HTTP 403)
- `erc-energy` (ERC Energy): page title did not name the brand
- `ergon` (Ergon Energy): blocked: bot check (HTTP 403)
- `erm-power` (ERM Power): site did not respond
- `flipped` (Flipped Energy): site did not respond
- `flow-systems` (Flow Systems): site did not respond
- `gee-energy` (GEE Energy): site did not respond
- `glow-power` (Glow Power): site did not respond
- `locality-planning` (Locality Planning Energy): site did not respond
- `localvolts` (Localvolts): server error (HTTP 520)
- `macarthur` (Macarthur Energy Retail): site did not respond
- `macquarie` (Macquarie): not checked: no unambiguous retail energy site known
- `metered-energy` (Metered Energy Holdings): page title did not name the brand
- `mojo` (Mojo Power): ambiguous: redirects to a comparison site (GoSwitch)
- `nectr` (Nectr): site did not respond
- `next-business` (Next Business Energy): server error (HTTP 520)
- `on-by-energyaustralia` (On by EnergyAustralia): not checked: no separate site known
- `origin` (Origin Energy): home page answered HTTP 404 to a plain request (likely bot protection)
- `people-energy` (People Energy): page had no title, could not confirm the brand
- `perpetual` (Perpetual Energy): site did not respond
- `powerdirect` (Powerdirect): site did not respond
- `powerhub` (PowerHub): ambiguous: the address shows a hosting test page
- `qenergy` (QEnergy): blocked (HTTP 403)
- `reamped` (ReAmped Energy): site did not respond
- `sanctuary` (Sanctuary Energy): site did not respond
- `seene` (Seene): ambiguous: page title is only My Account
- `simply-energy` (Simply Energy): ambiguous: redirects to the ENGIE site
- `smart-energy` (Smart Energy): site did not respond
- `smartestenergy` (SmartestEnergy): site did not respond
- `tas-gas` (Tas Gas): site did not respond
- `telstra-energy` (Telstra Energy): not found (HTTP 404)
- `tesla` (Tesla Energy Ventures): blocked (HTTP 403)
- `veolia` (Veolia Energy): ambiguous: redirects to the Veolia Australia and New Zealand group site
- `yes-energy` (YES Energy): ambiguous: the address shows a directory listing
- `zen-energy` (ZEN Energy): site did not respond

The ones that matter most are Origin (842 Victorian plans), Flipped (50), Nectr (30), Next Business Energy and Indigo Power (26 and others) and Energy Locals: their Victorian plans show "No link available" until a person confirms the address.

**Wording (task 1.3).** `docs/legal/` holds only the home loan view markers, no notes on links. The labels are "Rate sheet on Energy Made Easy", "Retailer website" and "Plan page published by the retailer"; none says official, approved or the plan's page, and the notice says we do not read or store the pages. No wording implies endorsement.

## Open Questions

- Answered: offer ids lose the trailing digits; gas uses the same pattern (unverified in a browser); every plan id is `@EME` or `@VEC`.
- Still open: does the EME page for an offer open its rate sheet for each form of id? A browser check of a few links (task 3.1).
