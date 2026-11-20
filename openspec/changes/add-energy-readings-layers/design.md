## Context

Measured (19 to 20 Nov 2026): a year of 30-minute data is 114 KB and 17,520 values; 15-minute 217 KB; 5-minute 628 to 730 KB. Our request body limit is 256 KB and the tool limit is 250,000 characters (PR #53). The profile string is about 8 KB at any interval length. In Claude web an attached CSV is placed in a code-execution sandbox (read by running code); the sandbox blocks outbound network unless the user allows the domain; another vendor (FutureSearch) uses a signed upload address from that sandbox in production. The MCP working group has a draft file upload extension that is not supported yet.

## Decisions

1. **Ladder, in order.** (1) File up to about 30 KB: call `summarise_interval_readings` with the text. (2) Larger: call `get_readings_upload_link`, then send the file to the address from the sandbox. (3) If that fails (no network, no code, error): build the profile by the recipe. (4) No code available at all: ask for a shorter period or 30-minute data, or give up the readings and use the invoice. Each step says what to say to the user.
2. **Upload endpoint, stateless.** `PUT /readings-upload/<token>` where the token is an HMAC of (expiry, size limit) with the profile key, valid 5 minutes and sized to `ASKRIGHTO_UPLOAD_MAX`. It reads the body in memory with a hard size limit, parses it with the same parser, returns the summary and signed profile as JSON, and logs nothing from the body. No single-use record is kept (that would need shared state); the short life, size cap and rate limit bound abuse. It answers only on the public host's own origin and refuses redirects.
3. **Signing.** `sig = HMAC-SHA256(key, canonical profile JSON without sig)`, with a key id; `decodeProfile` verifies it. Valid: `verified`. Missing or wrong: accepted if the shape and totals checks pass, labelled unverified (the rewritten-string case is detectable and also labelled). Keys rotate by key id with the previous key accepted for one rotation.
4. **Instructions in the tool text.** The layer 3 recipe is plain text: which streams (E consumption, B solar), summing intervals to half hours, dropping identifiers, missing days, local clock by state with daylight saving dates, weekday and weekend, month rows, rounding, totals check, and the exact profile layout. The fallback gives the agent the NEM12 rules and the time ranges to use and lets it do the work (Iven, 20 Nov 2026). The server never sends code at run time.
5. **Labels.** An unverified profile gives estimates labelled "from readings built by the assistant, not verified by Ask Righto"; the readings prompt and typical-usage notices stay off, as now.
6. **Directory review.** A text recipe in a skill and the tool text is the defensible form; the upload route (a `curl` to our domain) looks like an exfiltration pattern and needs the user to relax the sandbox, so the listing text explains it and it is the second layer, not the first. Each directory's policy on code execution and tool output instructions is read before submission (task).
7. **Not ranked by cost.** Layer order is by trust, not by effort.

## Risks / Trade-offs

- Layer 3 can be done wrongly by a model (daylight saving, slot order); the shape and totals checks catch gross errors only, which is why the label exists.
- A public upload endpoint is an abuse surface: signed, short, size-capped, rate-limited, and no body is kept.
- The allowed-domains setting is friction and may be impossible on some hosts; layer 3 carries those.
- A key leak lets someone sign profiles; rotate by key id, keep the key out of the image and the repo.

## Open Questions

- Does the ChatGPT sandbox have outbound network, and does Gemini's? (Host test.)
- Where does the recipe live for hosts without skills: the tool description, or an MCP resource?
- What is the right size threshold for layer 1 per host (the host test sets it)?
