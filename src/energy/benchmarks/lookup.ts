/** Turns (postcode, fuel, household size) into the AER benchmark for that place. Pure over loaded data. */
import { stateOfPostcode } from "./state.js";
import { BENCHMARK_SOURCE, SEASONS, type BenchFuel, type BenchmarkData, type BenchmarkRow, type Season } from "./types.js";

export interface BenchmarkFigure {
  fuel: BenchFuel;
  unit: "kWh" | "MJ";
  postcode: string;
  state: string;
  /** Human label: "climate zone 4", "South Australian zone Adelaide & Environs" or "NSW gas". */
  zoneLabel: string;
  zoneKind: "climate_zone" | "sa_zone" | "gas_state";
  /** Raw zone key as in the workbook. */
  zone: string;
  householdSize: 1 | 2 | 3 | 4 | 5;
  /** True for "5 or more". */
  fiveOrMore: boolean;
  /** Seasonal values exactly as published. */
  seasons: Record<Season, number>;
  /** Sum of the four seasons. */
  annual: number;
  sourceSheet: string;
  sourceFile: string;
  releaseLabel: string;
  releaseDate: Date;
  source: { name: string; url: string; licence: string };
  attribution: string;
}

export type BenchmarkLookup =
  | { ok: true; figure: BenchmarkFigure }
  | { ok: false; reason: "outside_coverage" | "not_in_dataset"; detail: string };

const NOT_COVERED = "The AER benchmarks cover NSW, VIC, QLD, SA, TAS and the ACT. Western Australia and the Northern Territory are outside the National Electricity Market and are not covered.";

export function lookupBenchmark(data: BenchmarkData, q: { postcode: string; fuel: BenchFuel; householdSize: number }): BenchmarkLookup {
  const size = Math.trunc(q.householdSize);
  if (!(size >= 1 && size <= 5)) return { ok: false, reason: "not_in_dataset", detail: "Household size must be 1 to 5 (5 means five or more)." };
  const state = stateOfPostcode(q.postcode);
  if (!state || state === "WA" || state === "NT") return { ok: false, reason: "outside_coverage", detail: NOT_COVERED };
  const pc = data.postcodes.find((p) => p.postcode === q.postcode);
  if (!pc) return { ok: false, reason: "outside_coverage", detail: `Postcode ${q.postcode} is not in the AER's postcode-to-zone list.` };

  let zone: string;
  let zoneKind: BenchmarkFigure["zoneKind"];
  let zoneLabel: string;
  if (q.fuel === "GAS") {
    zone = state;
    zoneKind = "gas_state";
    zoneLabel = `${state} gas`;
  } else if (state === "SA") {
    if (!pc.saZone) return { ok: false, reason: "outside_coverage", detail: `Postcode ${q.postcode} has no South Australian zone in the AER's list.` };
    zone = pc.saZone;
    zoneKind = "sa_zone";
    zoneLabel = `South Australian zone ${pc.saZone}`;
  } else {
    if (pc.climateZone === undefined) return { ok: false, reason: "outside_coverage", detail: `Postcode ${q.postcode} has no climate zone in the AER's list.` };
    zone = String(pc.climateZone);
    zoneKind = "climate_zone";
    zoneLabel = `climate zone ${pc.climateZone}`;
  }
  const rows = data.rows.filter((r) => r.fuel === q.fuel && r.zone === zone && r.state === state && r.size === size);
  const by = new Map<Season, BenchmarkRow>(rows.map((r) => [r.season, r]));
  if (SEASONS.some((s) => !by.has(s))) {
    return { ok: false, reason: "outside_coverage", detail: `The AER has no ${q.fuel.toLowerCase()} benchmark for ${state} in ${zoneLabel}.` };
  }
  const seasons = Object.fromEntries(SEASONS.map((s) => [s, by.get(s)!.value])) as Record<Season, number>;
  const first = by.get("Summer")!;
  return {
    ok: true,
    figure: {
      fuel: q.fuel,
      unit: first.unit,
      postcode: q.postcode,
      state,
      zoneLabel,
      zoneKind,
      zone,
      householdSize: size as BenchmarkFigure["householdSize"],
      fiveOrMore: size === 5,
      seasons,
      annual: SEASONS.reduce((a, s) => a + seasons[s], 0),
      sourceSheet: first.sheet,
      sourceFile: data.sourceFile,
      releaseLabel: data.releaseLabel,
      releaseDate: data.sourceDate,
      source: { name: BENCHMARK_SOURCE.name, url: BENCHMARK_SOURCE.url, licence: BENCHMARK_SOURCE.licence },
      attribution: BENCHMARK_SOURCE.attribution,
    },
  };
}
