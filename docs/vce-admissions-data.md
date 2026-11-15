# VCE admissions data

Files in `data/vce/`: `key-dates.yaml`, `preference-rules.yaml`, `early-entry.yaml` (own-words facts with a source URL and checked date each). All entries are ported from the earlier pilot (read 2026-08-30) and flagged `provisional: true` until re-read from the VCAA and VTAC pages. Key dates cover 2027 fully and 2028 partly. Early entry covers six universities and has no eligibility field.

Scaling and study area groupings come from VTAC and are `pending` in the rights register: they must not be committed. Development copies sit in git-ignored `data/local/` (`scaling-2025.json`, `study-groupings-2025.json`); a permitted file would go in `data/vce/scaling-<year>.json` and `data/vce/study-groupings-<year>.json`, and the rights entry must be updated first. In production the tools reading them answer `data_unavailable`.

`npm run vce:validate` checks the files; `vce:load` loads them in one transaction.

The aggregate rule (`src/vce/aggregate.ts`) is ported from the pilot: highest English-group score plus three more (at most two from one grouping), plus 10% of up to two more (at most three from one grouping overall). An aggregate is not an ATAR.
