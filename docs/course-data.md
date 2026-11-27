# Course data: the CRICOS index and provider links

Since 27 Nov 2026 (`switch-to-index-only`) the only stored course data is the CRICOS index: for each university in `data/courses/<region>/<university>.yaml` with a `cricosProviderCode`, every undergraduate CRICOS course (code, name, campuses, duration). The per-course YAML rows, curated summaries, entry figures, prerequisite rules and stand-ins are gone.

## Provider file

One file per university under `data/courses/vic`, `nsw-act` or `qld` (the folder is the region). Only a provider block:

```yaml
provider:
  id: monash
  cricosProviderCode: "00008C"
  name: Monash University
  coursesUrl: https://www.monash.edu/study/courses/find-a-course
  searchUrl: https://www.monash.edu/study/courses/find-a-course
  domains: [monash.edu]
```

`npm run courses:validate` checks the files: required fields, links on the provider's domains, no course rows, no duplicate ids, known region folders. `npm run courses:load -- --cricos FILE.csv` (or `cricos:refresh`) builds the index and loads it; a second load of the same content changes nothing.

## What tools return

Index rows only, with the university's link. For anything else the assistant reads the university's page using the reading checklist in `src/courses/notice.ts`. See [course-tools.md](course-tools.md).

## Maintenance

- Check the CRICOS provider codes against the real file on the first load (`courses:load` warns about providers with no code).
- `npm run sources:check` checks the provider and VCE links.
- Do not add course facts to the repository. A fact worth keeping belongs on the official page, and the assistant reads it there.
