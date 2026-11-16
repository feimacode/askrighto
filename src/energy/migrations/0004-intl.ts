/** Migration 0004: international student courses from CRICOS (add-intl-course-data). Separate from the domestic `courses` table. */
export const sql = `
CREATE TABLE intl_providers (
  id      text PRIMARY KEY,
  name    text NOT NULL,
  website text
);

CREATE TABLE intl_courses (
  cricos_code       text PRIMARY KEY,
  provider_id       text NOT NULL REFERENCES intl_providers(id),
  name              text NOT NULL,
  level             text NOT NULL,
  level_group       text NOT NULL,
  field             text,
  duration_weeks    integer,
  tuition_fee_total numeric(12,2),
  non_tuition_fee   numeric(12,2),
  language          text,
  work_component    boolean,
  expired           boolean NOT NULL DEFAULT false
);
CREATE INDEX intl_courses_level_group ON intl_courses (level_group);
CREATE INDEX intl_courses_provider ON intl_courses (provider_id);

CREATE TABLE intl_course_locations (
  cricos_code text NOT NULL REFERENCES intl_courses(cricos_code) ON DELETE CASCADE,
  state       text NOT NULL,
  campus      text NOT NULL,
  PRIMARY KEY (cricos_code, state, campus)
);

CREATE TABLE intl_loads (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source_file text NOT NULL,
  source_date date NOT NULL,
  git_sha     text,
  row_count   integer NOT NULL,
  report      jsonb NOT NULL DEFAULT '{}'
);
`;
