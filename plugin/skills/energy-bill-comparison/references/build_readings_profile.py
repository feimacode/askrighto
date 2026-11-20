#!/usr/bin/env python3
"""Reference script for layer 3 of the readings ladder: build the Ask Righto readings profile from a NEM12 file.

Use it only when you cannot pass the file to summarise_interval_readings or get_readings_upload_link. It reads one file
and prints one JSON object (the profile) to standard output. It uses only sys, json, math and datetime, makes no network
call, runs no other program, evaluates no text and writes no file. Pass the printed JSON unchanged as readingsProfile to
compare_energy_plans; the estimate will be labelled "built by the assistant, not verified by Ask Righto".

    python3 build_readings_profile.py <file> <state>      state is NSW, VIC, QLD, SA, TAS or ACT (from the postcode)

It mirrors the server's reader (docs/energy-readings-recipe.md): E streams are consumption, B streams are solar export,
intervals are summed to half hours, market time (AEST) is moved to the household's local clock, and no NMI, serial or
per-day value is printed. Errors go to standard error with a line number and a reason, never the line's content.
"""
import json
import math
import sys
from datetime import datetime, timedelta

UOM = {"KWH": 1.0, "WH": 0.001, "MWH": 1000.0}
STATES = ("NSW", "VIC", "QLD", "SA", "TAS", "ACT")


def fail(msg, line=None):
    sys.stderr.write("cannot read the file" + (" (line %d)" % line if line else "") + ": " + msg + "\n")
    sys.exit(1)


def num(s):
    try:
        x = float(s)
    except ValueError:
        return None
    return x if math.isfinite(x) else None


def valid_date(s):
    if len(s) != 8 or not s.isdigit():
        return False
    try:
        datetime(int(s[:4]), int(s[4:6]), int(s[6:8]))
        return True
    except ValueError:
        return False


def parse(text):
    nmis = set()
    streams = {}  # suffix -> {date: [48 values]}
    block = None
    saw200 = False
    non_actual = variable = outage = 0
    last_v = False
    for i, raw in enumerate(text.splitlines()):
        ln = i + 1
        if raw.strip() == "":
            continue
        f = raw.split(",")
        kind = f[0].strip()
        if kind in ("100", "500", "900"):
            continue
        if kind in ("250", "350", "550"):
            fail("this is an accumulation (meter reading, NEM13) file with no half-hourly figures; ask for interval data (NEM12)", ln)
        if kind == "200":
            saw200 = True
            if len(f) < 9:
                fail("a 200 record has too few fields", ln)
            nmi = f[1].strip()
            if not nmi:
                fail("a 200 record has no NMI", ln)
            nmis.add(nmi)
            if len(nmis) > 1:
                fail("the file holds more than one NMI; send one household's file", ln)
            suffix = f[4].strip().upper()
            if not suffix:
                fail("a 200 record has no data stream suffix", ln)
            uom = f[7].strip().upper()
            per = num(f[8].strip())
            wanted = suffix[0] in "ABCDEFN"
            if wanted and uom not in UOM:
                fail("a %s stream is in an unsupported unit (kWh, Wh or MWh expected)" % suffix, ln)
            if wanted and per not in (5, 15, 30):
                fail("a %s stream has an unsupported interval length (5, 15 or 30 minutes expected)" % suffix, ln)
            block = {"suffix": suffix, "factor": UOM.get(uom, 1.0), "per": int(per or 30), "use": wanted}
            block["n"] = 1440 // block["per"]
            last_v = False
        elif kind == "300":
            if block is None:
                fail("an interval record (300) comes before any 200 record", ln)
            last_v = False
            if not block["use"]:
                continue
            date = (f[1] if len(f) > 1 else "").strip()
            if not valid_date(date):
                fail("an interval record has no valid date", ln)
            n = block["n"]
            if len(f) < 2 + n:
                fail("an interval record has fewer than the %d values it needs" % n, ln)
            vals = []
            for k in range(n):
                x = num(f[2 + k].strip()) if f[2 + k].strip() != "" else None
                if x is None:
                    fail("an interval value is not a number (value %d)" % (k + 1), ln)
                if x < 0 and block["suffix"][0] != "N":
                    fail("an interval value is negative (value %d)" % (k + 1), ln)
                vals.append(x * block["factor"])
            step = 30 // block["per"]
            half = []
            for k in range(48):
                s = 0.0
                for j in range(step):
                    s += vals[k * step + j]
                half.append(s)
            by_date = streams.setdefault(block["suffix"], {})
            if date in by_date:
                fail("two interval records have the same date for one stream", ln)
            by_date[date] = half
            q = (f[2 + n] if len(f) > 2 + n else "").strip().upper()[:1]
            if q == "V":
                variable += 1
                last_v = True
            elif q and q != "A":
                non_actual += 1
        elif kind == "400":
            if not last_v or block is None or not block["use"]:
                continue
            a, b = num(f[1]) if len(f) > 1 else None, num(f[2]) if len(f) > 2 else None
            reason = (f[4] if len(f) > 4 else "").strip()
            if a is not None and b is not None and b >= a and reason == "79":
                outage += int(b - a + 1)
        else:
            fail("an unknown record type was found; this does not look like a NEM12 file", ln)
    if not saw200:
        fail("no 200 record was found; this does not look like a NEM12 file")

    def pick(firsts):
        for ch in firsts:
            names = sorted(s for s in streams if s[0] == ch)
            if names:
                return names
        return []

    cons = pick("EDF")
    exp = pick("BAC")
    net_only = False
    if not cons and not exp:
        cons = pick("N")
        net_only = bool(cons)
    if not cons:
        fail("the file has no consumption stream (no E stream, and no net N stream)")

    def total(names):
        out = {}
        for n in names:
            for d, v in streams[n].items():
                if d not in out:
                    out[d] = list(v)
                else:
                    for k in range(48):
                        out[d][k] += v[k]
        return out

    return total(cons), total(exp), net_only, cons, exp, non_actual, variable, outage


def first_sunday(year, month_index):
    js_dow = (datetime(year, month_index + 1, 1).weekday() + 1) % 7  # Sunday = 0
    return 1 + ((7 - js_dow) % 7)


def in_dst(state, d):
    if state == "QLD":
        return False
    m = d.month - 1
    if m > 9 or m < 3:
        return True
    if m == 9:
        return d.day >= first_sunday(d.year, 9)
    if m == 3:
        return d.day < first_sunday(d.year, 3)
    return False


def offset_minutes(state, d):
    if state == "QLD":
        return 0
    dst = in_dst(state, d)
    if state == "SA":
        return 30 if dst else -30
    return 60 if dst else 0


def rnd(x):
    return math.floor(x * 1000 + 0.5) / 1000


def main():
    if len(sys.argv) != 3 or sys.argv[2] not in STATES:
        sys.stderr.write("usage: build_readings_profile.py <file> <NSW|VIC|QLD|SA|TAS|ACT>\n")
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    state = sys.argv[2]
    cons, exp, net_only, cons_names, exp_names, non_actual, variable, outage = parse(text)
    dates = sorted(cons)
    sums = [[0.0] * 48 for _ in range(24)]
    total = 0.0
    for d in dates:
        base = datetime(int(d[:4]), int(d[4:6]), int(d[6:8]))
        off = offset_minutes(state, base)
        vals = cons[d]
        for k in range(48):
            local = base + timedelta(minutes=k * 30 + off)
            weekend = 1 if local.weekday() >= 5 else 0
            row = (local.month - 1) * 2 + weekend
            slot = local.hour * 2 + (1 if local.minute >= 30 else 0)
            sums[row][slot] += vals[k]
            total += vals[k]
    missing = []
    missing_count = 0
    t0 = datetime(int(dates[0][:4]), int(dates[0][4:6]), int(dates[0][6:8]))
    t1 = datetime(int(dates[-1][:4]), int(dates[-1][4:6]), int(dates[-1][6:8]))
    have = set(dates)
    t = t0
    while t <= t1:
        s = t.strftime("%Y%m%d")
        if s not in have:
            missing_count += 1
            if len(missing) < 31:
                missing.append("%s-%s-%s" % (s[:4], s[4:6], s[6:8]))
        t += timedelta(days=1)
    export_total = 0.0
    for d in dates:
        for v in exp.get(d, []):
            export_total += v
    iso = lambda s: "%s-%s-%s" % (s[:4], s[4:6], s[6:8])
    profile = {
        "v": 1,
        "state": state,
        "from": iso(dates[0]),
        "to": iso(dates[-1]),
        "daysPresent": len(dates),
        "missing": missing,
        "missingCount": missing_count,
        "totalKwh": rnd(total),
    }
    if exp:
        profile["exportKwh"] = rnd(export_total)
    profile.update(
        {
            "netOnly": net_only,
            "streams": {"consumption": cons_names, "export": exp_names},
            "nonActualDays": non_actual,
            "variableDays": variable,
            "outageIntervals": outage,
            "sums": [[rnd(x) for x in r] for r in sums],
        }
    )
    sys.stdout.write(json.dumps(profile, separators=(",", ":")))


main()
