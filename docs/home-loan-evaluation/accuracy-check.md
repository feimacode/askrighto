# Data accuracy spot check

Goal: find out whether the stored published figures match what a lender's own page shows. Read by a person, or by the user's own browsing assistant under AGENTS.md rule 1; **never fetched by our server**, and never past a bot check.

## Sampling

At least 30 products from the stored data, stratified: the four major banks, at least five mutuals or credit unions, any non-bank lenders, variable and fixed, owner-occupier and investor, at least three tailored products and three with LVR tiers. Record the list before reading any page.

## Record (one row per product)

| Lender | Product id | Page link | Read at | Stored rate | Page rate | Stored fees | Page fees | Verdict | Class | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

Verdict: `match`, `mismatch`, `not_checkable` (login or bot check).
Class for a mismatch: `rounding`, `different_tier`, `headline_vs_discount`, `product_not_offered`, `data_wrong`.

Recheck every mismatch after 24 hours before calling it `data_wrong` (a rate may have changed that day). Nothing from the page is stored here beyond the verdict and the figures needed to compare.

Status: not run (no live data yet).
