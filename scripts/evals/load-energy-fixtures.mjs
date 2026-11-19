// Loads the synthetic energy plans in test/fixtures/energy into the database named by DATABASE_URL, so the energy
// prompts and the smoke test have data without the live CDR load. A tiny stand-in for the CDR API serves the fixtures
// and the real `sync-energy` command reads from it (ASKRIGHTO_CDR_BASE), so the stored plans go through the real
// normaliser. The plans are made up (plus one recorded AGL plan); nothing here is production data.
//
//   DATABASE_URL=postgres://... node dist/askrighto.js migrate && node scripts/evals/load-energy-fixtures.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const fx = (name) =>
  JSON.parse(
    readFileSync(resolve(ROOT, "test/fixtures/energy", `${name}.json`), "utf8"),
  );
const ALL = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// A time-of-use plan whose windows cover the whole day (peak 3pm to 9pm, off-peak the rest), so it can be
// estimated from interval readings. The plain time-of-use fixture leaves 7am to 3pm uncovered on purpose.
const full = fx("time-of-use");
full.planId = "ORG-SYN-TOU-FULL";
full.displayName = "Synthetic Time of Use, full windows";
{
  const [peak, off] = full.electricityContract.tariffPeriod[0].timeOfUseRates;
  peak.timeOfUse = [{ days: ALL, startTime: "1500", endTime: "2100" }];
  off.timeOfUse = [{ days: ALL, startTime: "2100", endTime: "1500" }];
}

// A non-Victorian plan with an Energy Made Easy style id (`...@EME`), so the rate sheet link can be tested.
const nsw = fx("solar-time-varying");
nsw.planId = "AGLSYN1207MRE2@EME";

const retailers = {
  agl: [
    fx("single-rate"),
    fx("unknown-model"),
    nsw,
    fx("recorded/agl-AGD812605MR"),
  ],
  origin: [fx("time-of-use"), full],
  energyaustralia: [fx("block-rates-gas")],
};

const listItem = (d) => {
  const {
    planId,
    displayName,
    brandName,
    fuelType,
    type,
    customerType,
    effectiveFrom,
    effectiveTo,
    lastUpdated,
    geography,
  } = d;
  return {
    planId,
    displayName,
    brandName,
    fuelType,
    type,
    customerType,
    effectiveFrom,
    effectiveTo,
    lastUpdated,
    geography,
  };
};

const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const m = /^\/([^/]+)\/cds-au\/v1\/energy\/plans(?:\/(.+))?$/.exec(
    u.pathname,
  );
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };
  const plans = m && retailers[decodeURIComponent(m[1])];
  if (!plans) return send(404);
  if (m[2]) {
    const p = plans.find((x) => x.planId === decodeURIComponent(m[2]));
    return p ? send(200, { data: p }) : send(404);
  }
  if ((u.searchParams.get("effective") ?? "CURRENT") !== "CURRENT")
    return send(200, {
      data: { plans: [] },
      links: { self: "x" },
      meta: { totalRecords: 0 },
    });
  send(200, {
    data: { plans: plans.map(listItem) },
    links: { self: "x" },
    meta: { totalRecords: plans.length },
  });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;

let code = 1;
try {
  for (const slug of Object.keys(retailers)) {
    code = await new Promise((ok) => {
      const p = spawn(
        process.execPath,
        [resolve(ROOT, "dist/askrighto.js"), "sync-energy", "--retailer", slug],
        {
          env: {
            ...process.env,
            ASKRIGHTO_CDR_BASE: base,
            ASKRIGHTO_SYNC_PER_RETAILER_RPS: "500",
          },
          stdio: ["ignore", "inherit", "inherit"],
        },
      );
      p.on("exit", (c) => ok(c ?? 1));
    });
    if (code !== 0) break;
  }
} finally {
  server.close();
}
process.exit(code);
