/** Migration 0001: energy plan tables. Runs with search_path set to the Ask Righto schema. */
export const sql = `
CREATE TABLE retailers (
  slug            text PRIMARY KEY,
  brand_name      text NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  last_sync_at    timestamptz,
  last_sync_ok    boolean,
  last_plan_count integer,
  last_error      text
);

CREATE TABLE coverage_sets (
  id                 bigserial PRIMARY KEY,
  hash               text NOT NULL UNIQUE,
  included_postcodes integer[] NOT NULL,
  excluded_postcodes integer[] NOT NULL DEFAULT '{}',
  distributors       text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX coverage_sets_postcodes_gin ON coverage_sets USING gin (included_postcodes);

CREATE TABLE plans (
  plan_id             text PRIMARY KEY,
  retailer_slug       text NOT NULL REFERENCES retailers(slug),
  brand_name          text NOT NULL,
  display_name        text NOT NULL,
  fuel_type           text NOT NULL,
  plan_type           text NOT NULL,
  customer_type       text NOT NULL,
  coverage_id         bigint NOT NULL REFERENCES coverage_sets(id),
  effective_from      timestamptz,
  effective_to        timestamptz,
  plan_url            text,
  source_last_updated timestamptz NOT NULL,
  fetched_at          timestamptz NOT NULL,
  verified_at         timestamptz NOT NULL,
  understood          boolean NOT NULL,
  not_understood      text[] NOT NULL DEFAULT '{}',
  contract            jsonb NOT NULL,
  raw                 jsonb NOT NULL,
  detail_hash         text NOT NULL
);
CREATE INDEX plans_coverage_idx ON plans (coverage_id);
CREATE INDEX plans_retailer_idx ON plans (retailer_slug);
CREATE INDEX plans_fuel_type_idx ON plans (fuel_type, plan_type);
CREATE INDEX plans_verified_idx ON plans (verified_at);

CREATE TABLE plan_changes (
  id                  bigserial PRIMARY KEY,
  plan_id             text NOT NULL,
  changed_at          timestamptz NOT NULL,
  source_last_updated timestamptz,
  detail_hash         text NOT NULL,
  silent              boolean NOT NULL DEFAULT false
);
CREATE INDEX plan_changes_plan_idx ON plan_changes (plan_id);

CREATE TABLE sync_runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL,
  finished_at timestamptz,
  ok          boolean,
  report      jsonb
);
`;
