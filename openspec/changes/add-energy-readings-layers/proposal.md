# Proposal

## Why

In the first live test (19 Nov 2026, Claude web) the agent did not send the household's readings to our tool; it summed the file in its own sandbox and applied one made-up peak window. Its reason, in its own words, was that pasting the whole file is "slow but doable". It is: a year of 30-minute data is about 17,500 values (50 to 70 thousand tokens to write out, as much again to read first), and our server also refuses a request body over 256 KB. A model will always choose the cheaper path unless the right path is also cheap.

Iven (19 to 20 Nov 2026) asked for layers: paste a small file to our tool; upload a large one; if the upload fails, build the profile locally but by our instructions and the NEM12 specification.

## What Changes

- **Layer 1, paste (small file, about 30 KB or 90 days of 30-minute data):** `summarise_interval_readings`, as now, verified by us. The tool description says so, and says what to do for a longer file.
- **Layer 2, upload (large file):** a new tool `get_readings_upload_link` returns a short-lived signed upload address. The host's code sandbox sends the file to it (`curl`), our endpoint reads it in memory, returns the same summary and profile in its response, and keeps nothing. Needs the sandbox to reach our domain (in Claude web the user adds it under Settings, Capabilities, Code execution and file creation, Additional allowed domains).
- **Layer 3, local build by recipe (when the upload fails or is not possible):** the agent builds the profile itself by a published recipe (the NEM12 rules: streams, interval sums, local clock with daylight saving by state, weekday and weekend, monthly sums, the layout of the profile) and passes it as `readingsProfile`.
- **Signed profiles:** a profile built by our server (layers 1 and 2) is signed (HMAC). A signed profile is marked verified. An unsigned or changed profile (layer 3, or a rewritten string) is accepted after the same shape and totals checks but labelled **"built by the assistant, not verified by Ask Righto"**, and estimates from it say so.
- **Instructions:** one ladder, in order, with the size thresholds and what to do when a layer fails, in the server instructions, tool descriptions and the skill; "never sum the readings and apply your own windows".

Data source: the household's own readings, read in the request and not stored. Hosts affected: Claude, ChatGPT and Gemini, through two tools and one new web endpoint. Layer 2 depends on each host's sandbox reaching our domain (known to be possible in Claude web with the allowed-domains setting; not known for ChatGPT or Gemini).

Out of scope:

- Storing any file, profile or derived figure, or a session between calls.
- The in-chat file widget and the MCP file upload extension (tracked; hosts do not support them yet).
- Reading other file formats (CSV from retailers' apps) or gas readings.

## Capabilities

### New Capabilities

- `energy-readings-upload`: a signed, short-lived upload address and endpoint that returns a summary and a signed profile without storing the file.

### Modified Capabilities

- `energy-interval-readings`: the layer ladder, signed profiles, and an assistant-built profile accepted with a label.

## Impact

- New: `src/server/readings-upload.ts` (endpoint), `src/tools/get-readings-upload-link.ts`, `src/energy/readings/sign.ts`, `docs/energy-readings-recipe.md`, tests, evals.
- Changed: `src/energy/readings/profile.ts` (signature field, version), `src/tools/summarise-interval-readings.ts`, `src/tools/compare-energy-plans.ts` (the verified label), instructions and skill, `docs/energy-interval-readings.md`.
- New setting: `ASKRIGHTO_PROFILE_KEY` (a secret, with a key id for rotation; never in the repo or the image) and `ASKRIGHTO_UPLOAD_MAX` (default 5 MB). Depends on `add-energy-per-band-shares` for accuracy but not for building.
