# Design

- **Fractions as percentages.** Only a tool-result figure of the form `0.d{1,6}` also admits its decimal point moved two places, done on the digits so there is no floating point. A rounded rate (6 for 5.99) or an invented one is still flagged.
- **Live check as a test.** `test/homeloans/live.test.ts` runs the real `CdrProxy` and is skipped unless `CDR_LIVE=1`, so `npm test` never calls a lender. It asserts versions in the expected ranges, a non-empty `lendingRates`, and rates in (0, 1). Lenders: CommBank, Westpac, NATIONAL AUSTRALIA BANK (`CDR_LIVE_LENDERS` overrides). The workflow is manual only.
- **Nothing stored.** A test sends a marker through the tools and asserts it reaches the caller and no output stream, and that `proxy.ts` imports no file or database module. It cannot prove absence of every side effect; the spec and review cover the rest.
- **Prompt checks** use `result:` and `says:`/`never:` rather than `arg:` on lender names, because a model may write "westpac" or "Westpac" and `arg:` compares exactly.
- **Not covered by a live run:** a lender answering 406 to every version or being down. Unit tests cover them.
