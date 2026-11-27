# Proposal

## Why

Licensing, law and rules are too heavy to carry for course and finance data (Iven, 27 Nov 2026). Every plan so far had a legal or permission step that only a person can clear: VTAC, UAC and QTAC allow no reuse, so the plan was to re-key facts in our own words and ask for permission and a legal view; home loans are credit, so the plan was a credit legal view first. Storing the data is what creates the exposure. So for these areas Ask Righto stops storing source data. It indexes where the information lives, hands the agent the link, and teaches the agent (through skills and short structure facts) how to read it. This builds on the guided-browsing allowance already in AGENTS.md rule 1 and makes it the default for licence-heavy and regulated areas.

## What Changes

**Scope.** Domestic courses and VCE planning, and home loans (the only financial vertical that stores CDR data besides energy). Energy is out of scope and stays as it is (Iven, 27 Nov 2026). Health cover, careers and international courses are also untouched here (see Open questions).

**Domestic courses (`courses-domestic`)**
- The only stored data is the CRICOS index (CC BY 2.5 AU): course code, name, provider, level, duration and campuses. The agent fills in everything else (entry figures, prerequisites, other criteria) by reading the university's own course page, using links and a reading checklist our tools return.
- Remove the curated own-words store (`data/courses/**`, the stand-in rows, entry figures, prerequisites, `course_entry_figures` and `course_prerequisites` tables), the prerequisite checker and the comparison tool, since both need stored facts.
- ATAR scaling: Ask Righto gives only the link to the most recent VTAC ATAR scaling report (and the VCAA study score page). `get_subject_scaling` and `estimate_vce_aggregate` are removed; the aggregate rule is explained in a skill with a link, and the agent does the arithmetic from the report it reads.
- VCE dates, preference rules and early entry schemes: the stored YAML goes; one source-index tool returns the official pages to read. (Decision for Iven, see Open questions.)

**Home loans (`home-loans`)**
- Stop syncing and storing CDR banking product data and the RBA cash rate. Remove the six data tools (search, get, compare, reference rates, plus the sync and report CLI).
- Provide a `get_cdr_banking_guide` tool in the pattern of `get_energy_guide`: the CDR Register link, an index of lender brands and public base URIs, the product endpoints and version headers, the object structure (list, detail, lending rate, tier, fee, feature, eligibility), and the quirks found in the 17 Nov real run (x-v negotiation 5/4/3, rates as fractions, string or number tier bounds, DISCOUNT entries, comparison rate below rate). The agent fetches and does the comparison.
- Keep `calculate_home_loan_repayments` only if Iven wants a data-free calculator; the default here is to keep it, internal only (see Open questions).

**Cross-cutting**
- A new rights basis `link_only` for an indexed source whose content we never store. Retire the rights entries for stored course, VCE admissions and home loan data; no permission requests are needed any more (drop `docs/permissions/*` and the drafts task).
- AGENTS.md rule 1 and `openspec/config.yaml` get a line stating the default: licence-heavy or regulated areas are index-only.
- Supersede the unbuilt parts of earlier changes (listed under Impact).
- Skills (internal) are rewritten to teach reading, not quoting stored data. Each fact the agent reads is quoted with the page link and time read and labelled as read by the assistant (rule 1), never sent back to or stored by our server.

Hosts affected: none publicly today, since `/mcp` serves energy only. The internal route (Claude and ChatGPT developer mode) changes for courses and home loans. Public listing text, icons and zips are unchanged, apart from docs that name the old course plan.

Data sources: CRICOS (CC BY 2.5 AU, data.gov.au; refresh monthly or on the existing `cricos:refresh` timer). Everything else is a link, checked for liveness, with no content stored. Source licences for linked pages are not needed because nothing is copied.

Out of scope: any change to energy (stays stored and unchanged); NSW, ACT and QLD curated course data (retired the same way: `extend-courses-to-uac-qtac` is withdrawn, and their CRICOS rows come from the same index); building new verticals; a pass-through proxy for CDR calls (an option in the design, not chosen).

## Capabilities

### New Capabilities
- `index-only-sources`: the rules for indexing a source without storing it.
- `home-loan-guidance`: the CDR banking guide that replaces stored home loan data.

### Modified Capabilities
- `course-lookup`: CRICOS index plus links and checklist only.
- `vce-planning`: link-only scaling, dates and early entry; no stored facts or estimates.

## Impact

- Remove: `data/courses/**`, `data/vce/*`, `data/vce-studies.yaml`, `src/courses/{standins,verbatim,prerequisites,validate,studies}.ts`, `src/vce/`, most of `src/homeloans/` (keep `lenders.json`, `guidance.ts`, `guard.ts` as needed), tools `compare_domestic_courses`, `check_domestic_course_prerequisites`, `get_subject_scaling`, `estimate_vce_aggregate`, `get_vce_key_dates`, `list_early_entry_schemes`, and the home loan data tools; CLI commands `courses:validate`, `courses:check-pages`, `vce:*`, `homeloans:*`, `report:homeloans`; migrations stay (no down migrations) and a new migration 0011 drops the unused tables.
- Add: `src/courses/sources.ts` (link index), tools `get_course_sources` and `get_vce_admissions_sources` (names to settle in design), `get_cdr_banking_guide`, new internal skills.
- Docs: `docs/areas/vic-courses.md`, `course-data.md`, `home-loan-data.md`, `data-rights.md`, `promotion-checklist.md`, `use-case-comparison/*`, ROADMAP phases 4 and 6, `docs/listing/iven-checklist.md` (no change to its steps), `docs/permissions/` removed.
- Supersedes (unbuilt parts): `add-vic-course-data`, `add-vce-admissions-data`, `add-vic-course-tools`, `add-course-data-permissions`, `extend-courses-to-uac-qtac`, `add-home-loan-data`, `add-home-loan-tools`, `add-home-loan-evaluation`, `add-home-loan-promotion-gates`, `add-home-loan-skills`, and the course parts of `add-course-skills` and `add-course-use-case-comparison`. Also overtakes `research/courses-promotion-gap-analysis-2026-11-27.md`.
- Gates removed: course legal view on re-keyed facts, VTAC and Course Seeker permission, credit legal view for home loans (no data stored; still no recommendation or ranking wording).

## Open questions for Iven

1. **Health cover.** It is insurance, so financial, and stores an open (CC BY 3.0 AU) monthly file plus own-worded tax rules, with its legal view still outstanding. Recommend: leave it unchanged and internal for now, and decide after the course and home loan switch. Alternative: index-only too (link to the data.gov.au file and the rebate pages).
2. **Header problem for CDR.** Product endpoints need an `x-v` header. A browsing assistant that can only fetch a URL may not send it, so the home loan guide could be unusable in some hosts. The first task tests this in Claude, ChatGPT and Gemini. If it fails, options are a code-execution sandbox, a header-free pass-through endpoint on our server (fetches, stores nothing; more legal surface), or dropping home loans from hosts that cannot do it. Which would you prefer if the test fails?
3. **VCE dates and early entry.** Link-only (as proposed) or keep the small hand-checked YAML (about 300 lines of dates and scheme descriptions)? Recommend link-only for consistency.
4. **Repayment calculator.** Keep the data-free `calculate_home_loan_repayments` (internal), or remove with the rest? Recommend keep.
