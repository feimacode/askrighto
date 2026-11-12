#!/usr/bin/env python3
"""Quick consumer test for AER Energy Product Reference Data (CDR, no auth).

Reference only: Iven's proof of concept (13 Nov 2026), which ran successfully against
the live API. The product code is TypeScript; do not ship or import this file.

Usage:
  python3 cdr_energy.py list   [--retailer agl] [--fuel ELECTRICITY] [--type MARKET] [--postcode 3000] [--max 20]
  python3 cdr_energy.py detail <planId> [--retailer agl]
"""
import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://cdr.energymadeeasy.gov.au/{retailer}/cds-au/v1/energy/plans"
# Get Generic Plans = v1, Get Generic Plan Detail = v3 (v2 retired Mar 2025)
LIST_VERSION = "1"
DETAIL_VERSION = "3"


def get(url, version):
    req = urllib.request.Request(url, headers={"x-v": version, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} for {url}\n{e.read().decode(errors='replace')[:500]}")


def list_plans(retailer, fuel, plan_type, postcode, max_plans, page_size=100):
    params = {"effective": "CURRENT", "fuelType": fuel, "type": plan_type, "page-size": page_size, "page": 1}
    url = BASE.format(retailer=urllib.parse.quote(retailer)) + "?" + urllib.parse.urlencode(params)
    count = 0
    while url:
        body = get(url, LIST_VERSION)
        for p in body["data"]["plans"]:
            postcodes = p.get("geography", {}).get("includedPostcodes", [])
            if postcode and postcode not in postcodes:
                continue
            yield p
            count += 1
            if count >= max_plans:
                return
        url = body.get("links", {}).get("next")


def cmd_list(a):
    n = 0
    for p in list_plans(a.retailer, a.fuel, a.type, a.postcode, a.max):
        dists = ",".join(p.get("geography", {}).get("distributors", []))
        print(f"{p['planId']:<32} {p['fuelType']:<12} {p['type']:<9} {p.get('displayName', '')[:50]:<50} [{dists}]")
        n += 1
    print(f"\n{n} plan(s)")


def cmd_detail(a):
    url = BASE.format(retailer=urllib.parse.quote(a.retailer)) + "/" + urllib.parse.quote(a.plan_id, safe="")
    d = get(url, DETAIL_VERSION)["data"]
    print(f"{d['displayName']} ({d['planId']}) - {d['brandName']} {d['fuelType']} {d['type']}")
    for key in ("electricityContract", "gasContract"):
        c = d.get(key)
        if not c:
            continue
        print(f"\n[{key}] pricingModel={c.get('pricingModel')} billing={c.get('billFrequency')}")
        for tp in c.get("tariffPeriod", []):
            print(f"  period {tp.get('displayName')}: daily supply ${tp.get('dailySupplyCharge')}")
            for rb in tp.get("singleRate", {}).get("rates", []):
                print(f"    single rate ${rb.get('unitPrice')}/kWh (vol {rb.get('volume', '-')})")
            for tou in tp.get("timeOfUseRates", []):
                prices = ", ".join(r.get("unitPrice", "?") for r in tou.get("rates", []))
                print(f"    TOU {tou.get('type')} {tou.get('displayName')}: ${prices}/kWh")
        for f in c.get("solarFeedInTariff", []):
            print(f"  FiT {f.get('displayName')}: {json.dumps(f.get('singleTariff', f.get('timeVaryingTariffs')))}")
        for disc in c.get("discounts", []):
            print(f"  discount: {disc.get('displayName')}")
    if a.raw:
        print(json.dumps(d, indent=2))


def main():
    ap = argparse.ArgumentParser(description="AER Energy PRD (CDR) test consumer")
    sub = ap.add_subparsers(dest="cmd", required=True)

    l = sub.add_parser("list")
    l.add_argument("--retailer", default="agl", help="CDR brand slug, e.g. agl, origin, energyaustralia")
    l.add_argument("--fuel", default="ALL", choices=["ELECTRICITY", "GAS", "DUAL", "ALL"])
    l.add_argument("--type", default="ALL", choices=["STANDING", "MARKET", "REGULATED", "ALL"])
    l.add_argument("--postcode")
    l.add_argument("--max", type=int, default=20)
    l.set_defaults(func=cmd_list)

    d = sub.add_parser("detail")
    d.add_argument("plan_id")
    d.add_argument("--retailer", default="agl")
    d.add_argument("--raw", action="store_true", help="dump full JSON")
    d.set_defaults(func=cmd_detail)

    a = ap.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
