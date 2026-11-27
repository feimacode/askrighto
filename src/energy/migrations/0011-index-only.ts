/**
 * Migration 0011: index-only courses and home loans (switch-to-index-only).
 * Drops the tables that held facts taken from licence-heavy or regulated sources: course entry figures and
 * prerequisites, admissions-centre codes, VCE admissions data, and stored CDR home loan products and the RBA rate.
 * Kept: the CRICOS-backed course index (providers, courses, course_campuses, cricos_raw, course_loads).
 * Energy tables are untouched. The dropped data is rebuildable only from the retired YAML and sync code.
 */
export const sql = `
DROP TABLE IF EXISTS course_entry_figures;
DROP TABLE IF EXISTS course_prerequisites;
DROP TABLE IF EXISTS course_admissions;
DROP TABLE IF EXISTS vce_key_dates;
DROP TABLE IF EXISTS vce_preference_rules;
DROP TABLE IF EXISTS vce_early_entry;
DROP TABLE IF EXISTS vce_scaling;
DROP TABLE IF EXISTS vce_study_groupings;
DROP TABLE IF EXISTS home_loan_changes;
DROP TABLE IF EXISTS home_loan_products;
DROP TABLE IF EXISTS home_loan_sync_runs;
DROP TABLE IF EXISTS home_loan_lenders;
DROP TABLE IF EXISTS reference_rates;
`;
