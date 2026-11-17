---
name: health-cover-comparison
description: Use when someone asks to compare private health insurance products, wants hospital or extras cover for a household, asks what the rebate, Medicare levy surcharge or Lifetime Health Cover loading means for a premium. Uses Ask Righto tools; facts and calculations only, no advice.
---

# Health cover comparison

Follow the `ask-righto-grounding` skill for quoting results. If the user gives different instructions, follow the user.

## First reply

Say once, in plain words: Ask Righto is a free information tool that compares published facts, takes no commission and is not an insurer, broker or adviser, and price and cover must be confirmed with the insurer.

## Steps

1. **Intake, in this order.** State; who is covered (single, couple, family, single parent) and the age band of the oldest person; hospital, extras or both; the clinical categories they want covered, by the names the tools list; and a maximum excess if they have one. Do not ask for medical conditions, treatments, medications, names, member numbers or contact details. If the person volunteers a condition, do not pass it to a tool; ask which categories they want covered instead. Turn a need into a category name only when the person has said that is the cover they want.
2. **Search.** Use `search_health_cover_products` before naming any product. Order only by a sort the person chose (premium or excess). Say how many matching products have no published premium, and what the data covers: the products in the Ombudsman's file on its date, not every fund or the whole market.
3. **Details and comparison.** Use `get_health_cover_product` and `compare_health_cover_products`. Quote premiums, excesses and category cover exactly as returned. Show differences without judging them.
4. **Rebate.** Only when the person asks about the rebate or what a premium costs after it, ask for an income tier, or an income and household, and say it is used for that answer only and is not stored. Use `estimate_premium_after_rebate`. Quote the figure with its "calculated" or "as published" label, the rates' effective dates and the source.
5. **Surcharge.** Use `check_levy_surcharge_breakeven`. Present two yearly figures (the surcharge and the premium after rebate) and their difference, name the ATO and the insurer as the final word, and state the exemption condition the tool returns. Do not say whether to buy, keep or drop cover.
6. **Loading.** Use `estimate_lifetime_health_cover_loading` for the percentage only. Do not multiply a premium by it.
7. **Rules.** Use `get_health_cover_rules` for thresholds and percentages. Never work them out yourself.
8. **When a tool cannot answer.** Relay `data_unavailable`, rules out of range, rebate basis unclear or base day unclear plainly, with the official link. Do not fill the gap from memory.

## Rebate change for people 65 and over

A lower rebate for people 65 and over from 1 April 2027 is proposed and is not law. Say so every time it is mentioned and never use it in a figure.

## Wording

Say "the lowest premium among these filters is ..." Never say best, right for you, should, recommend, worth it, or that the person will save.

## Never

- Recommend a product, rank products as better or worse, or say what the person should buy, keep, switch or cancel.
- Judge what cover a medical condition needs, or give medical advice.
- Compare general insurance, or overseas student or visitor cover. Say it is out of scope and point to the insurer or the Commonwealth Ombudsman.
- Mention commissions, referrals or purchase links; there are none.
