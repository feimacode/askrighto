# PHIO file layout

Read from the real **November 2026** file (dated 02-Nov-2026), opened on 17 Nov 2026 from a machine that can reach data.gov.au. Dataset: https://data.gov.au/data/dataset/private-health-insurance (CC BY 3.0 AU; the CKAN record names the author as **Commonwealth Ombudsman**, contact support@privatehealth.gov.au). The ZIP is 85 MB and unpacks to about 2.1 GB. Its Readme says nothing about attribution or reuse, so the attribution wording comes from the dataset record. The XML follows schema V3.1 (`PHOLSchema-V3.1.xsd`, `PHOL-Lists-V3.1.xsd`).

## Files in the ZIP

| File | What it holds |
| --- | --- |
| `Hospital Open`, `Hospital Closed`, `GeneralHealth Open`, `GeneralHealth Closed`, `Combined Open`, `Combined Closed` (`... 02-Nov-2026.xml`) | Flat `<Products Count="n">` of `<Product>`; 96 MB to 684 MB each; 133,316 products in all |
| `Funds 02-Nov-2026.xml` | `<Funds Count="34">` of `<Fund>`: the insurers |
| `Agreement Hospitals 02-Nov-2026.csv` | 654 hospitals, one 0/1 column per fund code. **Not loaded yet** |
| `Fund Changes` and `Product Changes` CSVs | What changed since last month. Not loaded |

There is **no per-insurer file and no `<Insurer>` wrapper**. The default namespace `http://admin.privatehealth.gov.au/ws/Schemas` is declared on each `<Product>` and `<Fund>`, not on the root. Files have CRLF line endings, no BOM and no XML declaration. Nil elements are written `<X xsi:nil="true" />`.

## What `src/health/parse.ts` reads

Because of the sizes, product files are streamed and cut at `</Product>`; each product is parsed alone. The large `GeneralHealthCover` and `ProductAmbulance` blocks are cut out first (extras detail is not loaded yet). **Closed products are skipped** unless `--include-closed` is given.

Product attributes: `ProductID` (GUID, unique across all six files, and our key), `ProductCode` (like `J3/A0000S`; **not unique**: 157 codes repeat across different funds), `Status`, `PublishDate`, `SchemaVersion`.

| Element | Meaning and how we use it |
| --- | --- |
| `FundCode`, `Name`, `ProductType` | Insurer key, product name, `Hospital` / `GeneralHealth` / `Combined` |
| `ProductStatus` | `Open` or `Closed` |
| `State` | `ALL` (486 products) or one of NSW, NT, QLD, SA, TAS, VIC, WA. ACT is not a product state. `ALL` is stored as no state |
| `WhoIsCovered` | `OnlyOnePerson="true"` is single. Otherwise `Coverage/@NumberOfAdults` (0, 1 or 2) and six `DependantCover` elements with `Covered`. We derive single, couple (2 adults, no dependants), family (2 adults with dependants), single parent (1 adult with dependants) or dependants only (0 adults) |
| `Excesses` | `@ExcessType` None, PerAdmissionOnly, LimitedPerYear, LimitedPerPerson, LimitedPerPersonPerPolicy; children `ExcessPerAdmission`, `ExcessPerPerson`, `ExcessPerPolicy` (dollars) |
| `CoPayments/@CoPaymentType` | None, Limited, Unlimited |
| `PremiumNoRebate` | **Monthly** premium, the full 100% before any rebate (schema text). Decimal dollars. The schema does not say whether it includes GST |
| `PremiumHospitalComponent` | The hospital part of the monthly premium; 0 when there is none |
| `HospitalCover/HospitalTier` | **Seven** values: Basic, BasicPlus, Bronze, BronzePlus, Silver, SilverPlus, Gold |
| `HospitalCover/MedicalService` | Exactly 38 per hospital cover: `@Title` (CamelCase, for example `BackNeckSpine`) and `@Cover` Covered / Restricted / NotCovered |
| `HospitalCover/WaitingPeriods/WaitingPeriod` | `@Title` (SubAcute, PreExisting, PregnancyBirth, Other), `@Unit="Month"`, value in the text |
| `MedicareLevySurchargeExempt` | true or false |
| `Corporate/@IsCorporate` | Employer-group products |
| `OnlyAvailableWith` | `AnyHospital`, `AnyGeneralHealth`, or `Products` with a `;`-separated list of product group codes |
| `ProductURL` | The insurer's own page (nil on 80,931 of 133,316). Kept as `infoUrl` |
| `PHISURL` | **Nil on every product.** The product information statement link is not in the file |

Fund elements: `FundCode`, `FundName`, `FundType` (Open 25, Restricted 9), and for restricted funds `Restrictions/RestrictionHint`.

## What the file does not carry

- **No premium after rebate, no rebate basis, no frequency field.** One monthly before-rebate figure per product. Every premium after rebate is therefore **calculated** by Ask Righto from the dated ATO rates, and labelled so. The "published after-rebate premium" path in the calculator stays for other sources but never fires on this file.
- No hospital agreements in the XML (CSV only).
- No four-tier rebate code on the product; the four rebate income tiers come from the ATO rules, not from this file.

## Keys

`ProductID` is the only key unique on its own. `FundCode` + `ProductCode` + `State` was unique in 133,312 of 133,316 products matched by a pattern scan, so it is not relied on.

## Checked, and still not

Checked on the real file: layout, counts, enumerations, nil forms, key uniqueness, state values. Not checked: Funds `Brand` elements, `PreferredProvider` text, the meaning of `AddOns/ShortName`, whether premiums include GST, and the full-size streaming run of `health:validate` on all six files.
