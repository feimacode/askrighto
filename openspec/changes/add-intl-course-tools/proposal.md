## Why

With CRICOS loaded nationally (`add-intl-course-data`), international students and their families need tools to search, look up and compare courses by field, level, location, duration and indicative fee. This is the second use case to put next to the domestic finder.

## What Changes

- Four tools on the new `international` vertical: `search_intl_courses`, `get_intl_course`, `compare_intl_courses`, `get_intl_entry_checklist`.
- Every result carries source, as-of date, indicative-fee label and CRICOS attribution, or an explicit not-found.
- English and country-specific entry requirements, scholarships and intakes are returned as provider links plus a reading checklist for the user's own browsing assistant (AGENTS.md rule 1), never as stored facts.
- Visual results through the Inkview SDK (table, entity card, comparison), as for the domestic tools.
- Internal-only first: served on `/mcp-internal/<token>`, outside `ASKRIGHTO_PUBLIC_VERTICALS`, with the same metadata-only counters.
- No visa, migration, work-rights or post-study advice. Tool descriptions and instructions say so.

## Capabilities

### New Capabilities
- `intl-course-tools`: the four tools, their inputs, outputs and limits.

### Modified Capabilities
None.

## Impact

- New `src/tools/intl-tools.ts`, `src/intl/instructions.ts`, `src/intl/vertical.ts`; tools registered in `src/server/route.ts` under the `international` vertical.
- Tool count on the internal route rises; the public route is unchanged.
