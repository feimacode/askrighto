# Career outcomes

Occupation employment projections from Jobs and Skills Australia, next to the course answers. Internal route only for now (vertical `career-outcomes`).

**Tools**

- `find_occupations`: search ANZSCO unit groups by name.
- `get_occupation_outlook`: employment at May 2025, May 2030 and May 2035 (thousands of people), five- and ten-year change, and the skill level with the qualification level JSA pairs with it.

**Data:** `career_occupations` and `career_loads` (migration 0007), loaded by `careers:load` from one xlsx. Source columns and operator steps: [career-outcomes-columns.md](../career-outcomes-columns.md). Rights entry: `career-outcomes` in [data-rights.md](../data-rights.md).

**Limits, stated in every result:** projections are indicative; no pay, vacancies, visa advice, or course links. The skill level is a level of study, not a field. No study-path tool exists because the file holds no occupation-to-field link.

**Not built:** the OSCA and ANZSCO profile workbooks, salary, a promotion to the public route (waits for the legal view and the canary gates).
