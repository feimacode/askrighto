/**
 * Energy tool tests over MCP, against a PostgreSQL loaded from the (synthetic) fixtures.
 * Needs TEST_DATABASE_URL, like db.test.ts. The fixtures are loaded with an EXCLUSIVE GST basis
 * so costs can be tested; production data stays UNKNOWN until confirmed.
 */
import { randomBytes } from "node:crypto";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearDataSets } from "../../src/core/registry.js";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { runSync } from "../../src/energy/sync.js";
import type { GstBasis } from "../../src/energy/types.js";
import { createServer } from "../../src/server/create-server.js";
import { NOTICE, uniqueDistributors } from "../../src/tools/energy-common.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;
const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;

let db: Db;
let mock: MockCdr;
let rt: EnergyRuntime;
let client: Client;

const plan = (
  name: string,
  planId: string,
  extra: Record<string, unknown> = {},
) => ({ detail: { ...fixture(name), planId, ...extra } });

async function load(gstBasis: GstBasis) {
  await db.pool.query(
    "TRUNCATE plan_changes, plans, coverage_sets, retailers, sync_runs RESTART IDENTITY CASCADE",
  );
  await runSync({
    db,
    gstBasis,
    client: new CdrClient({
      baseUrl: mock.url,
      limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }),
    }),
    retailers: [
      { slug: "agl", brandName: "AGL", active: true },
      { slug: "origin", brandName: "Origin Energy", active: true },
      { slug: "energyaustralia", brandName: "EnergyAustralia", active: true },
    ],
  });
  rt.store.clear();
  await rt.refresh();
}

async function call(name: string, args: Record<string, unknown>) {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content as Array<{ text: string }>)[0]!.text;
  if (!r.structuredContent)
    throw new Error("no structuredContent: " + JSON.stringify(r).slice(0, 400));
  const sc = r.structuredContent as {
    grounded?: {
      found: boolean;
      reason?: string;
      message?: string;
      data?: any;
      source?: any;
      asOf?: string;
    };
    component?: string;
  };
  return { text, sc, g: sc.grounded ?? (r.structuredContent as any) };
}

beforeAll(async () => {
  if (!URL) return;
  db = createDb({ url: URL, schema, poolMax: 5 });
  await migrate(db);
  mock = await startMockCdr({
    retailers: {
      agl: [
        plan("single-rate", "A1"),
        plan("unknown-model", "A2"),
        plan("solar-time-varying", "A3"),
        // Recorded AGL plan, moved to one postcode of its own so the counts in the 3000 tests stay put.
        { detail: { ...fixture("recorded/agl-AGD812605MR"), geography: { distributors: ["Citipower"], includedPostcodes: ["3207"] } } },
      ],
      origin: [plan("time-of-use", "O1")],
      energyaustralia: [plan("block-rates-gas", "G1")],
    },
  });
  clearDataSets();
  clearReadinessChecks();
  rt = (await startEnergy({
    DATABASE_URL: URL,
    DATABASE_SCHEMA: schema,
    ASKRIGHTO_SYNC_SCHEDULE: "off",
  } as NodeJS.ProcessEnv))!;
  await load("EXCLUSIVE");
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "test", version: "1" });
  await client.connect(b);
});

afterAll(async () => {
  if (!URL) return;
  await client.close();
  await mock.close();
  clearDataSets();
  clearReadinessChecks();
  await rt.stop().catch(() => undefined);
  const admin = new pg.Pool({ connectionString: URL });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

d("tools are listed with annotations and the Inkview view", () => {
  it("lists the three energy tools with all hints", async () => {
    const { tools } = await client.listTools();
    for (const n of [
      "search_energy_plans",
      "get_energy_plan",
      "compare_energy_plans",
    ]) {
      const t = tools.find((x) => x.name === n)!;
      expect(t.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(t.title).toBeTruthy();
      // search_energy_plans only hands plan ids to the next call, so it draws no component.
      if (n === "search_energy_plans") {
        expect((t._meta as any)?.ui?.resourceUri).toBeUndefined();
      } else {
        expect((t._meta as any)?.ui?.resourceUri).toBe(
          "ui://inkview/v1/app.html",
        );
      }
    }
  });

  it("server instructions carry the energy guidance", () => {
    expect(client.getInstructions()).toMatch(/search_energy_plans/);
    expect(client.getInstructions()).toMatch(/never "best" or "recommended"/);
  });
});

d("search_energy_plans", () => {
  it("returns plans with source, date, notice and no component", async () => {
    const { text, sc, g } = await call("search_energy_plans", {
      postcode: "3000",
      fuelType: "ELECTRICITY",
    });
    expect(g.found).toBe(true);
    expect(g.data.total).toBe(3); // A1, A2, O1
    expect(g.data.plans[0]).toMatchObject({
      retailer: expect.any(String),
      planId: expect.any(String),
      fuelType: "ELECTRICITY",
      sourceLastUpdated: expect.any(String),
    });
    expect(g.source.url).toMatch(/aer\.gov\.au/);
    expect(Date.parse(g.asOf)).not.toBeNaN();
    expect(text).toContain(NOTICE);
    expect(g.data.notice).toBe(NOTICE);
    expect(sc.component).toBeUndefined(); // a pass-through lookup draws no UI
    expect(text).toMatch(/\| Retailer \| Plan \|/); // markdown table for text-only hosts
  });

  it("rejects a bad postcode and reports outside coverage", async () => {
    expect(
      (await call("search_energy_plans", { postcode: "30A0" })).g,
    ).toMatchObject({ found: false, reason: "needs_input" });
    const r = (await call("search_energy_plans", { postcode: "9999" })).g;
    expect(r).toMatchObject({ found: false, reason: "outside_coverage" });
    expect(r.message).toMatch(/NSW/);
  });

  it("applies filters together and echoes a fuzzy retailer match", async () => {
    const solar = (
      await call("search_energy_plans", {
        postcode: "3000",
        fuelType: "ELECTRICITY",
        hasSolarFeedIn: true,
      })
    ).g;
    expect(solar.data.plans.map((p: any) => p.planId)).toEqual(["O1"]);
    const fuzzy = (
      await call("search_energy_plans", {
        postcode: "3000",
        retailer: "Origen",
      })
    ).g;
    expect(fuzzy.data.matchedRetailer).toBe("Origin Energy");
    expect(
      fuzzy.data.plans.every((p: any) => p.retailer === "Origin Energy"),
    ).toBe(true);
    expect(
      (
        await call("search_energy_plans", {
          postcode: "3000",
          retailer: "Zzzzzz",
        })
      ).g.reason,
    ).toBe("not_in_dataset");
  });

  it("groups by distributor and asks which one when there are several", async () => {
    const r = (
      await call("search_energy_plans", {
        postcode: "3000",
        fuelType: "ELECTRICITY",
      })
    ).g;
    expect(r.data.distributorsByFuel.ELECTRICITY).toEqual([
      "CitiPower",
      "Jemena",
    ]);
    expect(r.data.needsDistributor).toBe(true);
    expect(r.data.askUser).toMatch(/which one is on their bill/);
    const one = (
      await call("search_energy_plans", {
        postcode: "3000",
        fuelType: "ELECTRICITY",
        distributor: "Jemena",
      })
    ).g;
    expect(one.data.plans.map((p: any) => p.planId)).toEqual(["O1"]);
    expect(one.data.needsDistributor).toBe(false);
  });

  it("pages in a neutral order", async () => {
    const p1 = (
      await call("search_energy_plans", { postcode: "3000", limit: 2 })
    ).g.data;
    expect(p1.returned).toBe(2);
    expect(p1.nextCursor).toBe("2");
    const p2 = (
      await call("search_energy_plans", {
        postcode: "3000",
        limit: 2,
        cursor: p1.nextCursor,
      })
    ).g.data;
    const all = [...p1.plans, ...p2.plans].map(
      (p: any) => `${p.retailer}|${p.planName}`,
    );
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
  });
});

d("get_energy_plan", () => {
  it("shows a known plan with GST-inclusive amounts and conditions attached to discounts", async () => {
    const { text, g, sc } = await call("get_energy_plan", { planId: "A1" });
    expect(g.found).toBe(true);
    expect(g.data.contracts[0].periods[0].dailySupply).toBe("$1.21/day"); // 1.10 x 1.1
    expect(g.data.contracts[0].periods[0].usage[0]).toBe("0.3080/kWh"); // 0.28 x 1.1
    expect(g.data.contracts[0].discounts[0]).toMatchObject({
      conditional: true,
      condition: expect.stringMatching(/pay on time/i),
    });
    expect(text).toMatch(/Discount, conditional: Pay on time/);
    expect(text).toContain(NOTICE);
    expect(sc.component).toBe("entity_card");
    expect(g.data.planUrl).toBe("https://example.test/plan/single");
  });

  it("shows feed-in credits as published (no GST added), including time-varying tariffs with windows", async () => {
    const tou = (await call("get_energy_plan", { planId: "O1" })).g;
    expect(tou.data.contracts[0].solarFeedIn[0]).toBe("FiT (current): 0.0500/kWh");
    expect(tou.data.contracts[0].controlledLoads[0]).toMatch(/supply \$0\.11\/day/); // 0.10 x 1.1, read from singleRate
    const tv = (await call("get_energy_plan", { planId: "A3" })).g;
    expect(tv.found).toBe(true);
    expect(tv.data.contracts[0].solarFeedIn[0]).toBe(
      "Time varying feed-in (current): varies by time: Evening: 0.0800/kWh (MON/TUE/WED/THU/FRI/SAT/SUN 16:00-21:00); Rest of day: 0.0200/kWh (MON/TUE/WED/THU/FRI/SAT/SUN 21:00-16:00)",
    );
  });

  it("recorded AGL plan shows the fact sheet's GST-inclusive prices and its fees as published", async () => {
    const g = (await call("get_energy_plan", { planId: "AGD812605MR@VEC" })).g;
    const c = g.data.contracts[0];
    expect(c.periods[0].dailySupply).toBe("$1.04/day"); // fact sheet 104.18 c/day
    expect(c.periods[0].usage).toEqual([
      "shoulder: 0.3058/kWh (MON/TUE/WED/THU/FRI/SAT/SUN 15:00-21:00)",
      "shoulder: 0.1824/kWh (MON/TUE/WED/THU/FRI/SAT/SUN 21:00-00:00; MON/TUE/WED/THU/FRI/SAT/SUN 00:00-15:00)",
    ]);
    expect(c.solarFeedIn[0]).toBe("Current FIT policy (current): 0.0050/kWh");
    expect(c.fees[0]).toMatch(/^reconnection \(fixed\): \$51\.19 /); // "Includes GST", not grossed up again
  });

  it("shows a labelled link, never the plan id as a link: a Victorian plan gets the retailer's checked website", async () => {
    const one = await call("get_energy_plan", { planId: "AGD812605MR@VEC", postcode: "3207" });
    // AGL's website is hand-checked in retailers.json (a brand with none shows "no link available": see links.test.ts).
    expect(one.g.data.link.url).toBe("https://www.agl.com.au/");
    expect(one.text).toContain("Link: [Retailer website](https://www.agl.com.au/)");
    expect(one.text).not.toMatch(/energymadeeasy/);
    const list = await call("search_energy_plans", { postcode: "3207" });
    expect(list.text).toMatch(/\| Updated \| Link \| Plan id \|/);
    expect(list.g.data.plans[0].link).toMatchObject({ label: "Retailer website" });
  });

  it("treats distributor spellings that differ only by case as one network", () => {
    expect(uniqueDistributors(["CitiPower", "Jemena", "Citipower"])).toEqual(["CitiPower", "Jemena"]);
  });

  it("reports an unknown id and flags a plan it does not fully understand", async () => {
    expect((await call("get_energy_plan", { planId: "NOPE" })).g).toMatchObject(
      { found: false, reason: "not_in_dataset" },
    );
    const odd = (await call("get_energy_plan", { planId: "A2" })).g;
    expect(odd.found).toBe(true);
    expect(odd.data.understood).toBe(false);
    expect(odd.warnings.join(" ")).toMatch(/not fully understood/);
  });

  it("withholds dollar amounts while the GST basis is unconfirmed", async () => {
    await load("UNKNOWN");
    const { g, text } = await call("get_energy_plan", { planId: "A1" });
    expect(g.data.pricesShown).toBe(false);
    expect(text).not.toMatch(/\$\d/);
    expect(text).toMatch(/withheld/);
    const cmp = (
      await call("compare_energy_plans", {
        postcode: "3000",
        fuelType: "ELECTRICITY",
        distributor: "CitiPower",
        annualUsageKwh: 4000,
      })
    ).g;
    expect(cmp.data.counts.estimated).toBe(0);
    expect(cmp.data.notEstimatedByReason.gst_basis_unknown).toBeGreaterThan(0);
    await load("EXCLUSIVE");
  });
});

d("compare_energy_plans", () => {
  const base = {
    postcode: "3000",
    fuelType: "ELECTRICITY",
    distributor: "CitiPower",
  };

  it("estimates from yearly usage, with breakdown that sums, ordering, counts and assumptions", async () => {
    const { g, text } = await call("compare_energy_plans", {
      ...base,
      annualUsageKwh: 4000,
    });
    expect(g.found).toBe(true);
    expect(g.data.counts).toMatchObject({
      available: 2,
      estimated: 1,
      notEstimated: 1,
    });
    const e = g.data.estimates[0];
    expect(e.planId).toBe("A1");
    expect(e.totalCents).toBe(167365);
    const b = e.breakdown;
    expect(
      b.supplyCents +
        b.usageCents +
        b.controlledLoadCents +
        b.feedInCreditCents +
        b.guaranteedDiscountCents +
        b.feesCents +
        b.gstCents,
    ).toBe(e.totalCents);
    expect(g.data.notEstimated[0]).toMatchObject({
      planId: "A2",
      reason: "not_fully_understood",
    });
    expect(g.data.assumptions.join(" ")).toMatch(/spread evenly/);
    expect(g.data.omissions.join(" ")).toMatch(/One-off fees/);
    expect(text).toMatch(/lowest estimate for the usage given/);
    expect(text).not.toMatch(/\bbest\b|recommended/i);
    expect(text).toContain(NOTICE);
    expect(e.conditionalDiscounts[0].condition).toMatch(/pay on time/i);
    expect(e.totalIfConditionsMetCents).toBeLessThan(e.totalCents);

    // Conditional discounts get their own table, ordered by the cost if conditions are met.
    expect(g.data.ifConditionsMet).toEqual([
      expect.objectContaining({ rank: 1, mainRank: 1, planId: "A1", totalCents: e.totalCents, totalIfConditionsMetCents: e.totalIfConditionsMetCents, savingCents: e.totalCents - e.totalIfConditionsMetCents }),
    ]);
    expect(text).toMatch(/If you meet the conditions/);
    expect(text).toMatch(/\| Cost if conditions met \| Cost otherwise \|/);
    // The main table no longer mixes in the conditional cost.
    expect(text.split("If you meet the conditions")[0]).not.toMatch(/Cost if conditions met/);
  });

  it("is deterministic", async () => {
    const a = await call("compare_energy_plans", {
      ...base,
      annualUsageKwh: 4000,
    });
    const b = await call("compare_energy_plans", {
      ...base,
      annualUsageKwh: 4000,
    });
    expect(a.g.data).toEqual(b.g.data);
  });

  it("scales bill usage to a year and says so; asks for usage when none; checks shares", async () => {
    const r = (
      await call("compare_energy_plans", {
        ...base,
        billUsageKwh: 1000,
        billDays: 90,
      })
    ).g;
    expect(r.data.usage.annualUsage).toBe(4056);
    expect(r.data.usage.scaledFromBill).toMatch(/scaled to a year/);
    expect((await call("compare_energy_plans", base)).g).toMatchObject({
      found: false,
      reason: "needs_input",
    });
    expect(
      (await call("compare_energy_plans", { ...base, billUsageKwh: 100 })).g
        .message,
    ).toMatch(/billDays/);
    expect(
      (
        await call("compare_energy_plans", {
          ...base,
          annualUsageKwh: 4000,
          peakSharePct: 50,
          offPeakSharePct: 30,
        })
      ).g.message,
    ).toMatch(/80%/);
  });

  it("estimates time-of-use plans only with a split", async () => {
    const jem = {
      postcode: "3000",
      fuelType: "ELECTRICITY",
      distributor: "Jemena",
      annualUsageKwh: 4000,
    };
    const without = (await call("compare_energy_plans", jem)).g;
    expect(without.data.notEstimated[0]).toMatchObject({
      planId: "O1",
      reason: "needs_time_of_use_split",
    });
    const withSplit = (
      await call("compare_energy_plans", {
        ...jem,
        peakSharePct: 30,
        shoulderSharePct: 20,
        offPeakSharePct: 50,
        solarExportAnnualKwh: 500,
        currentPlanId: "O1",
      })
    ).g;
    expect(withSplit.data.estimates[0]).toMatchObject({ planId: "O1" });
    expect(withSplit.data.estimates[0].breakdown.feedInCreditCents).toBe(-2500);
  });

  it("asks which distributor when there are several", async () => {
    const r = (
      await call("compare_energy_plans", {
        postcode: "3000",
        fuelType: "ELECTRICITY",
        annualUsageKwh: 4000,
      })
    ).g;
    expect(r).toMatchObject({ found: false, reason: "needs_input" });
    expect(r.details.distributors).toEqual(["CitiPower", "Jemena"]);
  });

  it("estimates gas in MJ and narrows by plan id", async () => {
    const gas = (
      await call("compare_energy_plans", {
        postcode: "3000",
        fuelType: "GAS",
        annualUsageMj: 20000,
      })
    ).g;
    expect(gas.data.estimates[0].totalCents).toBe(104720);
    const narrowed = (
      await call("compare_energy_plans", {
        ...base,
        annualUsageKwh: 4000,
        planIds: ["A1", "ZZ"],
      })
    ).g;
    expect(narrowed.data.counts.available).toBe(1);
    expect(narrowed.data.unknownPlanIds).toEqual(["ZZ"]);
  });
});

d("standard notice and components", () => {
  it("every found energy result carries the notice in both forms and a component for MCP Apps hosts", async () => {
    const calls: Array<[string, Record<string, unknown>, string]> = [
      ["get_energy_plan", { planId: "A1" }, "entity_card"],
      [
        "compare_energy_plans",
        {
          postcode: "3000",
          fuelType: "ELECTRICITY",
          distributor: "CitiPower",
          annualUsageKwh: 4000,
        },
        "data_table",
      ],
      [
        "compare_energy_plans",
        { postcode: "3000", fuelType: "GAS", annualUsageMj: 20000 },
        "data_table",
      ],
    ];
    for (const [name, args, component] of calls) {
      const { g, text, sc } = await call(name, args);
      expect(g.found, name).toBe(true);
      expect(text, name).toContain(NOTICE);
      expect(g.data.notice, name).toBe(NOTICE);
      expect(sc.component, name).toBe(component);
      expect(g.source.name, name).toMatch(/Australian Energy Regulator/);
    }
  });
});

d("outage", () => {
  it("every energy tool says data is unavailable and returns no figures when the database is gone", async () => {
    await rt.db.pool.end();
    for (const [name, args] of [
      ["search_energy_plans", { postcode: "3000" }],
      ["get_energy_plan", { planId: "A1" }],
      [
        "compare_energy_plans",
        {
          postcode: "3000",
          fuelType: "ELECTRICITY",
          distributor: "CitiPower",
          annualUsageKwh: 4000,
        },
      ],
    ] as const) {
      rt.store.clear();
      const { g, text } = await call(name, args as Record<string, unknown>);
      expect(g).toMatchObject({ found: false, reason: "data_unavailable" });
      expect(text).not.toMatch(/\$\d/);
    }
  });
});
