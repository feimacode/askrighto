## Context

`isResidential` in `normalise.ts` kept only `customerType === "RESIDENTIAL"`; `normalisePlan` and `rowToPlan` hard-coded `RESIDENTIAL`; `plans.customer_type` was always written. The CDR energy plan list and detail carry `customerType` as `RESIDENTIAL` or `BUSINESS`.

## Decisions

1. **Same table, a filter.** One `plans` table, `customer_type` filtered in `plansByPostcode`; no migration. Plan ids are unique across types in the CDR data, so nothing collides.
2. **Residential is the default, and said.** `customerType` is optional and defaults to `RESIDENTIAL` so existing callers keep working, but every result states the kind it covers (the text, `data.customerType`). The instructions tell the host to ask and never assume; a required input would push a model to guess.
3. **No benchmark for business.** The AER benchmarks are household figures by household size; business has none. The tool refuses the benchmark route for `BUSINESS` with a plain message and stops offering it.
4. **GST.** CDR amounts are stored as published (exclusive of GST) and the estimate adds GST as for a household. A business may claim GST credits, so the assumption line says the breakdown shows GST separately; no advice is given about claiming it.
5. **Large customers are not in the data.** Iven (20 Nov 2026): every plan in the CDR data is for a residential or a small business customer, and large customers are totally different, so they are not compared. `BUSINESS` therefore means small business. The agent is told so, and to say so and stop for a large customer; eligibility text is shown beside a plan and not checked.
6. **Rollout.** The first sync after deploy sees business plans as new ids and adds them; existing rows are not touched. `renormalise-energy` reads each row's `customer_type`.

## Risks / Trade-offs

- More plans means a longer first sync and larger lists; the list tools already page.
- Business tariffs more often have demand charges, so more plans are listed as not estimated.
- A user who is a sole trader at home may pick either; the question asks about the plan the user wants, and the result says which kind it covers.

## Open Questions

- Does a business invoice carry GST-exclusive or inclusive rates? Matching in the invoice-first change must allow for both.
