/** Migration 0009: sector and VET National Code on international courses (add-intl-diplomas-vet). */
export const sql = `
ALTER TABLE intl_courses ADD COLUMN sector text;
ALTER TABLE intl_courses ADD COLUMN vet_national_code text;
`;
