const express = require('express');
const multer = require('multer');
const { requireStaff, requireElevated } = require('../../../middleware/roleGuard');

const {
  getUsers,
  updateUserStatus,
  createUser,
  updateUser,
  deleteUser,
  getUser,
  getUserTaxRecords,
  updateUserTaxForm,
  getUserCredentials,
  getUserLoginCredentials,
  updateUserRole,
} = require('../controllers/usersController');
const {
  bulkImportTemplate,
  bulkImportUsers,
  bulkDeleteUsers,
} = require('../controllers/bulkUsersController');
const { getStats, getAuditLogs } = require('../controllers/statsController');
const {
  getTaxYears,
  updateTaxYearStatus,
  createTaxYear,
  updateTaxYear,
} = require('../controllers/taxYearsController');
const {
  getTaxSlabs,
  getTaxSlabTypes,
  createTaxSlab,
  updateTaxSlab,
  deleteTaxSlab,
  cloneTaxSlabs,
  previewTaxSlabs,
} = require('../controllers/taxSlabsController');
const { impersonateUser, endImpersonation } = require('../controllers/impersonationController');
const { calculateTax } = require('../controllers/taxCalculatorController');
const {
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  resetAdminPassword,
} = require('../controllers/adminAccountsController');

const router = express.Router();

/**
 * requireAdmin — staff-tier gate (admin + super_admin + tax_consultant).
 * Now delegates to the shared roleGuard so the three staff tiers live in one
 * place. tax_consultant is included here at the route level; the powerful
 * operations (impersonate, delete, bulk, playbook) are additionally gated to the
 * `elevated` tier, and rate/role/admin-account changes to `superAdmin`, via the
 * in-controller checks and the dedicated tiers below.
 */
const requireAdmin = requireStaff;

// In-memory upload for the bulk-import .xlsx (10 MB cap, matches the other
// admin upload surfaces).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// --- Bulk user operations (super_admin + tax_consultant) ----------------------
// Registered BEFORE `/users/:id` so the literal paths aren't captured by the
// `:id` param route. Bulk import/delete are gated to the elevated tier.
router.get('/users/bulk-template', requireElevated, bulkImportTemplate);
router.post('/users/bulk-import', requireElevated, upload.single('file'), bulkImportUsers);
router.post('/users/bulk-delete', requireElevated, bulkDeleteUsers);

// Get all users (admin only)
router.get('/users', requireAdmin, getUsers);

// Get system statistics
router.get('/stats', requireAdmin, getStats);

// Get all tax years
router.get('/tax-years', requireAdmin, getTaxYears);

// Update tax year status
router.put('/tax-years/:id/status', requireAdmin, updateTaxYearStatus);

// `POST /tax-years` previously had two definitions — Express matched the
// first, so the older un-restricted handler shadowed the super-admin gate
// added at line ~1802. The richer handler (with `description` + audit) is
// kept; this stub has been removed.

// Update user status (activate/deactivate)
router.put('/users/:id/status', requireAdmin, updateUserStatus);

// `GET /audit-logs` previously had two definitions — the older handler
// (without the super-admin gate or the richer category/search filters)
// was shadowing the proper one. Removed; the live handler is at line ~1990.

// Create new user (Super Admin only)
router.post('/users', requireAdmin, createUser);

// Update user (Admin can edit users, Super Admin can edit everything)
router.put('/users/:id', requireAdmin, updateUser);

// Delete user (Super Admin only)
router.delete('/users/:id', requireAdmin, deleteUser);

// Get single user details (Admin only)
router.get('/users/:id', requireAdmin, getUser);

// Tax Calculator endpoint for admin
router.post('/tax-calculator', requireAdmin, calculateTax);

// Get user tax records for admin
router.get('/users/:id/tax-records', requireAdmin, getUserTaxRecords);

// Update user tax form data (admin as tax consultant)
router.put('/users/:userId/tax-forms/:formType', requireAdmin, updateUserTaxForm);

// Get all users with login credentials (Super Admin only)
router.get('/user-credentials', requireAdmin, getUserCredentials);

// Get user login credentials for manual login (Super Admin only)
router.get('/user-login-credentials/:userId', requireAdmin, getUserLoginCredentials);

// Impersonate user (Super Admin only)
router.post('/impersonate/:userId', requireAdmin, impersonateUser);

// End impersonation (return to admin) — requires valid JWT
// end-impersonation is called WITH the impersonation token — whose role is
// 'user', not 'admin'. `requireAdmin` would reject it. We validate the JWT
// manually and enforce the real gate: isImpersonation=true AND actingAdminId
// resolves to an admin row.
router.post('/end-impersonation', endImpersonation);

// ─────────────────────────────────────────────────────────────────
// TAX SLABS MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/tax-slabs?taxYearId=&slabType=
router.get('/tax-slabs', requireAdmin, getTaxSlabs);

// GET /api/admin/tax-slabs/types  — distinct slab_types in use
router.get('/tax-slabs/types', requireAdmin, getTaxSlabTypes);

// POST /api/admin/tax-slabs  — create slab (super_admin only)
router.post('/tax-slabs', requireAdmin, createTaxSlab);

// PUT /api/admin/tax-slabs/:id  — update slab (super_admin only)
router.put('/tax-slabs/:id', requireAdmin, updateTaxSlab);

// DELETE /api/admin/tax-slabs/:id  (super_admin only)
router.delete('/tax-slabs/:id', requireAdmin, deleteTaxSlab);

// POST /api/admin/tax-slabs/clone  — copy all slabs from one year to another (super_admin only)
router.post('/tax-slabs/clone', requireAdmin, cloneTaxSlabs);

// POST /api/admin/tax-slabs/preview  — calculate tax with current slabs for test income
router.post('/tax-slabs/preview', requireAdmin, previewTaxSlabs);

// ─────────────────────────────────────────────────────────────────
// USER ROLE MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

router.put('/users/:id/role', requireAdmin, updateUserRole);

// ─────────────────────────────────────────────────────────────────
// TAX YEAR MANAGEMENT (Admin+ can read, super_admin can write)
// ─────────────────────────────────────────────────────────────────

router.post('/tax-years', requireAdmin, createTaxYear);

router.put('/tax-years/:id', requireAdmin, updateTaxYear);

// ─────────────────────────────────────────────────────────────────
// ADMIN ACCOUNT MANAGEMENT (Super Admin only)
// ─────────────────────────────────────────────────────────────────

// GET /api/admin/admin-accounts  — list all admin + super_admin users
router.get('/admin-accounts', requireAdmin, listAdminAccounts);

// POST /api/admin/admin-accounts  — create new admin account (super_admin only)
router.post('/admin-accounts', requireAdmin, createAdminAccount);

// PUT /api/admin/admin-accounts/:id  — update admin account (super_admin only)
router.put('/admin-accounts/:id', requireAdmin, updateAdminAccount);

// POST /api/admin/admin-accounts/:id/reset-password  — reset admin password (super_admin only)
router.post('/admin-accounts/:id/reset-password', requireAdmin, resetAdminPassword);

// ─────────────────────────────────────────────────────────────────
// AUDIT LOGS (read-only)
// ─────────────────────────────────────────────────────────────────

router.get('/audit-logs', requireAdmin, getAuditLogs);

module.exports = router;
