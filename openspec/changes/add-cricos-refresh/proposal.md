# Proposal

## Why

Loading CRICOS data into a deployed server takes too many hand steps: export sheets to CSV on a laptop, copy three files to the VM, type long `docker run` commands against a read-only container, and pass the as-of date by hand. Iven asked for this to be optimised (21 Nov 2026), for example by putting the CSVs in the image. Putting them in the image would mean committing or build-time downloading raw CRICOS files and rebuilding the image every month. A better route exists: the CRICOS dataset on data.gov.au (CC BY 2.5 AU) already publishes separate Courses, Course Locations and Institutions CSV resources, so the server can fetch them itself.

Checked on 22 Nov 2026 against the real dataset (package `cricos`, id `e5ae7059-bfa8-4fa4-a5c0-c13cf3520193`): the three CSV resources download with plain HTTPS, carry a UTF-8 byte order mark and no title rows, and have a `last_modified` timestamp (2 Nov 2026). They are not the same snapshot as the monthly XLSX files (25,631 course rows against 25,971 in the 1 Oct XLSX): the CSVs are the register as last republished, the XLSX files are dated monthly snapshots. They contain no "report generated" line, so the as-of date has to come from dataset metadata.

## What Changes

- Add `cricos:refresh [--dry-run] [--force]`: look up the dataset through the data.gov.au CKAN API, download the three CSV resources into memory (no temp files: the container filesystem is read-only), check them, and load both the domestic course index (`courses:load` merge) and the international store (`intl:load`) in one run. The as-of date is the Courses resource's `last_modified` date, stored and shown as "file dated".
- Idempotent: it does nothing to CRICOS data when the resources' ids and modified timestamps match the last load. Even then it re-merges the domestic YAML (from the stored raw CRICOS rows) so a new deploy's course files take effect without a download.
- Guards: refuse and keep the old data if a required column is missing, the as-of date is older than the stored one, kept international courses fall below a floor or drop by more than 20 percent against the last load, or the merged domestic course count drops by more than 20 percent. `--force` overrides the drop and date guards, never a missing column.
- Add `load-all [--force]`: `migrate`, then `vce:load`, then `cricos:refresh`, so one command prepares a fresh database.
- Add an optional in-server schedule, off by default (`ASKRIGHTO_CRICOS_REFRESH=on`), that checks daily and loads only when the dataset changed, under a PostgreSQL advisory lock so several instances do not collide. It logs counts and dates only.
- In feima-infra, a post-deploy step runs `docker exec <container> node askrighto.js load-all`, only when the internal token is set, and a failure there is reported but never fails the deploy or energy.
- Update `docs/deploying.md`, `docs/course-gaps.md` and the role README.

Data sources: CRICOS on data.gov.au (CC BY 2.5 AU), as today, with the attribution and as-of date on every record. Download only from data.gov.au over HTTPS; no scraping and no other host.

Out of scope: the monthly XLSX files (no spreadsheet reader is added), the CRICOS Locations CSV (not used), VTAC, UAC or QTAC data, and public listing of either vertical.

## Capabilities

### New Capabilities

- `cricos-refresh`: finding, fetching, checking and loading the CRICOS dataset on demand and on a schedule, with idempotence, guards and a one-command database setup.

### Modified Capabilities

- `intl-course-data`, `vic-course-data`: their load commands gain a fetch-based route; the old `--cricos FILE` commands stay for local files and tests.

## Impact

- Code: new `src/cricos/` (`source.ts`, `refresh.ts`, `guards.ts`, `index.ts` for the schedule), CLI wiring in `src/main.ts`, reading the stored raw CRICOS rows in `src/courses/load.ts`.
- Tests: fixture-based, with a fake `fetch`; no network in CI.
- feima-infra: a post-deploy task and one default variable in the askrighto role; README.
- Docs: deploying, course gaps.
