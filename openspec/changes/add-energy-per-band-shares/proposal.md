## Why

Time-of-use plans with more than one shoulder band (SHOULDER1, SHOULDER2) cannot be costed from readings or from a bill split. A check on the 17 Nov 2026 load found 6,501 current time-of-use electricity plans; the readings window matcher can cost 4,268 (66%), and all 2,233 it rejects have several shoulder bands. The calculator splits one shoulder share equally between shoulder bands, which the data does not support. The bill-split route has the same limit.

## What Changes

- Usage shares are carried per band (peak, each shoulder, off-peak), not as one shoulder share.
- The readings profile and the window matcher map readings to each band of each plan, including plans with several shoulders.
- `compare_energy_plans` accepts shares for the bands a bill shows. When a plan has more bands than the user's split names, the result says the split was approximate for that plan.
- Plans still not estimated (gaps, overlaps, odd times, partial weekdays, demand charges) keep a reason.

## Impact

Roughly a third of time-of-use plans, in some networks the common case, become estimable from readings. No data reload.
