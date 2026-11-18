export type BenchFuel = "ELECTRICITY" | "GAS";
export const SEASONS = ["Summer", "Autumn", "Winter", "Spring"] as const;
export type Season = (typeof SEASONS)[number];
export type BenchState = "NSW" | "VIC" | "QLD" | "SA" | "TAS" | "ACT";

/** One published value. `size` 5 means "5+". */
export interface BenchmarkRow {
  fuel: BenchFuel;
  /** Climate zone number as text ("1".."8"), the SA zone name, or (gas) the state sheet name. */
  zone: string;
  state: string;
  size: 1 | 2 | 3 | 4 | 5;
  season: Season;
  value: number;
  unit: "kWh" | "MJ";
  sheet: string;
}

export interface PostcodeRow {
  postcode: string;
  climateZone?: number;
  saZone?: string;
}

export interface BenchmarkData {
  rows: BenchmarkRow[];
  postcodes: PostcodeRow[];
  sourceFile: string;
  sourceDate: Date;
  releaseLabel: string;
  loadedAt: Date;
}

export interface BenchmarkSource {
  data(): Promise<BenchmarkData>;
  clear?(): void;
}

export const BENCHMARK_SOURCE = {
  name: "Australian Energy Regulator, Simple electricity and gas benchmarks (analysis by Frontier Economics)",
  url: "https://www.aer.gov.au/documents/frontier-economics-simple-electricity-and-gas-benchmarks-june-2021",
  licence: "CC BY 4.0 (AER website general statement)",
  attribution: "Source: AER © Commonwealth of Australia, simple electricity and gas benchmarks (analysis by Frontier Economics), CC BY 4.0. Values re-keyed unchanged.",
} as const;
