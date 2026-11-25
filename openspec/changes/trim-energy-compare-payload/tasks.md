## 1. Check what reads the list

- [ ] 1.1 Search `src`, `src/guidance/energy/*.md`, `plugin/skills/` and `test/` for reads of `notEstimated`; note any that need the long list

## 2. The tool

- [x] 2.1 Add `notEstimatedLimit` (integer, 0 to 50, default 10) to the input of `compare_energy_plans`, with a description that says it lifts the cap
- [x] 2.2 Slice `notEstimated` to the limit; add `notEstimatedShown` and `notEstimatedMore` to the result and `CompareData`
- [x] 2.3 In `rank.ts`, replace the text view's 15 with the same limit and use `notEstimatedMore` in the "and N more" line
- [x] 2.4 Add one sentence to the tool description: the full list is available with `notEstimatedLimit`

## 3. Tests

- [x] 3.1 With more than 10 plans not estimated: default gives 10, counts and reasons are full, shown and left-out numbers are right
- [x] 3.2 Limits 0 and 50 behave as specified
- [x] 3.3 With the default, every other field of the result equals the result with `notEstimatedLimit` 50 (only the list and its two numbers differ)
- [x] 3.4 Text view and data agree on the number listed
- [ ] 3.5 Run `npm test` and `npm run lint`; record the result size before and after on a postcode with many time-of-use plans
