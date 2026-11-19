// Writes synthetic NEM12 files of several sizes for the host tests (docs/energy-readings-host-test.md).
// The NMI and meter serial are made up. Each file's use is a fixed pattern, so the expected figures are known:
//   every half hour uses 0.10 kWh, except 16:00 to 20:00 (8 half hours) which use 0.50 kWh, on every day.
//   That is 8 x 0.50 + 40 x 0.10 = 8.00 kWh a day, and half of the day's use (50%) falls in 15:00 to 21:00.
// The pattern is in clock time with no daylight saving (market time, AEST), as in a real file.
// Usage: node scripts/make-sample-readings.mjs [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const out = resolve(process.argv[2] ?? "evals/readings-samples");
mkdirSync(out, { recursive: true });
const pad = (n) => String(n).padStart(2, "0");

function make(startIso, days, withSolar) {
  const lines = [];
  const stream = (suffix, valueAt) => {
    lines.push(
      `200,4001234567,${suffix},${suffix},${suffix},,SERIAL0001,KWH,30,`,
    );
    const d = new Date(`${startIso}T00:00:00Z`);
    for (let i = 0; i < days; i++) {
      const date = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
      const vals = Array.from({ length: 48 }, (_, k) => valueAt(k).toFixed(3));
      lines.push(`300,${date},${vals.join(",")},A,,,20261120010101,`);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  };
  stream("E1", (k) => (k >= 32 && k < 40 ? 0.5 : 0.1));
  if (withSolar) stream("B1", (k) => (k >= 20 && k < 32 ? 0.3 : 0));
  return lines.join("\n");
}

const sizes = [
  ["week", 7],
  ["month", 30],
  ["quarter", 91],
  ["year", 365],
];
const rows = [];
for (const [name, days] of sizes) {
  const text = make("2026-01-01", days, false);
  const file = `readings-${name}.csv`;
  writeFileSync(resolve(out, file), text);
  rows.push(
    `${file}: ${days} days, ${(text.length / 1024).toFixed(0)} KB, ${(days * 8).toFixed(0)} kWh measured, ${Math.round(365 * 8)} kWh a year`,
  );
}
writeFileSync(
  resolve(out, "readings-year-solar.csv"),
  make("2026-01-01", 365, true),
);
rows.push(
  `readings-year-solar.csv: 365 days with a B1 stream, export 3.6 kWh a day = ${Math.round(365 * 3.6)} kWh a year`,
);
console.log(rows.join("\n"));
