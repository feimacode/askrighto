/** Migration 0008: AER simple electricity and gas benchmarks (add-energy-benchmark-usage). */
export const sql = `
-- One row per (fuel, zone, state, household size, season), exactly as the AER workbook publishes it.
-- Electricity: zone is the climate zone number ('1'..'8') or, for South Australia, the SA zone name.
-- Gas: zone is the state sheet name. Values are kWh (electricity) or MJ (gas) per season, full precision.
-- household_size 5 means "5+".
CREATE TABLE energy_benchmarks (
  fuel           text NOT NULL CHECK (fuel IN ('ELECTRICITY','GAS')),
  zone           text NOT NULL,
  state          text NOT NULL,
  household_size smallint NOT NULL CHECK (household_size BETWEEN 1 AND 5),
  season         text NOT NULL CHECK (season IN ('Summer','Autumn','Winter','Spring')),
  value          numeric NOT NULL CHECK (value > 0),
  unit           text NOT NULL CHECK (unit IN ('kWh','MJ')),
  source_sheet   text NOT NULL,
  PRIMARY KEY (fuel, zone, state, household_size, season)
);

-- The workbook's postcode sheet: climate zone (nullable if the postcode is only in the SA list) and SA zone.
CREATE TABLE energy_benchmark_postcodes (
  postcode     text PRIMARY KEY CHECK (postcode ~ '^[0-9]{4}$'),
  climate_zone smallint,
  sa_zone      text,
  CHECK (climate_zone IS NOT NULL OR sa_zone IS NOT NULL)
);

CREATE TABLE energy_benchmark_load (
  id             bigserial PRIMARY KEY,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  source_file    text NOT NULL,
  source_date    date NOT NULL,
  release_label  text NOT NULL,
  file_hash      text NOT NULL,
  git_sha        text,
  benchmark_rows integer NOT NULL,
  postcode_rows  integer NOT NULL,
  report         jsonb NOT NULL DEFAULT '{}'
);
`;
