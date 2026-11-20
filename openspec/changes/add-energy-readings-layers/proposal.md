## Why

In Claude web (19 Nov 2026) the agent did not call `summarise_interval_readings`. It summed the attached file in its own sandbox with a guessed 3pm to 9pm weekday peak, and said passing the raw file was "slow but doable". Passing a year of half-hourly data means writing about 17,500 values as tool input, roughly 50 to 70 thousand tokens, which is dearer than summing locally. Our rule not to sum it itself has no fallback and no reason attached.

## What Changes

Three layers, in the agent's priority order (Iven, 20 Nov 2026):
1. **Paste small files** (about 30 KB, roughly 90 days of half-hourly data) unchanged to `summarise_interval_readings`.
2. **Upload large files** where the host allows it (signed upload link or host file reference). Unproven on every host; built last, only if host tests show it is needed.
3. **Local build by our recipe** if the upload is not possible: the agent builds our profile in its own sandbox by a published NEM12 procedure, then passes it to `compare_energy_plans`. The answer is labelled as built by the assistant, not verified by Ask Righto.

Build order can differ from priority order: layer 3 is needed whenever upload fails, so it is likely to carry large files at first.

- **Signed profiles:** the server signs profiles it builds (stateless HMAC). A signed profile is marked verified; an unsigned one is accepted after revalidation and labelled unverified; a changed one fails.
- **Descriptions and instructions:** say why the tool exists (each plan's own windows, daylight saving), give the size limit and what to do past it, and put the readings route before the bill-split instruction.

## Not in this change

- No code or file for the model to run is sent in tool results. A reference script, if used, ships static and versioned in the plugin skill.
- The upload route stays out of the first directory listing until the review rules have been read.

## Impact

Large and 5-minute files get a route that does not need the whole file as tool input.
