# Design

## What stays

Index-only. The server holds no figure, date or rule. A source entry is a link, who publishes it, and a short list of what the agent should look for on the page. The agent reads the page for the user and quotes it with link and time, labelled as read by the assistant (AGENTS.md rule 1), and never sends it back.

## Decisions

1. **One tool, two filters.** `get_admissions_sources(state, topic)` replaces the Victoria-only tool. `state` is required when more than one state could apply, and `topic` defaults to `all`. A result lists only the entries for that state and topic. When `state` is missing and the question names none, the tool answers `needs_input` ("Which state's admissions system: Victoria, NSW, the ACT or Queensland?") rather than guessing, in the same way the home loan tools ask about an ambiguous lender.
2. **Rename, do not alias.** The tool is on the internal route only and the only callers are our own skills, prompts and tests. We rename it in one change and update them together; no alias is kept. (Open question 1.)
3. **The table is keyed by state, with the admissions centre as data, not code.** NSW and the ACT share UAC but have different certificate bodies, so the entries are per state with a `centre` field, not per centre.
4. **What each state's entry must name** (all unconfirmed until opened):

| State | Admissions centre | Certificate | Subject rules published by |
| --- | --- | --- | --- |
| vic | VTAC | VCE | VCAA |
| nsw | UAC | HSC | NESA |
| act | UAC | ACT Senior Secondary Certificate | ACT Board of Senior Secondary Studies |
| qld | QTAC | QCE | QCAA |

   This table is my reading and the links are not yet checked; task 1 confirms it by opening each page.
5. **Comparability is a field, not a footnote.** Each state's entry has `figureKinds`: the names of the entry figures that state's universities publish (for example ATAR, aggregate, selection rank, adjusted rank), copied as names only. The tool result carries the sentence "These are different measures; do not compare a figure from one state's system with another's, and never convert an aggregate to an ATAR". Names are structure facts, not data.
6. **Course to state.** A provider file sits in one region folder, but a university can have campuses in several states. `get_domestic_course` returns `admissionsState` per campus when the campus state is known from the CRICOS row, and otherwise the provider's region. The host is told which `get_admissions_sources` state to call. Where it is unclear, the result says so and the host asks the student.
7. **Verification.** `sources:check` already fetches each link. It is extended to every state's entries and to report entries with no `checkedOn`. A person still has to open each page and set `checkedOn`, because a link that loads may not be the right page. Until then the existing unverified warning shows.
8. **Rights.** The dataset id changes and its owner line lists VTAC, UAC, QTAC, VCAA, NESA, the ACT Board and QCAA. Basis stays `link_only`, status `cleared`. No new rights risk: we publish links and our own checklist wording only.

## Risks

- A wrong or moved link: mitigated by the warning and by `sources:check`; it fails loudly rather than guessing.
- Over-claiming NSW, ACT or QLD rules: the checklists say what to look for, never what the answer is.
- ACT students apply through UAC but their certificate is separate from NSW's: the table above keeps them apart and task 1 confirms it.

## Decisions on the open questions (Iven, 28 Nov 2026)

1. Rename outright, no alias. Done.
2. No aggregate calculator yet; to be assessed later.
3. No other states and no IB for now.

## Open questions (answered above)

1. Rename outright (recommended) or keep `get_vce_admissions_sources` as an alias for one release?
2. Should the server offer a small, data-free aggregate calculator (the VCE rule of the primary four plus a share of the fifth and sixth studies, applied to scores the user or agent read)? Like the home loan repayment calculator it stores no data and needs no licence, but a state-by-state ATAR conversion would need the centre's tables and stays out. Recommend: not in this change.
3. South Australia, Western Australia, Tasmania and the Northern Territory (SATAC, TISC, UTAS) and the International Baccalaureate: add after these four are confirmed?
