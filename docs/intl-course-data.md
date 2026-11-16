# International course data (CRICOS)

The `international` vertical answers questions about courses open to international students, from the CRICOS register (CC BY 2.5 AU, Australian Government Department of Education, via data.gov.au). It is kept apart from the domestic VCE finder: its own tables, its own tools, its own rights entry (`intl-courses`).

## What it holds

Higher-education courses only: associate degree, bachelor, graduate certificate, graduate diploma, master, doctorate. School, ELICOS, diploma, VET and non-award rows are counted in the load report and not stored. Per course, as published and never inferred: CRICOS code, provider, level, field of education, duration in weeks, total tuition fee, non-tuition fee, language, work component, expiry and locations (state and campus). A field the file does not publish is stored as null and shown as "not published".

Fees are labelled "Indicative, as published in CRICOS" with the file date. A yearly figure appears only when fee and duration are both published, labelled "calculated: total fee divided by duration".

## What it does not hold

English language requirements, entry requirements by country, intake dates and scholarships. `get_intl_entry_checklist` returns the provider's website and a reading checklist for the user's own browsing assistant (AGENTS.md rule 1). Nothing read that way is sent back or stored. There is no visa, migration or work-rights advice.

## Loading

CRICOS is a spreadsheet. Export the courses sheet to CSV (see `docs/cricos-columns.md`, which also says the real columns are still to be confirmed), then:

```
npm run intl:validate -- --cricos courses.csv
DATABASE_URL=... DATABASE_SCHEMA=askrighto npm run intl:load -- --cricos courses.csv --source-date 2026-02-02
```

`--source-date` is the file date from the dataset page and is what tools show as the as-of date. A load replaces all rows in one transaction; an empty or failed load leaves the old rows. The table `intl_loads` records each load.

## Serving

`ASKRIGHTO_VERTICALS=energy,courses,international` loads it. Leave it out of `ASKRIGHTO_PUBLIC_VERTICALS` and it is served only on `/mcp-internal/<token>`. Domestic and international rows link through the CRICOS code (`domesticCourseId`).

## Comparing with the domestic finder

See `docs/use-case-comparison/`.
