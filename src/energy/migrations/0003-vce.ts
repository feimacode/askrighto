/** Migration 0003: VCE admissions data (add-vce-admissions-data). Rows hold one validated document each. */
export const sql = `
CREATE TABLE vce_key_dates (
  admissions_year integer NOT NULL,
  key             text NOT NULL,
  doc             jsonb NOT NULL,
  PRIMARY KEY (admissions_year, key)
);

CREATE TABLE vce_preference_rules (
  id  text PRIMARY KEY,
  doc jsonb NOT NULL
);

CREATE TABLE vce_early_entry (
  id              text PRIMARY KEY,
  university      text NOT NULL,
  admissions_year integer NOT NULL,
  doc             jsonb NOT NULL
);

CREATE TABLE vce_scaling (
  study_year integer NOT NULL,
  study_id   text NOT NULL,
  doc        jsonb NOT NULL,
  PRIMARY KEY (study_year, study_id)
);

CREATE TABLE vce_study_groupings (
  study_year integer PRIMARY KEY,
  doc        jsonb NOT NULL
);

CREATE TABLE vce_loads (
  id        bigserial PRIMARY KEY,
  dataset   text NOT NULL,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  git_sha   text,
  row_count integer NOT NULL,
  report    jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX vce_loads_dataset ON vce_loads (dataset, loaded_at DESC);
`;
