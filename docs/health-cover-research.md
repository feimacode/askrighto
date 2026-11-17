# Private health insurance: data and regulatory research

Written 17 November 2026 to support the five `add-health-cover-*` OpenSpec changes. Planning
only: nothing here has been built. Read from a cloud session whose network blocked `data.gov.au`,
`privatehealth.gov.au` and `ombudsman.gov.au`, so **no file was downloaded and no page was read
directly**; every statement below comes from search results and page summaries. Items are marked
**[read]** (a page summary or search result showed it), **[third party]** (a non-official site
said it) or **[unverified]** (desk knowledge or not found). None of this is legal advice.

## 1. Data that exists

| Source | What it holds | Licence | Cadence | Status |
| --- | --- | --- | --- | --- |
| PrivateHealth.gov.au dataset, owned by the Private Health Insurance Ombudsman (PHIO), published on data.gov.au as `private-health-insurance` | Monthly ZIP: XML per registered insurer and product, an XML schema, CSVs of changes since the last upload, a CSV of private hospital agreements, a `Readme.txt`. Private Health Information Statement (PHIS) content for every policy. | **CC BY 3.0 AU** [read: researchdata.edu.au record; data.gov.au resource page] | Monthly. File names look like `privatehealth-01-nov-2025.zip`; the November 2025 file was updated 3 Nov 2025 and is 66.1 MiB [read]. Releases are listed from Aug 2020 to Nov 2026 [read, researchdata.edu.au]. | Not downloaded. Field list is **unverified** until a real file is opened. |
| Third-party API built on that file (`privatehealthinsuranceapi.netlify.app`) | Says it carries 117,000+ products from 34 funds, premium with and without rebate, excess, hospital tier, 38 clinical categories, 27 general treatment services, waiting periods, agreement hospitals [third party] | Claims CC BY 3.0 AU | Monthly | Useful only as a hint of what the file holds. Not a source: it is a paid, unofficial layer. |
| Department of Health clinical category definitions | Definitions of the 38 clinical categories and the Gold/Silver/Bronze/Basic tier rules, versioned (latest listed: 1 August 2026) [read: search result] | Commonwealth site; licence **unverified** (likely CC BY 4.0) | Several times a year | Definitions would be linked, not re-keyed, unless the licence is confirmed. |
| ATO: private health insurance rebate thresholds and rates | Income tiers and rebate percentages for 2025-26 and 2026-27; page updated 22 June 2026 [read] | ATO site licence **unverified** (the ATO usually uses CC BY 4.0) | 1 July (thresholds), 1 April (rates) | Read in full; numbers below. |
| ATO: Medicare levy surcharge thresholds and rates | Same thresholds; rates 0 / 1 / 1.25 / 1.5 per cent; page updated 22 June 2026 [read] | As above | 1 July | Read in full. |
| ATO: Lifetime Health Cover | 2 per cent per year over 30, cap 70 per cent, stops after 10 years of continuous paid cover; page updated 5 May 2026 [read] | As above | Rarely changes | Read. Base-day and absence rules are partly summarised [read, incomplete]. |
| Department of Health: "Modernising the private health insurance rebate" | **Proposed**, not law: from 1 April 2027 people 65 and over get the same rebate rate as others in the same income tier. Subject to Parliament [read] | As above | One-off | Must be handled as a dated, flagged rule, not a fact. |
| APRA quarterly private health insurance statistics | Fund-level membership and financial data, not product prices | CC BY 3.0 AU on the APRA site **[unverified]** | Quarterly | Not needed for the first release. |

Current rates read from the ATO on 17 Nov 2026 (rebate effective 1 July 2026 to 31 March 2027, and
the same MLS tiers):

| Tier | Single (2026-27) | Family (2026-27) | Rebate under 65 | 65 to 69 | 70 and over | MLS rate |
| --- | --- | --- | --- | --- | --- | --- |
| Base | up to $105,000 | up to $210,000 | 24.118% | 28.139% | 32.158% | 0% |
| Tier 1 | $105,001 to $123,000 | $210,001 to $246,000 | 16.079% | 20.098% | 24.118% | 1% |
| Tier 2 | $123,001 to $164,000 | $246,001 to $328,000 | 8.038% | 12.058% | 16.079% | 1.25% |
| Tier 3 | $164,001 and over | $328,001 and over | 0% | 0% | 0% | 1.5% |

The family thresholds rise by $1,500 for each dependent child after the first. These numbers are
examples of what the rates change would hold; the tools must read them from the stored, dated rates
table and never from this document.

## 2. Reuse rights

- **The ZIP is clearly reusable.** CC BY 3.0 AU allows copying, adapting and commercial use with
  attribution. The licence page gives no attribution wording, so we write our own line: "Private
  health insurance product data: Private Health Insurance Ombudsman, via data.gov.au, licensed CC BY
  3.0 AU." The ZIP file's own `Readme.txt` may add wording; **check it when a real file is opened**.
- **The privatehealth.gov.au website is a different matter.** The roadmap records that its terms ban
  framing or using it to sell. The only page read in this research (its disclaimer) says nothing about
  reuse and warns that information "may not be accurate, complete or up to date", so the site terms
  page is **still unread**. Rule: use the dataset only; never scrape, frame or deep-link-scrape the
  site; link to a policy's own PHIS page only where the dataset carries that URL.
- **Accuracy.** PHIO disclaims accuracy and tells users to confirm with the insurer. We pass that on:
  every product result tells the person to confirm price and cover with the insurer before acting.
- **Insurer names and logos.** Do not use logos. Names appear as data. [unverified: whether any
  trade mark guidance applies; part of the legal view.]

## 3. The regulatory line

**Information versus advice.**

- Private health insurance is carved out of the Corporations Act definition of a financial product:
  section 765A(1)(c) excludes "health insurance provided as part of a health insurance business"
  (defined by reference to the Private Health Insurance Act 2007) [read: AustLII text of s765A].
  So the AFSL and "general advice" regime that drives the roadmap's rule 5 for car, home and travel
  insurance **does not appear to apply to health cover itself**. The roadmap's phrase "Legal view
  before listing; Claude high-risk category" should be read that way: the legal view is still needed,
  but the question is narrower than an AFSL question. This is a desk reading of one section, not a
  legal conclusion, and **needs a lawyer** (for example whether any regulation or instrument narrows
  the exclusion).
- Other rules that still apply [unverified, for the legal view]:
  - **Australian Consumer Law**: misleading or deceptive conduct. The 2026 Federal Court decision
    against Choosi concerned funeral and life insurance, not health, but its lesson carries over:
    the court found a comparison that implied it covered a broad range of insurers, when it covered
    one, was misleading [read: ASIC 26-211MR]. So we say exactly what the dataset covers (all
    products in PHIO's file) and never "all funds" or "the market".
  - **Private Health Insurance Act 2007 and its rules** regulate insurers (products, tiers, premiums).
    We are not an insurer or a registered intermediary. Whether any intermediary regime catches a
    free information tool that takes no commission is **unverified**. There is a voluntary
    intermediaries code of conduct that some comparison sites sign [read: Compare the Market page]; we
    do not sign it and make no claim to.
  - **Tax agent services** (Tax Agent Services Act 2009): explaining rebate and surcharge rules for
    reward could in theory be a tax agent service. We charge nothing, give no personal tax advice and
    link to ATO calculators; **ask the lawyer**.
  - **Privacy Act and health information.** Tools take no names or contacts, store nothing and log no
    arguments. They accept needed cover as clinical category names, never conditions or diagnoses
    (see the skills change). Claude's directory treats insurance as a high-risk category [roadmap, F].
- What we will not do: recommend a product ("best", "right for you"), tell someone what medical cover
  they need, take commissions or referral fees (rule 4), start or end a policy, or compare general
  insurance. Overseas student and visitor cover (OSHC, OVHC) is out of scope; it is a different
  product family with its own rules.

## 4. Reform in progress (affects the design)

- **Rebate rates for people 65 and over** would fall to the under-65 rate of their tier from
  1 April 2027, if legislation passes [read]. Average extra cost is stated as $252 a year. The
  rebate adjustment factor indexation would start 1 April 2028 [read].
- **Product simplification** (Consultation Paper 1, 2 July 2026; closed 13 August 2026) proposes
  limiting Basic and "plus" products, consolidating tiers, standardising dependant age cut-offs and
  clarifying hospital-only versus combined cover. Tranche 2 plans more data transparency [read].
  Tiers and categories can therefore change; the data model keys tier and category by the file's own
  codes and version, never by hard-coded names.
- **Premium round**: insurers lodge price changes for 2027 in November 2026; increases usually take
  effect 1 April [read: consultation timeline; the 1 April date is also **unverified** per insurer,
  since some insurers move on other dates]. A file older than the last premium change shows old prices.

## 5. What is verified and what is not

| Claim | State |
| --- | --- |
| Dataset is CC BY 3.0 AU, monthly ZIP, owned by PHIO | Read (search result and record pages) |
| ZIP contents list (XML per insurer and product, schema, change CSVs, hospital agreements CSV) | Read (record page) |
| Per-product fields (premium by rebate tier? excess, tier, clinical categories, waiting periods) | **Unverified**: from a third party only; open a real file first |
| Whether the file lists premium after rebate for each tier and age band | **Unverified** |
| Whether premiums are per state and per household type (single, couple, family, single parent) | **Unverified** (third party mentions state) |
| privatehealth.gov.au site terms | **Unread** |
| ATO rebate, MLS and LHC numbers | Read, 17 Nov 2026 |
| ATO and Department of Health reuse licence | **Unverified** |
| s765A(1)(c) health insurance exclusion | Read (one consolidated text; amendments not checked) |
| Intermediary and tax agent rules | **Unverified**, for the lawyer |
| Network access to data.gov.au from a cloud session | Blocked; a real file must be opened from a machine that can reach it, as was done for CRICOS |
