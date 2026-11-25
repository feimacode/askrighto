/**
 * Plan links (add-energy-plan-links): the pure rules, the brand website consistency check, and the three tools.
 * Plan ids in the tool tests are given the @EME / @VEC suffixes the real data has, on the synthetic fixtures.
 * Database parts need TEST_DATABASE_URL and run in a throwaway schema.
 */
import { randomBytes } from "node:crypto";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearReadinessChecks } from "../../src/core/readiness.js";
import { clearDataSets } from "../../src/core/registry.js";
import { CdrClient } from "../../src/energy/cdr-client.js";
import { createDb, migrate, type Db } from "../../src/energy/db.js";
import { RETAILERS, startEnergy, type EnergyRuntime } from "../../src/energy/index.js";
import { RetailerLimiter } from "../../src/energy/limiter.js";
import { emeOfferId, linkMarkdown, planLink, type LinkRetailer } from "../../src/energy/links.js";
import { runSync } from "../../src/energy/sync.js";
import { createServer } from "../../src/server/create-server.js";
import { fixture, startMockCdr, type MockCdr } from "./mock-cdr.js";

const URL = process.env.TEST_DATABASE_URL;
const d = URL ? describe : describe.skip;

const R: LinkRetailer[] = [
  { slug: "agl", website: "https://www.agl.com.au/", websiteCheckedAt: "2026-11-19" },
  { slug: "origin", noWebsite: "home page answered HTTP 404" },
  { slug: "energy-locals", noWebsite: "blocked", brandWebsites: { "1st Energy (EL Retail Energy)": "https://1stenergy.com.au/" } },
];
const eme = { planId: "ENG1207222MRE2@EME", retailerSlug: "agl", brandName: "AGL" };
const vec = { planId: "AGD812605MR@VEC", retailerSlug: "agl", brandName: "AGL" };

describe("offer id", () => {
  it("drops the @EME suffix and the trailing revision digits", () => {
    expect(emeOfferId("ENG1207222MRE2@EME")).toBe("ENG1207222MRE"); // Iven's example: ENG1207222MRE
    expect(emeOfferId("FP11198920MRE1@EME")).toBe("FP11198920MRE");
    expect(emeOfferId("ACT345475MRE12@EME")).toBe("ACT345475MRE");
    expect(emeOfferId("ACT1012834MRG4@EME")).toBe("ACT1012834MRG"); // gas offers use the same shape
  });
  it("is undefined for @VEC ids and ids of another shape", () => {
    expect(emeOfferId("AGD812605MR@VEC")).toBeUndefined();
    expect(emeOfferId("A1")).toBeUndefined();
    expect(emeOfferId("123456@EME")).toBeUndefined();
  });
});

describe("planLink", () => {
  it("links outside Victoria to the Energy Made Easy page for the offer and postcode", () => {
    const l = planLink(eme, "2000", R);
    expect(l).toMatchObject({ kind: "eme_rate_sheet", url: "https://www.energymadeeasy.gov.au/plan?id=ENG1207222MRE&postcode=2000", label: "Rate sheet on Energy Made Easy" });
  });
  it("links a Victorian plan to the retailer's website, labelled as such, with no per-plan link", () => {
    const l = planLink(vec, "3000", R);
    expect(l).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/", label: "Retailer website" });
    expect(l.url).not.toMatch(/plan\?id=/);
    expect(l.note).toMatch(/not the plan's page/);
    expect(l.note).toMatch(/find this plan's rate sheet there/);
    // Same without a postcode.
    expect(planLink(vec, undefined, R).kind).toBe("retailer_website");
  });
  it("uses the retailer website for a Victorian postcode even on an @EME id", () => {
    expect(planLink(eme, "3000", R)).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/" });
  });
  it("uses the link the retailer published first", () => {
    const l = planLink({ ...eme, planUrl: "https://retailer.example/plan/1" }, "2000", R);
    expect(l).toMatchObject({ kind: "retailer_plan_page", url: "https://retailer.example/plan/1" });
  });
  it("says no link is available without a postcode, and never shows the plan id as a link", () => {
    const l = planLink(eme, undefined, R);
    expect(l).toMatchObject({ kind: "none", label: "No link available" });
    expect(l.url).toBeUndefined();
    expect(l.note).toMatch(/postcode/);
    expect(linkMarkdown(l)).not.toContain("](");
    expect(planLink(eme, "20", R).kind).toBe("none"); // not a postcode
  });
  it("says no link is available when the brand has no checked website", () => {
    const l = planLink({ planId: "ORI1@VEC", retailerSlug: "origin", brandName: "Origin Energy" }, "3000", R);
    expect(l).toMatchObject({ kind: "none" });
    expect(l.note).toMatch(/No checked website/);
    expect(planLink({ ...eme, retailerSlug: "unknown-slug" }, "3000", R).kind).toBe("none");
  });
  it("uses a brand's own website on a shared path, and gives an unknown id shape the website only", () => {
    expect(planLink({ planId: "X1@VEC", retailerSlug: "energy-locals", brandName: "1st Energy (EL Retail Energy)" }, "3000", R).url).toBe("https://1stenergy.com.au/");
    expect(planLink({ planId: "X1@VEC", retailerSlug: "energy-locals", brandName: "Indigo Power" }, "3000", R).kind).toBe("none");
    expect(planLink({ planId: "ODDID", retailerSlug: "agl", brandName: "AGL" }, "2000", R)).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/" });
  });
  it("never calls anything but the EME page a rate sheet, and never the plan page unless published", () => {
    for (const l of [planLink(vec, "3000", R), planLink(eme, undefined, R), planLink({ ...eme, retailerSlug: "x" }, "3000", R)]) {
      expect(l.label).not.toMatch(/plan page|rate sheet/i);
    }
  });
});

describe("retailers.json websites", () => {
  it("gives every active brand a checked, dated website or a reason for none", () => {
    for (const r of RETAILERS.filter((x) => x.active)) {
      const has = !!r.website;
      expect(has !== !!r.noWebsite, `${r.slug}: needs exactly one of website or noWebsite`).toBe(true);
      if (has) {
        expect(r.website, r.slug).toMatch(/^https:\/\/[a-z0-9.-]+\/$/);
        expect(r.websiteCheckedAt, r.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(r.noWebsite!.length, r.slug).toBeGreaterThan(8);
      }
      for (const url of Object.values(r.brandWebsites ?? {})) expect(url, r.slug).toMatch(/^https:\/\/[a-z0-9.-]+\/$/);
    }
  });
  it("lists the biggest retailers' sites, or says why not", () => {
    for (const slug of ["agl", "engie", "red-energy", "energyaustralia", "momentum", "alinta"]) expect(RETAILERS.find((r) => r.slug === slug)!.website, slug).toBeTruthy();
  });
});

d("links in the three tools (database)", () => {
  const schema = `askrighto_test_${randomBytes(4).toString("hex")}`;
  let db: Db;
  let mock: MockCdr;
  let rt: EnergyRuntime;
  let client: Client;
  // The fixtures carry a retailer-published link; real plans do not, so it is removed unless asked for.
  const plan = (name: string, planId: string, keepUrl = false) => {
    const detail: Record<string, unknown> = { ...fixture(name), planId };
    if (!keepUrl) {
      delete detail.additionalInformation;
      delete detail.applicationUri;
    }
    return { detail };
  };
  async function call(name: string, args: Record<string, unknown>) {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content as Array<{ text: string }>)[0]!.text;
    const sc = r.structuredContent as any;
    return { text, sc, g: sc.grounded ?? sc };
  }
  beforeAll(async () => {
    db = createDb({ url: URL!, schema, poolMax: 5 });
    await migrate(db);
    // single-rate covers 3000/3001 (Victoria); solar-time-varying covers 2000 (NSW).
    mock = await startMockCdr({
      retailers: { agl: [plan("single-rate", "AGD812605MR@VEC")], origin: [plan("solar-time-varying", "ORI1012345MRE3@EME"), plan("single-rate", "ORI1099999MRE1@EME", true)] },
    });
    clearDataSets();
    clearReadinessChecks();
    rt = (await startEnergy({ DATABASE_URL: URL, DATABASE_SCHEMA: schema, ASKRIGHTO_SYNC_SCHEDULE: "off" } as NodeJS.ProcessEnv))!;
    await runSync({
      db,
      gstBasis: "EXCLUSIVE",
      client: new CdrClient({ baseUrl: mock.url, limiter: new RetailerLimiter({ rps: 500, maxInFlight: 8 }) }),
      retailers: [
        { slug: "agl", brandName: "AGL", active: true },
        { slug: "origin", brandName: "Origin Energy", active: true },
      ],
    });
    rt.store.clear();
    await rt.refresh();
    const [a, b] = InMemoryTransport.createLinkedPair();
    await createServer().connect(a);
    client = new Client({ name: "test", version: "1" });
    await client.connect(b);
  });
  afterAll(async () => {
    await client.close();
    await mock.close();
    clearDataSets();
    clearReadinessChecks();
    await rt.stop().catch(() => undefined);
    const admin = new pg.Pool({ connectionString: URL });
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  it("search: an EME rate sheet link outside Victoria, labelled, with the notice and no plan id as a link", async () => {
    const { g, text, sc } = await call("search_energy_plans", { postcode: "2000" });
    const row = g.data.plans.find((p: any) => p.planId === "ORI1012345MRE3@EME");
    expect(row.link).toMatchObject({ kind: "eme_rate_sheet", url: "https://www.energymadeeasy.gov.au/plan?id=ORI1012345MRE&postcode=2000", label: "Rate sheet on Energy Made Easy" });
    expect(text).toContain("[Rate sheet on Energy Made Easy](https://www.energymadeeasy.gov.au/plan?id=ORI1012345MRE&postcode=2000)");
    expect(text).toMatch(/does not read or store those pages/);
    expect(text).not.toMatch(/\]\(ORI1012345MRE3@EME\)/);
    expect(sc.component).toBeUndefined(); // no UI for this pass-through lookup; the link rides in the data
  });

  it("search: a Victorian plan gets the retailer website, and the text says to find the rate sheet there", async () => {
    const { g, text } = await call("search_energy_plans", { postcode: "3000", distributor: "CitiPower" });
    const row = g.data.plans.find((p: any) => p.planId === "AGD812605MR@VEC");
    expect(row.link).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/", label: "Retailer website" });
    expect(text).toContain("[Retailer website](https://www.agl.com.au/)");
    expect(text).toMatch(/not the plan's page/);
    expect(text).toMatch(/find this plan's rate sheet on the retailer's site/);
    expect(text).not.toMatch(/plan\?id=AGD/);
  });

  it("a retailer-published link is shown first, labelled as the retailer's own", async () => {
    const { g, text } = await call("get_energy_plan", { planId: "ORI1099999MRE1@EME", postcode: "2000" });
    expect(g.data.link).toMatchObject({ kind: "retailer_plan_page", label: "Plan page published by the retailer" });
    expect(g.data.link.url).toMatch(/^https:\/\//);
    expect(text).toContain(`Link: [Plan page published by the retailer](${g.data.link.url})`);
  });

  it("get_energy_plan: link with a postcode, no link without one, and a bad postcode is an input error", async () => {
    const withPc = await call("get_energy_plan", { planId: "ORI1012345MRE3@EME", postcode: "2000" });
    expect(withPc.g.data.link).toMatchObject({ kind: "eme_rate_sheet" });
    expect(withPc.text).toContain("Link: [Rate sheet on Energy Made Easy](https://www.energymadeeasy.gov.au/plan?id=ORI1012345MRE&postcode=2000)");
    const without = await call("get_energy_plan", { planId: "ORI1012345MRE3@EME" });
    expect(without.g.data.link).toMatchObject({ kind: "none" });
    expect(without.text).toMatch(/No link available/);
    expect(without.text).toMatch(/postcode/);
    expect(without.text).not.toMatch(/energymadeeasy\.gov\.au\/plan/);
    const vic = await call("get_energy_plan", { planId: "AGD812605MR@VEC" });
    expect(vic.g.data.link).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/" });
    const bad = await call("get_energy_plan", { planId: "ORI1012345MRE3@EME", postcode: "20" });
    expect(bad.g).toMatchObject({ found: false, reason: "needs_input" });
  });

  it("compare: each estimate carries its link in the table and the structured data", async () => {
    const { g, text } = await call("compare_energy_plans", { postcode: "3000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", distributor: "CitiPower", usageSource: "yearly", usage: 4000 });
    expect(g.found).toBe(true);
    const e = g.data.estimates[0];
    expect(e.link).toMatchObject({ kind: "retailer_website", url: "https://www.agl.com.au/" });
    expect(text).toMatch(/\| Link \|/);
    expect(text).toContain("[Retailer website](https://www.agl.com.au/)");
    expect(text).not.toMatch(/\| AGD812605MR@VEC \|\s*$/m); // the plan id is no longer the last column standing in for a link
    const nsw = await call("compare_energy_plans", { postcode: "2000", fuelType: "ELECTRICITY", customerType: "RESIDENTIAL", usageSource: "yearly", usage: 4000 });
    expect(nsw.g.found).toBe(true);
    for (const x of [...nsw.g.data.estimates, ...nsw.g.data.ifConditionsMet]) expect(["eme_rate_sheet", "retailer_plan_page"]).toContain(x.link.kind);
    expect(nsw.g.data.estimates.some((x: any) => x.link.kind === "eme_rate_sheet")).toBe(true);
  });
});
