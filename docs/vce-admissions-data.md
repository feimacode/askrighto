# VCE admissions sources (index-only)

Since 27 Nov 2026 (`switch-to-index-only`) Ask Righto stores no VCE admissions data: no key dates, preference rules, early entry schemes, scaling tables or study groupings, and the `data/vce/` files and `vce:*` commands are gone.

What exists instead is a short list of official pages in `src/courses/sources.ts` (VTAC scaling report, how the ATAR and aggregate are calculated, key dates, preferences, early entry), each with a reading checklist. The tool `get_vce_admissions_sources` returns them. The assistant reads the page, quotes only the checklist items with the link and time read, labels them as read by the assistant, and never sends them back to the server. An aggregate is not an ATAR.

The entries are marked unconfirmed (no `checkedOn`) until a person opens each link; the tool then adds a warning. `npm run sources:check` fetches each link (one a second, nothing kept) and reports failures. Update the scaling report entry each December when VTAC publishes the new report.

VTAC scaling and study groupings were `pending` permission and are now `withdrawn` in the rights register: they are linked, never stored.
