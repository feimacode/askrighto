## Context

The existing loaders (`courses:load --cricos`, `intl:load --cricos`) take local files and need a hand-passed `--source-date`. The server image is read-only with no writable temp directory, and the infra role runs it with `read_only: true`. CRICOS files are about 12 MB in all.

## Decisions

1. **Fetch the CSV resources, not the XLSX.** The dataset lists Courses, Course Locations and Institutions CSVs (and a Locations CSV we do not use). They are what the parsers already read (the parsers skip title rows if present and accept a BOM), so no spreadsheet reader dependency is added. The XLSX files are monthly snapshots and need one.
2. **In memory, no temp files.** Responses are read as text with a size cap (40 MB each) and a timeout, passed to the existing parsers and discarded. So the command works in the read-only container and `docker exec` is enough: nothing is copied in, and nothing needs cleaning up.
3. **Dataset lookup.** `GET https://data.gov.au/data/api/3/action/package_show?id=cricos` returns the resources. Pick by exact resource name (`CRICOS Courses.csv`, `CRICOS Course Locations.csv`, `CRICOS Institutions.csv`); a missing resource aborts. Every URL must be https on `data.gov.au` (or a subdomain), including after a redirect, otherwise abort. The fetch function is injected so tests use fixtures.
4. **As-of date.** The CSVs contain no date. The as-of date is the date part (UTC) of the Courses resource's `last_modified`, shown as "file dated". This is a publication date, not the register's own "as at" date; the docs say so. It is stored as the existing `source_date`.
5. **Idempotence.** The fingerprint is the three resources' ids and `last_modified` values, plus the SHA-256 of the three downloaded bodies once fetched. It is stored in the `intl_loads` row's `report` (`fingerprint`, `contentHash`) and compared with the latest row. If the metadata matches, nothing is downloaded. If the metadata changed but the content hash matches, the run records nothing new and says so. When CRICOS is unchanged, the domestic YAML is still re-merged from the stored `cricos_raw` rows, because a deploy may have changed the course YAML; the domestic loader already skips a load whose hash did not change.
6. **Order and atomicity.** Download and parse everything first, run every guard, then load the domestic index, then the international store last. `intl_loads` is the marker, so a failure between the two loads means the next run repeats both; each load is one transaction and keeps the old data on failure.
7. **Guards.** Abort when: a required column is missing (parser `problems`); the as-of date is older than the stored one (unless forced); kept international courses are under 1,000 or fall more than 20 percent from the last load; the merged domestic course count falls more than 20 percent from the last domestic load. The numbers are constants in `guards.ts`, covered by tests.
8. **One command.** `load-all` is `migrate`, `vce:load`, `cricos:refresh`. Home energy plans are separate (`sync-energy`). `vce:load` loads only what the repo holds.
9. **Schedule.** Off unless `ASKRIGHTO_CRICOS_REFRESH=on`; it runs at `ASKRIGHTO_CRICOS_AT` (default 03:30, Australia/Sydney) each day, which is a cheap metadata check that loads only on change. A transaction-level advisory lock (`pg_try_advisory_lock`) lets one instance run; the others skip. Failures are logged and retried the next day; it never runs when the course verticals are not loaded. Logs hold counts, dates and resource ids, never URLs with credentials or row content.
10. **feima-infra.** After the container is healthy, if the internal token is set, run `docker exec <container> node askrighto.js load-all` with `failed_when: false` and a debug message, so a data.gov.au outage cannot fail a deploy. Energy is untouched either way. Not run when no token is set.
11. **Rights.** The `cricos-register` entry already carries the CC BY attribution; nothing new is stored. The load report keeps the attribution text and as-of date flowing to tool results as today.

## Risks / Trade-offs

- The CSV resources and the XLSX snapshots can differ; the as-of date is the CSV's publication date, not the monthly "as at" date. Mitigated by wording in the docs and the load report.
- data.gov.au could change resource names or move off CKAN; the command aborts with a clear message and the old data stays.
- A daily check adds one small request a day per instance (only the lock holder downloads).
- The 20 percent guard could block a real large change; `--force` exists and is logged.

## Open Questions

- None blocking. Whether to also schedule `courses:check-pages` is left out.
