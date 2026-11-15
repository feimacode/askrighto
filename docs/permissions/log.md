# Permission log and corrections process

## Log

Newest first. Record every request sent, every reply and every decision, then update `src/core/rights.json` and `docs/data-rights.md`.

| Date | Body | Dataset ids | What happened |
| --- | --- | --- | --- |
| 2026-11-15 | Course Seeker, VTAC, VCAA | course-seeker, vtac-coursesearch, vce-scaling, vce-study-groupings, vce-key-dates | Requests drafted in this folder, not yet sent. |

## Corrections process

- Contact: the address on the sources and corrections page of askrighto.com.au (to be set up before any public listing; it must be monitored).
- Target: acknowledge and fix or remove within five business days.
- Take-down: set the dataset's status to `withdrawn` (or the entries to be removed) in the rights register and redeploy; tools then answer `data_unavailable` for it in production.
- Record each correction in the log table above (date, who asked, what changed).
