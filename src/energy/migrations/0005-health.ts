/** Migration 0005: private health cover products from the PHIO monthly file (add-health-cover-data). */
export const sql = `
CREATE TABLE health_insurers (
  id   text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE health_products (
  id          text PRIMARY KEY,
  insurer_id  text NOT NULL REFERENCES health_insurers(id),
  code        text NOT NULL,
  name        text NOT NULL,
  kind        text NOT NULL,
  tier        text,
  state       text,
  household   text,
  excess_cents integer,
  excess_type text,
  info_url    text,
  premiums    jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX health_products_insurer ON health_products (insurer_id);
CREATE INDEX health_products_state ON health_products (state);

CREATE TABLE health_product_categories (
  product_id text NOT NULL REFERENCES health_products(id) ON DELETE CASCADE,
  code       text NOT NULL,
  label      text NOT NULL,
  cover      text NOT NULL,
  PRIMARY KEY (product_id, code)
);

CREATE TABLE health_waiting_periods (
  product_id text NOT NULL REFERENCES health_products(id) ON DELETE CASCADE,
  type       text NOT NULL,
  months     integer NOT NULL,
  PRIMARY KEY (product_id, type)
);

CREATE TABLE health_loads (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source_file text NOT NULL,
  source_date date NOT NULL,
  file_hash   text NOT NULL,
  git_sha     text,
  row_count   integer NOT NULL,
  report      jsonb NOT NULL DEFAULT '{}'
);
`;
