# More Australian open data for Ask Righto: exploration, 17 Nov 2026

Research only. Each source below was read on 17 Nov 2026 through a summarising fetcher
(not verbatim), so **Verified** means a licence or status line was seen on the publisher's
page, and **Unverified** means it was not. Nothing here is legal advice.

## Short answer

Ask Righto already covers the best open, joinable datasets (CDR energy, CDR home loans,
PHIO health cover, CRICOS). The new sources that clear the "open licence" gate are mostly
**state and ABS-style datasets that join into a suburb view**, plus **Jobs and Skills Australia
career data that strengthens the course vertical**. The sectors people hope for (telco,
insurance, super) are still closed or restricted.

**Recommendation, in order:**

1. **Careers layer on the course vertical** (JSA Labour Market Insights, CC BY 4.0). Cheapest,
   no new regulatory question, same audience as courses.
2. **Solar and battery payback** (already Phase 7). Confirm the CER copyright terms first.
3. **Suburb fit, Victoria first.** Start a research change now; VIC rents and school zones are
   both CC BY 4.0. Highest effort, so start after 1 and 2.
4. **Aged care** only after the Star Ratings licence is confirmed.
5. Leave telco, super, general insurance and vehicle data parked.

## Candidate table

| # | Source / vertical | Access | Licence | Freshness | Financial-licence issue | Status |
|---|---|---|---|---|---|---|
| 1 | Jobs and Skills Australia, Labour Market Insights (occupation profiles, projections) | Downloads and data.gov.au | CC BY 4.0 on labourmarketinsights.gov.au; coat of arms, logos, third-party material excluded; attribution required. Some data.gov.au JSA datasets are CC BY 2.5 AU and not updated (Entry Level Labour Markets, last updated Aug 2023) | Site current; check each dataset | None | **Verified** (site licence). Dataset-level currency unverified |
| 2 | QILT graduate outcomes (salary and employment by field and institution) | Reports on qilt.edu.au | Not found: copyright page failed to load | Annual | None | **Unverified**. Would pair with course vertical; needs permission check |
| 3 | CER small-scale solar and battery installs by postcode | Monthly XLSX and CSV | Page states no licence; links a copyright policy not read | Monthly; data to 30 Sep 2026 | None | Access verified, **licence unverified** |
| 4 | VIC Rental Report, moving annual median rents by suburb | data.vic.gov.au download | **CC BY 4.0 (verified)** | Quarterly; June 2026 quarter, updated 10 Nov 2026 | None | **Verified** |
| 5 | VIC government school zones (primary and secondary) | Spatial ZIP, annual | **CC BY 4.0 (verified)** | 2027 zones published; neighbourhood schools only (selective, specialist excluded) | None | **Verified**. ACARA My School stays excluded |
| 6 | ABS Census, GTFS public transport feeds, state crime statistics | Bulk and APIs | ABS and VIC GTFS are CC BY from desk knowledge; crime stats vary by state | Varies | None | **Unverified** (not fetched this session) |
| 7 | Aged care Star Ratings quarterly extract | Excel, about 2 MB, Aug 2026 edition published 7 Aug 2026 | Page states no licence | Quarterly | None known; fee estimates must defer to Services Australia | Access verified, **licence unverified**. Provider Register (Aged Care Quality and Safety Commission) updated up to weekly, licence not seen |
| 8 | APRA MySuper statistics and heatmap | data.gov.au | CC BY 3.0 AU (verified for that dataset) | Dataset page last updated Aug 2023, so currency doubtful | **Yes**: comparing super products likely needs an AFSL view | Parked |
| 9 | PBS public API (medicine schedule and fees) | No login; **one request per 20 seconds shared by all users** | No licence stated | Monthly | None known | Low value (government sets prices); rate limit makes live use impractical, a monthly bulk load would be needed |
| 10 | Green Vehicle Guide and VESR (vehicle running cost) | Web views only | GVG data is under a **limited end-user licence, personal use**; no download or API seen | n/a | Stay off finance and novated leases | **Not open**. Demote EV running cost unless the Department grants permission |
| 11 | CDR telecommunications | Designated Jan 2022 | n/a | Expansion into telco, super and insurance **paused by Treasury in May 2023** | n/a | Still blocked. A 2026 consultancy blog says telco is "designated, not operationally launched"; I found no official 2026 status, so unverified |
| 12 | CDR non-bank lending | CDR page says "now expanding", no date | CDR product data | n/a | ACL question as for home loans | Watch only |
| 13 | training.gov.au / National Training Register web services (VET) | Move from SOAP to REST under way; public access not stated | Not stated | n/a | None | **Unverified**. Would extend courses to TAFE; ask DEWR (NTRReform@dewr.gov.au) |
| 14 | ATO taxation statistics | data.gov.au | Not checked this session | Annual | General tax information only | Low value for our case test (single-source rates) |

## Findings worth keeping

- **Telco is not a near-term vertical.** The CDR rollout page lists banking, energy and
  non-bank lending only. Treasury paused telco, super and insurance in May 2023 and I found
  no official restart.
- **Vehicle data is not open.** The EV versus petrol idea in the roadmap depends on Green Vehicle
  Guide figures, which are personal-use only. The roadmap should say so.
- **The PBS API has a hard rate limit** (one request per 20 seconds, shared), so it can only be
  a monthly bulk load, if it were used at all.
- **JSA's open licence is the cleanest find.** It could give occupations, outlook and
  employment projections next to a course answer, without touching any admissions-centre data.
- **Licence wording varies inside one agency.** JSA datasets on data.gov.au are CC BY 2.5 AU and
  frozen, while the live site is CC BY 4.0. Check each dataset's own page before ingesting.

## Not covered

Not checked: ABS licence text, state GTFS licences, crime statistics by state, NSW and QLD
rent and school data, Medicare benefit schedule, Fair Work pay rates, and insurance-adjacent
hazard maps (flood, bushfire). The fetcher summarised pages rather than quoting them, so
re-read each licence page before any ingestion change.

## Suggested next steps

1. Ask Iven whether to open an OpenSpec change `add-career-outcomes-layer` (JSA data into
   course answers).
2. Read the CER copyright page and QILT terms, then email if either is unclear.
3. Open a research-only thread for suburb fit (Victoria) joining rents, school zones, ABS and
   transport.
