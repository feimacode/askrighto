/** Migration 0005: home loan products from CDR banking product data (add-home-loan-data). */
export const sql = `
CREATE TABLE home_loan_lenders (
  slug               text PRIMARY KEY,
  brand_name         text NOT NULL,
  base_uri           text NOT NULL,
  active             boolean NOT NULL DEFAULT true,
  last_sync_at       timestamptz,
  last_sync_ok       boolean,
  last_product_count integer,
  last_error         text
);

CREATE TABLE home_loan_products (
  lender_slug         text NOT NULL REFERENCES home_loan_lenders(slug),
  product_id          text NOT NULL,
  name                text NOT NULL,
  description         text NOT NULL DEFAULT '',
  is_tailored         boolean NOT NULL DEFAULT false,
  effective_from      timestamptz,
  effective_to        timestamptz,
  understood          boolean NOT NULL,
  not_understood      text[] NOT NULL DEFAULT '{}',
  detail              jsonb NOT NULL,
  raw                 jsonb NOT NULL,
  detail_hash         text NOT NULL,
  source_last_updated timestamptz NOT NULL,
  fetched_at          timestamptz NOT NULL,
  verified_at         timestamptz NOT NULL,
  PRIMARY KEY (lender_slug, product_id)
);
CREATE INDEX home_loan_products_verified ON home_loan_products (verified_at);
CREATE INDEX home_loan_products_understood ON home_loan_products (understood);

CREATE TABLE home_loan_changes (
  id                  bigserial PRIMARY KEY,
  lender_slug         text NOT NULL,
  product_id          text NOT NULL,
  changed_at          timestamptz NOT NULL,
  source_last_updated timestamptz NOT NULL,
  detail_hash         text NOT NULL,
  silent              boolean NOT NULL DEFAULT false
);

CREATE TABLE home_loan_sync_runs (
  id          bigserial PRIMARY KEY,
  started_at  timestamptz NOT NULL,
  finished_at timestamptz,
  ok          boolean,
  report      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE reference_rates (
  series         text NOT NULL,
  effective_date date NOT NULL,
  value_pct      numeric(7,4) NOT NULL,
  source_url     text NOT NULL,
  fetched_at     timestamptz NOT NULL,
  PRIMARY KEY (series, effective_date)
);
`;
