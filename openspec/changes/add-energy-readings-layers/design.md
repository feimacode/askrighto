## Context

Sizes: a 30-minute year is about 115 KB, 15-minute about 220 to 235 KB, 5-minute about 630 to 730 KB, and a 5-minute year with solar about 1.4 MB. The server's request body limit is 256 KB and the tool cap is 250,000 characters (PR #53). The profile string stays about 4 to 8 KB at any interval length. The real limit on pasting is the model writing the file out.

## Decisions

1. **The recipe is NEM12 knowledge, published as plain text** in the tool description or a resource: E streams are consumption, B streams are solar export, C, F, A, D variants only if the master is absent, N only when there is no E stream; numeric-first suffixes refused; sum 5- and 15-minute values to half hours; drop the NMI and serial; list missing days; local time with daylight saving by state; weekday and weekend by half hour, with per-month sums in the profile layout and a totals check; controlled load is a stated gap.
2. **Signed profiles.** HMAC with a server key, stateless. Signing marks provenance; the server still revalidates shape and totals on every use.
3. **Any reference script lives in the Claude skill,** static, about 40 lines, standard library only, no network, shell, `eval` or file writes, with a published hash and a test that the shipped script is the one tested. It is not delivered in tool output, which scanners treat as an injection risk.
4. **Upload route:** a signed one-time URL from a flat-input tool; needs the sandbox to reach our domain (user allowlist on Claude web; ChatGPT's sandbox is believed to have no outbound network; Gemini unknown). The draft MCP file-upload extension is tracked, not built (its `x-mcp-file` object would break the flat-input rule).
5. **Host tests decide** how much of layers 2 and 3 is built.

## Risks

- Directory review may dislike instructions that tell the model to run code; read the Claude, ChatGPT and Gemini rules before listing.
- A locally built profile can be wrong; labelling and revalidation limit the harm.
- Hosts cut long output at different points.

## Open Questions

- Can each host's sandbox read an attached CSV, reach outside addresses, or pass a file by reference to a connector?
