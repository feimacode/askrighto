## Context

`compare_energy_plans` already knows the distributor (from the plan data or the person's answer) and, after `add-energy-benchmark-usage`, the usage basis (`customer` or `benchmark`). The stored distributor names come from CDR plan data and are spelled as retailers spell them ("Citipower", "CitiPower"). Three distributor pages were read on 19 Nov 2026: Ausgrid (online form, NMI, surname, postcode, date range; 10 business days; up to 2 years; fees after 4 requests in 12 months or for other formats; times in AEST), Energex (account holder or authorised third party; usually free; CSV for interval meters; data from 1 Jan 2017), Essential Energy (online form for the customer; NEM12 provided; 10 business days best endeavours).

## Decisions

1. **Rights in plain words, not rule numbers.** The note says people can ask their retailer or their distributor, and links the AER or AEMC page; rule numbers appear only in docs with the check date, because they may have been renumbered since 2014.
2. **One note, one place.** Shown only when the basis is a benchmark or a single bill (never when readings were already used), as one short paragraph below the table, plus one line on each not-estimated time-of-use plan. Never repeated per plan.
3. **Distributor links are data, hand-checked.** `distributors.json`: `name`, `aliases` (spellings seen in plan data), `requestUrl`, `checkedAt`, optional `note` (for example "usually free, about 10 business days") copied from that page only. A missing entry means no link, never a guess. A test fails if a distributor seen on active plans has no entry or an explicit "none" marker.
4. **No promises.** Wording says "usually" and "about" and names the retailer as an alternative when a distributor page is unclear. The fee line is only shown where the distributor's page states it.
5. **Not a data path.** The note does not ask the person to send the file to us. A later change decides upload; this change must not hint that we read it. A decision for that change: readings upload stays parked until Iven has tested a real file (he will supply one from his own distributor).
6. **Rights.** No new dataset; `docs/data-rights.md` records that distributor pages and the AEMC rule are linked and paraphrased, nothing stored.

## Risks / Trade-offs

- Distributor pages change. The check date is shown in the docs and a pre-ship task re-checks the links.
- Distributor names in plan data are inconsistent; aliases handle the known spellings, and an unmatched name falls back to the generic note.
- Some customers cannot find their NMI. The note says it is on the bill and the retailer can give it; nothing more is claimed.
- A rule renumbering or change after 2014 could alter details; the note avoids the specifics (counts of free requests) unless the distributor page states them.

## Findings (tasks 1.1 to 1.4, 19 Nov 2026)

Full detail in `docs/energy-readings.md`. Summary:

- **Distributors on active plans (1.1):** 13 electricity distributors under 15 spellings (Citipower, AusNet Services (electricity), Essential Energy Standard / Far West / plain, Ergon) and 27 gas distributor names. Gas is out of scope: the note is about electricity interval data, so gas results get no note.
- **Pages (1.2):** only 3 of 13 electricity distributors have a page I could check with one plain GET and that has real request content (Ausgrid, AusNet, SA Power Networks). Essential, Energex and Ergon answer a bot check; Evoenergy's page has moved; CitiPower, Powercor, United Energy and Jemena portals did not answer; Endeavour's address redirects to a general page; TasNetworks has no page of its own. Those get the generic note, listed with the addresses a person should confirm. The spec's consistency test is met by an explicit `none` reason.
- **Retailers (1.3):** EnergyAustralia and AGL pages found and read; Origin's answered 404. Not linked yet.
- **Rule text (1.4):** not re-read. aemc.gov.au answered HTTP 403 (bot check). The note avoids rule numbers, the free-request count and the 10 business day figure unless a distributor's own page states them (Ausgrid's does).
- **Inkview:** the caption is capped at 300 characters, so the note rides in a `footnote` field on the table, plus the structured data and the text form. This is weaker than the spec's "in both"; flagged in the PR.

## Open Questions

- Answered (1.1): 13 electricity distributors under 15 spellings.
- Do the retailer-side pages for the biggest retailers say how to request readings? If yes, link the retailer route too; otherwise the note stays generic for retailers.
- What does a real readings file from Iven's distributor look like (NEM12, CSV, columns)? Needed only for the later upload change.
