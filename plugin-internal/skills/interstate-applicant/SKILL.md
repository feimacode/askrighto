---
name: interstate-applicant
description: Use when a student studies senior secondary in one state and wants to apply to universities in another, or does the IB, an overseas or another certificate, or moves states. Explains in general terms which admissions centre and rules apply and where to read them, comparing no figures.
---

# Interstate applicant

Follow the `ask-righto-grounding` skill for quoting. Ask Righto covers Victoria, NSW, the ACT and Queensland. Other states and the International Baccalaureate are not covered yet.

## Steps

1. **Ask two things.** The state and certificate the student studies (or studied), and the state or university they want to apply to. Do not guess from where they live or their name.
2. **Say what is covered.** If the certificate is the VCE, HSC, the ACT certificate or the QCE, the student's own state's admissions centre and rules are the starting point: call `get_admissions_sources` with the state they study in and read the pages the same way as any other source. If the course is at a university in another state, use `get_domestic_course` for that university's page and read how it treats applicants from other states or certificates.
3. **Read, do not assume.** Whether a student can apply through their home centre to another state's university, or must apply another way, is on the centres' and the university's pages. Read those and quote them with link and time. Say plainly if the pages do not answer.
4. **Not covered.** For the IB, an overseas certificate or a state outside the four, say Ask Righto does not cover it yet, give the university's own admissions link from `get_domestic_course`, and stop.
5. **Keep systems apart.** Do not set one state's figure beside another's. Say each centre's figure is its own measure and the student reads each on its own page.

## Never

- State a rule, date or figure from memory; every one comes from a page you read.
- Say a student "will get in", give odds or a chance, or call a course the best.
- Convert an aggregate or a rank into an ATAR or the reverse, or compare an entry figure from one state's system with another's.
- Send what you read back to an Ask Righto tool.
- Try to get past a bot check or a login; give the link and stop.
