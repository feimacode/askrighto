// Builds aer_benchmarks_synthetic.xlsx: invented numbers in the real AER workbook's layout (not AER data).
// Run: node test/fixtures/benchmarks/make-fixture.mjs   (uses fflate, which read-excel-file already depends on)
import { zipSync, strToU8 } from "fflate";
import { writeFileSync } from "node:fs";

const SEASONS = ["Autumn", "Spring", "Summer", "Winter"]; // order as in the AER long tables is irrelevant to the parser
const SIZES = [1, 2, 3, 4, "5+"];
const sizeNo = (s) => (s === "5+" ? 5 : s);
const ZONE_STATES = { 1: ["QLD"], 2: ["NSW", "QLD"], 3: ["QLD"], 4: ["NSW", "SA", "VIC"], 5: ["NSW", "QLD", "SA"], 6: ["NSW", "SA", "VIC"], 7: ["ACT", "NSW", "TAS", "VIC"], 8: ["ACT", "NSW", "TAS", "VIC"] };
const STATE_IDX = { ACT: 1, NSW: 2, QLD: 3, SA: 4, TAS: 5, VIC: 6 };
const SA_ZONES = ["Adelaide & Environs", "Central North", "Eyre Peninsula", "Far North", "Mid North", "Murray Lands", "Port Augusta & Pastoral", "South East", "Yorke Peninsula", "Kangaroo Island"];

// Synthetic values: electricity kWh = zone*1000 + stateIdx*100 + size*10 + seasonIdx + 0.5 (zone 8 uses 7's numbers)
const elec = (zone, state, size, si) => (zone === 8 ? 7 : zone) * 1000 + STATE_IDX[state] * 100 + sizeNo(size) * 10 + si + 0.5;
const gas = (state, size, si) => 10000 + STATE_IDX[state] * 1000 + sizeNo(size) * 100 + si * 10 + 0.25;
const saVal = (zi, size, si) => 500 + zi * 100 + sizeNo(size) * 10 + si + 0.75;
const SEASON_IDX = { Summer: 0, Autumn: 1, Winter: 2, Spring: 3 };

const strings = [];
const sidx = new Map();
const si = (s) => (sidx.has(s) ? sidx.get(s) : (sidx.set(s, strings.length), strings.push(s), strings.length - 1));
const col = (i) => String.fromCharCode(65 + i);
function sheetXml(rows) {
  const body = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          if (v === null || v === undefined) return "";
          const ref = `${col(ci)}${ri + 1}`;
          return typeof v === "number" ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${si(String(v))}</v></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

const sheets = [];
sheets.push(["Cover page", [[null, "Simple electricity and gas benchmarks (synthetic test fixture, not AER data)"]]]);
sheets.push(["Instructions", [[null, "Instructions"], [null, "Seasons", "Months in season"], [null, "Summer", "December, January and February"]]]);
sheets.push(["Electricity >", []]);
const longHead = (title, name, valueHead, regionHead) => [
  [null, title],
  [null, name],
  [],
  [null, "Geographical pooling", "Synthetic"],
  [null, "Household pooling", "Synthetic"],
  [],
  [],
  [null, "Season", regionHead, "Household size", valueHead],
];
for (let z = 1; z <= 8; z++) {
  const rows = longHead("Simple electricity benchmarks", `Climate Zone ${z}`, "Benchmark (kWh)", "State");
  for (const state of ZONE_STATES[z]) for (const s of SEASONS) for (const size of SIZES) rows.push([null, s, state, size, elec(z, state, size, SEASON_IDX[s])]);
  sheets.push([`Climate zone ${z}`, rows]);
}
const sa = [[null, "Simple electricity benchmarks"], [null, "South Australian zones"], [], [null, "Synthetic"], [], [null, "South Autralian zones", "Household size", "Summer (kWh)", "Autumn (kWh)", "Winter (kWh)", "Spring (kWh)"]];
SA_ZONES.forEach((z, zi) => SIZES.forEach((size) => sa.push([null, z, size, saVal(zi, size, 0), saVal(zi, size, 1), saVal(zi, size, 2), saVal(zi, size, 3)])));
sheets.push(["SA zones", sa]);
// Postcode -> climate zone, and SA postcode -> SA zone (the two lists sit side by side, as in the AER file).
const climate = [
  [2000, 5], [2618, 6], [2800, 4], [2600, 7], [3000, 6], [3550, 4], [4000, 2], [4870, 1], [4700, 3], [5000, 4], [5700, 5], [7000, 7],
];
const saList = [[5000, "Adelaide & Environs"], [5700, "Far North"]];
const pm = [[null, "Simple electricity benchmarks"], [null, "Postcode to localised zone mapping"], [], [null, "Synthetic"], [], [null, "Postcode", "Climate Zone", null, "Postcode", "South Australian zone"]];
for (let i = 0; i < climate.length; i++) pm.push([null, climate[i][0], climate[i][1], null, saList[i]?.[0] ?? null, saList[i]?.[1] ?? null]);
sheets.push(["Postcode mapping", pm]);
sheets.push(["Gas >", []]);
for (const state of ["ACT", "NSW", "QLD", "SA", "TAS", "VIC"]) {
  const rows = longHead("Simple gas benchmarks", state, "Benchmark (MJ)", "Region");
  for (const s of SEASONS) for (const size of SIZES) rows.push([null, s, state, size, gas(state, size, SEASON_IDX[s])]);
  sheets.push([state, rows]);
}

const files = {};
sheets.forEach(([, rows], i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(rows))));
files["xl/sharedStrings.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`);
files["xl/workbook.xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([n], i) => `<sheet name="${n.replace(/&/g, "&amp;")}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`);
files["xl/_rels/workbook.xml.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
files["_rels/.rels"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
files["[Content_Types].xml"] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`);
writeFileSync(new URL("./aer_benchmarks_synthetic.xlsx", import.meta.url), Buffer.from(zipSync(files, { mtime: new Date("2026-01-01T00:00:00Z") })));
console.log("wrote aer_benchmarks_synthetic.xlsx");
