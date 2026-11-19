# Energy readings prompt

A comparison made from a benchmark or one bill is only as accurate as that usage. Interval readings (use in half-hour steps from the smart meter) are the most accurate input and the only fair way to compare time-of-use plans. Ask Righto is not an accredited CDR data recipient (Iven, 18 Nov 2026), so it cannot fetch readings. It tells people they can ask, and shows where. Change: `add-energy-readings-prompt`.

## What the tool does

`compare_energy_plans` adds one note, "More accurate comparison", to **electricity** results whose usage is a benchmark or one bill scaled to a year (not a stated yearly figure, and not gas: no interval data is offered for gas here). It says the household can ask its retailer or its electricity distributor for interval readings, often for up to the last two years, that the NMI printed on a bill is needed, and that readings would also let time-of-use plans be compared. It says Ask Righto does not request the readings, and that once the household has the file it can be read here (nothing is stored; see `docs/energy-interval-readings.md`). It appears once, below the main table, and in the structured data (`readingsNote`); the Inkview table carries it as a `footnote` because the table caption is capped at 300 characters. Time-of-use plans not estimated for lack of a split say that readings from the retailer or distributor would allow a comparison.

When the distributor is known (named by the person, or the only one for the postcode) and has a checked page in `src/energy/distributors.json`, the note links that page, shows the check date and repeats the distributor's own note (what its page states about fees and time). Otherwise it stays generic: no link, no claim about that distributor. No fee, time or "free" is ever stated unless the distributor's page does; `readingsWordingProblems` and the tests enforce it.

## The right to request data (task 1.4)

The AEMC final rule determination ERC0171, "Customer access to information about their energy consumption", was made on 6 Nov 2014 (project page lists it as completed; the rule commenced in stages from 1 Dec 2014). It gives a small customer, or a person they authorise, access to metering data from their retailer or their distributor, with minimum requirements for format, response time, data period and when a request is free set in AEMO's metering data provision procedures. **I could not re-read the current rule text: aemc.gov.au answered a plain request with an HTTP 403 bot check (19 Nov 2026) and I did not get around it.** What the note says therefore rests on the distributors' and retailers' own pages below, not on rule numbers. Still to confirm by a person: the current rule numbers (the 2014 numbering may have moved), whether the data period is two years, the count of free requests per 12 months (search results mention four in 12 months, from a submission on the draft, not the final text) and the 10 business day response time.

## Distributor pages (task 1.2), checked 19 Nov 2026

One plain GET per page; nothing stored but the link, the date and a one-line note. 13 electricity distributors (15 spellings) are named on the 17 Nov 2026 plan data (`test/fixtures/energy/distributors-on-active-plans.json`).

| Distributor | Result | Page says (our words) |
| --- | --- | --- |
| Ausgrid | linked | Request your own or a third party's meter data; NMI from a bill; up to 2 years; single NMI within 10 business days; a fee may apply after 4 requests in 12 months, for other formats, or for a third party requesting for several customers; it says it will tell you before sending |
| AusNet (electricity) | linked | "Meter data" page: a smart meter can be viewed on MyHomeEnergy; a basic meter has a request form. No fee or time stated |
| SA Power Networks | linked | Meter page linking its "Your Meter Data" service; no fee or time stated on this page |
| Endeavour | no link | The address found by search redirects to a general "Your meter" page with no request steps |
| Essential Energy, Energex, Ergon | no link | Bot check (HTTP 403) on a plain request |
| Evoenergy | no link | The address found by search now answers 404 |
| CitiPower, Powercor (myEnergy), United Energy (Energy Easy), Jemena (Electricity Outlook) | no link | The portal did not answer a plain request |
| TasNetworks | no link | No page of its own found; one source says to ask the retailer, not confirmed |

Addresses found by search but **not checked** (for a person to open and confirm, then add to `distributors.json`): Essential `essentialenergy.com.au/partners/meter-data-requests`; Energex `energex.com.au/our-services/metering/accessing-your-metering-data`; Ergon `ergon.com.au/network/our-services/metering/accessing-your-metering-data` and `.../network/contact-us/forms/metering-data-request-form`; Endeavour `endeavourenergy.com.au/your-energy/your-electricity-meter/accessing-your-meter-data`; Evoenergy `evoenergy.com.au/Your-Energy/Meters/Request-meter-data` (now 404); CitiPower and Powercor `myenergy.powercor.com.au/s/data-request`; United Energy `energyeasy.ue.com.au`; Jemena `electricityoutlook.jemena.com.au`; SA Power Networks `customer.portal.sapowernetworks.com.au/meterdata/`.

Gas distributors (Australian Gas Networks, AusNet gas, Multinet, Jemena gas, Allgas, Evoenergy gas and others) are out of scope: the note is about electricity interval data.

## Retailer pages (task 1.3), checked 19 Nov 2026

- EnergyAustralia (`energyaustralia.com.au/meter-usage-request`): only properties with a smart meter are eligible; data in CSV and PDF; can take up to 10 business days.
- AGL (`agl.com.au/campaigns/request-metering-data`): the requester must be an authorised contact on the account (otherwise a signed consent form); the service may be subject to a charge; former customers can ask for data from the last 2 years.
- Origin (`originenergy.com.au/meter-data-request/`): answered 404. Not recorded.

The note does not link retailer pages yet: only two were checked and they differ. A later change could add `readingsUrl` per retailer.

## Adding a distributor

Open the distributor's own request page in a browser, then add an entry to `distributors.json`: `name`, `aliases` (spellings seen in plan data), `requestUrl`, `checkedAt` and, only if the page states it, a one-line `note` on fees or time; or `none` with the reason. A test fails if a distributor on active plans has no entry. Re-check links before shipping and when a retailer's distributor list changes.

## Not in scope

Uploading, parsing or storing readings (NEM12 or CSV); becoming an accredited data recipient; requesting data for the person; WA and NT; business customers. Iven will supply a real readings file from his own distributor to test a later upload change.
