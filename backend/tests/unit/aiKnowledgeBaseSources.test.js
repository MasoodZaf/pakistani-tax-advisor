/**
 * What the AI tax consultant is allowed to be grounded on.
 *
 * The consultant's knowledge base was found ingesting the app's own
 * engineering documents and citing them, by filename, to practising tax
 * consultants. They are not tax law:
 *
 *   - TAX_APP_CORRECTIONS_AND_ROADMAP.md carries headings like "Wrong Tax
 *     Slabs Throughout" and spells out SUPERSEDED TY2024-25 rates in prose.
 *     Retrieval is keyword-scored with no IDF, so a question about slab rates
 *     competes directly with a chunk describing rates the app got wrong.
 *   - AUDIT_REPORT_2026-05-17.md contains security findings, including
 *     "Hardcoded super-admin credentials in committed setup script".
 *   - TAX_CONSULTANT_GUIDE.md is, despite its name, a software spec including
 *     Python source for encryption.py, auth.py and rate_limiting.py.
 *
 * This is a policy test. It fails loudly if anyone re-adds them.
 */
// knowledgeBase pulls in the DB pool (for live rate lookups) and the logger.
// This test only inspects a static constant, so stub both rather than require
// a database to assert a policy.
jest.mock('../../src/config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const kb = require('../../src/services/aiConsultant/knowledgeBase');

// Substrings that identify an internal engineering document. Matching is on
// the substring so renames like AUDIT_REPORT_2026-11-02.md are still caught.
const BANNED_SUBSTRINGS = [
  'AUDIT_REPORT',
  'APP-SNAPSHOT',
  'CORRECTIONS_AND_ROADMAP',
  'CROSS_FORM_DATA_FLOW',
  'IMPLEMENTATION_PROGRESS',
  'COMPLIANCE_AUDIT',
  'COMPLIANCE_VERIFICATION',
  'EXCEL_RECONCILIATION',
  'CONSULTANT_GUIDE',
  'REMEDIATION',
  'STRESS_TEST',
  'PRODUCTION_READINESS',
  'DEPLOYMENT',
  'RUNBOOK',
];

describe('AI consultant knowledge sources', () => {
  test('no repo engineering document is ingested as default knowledge', () => {
    const offenders = (kb.DEFAULT_REPO_DOCS || []).filter((doc) =>
      BANNED_SUBSTRINGS.some((banned) => doc.toUpperCase().includes(banned))
    );
    expect(offenders).toEqual([]);
  });

  test('DEFAULT_REPO_DOCS is empty — knowledge is uploaded deliberately, not scavenged from the repo root', () => {
    // If you are here because you legitimately want a curated document in the
    // consultant's knowledge, upload it via the admin KB screen so the choice
    // has a named owner. Do not reintroduce repo-root scanning: that is how
    // the defect log ended up being cited as tax guidance.
    expect(kb.DEFAULT_REPO_DOCS).toEqual([]);
  });
});
