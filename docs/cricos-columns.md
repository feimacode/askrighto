# CRICOS columns: what the real file holds

**Verified 16 Nov 2026** against the file `cricos-providers-courses-and-locations-as-at-2026-10-1-7-28-30-1.xlsx` (4.1 MB, data generated 1 Oct 2026, published 1 Nov 2026) on the CRICOS dataset at data.gov.au (CC BY 2.5 AU). The dataset also lists separate CSV resources (Courses, Institutions, Locations, Course Locations, modified 2 Nov 2026); they were not compared with the XLSX.

Every data sheet has two title rows ("<Sheet name>", "Report generated ...") above the header on row 3. The parser skips them.

## Sheets

| Sheet | Data rows | Used for |
| --- | --- | --- |
| Purpose Statement | text only | not used |
| Institutions | 1,547 | provider website (join on CRICOS Provider Code) |
| Courses | 25,971 | the course facts (the file passed to `--cricos`) |
| Locations | 3,883 | addresses only; not used |
| Course Locations | 46,511 | campus, city and state per course (join on provider code and course code) |

25,937 of 25,971 courses have at least one location row; 34 have none.

## Columns we use

| Field | Sheet and real column | Notes |
| --- | --- | --- |
| CRICOS course code | Courses: CRICOS Course Code | |
| Provider code, name | Courses: CRICOS Provider Code, Institution Name | |
| Provider website | Institutions: Website | inconsistent: `https://international.cit.edu.au/`, `www.ecu.edu.au`; a missing scheme is added, a value with no dot is dropped |
| Course name | Courses: Course Name | |
| Level | Courses: Course Level | kept: Bachelor Degree, Bachelor Honours Degree, Masters Degree (Coursework, Research, Extended), Doctoral Degree, Graduate Certificate, Graduate Diploma, Associate Degree |
| Field of education | Courses: Field of Education 1 Broad Field and Narrow Field | values like `12 - Mixed Field Programmes`; stored as "broad; narrow". Field 2 and the detailed field are not used |
| Duration | Courses: Duration (Weeks) | present on every row |
| Tuition fee | Courses: Tuition Fee | total for the whole course, not per year; blank on 180 courses (126 among the kept levels) |
| Non-tuition fee | Courses: Non Tuition Fee | |
| Language | Courses: Course Language | |
| Work component | Courses: Work Component | |
| Expired | Courses: Expired | `Yes` on 431 rows; these rows are kept and labelled, and search leaves them out |
| Locations | Course Locations: Location Name, Location City, Location State | one row per course and location |

Not used: Estimated Total Course Cost (a published total of tuition and non-tuition fees; we show the two parts as published), Dual Qualification, Foundation Studies, work component hours and weeks.

## What the first real run showed

With the header rows skipped: 13,069 courses from 664 providers kept of 25,971 rows. Left out by level: Diploma 4,180, Certificate IV 1,976, Certificate III 2,413, Advanced Diploma 1,666, Non AQF Award 1,707, Senior Secondary Certificate of Education 326, Primary School Studies 246, Junior Secondary Studies 241, Certificate II 102, Vocational Short Course 39, Certificate I 6. Kept by level: Bachelor Degree 3,872, Masters Degree (Coursework) 3,235, Bachelor Honours Degree 1,460, Graduate Diploma 1,485, Graduate Certificate 1,039, Doctoral Degree 886, Masters Degree (Research) 779, Associate Degree 244, Masters Degree (Extended) 69. Before the parser handled the layout, validation failed on the title rows and found no locations, website or field.

Decided 20 Nov 2026: diplomas, advanced diplomas and Certificate I to IV are also kept (10,343 more courses, 23,412 in all; see `openspec/changes/add-intl-diplomas-vet`). The VET National Code column is now read and stored as published; it decides the sector of a diploma. Non AQF Award, Vocational Short Course and school levels stay out.

## How to reload

Export the Courses, Course Locations and Institutions sheets to CSV, then:

```
npm run intl:validate -- --cricos courses.csv --course-locations course-locations.csv --institutions institutions.csv
```

## The CSV resources on data.gov.au (checked 22 Nov 2026)

The dataset (`cricos`, CKAN id `e5ae7059-bfa8-4fa4-a5c0-c13cf3520193`) lists separate CSV resources named `CRICOS Courses.csv`, `CRICOS Course Locations.csv`, `CRICOS Institutions.csv` and `CRICOS Locations.csv`. `cricos:refresh` reads the first three. They have the same headers as the XLSX sheets, a UTF-8 byte order mark, no title rows and no report date, so the as-of date is the resource's `last_modified` (2 Nov 2026 at the time). They are the register as last republished, not the 1 Oct snapshot: 25,631 course rows against 25,971, and 23,072 kept against 23,412.
