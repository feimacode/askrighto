## Context

In `compare-energy-plans.ts`, `notEstimated: no.slice(0, 50)` returns up to 50 entries, each `{ planId, retailerSlug, brandName, displayName, sourceLastUpdated, estimated: false, reason, detail }`. For a postcode with many time-of-use plans the entries are near-identical: the same `reason` and the same `detail` sentence repeated. The text view in `rank.ts` already shows only 15 and ends with "and N more (see structured data)". `counts.notEstimated` and `notEstimatedByReason` already carry the full numbers.

A typical hosted answer at postcode 3000 with `limit` 3 was about 30,000 characters; the not-estimated list was well over half of it.

## Goals / Non-Goals

**Goals:**
- Cut the default result size by dropping repetition, not information.
- Keep every excluded plan countable and reachable.

**Non-Goals:**
- Changing which plans are estimated or how they are ranked.
- Shortening the notes on each estimate.

## Decisions

**1. Default 10, settable 0 to 50 with `notEstimatedLimit`.** Ten is enough to show each reason and a few examples. 0 is allowed, for a host that wants only the counts. 50 is today's cap, so nothing becomes unreachable. The plans listed stay in the data's order, so the same call gives the same plans.
- Alternative: group by reason and return one entry per reason with a count. Cleaner, but the plan ids and names are what a user asking "why isn't Origin's plan there?" needs, and a grouped list would lose them. A later change can add grouping.
- Alternative: leave the list long and rely on hosts to ignore it. Rejected: the point is to save the host's context.

**2. The text view uses the same limit.** It currently has its own 15. One limit makes the two views agree and removes a second constant.

**3. No change to counts.** `counts.notEstimated`, `notEstimatedByReason` and the summary sentence ("Of 700 plans available, 277 could be estimated and 423 could not") are unchanged, so the figures the host quotes are the same.

**4. The tool description says how to get the rest.** One sentence: the full list is available with `notEstimatedLimit`. The result adds `notEstimatedShown` and `notEstimatedMore` so the host sees the list was cut without having to compare numbers.

## Risks / Trade-offs

- A host that read the 50-entry list for something now sees 10. The counts and reasons are still there, and the limit lifts the cap. No skill or guidance text depends on the long list (to be confirmed in task 1.1).
- A user asking about one specific plan that was cut now needs a second call. Accepted: that call is rare, and cheaper than carrying 40 entries on every comparison.
