const express = require('express');
const jwtAuth = require('../../../middleware/auth'); // Standardized JWT middleware

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
 * requireAdmin — chains JWT verification then checks admin role.
 * Sets req.user (from jwtAuth) — all routes use req.user instead of req.user.
 */
const requireAdmin = [
  jwtAuth,
  (req, res, next) => {
    if (!['admin', 'super_admin'].includes(req.user?.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required',
      });
    }
    next();
  },
];

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
