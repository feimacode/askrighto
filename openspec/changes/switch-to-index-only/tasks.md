# Tasks

## 1. Check feasibility first
- [ ] 1.1 On Iven's WSL and in Claude, ChatGPT and Gemini, test whether an agent can fetch a lender's CDR product list with the `x-v` header (three lenders); record results in `docs/home-loan-data.md` and decide the fallback with Iven
- [ ] 1.2 Confirm the current VTAC ATAR scaling report, VCAA, VTAC dates and preferences links, and each provider's course search link; record checked dates
- [ ] 1.3 Run a 20-course reading test through each host's browsing, with the new checklist, to see how often an agent reaches the facts (repeat of the 16 Nov test)

## 2. Index and rights
- [x] 2.1 Add `link_only` basis and validation in `src/core/rights.ts`; update `rights.json` and `docs/data-rights.md`
- [x] 2.2 Add `src/courses/sources.ts` provider and admissions source index; add `sources:check`
- [x] 2.3 Check the CRICOS licence is still current before shipping

## 3. Courses and VCE
- [x] 3.1 Reduce `search_domestic_courses` and `get_domestic_course`; remove compare, prerequisite, scaling, aggregate, key dates and early entry tools; add the admissions sources tool
- [ ] 3.2 (needs the WSL) Load a real CRICOS file on the WSL and confirm the domestic rows (1,183 expected); retire stand-ins
- [x] 3.3 Remove curated YAML, `data/vce/*`, `vce-studies.yaml`, related loaders, CLI commands and tests
- [ ] 3.4 Verify the aggregate rule against the live VTAC page before it goes in a skill
- [x] 3.5 Rewrite `vce-course-research` skill and grounding rules for read facts

## 4. Home loans
- [x] 4.1 Add `get_cdr_banking_guide`; keep `lenders.json`; remove sync, store, tools and CLI
- [x] 4.2 Rewrite `home-loan-comparison` skill and `docs/home-loan-data.md` as an agent guide
- [x] 4.3 Keep `calculate_home_loan_repayments` as a data-free calculator (taking the recommendation; Iven can reverse)

## 5. Database and release
- [x] 5.1 Migration 0011 dropping retired tables (list reviewed by Iven; energy untouched)
- [x] 5.2 Remove the home loan gate from `scripts/release-check.mjs`; update `docs/promotion-checklist.md`
- [x] 5.3 Run `npm test`, `guidance:check`, `plugin:check` and confirm `/mcp` is still energy only

## 6. Docs and records
- [x] 6.1 Update AGENTS.md rule 1, `openspec/config.yaml`, ROADMAP phases 4 and 6, area docs and use-case prompts
- [x] 6.2 Remove `docs/permissions/`; mark superseded changes (list in proposal) and archive them
- [ ] 6.3 Health cover left unchanged and VCE dates made link-only (recommendations taken when Iven said to start); confirm with Iven
