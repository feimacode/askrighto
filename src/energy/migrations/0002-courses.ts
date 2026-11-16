/** Migration 0002: Victorian course index and curated facts (add-vic-course-data). */
export const sql = `
CREATE TABLE providers (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  courses_url          text NOT NULL,
  search_url           text,
  cricos_provider_code text
);

CREATE TABLE courses (
  id                text PRIMARY KEY,
  provider_id       text NOT NULL REFERENCES providers (id),
  origin            text NOT NULL CHECK (origin IN ('cricos', 'gap_fill')),
  depth             text NOT NULL CHECK (depth IN ('index_only', 'curated')),
  name              text NOT NULL,
  level             text NOT NULL,
  fields            text[] NOT NULL DEFAULT '{}',
  duration_years    numeric(4,2),
  cricos_code       text,
  vtac_code         text,
  official_url      text,
  course_seeker_url text,
  found_at          text,
  summary           text,
  checked_on        date,
  checked_by        text,
  other_criteria    jsonb NOT NULL DEFAULT '[]',
  from_cricos       boolean NOT NULL DEFAULT false
);
CREATE INDEX courses_provider ON courses (provider_id);
CREATE INDEX courses_fields_gin ON courses USING gin (fields);
CREATE INDEX courses_name_lower ON courses (lower(name));

CREATE TABLE course_campuses (
  course_id text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  campus    text NOT NULL,
  mode      text,
  PRIMARY KEY (course_id, campus)
);

CREATE TABLE course_entry_figures (
  course_id   text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  kind        text NOT NULL,
  value       numeric(5,2) NOT NULL,
  intake_year integer NOT NULL,
  campus      text NOT NULL DEFAULT '',
  source_url  text NOT NULL,
  checked_on  date NOT NULL,
  PRIMARY KEY (course_id, kind, intake_year, campus)
);
CREATE INDEX course_entry_figures_year ON course_entry_figures (course_id, intake_year);

CREATE TABLE course_prerequisites (
  course_id       text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  applies_to_year integer NOT NULL,
  text            text NOT NULL,
  rules           jsonb NOT NULL,
  source_url      text NOT NULL,
  checked_on      date NOT NULL,
  PRIMARY KEY (course_id, applies_to_year)
);

CREATE TABLE cricos_raw (
  cricos_code   text PRIMARY KEY,
  provider_code text NOT NULL,
  provider_name text,
  course_name   text NOT NULL,
  level         text,
  duration_weeks integer,
  locations     text[] NOT NULL DEFAULT '{}',
  loaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_loads (
  id           bigserial PRIMARY KEY,
  loaded_at    timestamptz NOT NULL DEFAULT now(),
  git_sha      text,
  course_count integer NOT NULL,
  figure_count integer NOT NULL,
  report       jsonb NOT NULL
);
`;
