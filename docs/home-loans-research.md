> **Superseded in approach (27 Nov 2026):** Ask Righto no longer stores home loan data, so the credit legal-view plan below is no longer a gate. Kept for the research on CDR shapes and credit law. See `openspec/changes/switch-to-index-only`.

# Home loan comparison: data and regulatory research

Research for the `add-home-loan-*` OpenSpec changes, 17 Nov 2026. Status: **planning only; no code**.
Not legal advice. Every statement is marked **(verified)** when I read the source in this session,
**(inferred)** when it is my reading of what I verified, or **(unverified)** when I could not
check it. The cloud workspace could not reach `api.cdr.gov.au`, a bank's CDR host or `rba.gov.au`
(proxy refused them), so no live payload was read.

## 1. What open data exists

### 1.1 CDR banking Product Reference Data (the core source)

- Each bank (data holder) must publish product data for its public products through two endpoints,
  **Get Products** and **Get Product Detail**, with **no authentication**. **(verified)** CDR support
  article "Providing and Accessing Product Reference Data":
  https://cdr-support.zendesk.com/hc/en-us/articles/900004104506
- The article says a data holder may refuse a request if traffic thresholds are exceeded or a security
  threat is suspected, and sets no specific rate limit. **(verified)** Use the same gentle per-brand rate
  cap as the energy sync.
- Our product use needs no accreditation: the article describes accredited data recipients as one user of
  the data, and the no-authentication statement is what we rely on. **(inferred)**
- Reuse right: the CDR Rules' simplified outline (rule 1.4) says "The data holder cannot impose
  conditions, restrictions or limitations of any kind on the use of the disclosed data." **(verified,
  but it is an outline note, not the operative text.)** I could not read the operative rules (2.3 to
  2.6 in the energy notes) because the fetch was cut off. Same open check as energy
  (`docs/data-rights.md`, energy-plans): read the operative rule in the current compilation and record
  its number. **(unverified)**
- Product data from the banking sector is in force for all product phases; the CDR guidance says
  product reference data for all phases was required from accredited ADIs from October 2020.
  **(verified)**
- Brand list: the Register publishes a Data Holder Brands Summary API; a public community project uses it
  to list about 117 providers. **(verified: the project README says so)** The API's exact URL, version
  header and fields are **(unverified)**; the first task is to call it from a machine that can.
  Non-bank lenders were added to the CDR by a rules amendment, so some home loan lenders may sit
  outside the bank list. **(unverified)** https://www.cdr.gov.au/rollout/cdr-non-bank-lenders-sector

### 1.2 What the standards say a home loan record holds (verified against dsb-schema-tools 1.35.0)

Read in `1.35.0/schemas/banking/`:

| Item | Schema | Notes |
| --- | --- | --- |
| Product category | `BankingProductCategoryV2` | Home loans are `RESIDENTIAL_MORTGAGES`. Other loan categories (`PERS_LOANS`, `BUSINESS_LOANS`, `MARGIN_LOANS`) are filtered out. |
| List item | `BankingProductV6` | Required: `brand`, `description`, `isTailored`, `lastUpdated`, `name`, `productCategory`, `productId`. Optional: `brandName`, `applicationUri`, `effectiveFrom`, `effectiveTo`, `additionalInformation` (product, fees, eligibility, terms and bundle URIs). |
| Detail | `BankingProductDetailV7` (response `ResponseBankingProductByIdV7`) | Adds `bundles`, `features`, `constraints`, `eligibility`, `fees`, `depositRates`, `lendingRates`, `instalments`. Which `x-v` header value selects which version is **(inferred)** from the energy pattern (list V4, detail V7); confirm against the standards' endpoint table. |
| Rate | `BankingProductLendingRateV3` | Required: `lendingRateType`, `rate`, `applicationType`, `repaymentType`, `loanPurpose`. Optional: `comparisonRate`, `additionalValue`, `additionalInfo(Uri)`, `calculationFrequency`, `applicationFrequency`, `interestPaymentDue`, `applicabilityConditions`, `tiers`. |
| Rate type | enum | `FIXED`, `VARIABLE`, `FLOATING`, `INTRODUCTORY`, `DISCOUNT`, `BUNDLE_DISCOUNT_FIXED`, `BUNDLE_DISCOUNT_VARIABLE`, `MARKET_LINKED`, `PENALTY`, plus card types we ignore. |
| Repayment and purpose | enums | `repaymentType`: `PRINCIPAL_AND_INTEREST`, `INTEREST_ONLY`, `OTHER`, `UNCONSTRAINED`. `loanPurpose`: `OWNER_OCCUPIED`, `INVESTMENT`, `OTHER`, `UNCONSTRAINED`. V2 allowed these to be absent; V3 requires them. |
| Tiers | `BankingProductRateTierV4` | `unitOfMeasure` `PERCENT` means loan-to-value ratio (LVR) bands; `DOLLAR` means balance bands; `MONTH`/`DAY` mean periods. `rateApplicationMethod` `WHOLE_BALANCE` or `PER_TIER`. |
| Fees | `BankingProductFeeV2` | `feeType` includes `UPFRONT`, `UPFRONT_PER_PLAN`, `PERIODIC`, `EXIT`, `VARIATION`, `LATE_PAYMENT`, `OTHER`; method `fixedAmount`, `rateBased` or `variable`; optional `discounts`. |
| Features | `BankingProductFeatureV4` | Includes `OFFSET`, `REDRAW`, `EXTRA_REPAYMENTS`, `EXTRA_DOWN_PAYMENT`, `GUARANTOR`, `CASHBACK_OFFER`, `BONUS_REWARDS`. |
| Constraints | `BankingProductConstraintV3` | `MIN_LVR`, `MAX_LVR`, `MIN_LIMIT`, `MAX_LIMIT`, `OPENING_BALANCE`, `OTHER`. |

The schema says what a holder **must** follow, not what it sends. Points to check on real payloads
**(all unverified)**:

- whether fixed-rate terms are in `additionalValue` as an ISO duration, and how each bank states it;
- whether lenders publish one rate per LVR tier or only a headline rate, and whether the advertised
  discounted rate or only a standard variable rate is present;
- whether `comparisonRate` is filled, and on which basis (the schema does not say);
- whether fees are complete (valuation, settlement, discharge) or only the periodic fee;
- how many products are `isTailored` (rates "significantly negotiated", so a published rate is not a
  quote), and how many are not offered to new customers (`effectiveTo`).

### 1.3 RBA data (context only)

- The RBA copyright page puts "Financial Data" (statistical tables, the cash rate) outside its CC BY 4.0
  licence but allows personal or commercial use if the RBA's endorsement is not stated or implied.
  If you charge for access you must say the data is free on the RBA website; tables with third-party
  content need that party's consent. Attribution form: "Source: Reserve Bank of Australia [year]".
  **(verified)** https://www.rba.gov.au/copyright/
- So the **cash rate target** can be shown with source and date. Whether table F5 or F6 (indicator
  lending rates) counts as third-party content is **(unverified)**; do not ingest those tables until read.
  The first release uses the cash rate only.

### 1.4 Sources judged not reusable (do not use)

- Comparison sites (Canstar, RateCity, Finder, Compare the Market, Mozo, Mortgage Choice). Their
  terms were **not read** in this session; the working assumption, unverified, is that scraping them
  is out under AGENTS.md rule 2 and that their ratings are their own work.
- ASIC MoneySmart calculators: link only. **(inferred)**
- Lender web pages: allowed only as links and as the user's own assistant reading a page, under rule 1.
  The CDR payload carries the lender's own page links (`additionalInformation`, `applicationUri`).
- Prior art to read, not copy: the community "Australian Open Banking Data Database" collects the
  brand endpoint list (about 117 providers). **(verified: README only; its licence was not read.)**

## 2. The regulatory line

Only the verified material is stated as fact; the rest is a list of questions for a lawyer.

- A business needs an **Australian credit licence, or an authorisation from a licensee, to engage in
  credit activities**, which include credit services around credit contracts and mortgages.
  **(verified)** https://asic.gov.au/regulatory-resources/credit/credit-regulation-background/
  That page does not define "credit assistance" and says nothing on general information or
  comparison tools.
- The statutory definition of **credit assistance** (National Consumer Credit Protection Act 2009,
  section 8) is my recollection: suggesting a particular credit contract, or assisting a consumer to apply
  for one. **(unverified: search returned the Act but I did not read the section.)** The design treats the
  line as: listing and sorting published products on user-chosen criteria is information; saying
  which product suits this person, or helping them apply, is the regulated activity.
- ASIC's 2012 warning to comparison sites **(verified)**: do not imply a wider comparison than you
  give; explain any rating, ranking, special offer or "featured product"; disclose links to
  providers; warn that price-only comparisons ignore features; sites advertising loans must disclose
  **comparison rates** as the National Credit Code requires. It points to ASIC Regulatory Guide 234
  (good advertising practice). https://asic.gov.au/about-asic/news-centre/find-a-media-release/2012-releases/12-304mr-asic-warns-comparison-websites
- Comparison rate rules (the standard example amount and term, and the required warning that a
  comparison rate is true only for the example given) are in the National Credit Code and its
  regulations. **(unverified: exact figures not read; I recall $150,000 over 25 years and a fixed
  warning, both to be confirmed.)**
- The roadmap says ASIC sued Choosi in 2025 (insurance, not credit). That case is not a credit
  precedent. **(from ROADMAP, not re-checked)**

### Questions for the legal view (must be answered before any public listing)

1. Does a tool that filters, sorts and displays CDR product data on user-chosen criteria, with no
   recommendation, engage in a credit activity?
2. Does a repayment calculator using a user's stated amount and a lender's published rate become
   credit assistance or "suggesting" a contract?
3. Is a comparison rate shown from the CDR field (basis unknown) enough, or must it be recalculated
   or omitted? What warning wording is mandatory when shown?
4. Does the host model's narration make Ask Righto responsible for what it says, and what disclaimers
   are needed in each host's directory listing?
5. Is a pure link-out to a lender's application page acceptable, and would any referral fee ever change that?
6. Are there advertising or misleading-conduct risks if a published rate is not available to the user
   (tailored, discounted, or not offered)?
7. Anything extra for under-18 users, since ChatGPT allows 13 to 17 year olds.

## 3. Where this sits in the roadmap

ROADMAP.md row 3 scores banking and home loans 14 and parks it "pending a legal view". AGENTS.md rule 5
says credit products "stay out until there is a legal view or a licensed partner". These proposals
follow rule 5 by building and testing on the internal route only; the rule is not changed here.
`add-home-loan-promotion-gates` records the question of what "stay out" means for internal testing.
