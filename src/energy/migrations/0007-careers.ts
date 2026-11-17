/** Migration 0007: occupation employment projections from the JSA file (add-career-outcomes-data). */
export const sql = `
-- One row per row of the file's occupation unit group table, as published.
-- Employment figures are in thousands of people, exactly as the file states; percentages are fractions (0.0766 = 7.66%).
CREATE TABLE career_occupations (
  code        text NOT NULL,
  level       smallint NOT NULL,
  nfd         boolean NOT NULL DEFAULT false,
  name        text NOT NULL,
  skill_level text,
  baseline_k  numeric,
  proj_mid_k  numeric,
  proj_end_k  numeric,
  change5_k   numeric,
  change5_pct numeric,
  change10_k  numeric,
  change10_pct numeric,
  PRIMARY KEY (level, code, nfd)
);
CREATE INDEX career_occupations_code ON career_occupations (code);

CREATE TABLE career_loads (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source_file text NOT NULL,
  source_date date NOT NULL,
  file_hash   text NOT NULL,
  git_sha     text,
  row_count   integer NOT NULL,
  baseline_label text NOT NULL,
  mid_label   text NOT NULL,
  end_label   text NOT NULL,
  classification text NOT NULL,
  report      jsonb NOT NULL DEFAULT '{}'
);
`;
