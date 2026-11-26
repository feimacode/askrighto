// Loads synthetic energy data for the "energy" eval set, without the network: a small in-process stand-in
// for the CDR plan API serving test/fixtures/energy, synced through the real `sync-energy` command, then the
// synthetic AER benchmark file through `benchmarks:load`. Needs DATABASE_URL (a throwaway database), the
// schema migrated, and `npm run build`. Plan ids carry the suffixes real data has (@EME outside Victoria,
// @VEC in Victoria) so the link rules run as they do on real plans. All numbers are invented.
//
//   node scripts/evals/load-energy-fixtures.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
// The fixtures carry a retailer-published plan link; real CDR plans do not, and keeping it would hide the link rules.
const fx = (name) => {
  const d = JSON.parse(readFileSync(resolve(ROOT, "test/fixtures/energy", `${name}.json`), "utf8"));
  delete d.additionalInformation;
  delete d.applicationUri;
  return d;
};

// A time-of-use plan whose off-peak has no windows of its own (the rest of the day), so readings can be matched.
const mappableTou = () => {
  const d = fx("time-of-use");
  d.planId = "ORI1000004MR@VEC";
  d.displayName = "Synthetic Time of Use (matchable windows)";
  d.electricityContract.tariffPeriod[0].timeOfUseRates[1].timeOfUse = [];
  return d;
};
const withId = (name, planId) => ({ ...fx(name), planId });

/** retailer slug -> plan detail records. */
const PLANS = {
  agl: [withId("single-rate", "AGL1000001MR@VEC"), withId("solar-time-varying", "AGL1000002MRE1@EME"), withId("unknown-model", "AGL1000003MR@VEC")],
  origin: [mappableTou(), withId("time-of-use", "ORI1000005MR@VEC")],
  energyaustralia: [withId("block-rates-gas", "ENE1000006MRG@VEC")],
};

const listItem = (d) => ({ planId: d.planId, displayName: d.displayName, brandName: d.brandName, fuelType: d.fuelType, type: d.type, customerType: d.customerType, effectiveFrom: d.effectiveFrom, effectiveTo: d.effectiveTo, lastUpdated: d.lastUpdated, geography: d.geography });

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const m = /^\/([^/]+)\/cds-au\/v1\/energy\/plans(?:\/(.+))?$/.exec(u.pathname);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const plans = m && PLANS[decodeURIComponent(m[1])];
  if (!plans) return send(404);
  if (m[2]) {
    const p = plans.find((x) => x.planId === decodeURIComponent(m[2]));
    return p ? send(200, { data: p }) : send(404);
  }
  const eff = u.searchParams.get("effective") ?? "CURRENT";
  send(200, { data: { plans: eff === "CURRENT" ? plans.map(listItem) : [] }, links: { self: "x" }, meta: { totalRecords: plans.length } });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = false;
// Async on purpose: the stand-in API above lives in this process and must keep answering while sync-energy runs.
const run = (args, extra = {}) =>
  new Promise((ok) => {
    const child = spawn(process.execPath, [resolve(ROOT, "dist/askrighto.js"), ...args], { stdio: "inherit", env: { ...process.env, ...extra } });
    child.on("exit", (code) => {
      if (code !== 0) {
        console.error(`::warning::'${args.join(" ")}' failed; the energy prompts will see less data`);
        failed = true;
      }
      ok();
    });
  });
try {
  for (const slug of Object.keys(PLANS)) await run(["sync-energy", "--retailer", slug], { ASKRIGHTO_CDR_BASE: base });
} finally {
  server.close();
}
await run(["benchmarks:load", "--file", resolve(ROOT, "test/fixtures/benchmarks/aer_benchmarks_synthetic.xlsx"), "--source-date", "2021-06-01", "--source-name", "Synthetic test fixture"]);
process.exit(failed ? 1 : 0);
