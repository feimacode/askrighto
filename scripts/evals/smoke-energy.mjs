// Calls the energy tools directly (no model, no host) against the synthetic fixtures and checks what a script can:
// notes appear once, links are the right kind, refusals are plain, the readings flow works end to end, and no
// identifier comes back. Run it after scripts/evals/load-energy-fixtures.mjs:
//
//   DATABASE_URL=... DATABASE_SCHEMA=askrighto_x node dist/askrighto.js migrate
//   node scripts/evals/load-energy-fixtures.mjs && node scripts/evals/smoke-energy.mjs
//
// Exit code 1 if any check fails. This is the "no host" half of the readings host test (docs/energy-readings-host-test.md).
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const { Client, StreamableHTTPClientTransport } =
  await import("@modelcontextprotocol/client");

const freePort = () =>
  new Promise((ok, bad) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
    s.on("error", bad);
  });

const port = await freePort();
const token = randomBytes(32).toString("base64url");
const server = spawn(
  process.execPath,
  [resolve(ROOT, "dist/askrighto.js"), "--http"],
  {
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      ASKRIGHTO_VERTICALS: "energy",
      ASKRIGHTO_PUBLIC_VERTICALS: "energy",
      ASKRIGHTO_INTERNAL_TOKEN: token,
      ASKRIGHTO_RATE_LIMIT: "100000",
      ASKRIGHTO_LOG: "off",
      ASKRIGHTO_SYNC_SCHEDULE: "off",
    },
    stdio: ["ignore", "pipe", "inherit"],
  },
);
await new Promise((ok, bad) => {
  server.stdout.on("data", (d) => String(d).includes("listening") && ok());
  server.on("exit", (c) =>
    bad(new Error(`server exited with ${c}; run npm run build first`)),
  );
});
const client = new Client({ name: "smoke", version: "0" });
await client.connect(
  new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${port}/mcp-internal/${token}`),
  ),
);

let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? ` (${detail})` : ""}`,
  );
  if (!ok) failed++;
};
async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const text = (r.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  const sc = r.structuredContent ?? {};
  return { text, g: sc.grounded ?? sc };
}

// A synthetic NEM12 file: 0.10 kWh per half hour, 0.50 from 4pm to 8pm AEST, made-up NMI and serial.
const NMI = "4001234567";
const SERIAL = "SERIAL0001";
function nem12({
  days = 365,
  nmi = NMI,
  header = false,
  solar = false,
  nem13 = false,
}) {
  if (nem13)
    return "100,NEM13,200301011534,MDP1,Retailer1\n250,1234567890,1141,01,11,11,METSER66,E,000021.2,20031001103230,A,,,000534.5,20040201100000,A,,\n900";
  const L = header ? ["100,NEM12,202611191200,MDP1,Retailer1"] : [];
  const stream = (suffix, f) => {
    L.push(`200,${nmi},${suffix},${suffix},${suffix},,${SERIAL},KWH,30,`);
    const d = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < days; i++, d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10).replaceAll("-", "");
      L.push(
        `300,${date},${Array.from({ length: 48 }, (_, k) => f(k).toFixed(3)).join(",")},A,,,20261120010101,`,
      );
    }
  };
  stream("E1", (k) => (k >= 32 && k < 40 ? 0.5 : 0.1));
  if (solar) stream("B1", (k) => (k >= 20 && k < 32 ? 0.3 : 0));
  if (header) L.push("900");
  return L.join("\n");
}

const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
check(
  "energy tools and summarise_interval_readings are listed",
  [
    "search_energy_plans",
    "get_energy_plan",
    "compare_energy_plans",
    "summarise_interval_readings",
  ].every((n) => names.includes(n)),
  names.join(","),
);
check(
  "every tool is read-only",
  tools.every((t) => t.annotations?.readOnlyHint === true),
);

// Search, coverage and links.
const search = await call("search_energy_plans", { postcode: "3000" });
check("search at 3000 finds plans", search.g.found === true);
const wa = await call("search_energy_plans", { postcode: "6000" });
check(
  "a WA postcode is outside coverage with a message",
  wa.g.found === false && wa.g.reason === "outside_coverage",
  JSON.stringify(wa.g).slice(0, 200),
);
const vic = await call("get_energy_plan", {
  planId: "AGD812605MR@VEC",
  postcode: "3000",
});
const vicText = JSON.stringify(vic.g);
check(
  "a Victorian plan links the retailer's website, not an Energy Made Easy sheet",
  vic.g.found &&
    !/energymadeeasy\.gov\.au\/plan/.test(vicText) &&
    /Retailer website/i.test(vicText),
  vicText.slice(0, 200),
);
const nsw = await call("get_energy_plan", {
  planId: "AGLSYN1207MRE2@EME",
  postcode: "2000",
});
check(
  "a non-Victorian plan links an Energy Made Easy rate sheet",
  nsw.g.found &&
    /energymadeeasy\.gov\.au\/plan\?id=AGLSYN1207MRE&postcode=2000/.test(
      JSON.stringify(nsw.g),
    ),
  JSON.stringify(nsw.g).slice(0, 200),
);

// Bill route.
const bill = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "ELECTRICITY",
  distributor: "CitiPower",
  billUsageKwh: 300,
  billDays: 90,
});
check(
  "one bill gives estimates",
  bill.g.found && bill.g.data.counts.estimated >= 1,
);
const noteCount = (bill.text.match(/More accurate comparison/g) ?? []).length;
check(
  "the readings note appears once in the text (one bill is scaled to a year)",
  noteCount === 1,
  `${noteCount}`,
);
check(
  "the answer has no 'best' or 'recommended'",
  !/\b(best|recommended)\b/i.test(bill.text),
);
check("the notice is in the text", /general information only/.test(bill.text));
const noUsage = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "ELECTRICITY",
  distributor: "CitiPower",
});
check(
  "no usage asks for usage",
  noUsage.g.found === false && noUsage.g.reason === "needs_input",
);
const noNet = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "ELECTRICITY",
  useBenchmarkUsage: true,
  householdSize: 2,
  distributor: "CitiPower",
});
check(
  "typical usage without benchmark data loaded says so plainly",
  noNet.g.found === false &&
    /not been loaded|not available|not configured/i.test(noNet.g.message),
  noNet.g.message,
);

// Readings route.
const year = nem12({});
const sum = await call("summarise_interval_readings", {
  readingsText: year,
  postcode: "3000",
});
check(
  "summarise reads a year",
  sum.g.found &&
    sum.g.data.daysPresent === 365 &&
    sum.g.data.annualKwh === 2920,
  JSON.stringify(sum.g.data ?? sum.g).slice(0, 200),
);
check(
  "no NMI or serial in the summary",
  !sum.text.includes(NMI) &&
    !sum.text.includes(SERIAL) &&
    !JSON.stringify(sum.g).includes(NMI),
);
const profile = sum.g.data?.profile ?? "";
const cmp = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "ELECTRICITY",
  distributor: "Jemena",
  readingsProfile: profile,
});
const est = cmp.g.data?.estimates ?? [];
check(
  "the full-window time-of-use plan is estimated from readings",
  cmp.g.found && est.some((e) => e.planId === "ORG-SYN-TOU-FULL"),
  JSON.stringify(cmp.g).slice(0, 200),
);
check(
  "the gappy time-of-use plan is not estimated, with a reason",
  (cmp.g.data?.notEstimated ?? []).some(
    (e) =>
      e.planId === "ORG-SYN-TOU" &&
      /uncovered|cannot be matched|windows/i.test(e.detail),
  ),
  JSON.stringify(cmp.g.data?.notEstimated ?? []).slice(0, 200),
);
check(
  "basis is readings, the period and days are stated, no readings prompt",
  cmp.g.data?.usage?.basis === "readings" &&
    /2026-01-01/.test(cmp.text) &&
    !/More accurate comparison/.test(cmp.text),
);
check(
  "no NMI or serial in the comparison",
  !cmp.text.includes(NMI) && !cmp.text.includes(SERIAL),
);
const tampered = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "ELECTRICITY",
  distributor: "Jemena",
  readingsProfile: profile.replace('"v":1', '"v":9'),
});
check(
  "a tampered profile is refused with a way to recover",
  tampered.g.found === false &&
    tampered.g.reason === "needs_input" &&
    /summarise_interval_readings/.test(tampered.g.message),
  tampered.g.message,
);
const solar = await call("summarise_interval_readings", {
  readingsText: nem12({ solar: true }),
  postcode: "3000",
});
check(
  "a B stream is reported as solar export (1,314 kWh a year)",
  solar.g.found && solar.g.data.annualSolarExportKwh === 1314,
  JSON.stringify(solar.g.data ?? solar.g).slice(0, 200),
);
const withHeader = await call("summarise_interval_readings", {
  readingsText: nem12({ header: true }),
  postcode: "3000",
});
check(
  "a file with 100 and 900 records is read too",
  withHeader.g.found && withHeader.g.data.daysPresent === 365,
);

// Refusals.
const refuse = async (name, text, re) => {
  const r = await call("summarise_interval_readings", {
    readingsText: text,
    postcode: "3000",
  });
  check(
    name,
    r.g.found === false && re.test(r.g.message ?? "") && !r.text.includes(NMI),
    (r.g.message ?? "").slice(0, 160),
  );
};
await refuse(
  "NEM13 is refused as accumulation data",
  nem12({ nem13: true }),
  /accumulation|NEM13/i,
);
await refuse(
  "two NMIs are refused",
  `${nem12({ days: 30 })}\n${nem12({ days: 30, nmi: "4009999999" })}`,
  /more than one/i,
);
await refuse(
  "a file cut off mid-line is refused",
  nem12({ days: 30 }).slice(0, 5000),
  /line|values|fewer/i,
);
await refuse(
  "a text value is refused without echoing it",
  nem12({ days: 30 }).replace("0.100", "NOTANUMBER"),
  /line \d+/i,
);
// Size limits. The tool's own cap is 600,000 characters, but the HTTP route refuses a request body over 256 KB, so a
// larger paste fails in the transport before the tool can answer. Reported, not asserted: see the host test doc.
for (const [label, text] of [
  ["year of one stream (about 115 KB)", nem12({})],
  ["year with solar (about 230 KB)", nem12({ solar: true })],
  ["two years (about 230 KB)", nem12({ days: 730 })],
  ["three years (about 340 KB)", nem12({ days: 1095 })],
]) {
  try {
    const r = await call("summarise_interval_readings", {
      readingsText: text,
      postcode: "3000",
    });
    console.log(
      `INFO ${label}: ${r.g.found ? `read, ${r.g.data.daysPresent} days` : `refused: ${(r.g.message ?? "").slice(0, 120)}`}`,
    );
  } catch (e) {
    console.log(
      `INFO ${label}: transport error: ${String(e.data?.text ?? e.message).slice(0, 120)}`,
    );
  }
}
const wrongState = await call("compare_energy_plans", {
  postcode: "3000",
  fuelType: "GAS",
  readingsProfile: profile,
});
check(
  "readings with gas are refused",
  wrongState.g.found === false && wrongState.g.reason === "needs_input",
);

await client.close().catch(() => {});
server.kill();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
