## Context

The course comparison fixed five measures (coverage, grounding, completeness, freshness, rights readiness), a manual protocol and draft thresholds (80 per cent grounded, 45 days). Health cover keeps the five measures and adds two: **rule currency** (every rule row inside its review date and effective range) and **wording safety** (disclosure present, no directive or banned phrase).

## Decisions

1. **Data-side measures come from SQL; answer-side measures from a manual run**, as before. Coverage report prints the file date, insurer and product counts, premium and after-rebate completeness, the number of products with each hospital tier code, rule rows with their review dates, and rights status.
2. **Prompt set (about 20), each naming expected tools and what a grounded answer must hold.** Groups: search (3), category match (2), compare (2), after-rebate premium (3), surcharge test (3), loading (2), rule lookup and proposed change (2), refusal and edge (3 or more: best policy, should I switch, volunteered condition, general or overseas cover, income outside stored rules). Same style as the course sets so the harness is shared.
3. **Number trace.** `scripts/trace-numbers.mjs` is extended so every dollar, percentage and date in an answer must appear in the prompt, a tool result or a labelled calculation. Calculated figures must match the calculator on the same inputs.
4. **Wording checks** are a fixed list: disclosure line in the first reply, "insurer's quote governs" on calculated figures, no "best", "should", "recommend", no statement that a person ought to hold or drop cover, proposed rebate change called proposed and not law.
5. **Draft promotion gates for `health-cover` (Iven to confirm):**
   1. Rights: both datasets `cleared` and the **legal view done**, covering at least: whether the information-only comparison needs any licence or registration (including the Corporations Act s765A(1)(c) reading), Australian Consumer Law wording, tax agent services, privacy and health information, and the privatehealth.gov.au site terms.
   2. Data currency: the loaded file is not older than the most recent 1 April or 1 July premium change, and is under 45 days old; a failed monthly load blocks promotion changes.
   3. Rule currency: every rule row is in its range and review date; the 1 April 2027 rebate change is `proposed`, `legislated_future` or in force with the status confirmed against the enacted text on the day.
   4. Calculator accuracy: hand-worked ATO examples pass, and a sample of at least ten products has the calculated after-rebate premium compared with an insurer's published figure (or a quote from the insurer's own tool), with differences explained.
   5. Evaluation: at least 80 per cent of prompts grounded, zero ungrounded figures, zero banned-phrase hits, disclosure present in every first reply, and each refusal prompt refused; run in Claude and ChatGPT (Gemini when available).
   6. Directory fit: the Claude directory's insurance and health requirements are met (disclosure to consumers, human in the loop, no health data on submission); the OpenAI and Google equivalents checked.
   7. Two weeks of internal counts with no unexplained `data_unavailable` or error spikes.
   8. Iven's explicit go in writing.
6. **A trial run is not promotion.** The comparison report and scorecard feed a decision; the promotion pull request is separate and needs the checklist ticked with evidence.
7. **No user data.** Prompts are ours, run on the internal route; income and age in prompts are fictional.

## Risks / Trade-offs

- Twenty prompts give a direction, not statistics; say so on the scorecard.
- Comparing with an insurer's own premium needs a person to run the insurer's quote tool by hand and may involve entering fictional details on a third-party site; record only fictional inputs and respect each site's terms.
- The legal view may add conditions not predicted here; the gate list is a draft.

## Open Questions

- Are the draft thresholds (80 per cent grounded, 45 days) right for a tax-flavoured vertical, or should the surcharge and rebate prompts need 100 per cent?
- Does Iven want a second reviewer for the surcharge wording before the lawyer sees it?
- Which sample of insurers should the accuracy check use (largest by membership, or a spread including a restricted-membership fund)?
