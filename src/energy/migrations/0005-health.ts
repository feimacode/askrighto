/** Migration 0005: private health cover products from the PHIO monthly file (add-health-cover-data). */
export const sql = `
CREATE TABLE health_insurers (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  fund_type        text,
  restriction_hint text
);

-- One row per product variant (the file's Product element): id is the file's ProductID.
-- Cover per clinical category is one letter each (C, R, N) in cover_codes, in the order of health_loads.category_titles.
CREATE TABLE health_products (
  id          text PRIMARY KEY,
  insurer_id  text NOT NULL REFERENCES health_insurers(id),
  code        text NOT NULL,
  name        text NOT NULL,
  kind        text NOT NULL,
  status      text NOT NULL DEFAULT 'open',
  tier        text,
  state       text,
  household   text,
  dependants_covered text[],
  excess_type text,
  excess_per_admission_cents integer,
  excess_per_person_cents    integer,
  excess_per_policy_cents    integer,
  excess_cents integer,
  copayment_type text,
  mls_exempt  boolean,
  corporate   boolean NOT NULL DEFAULT false,
  only_available_with text,
  info_url    text,
  premium_cents integer,
  hospital_component_cents integer,
  cover_codes text NOT NULL DEFAULT '',
  waiting     jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX health_products_insurer ON health_products (insurer_id);
CREATE INDEX health_products_state ON health_products (state);

CREATE TABLE health_loads (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source_file text NOT NULL,
  source_date date NOT NULL,
  file_hash   text NOT NULL,
  git_sha     text,
  row_count   integer NOT NULL,
  category_titles jsonb NOT NULL DEFAULT '[]',
  report      jsonb NOT NULL DEFAULT '{}'
);
`;
