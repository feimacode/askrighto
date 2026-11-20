/** Migration 0010: region on providers and admissions centre codes on courses (extend-courses-to-uac-qtac). */
export const sql = `
ALTER TABLE providers ADD COLUMN region text NOT NULL DEFAULT 'vic';

CREATE TABLE course_admissions (
  course_id text NOT NULL REFERENCES courses (id) ON DELETE CASCADE,
  centre    text NOT NULL CHECK (centre IN ('vtac', 'uac', 'qtac')),
  code      text NOT NULL,
  PRIMARY KEY (course_id, centre, code)
);

INSERT INTO course_admissions (course_id, centre, code)
SELECT id, 'vtac', vtac_code FROM courses WHERE vtac_code IS NOT NULL;
`;
