# Energy fixtures

**These are synthetic.** They follow the shape of the CDR energy plan payloads (Get Generic
Plans v1, Get Generic Plan Detail v3) as described in the standards and in the proof of
concept, but no real API was reachable when they were written. They exercise the normaliser
and sync; they say nothing about real prices.

Task 1.2 of `add-energy-plan-data` replaces them with recorded responses:

    npm run sync:energy -- --record test/fixtures/energy/recorded

Record from a network that can reach `cdr.energymadeeasy.gov.au`, then note the capture date
here. Do not commit any fixture that has not been checked for personal data (there should be none).
