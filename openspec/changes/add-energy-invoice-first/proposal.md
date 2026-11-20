## Why

Claude web tests (19 Nov 2026) showed the agent summing the readings file itself with a guessed peak window, and nothing asked the user for a recent bill. A bill names the retailer, plan and network, which gives the real band windows, and it is far easier for a user to supply than a readings file. Iven (20 Nov 2026): ask for the bill first, even when the user has a readings file; list candidate plans for the user to pick instead of matching by name; fall back to time ranges only.

## What Changes

- **Instructions and skill:** ask for the latest bill (file, photo or typed figures) before anything else. The agent reads retailer, plan name, usage and days, kWh in each band, rates, daily supply charge, solar export and network, and shows what it read for the user to confirm. It sends our tools only plan identity and usage figures, never name, address, account number or NMI.
- **Plan pick list:** a new flat-input tool returns a short list of the retailer's current plans for the user's network, postcode and customer type. Plans with identical rates and windows are merged into one option. Each option shows the plan name, rates and band hours in plain words. The user picks one, or says none of these.
- **Time-range fallback:** if the plan is not in the data or the user cannot pick, the tool lists the band-hour layouts that retailer uses on that network. The user picks the one that matches the bill, or states the hours.
- **Current plan as baseline:** a picked plan appears in the comparison as "your current plan".
- **Moving in:** a user who is moving house or moving in has no bill or readings for the new place. The agent skips the bill and readings questions, asks household size, and uses typical usage, clearly labelled (households only; a business must give figures).
- **Customer type:** the agent asks home or business first (see `add-energy-business-plans`).

## Not in this change

- No recost-against-the-invoice check (Iven: the estimate is annual and the bill monthly).
- No matching by plan name alone; no personal identifiers to our tools.

## Impact

Exact band hours for a picked plan; approximate for plans with different hours, and labelled so.
