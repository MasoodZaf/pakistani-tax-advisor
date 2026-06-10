// roleGuard — shared staff-role authorization tiers for the admin + tax-consultant
// surfaces. Replaces the per-file inline `requireAdmin` arrays so the three tiers
// are defined once and used consistently across admin.js, playbook.js, taxRates.js,
// etc. Each tier chains the standard JWT middleware first, then checks req.user.role.
//
// Tiers (see phase-z6-tax-consultant.sql for the rationale):
//   requireStaff      — admin + super_admin + tax_consultant   (general admin surface)
//   requireElevated   — super_admin + tax_consultant           (impersonate, delete,
//                                                                bulk ops, AI playbook)
//   requireSuperAdmin — super_admin only                       (rates/slabs/bundle,
//                                                                user-role changes,
//                                                                admin-account mgmt)
//
// tax_consultant deliberately sits in `elevated` but NOT in `superAdmin`: it gets
// super-admin-equivalent reach over regular users and the tax-efficiency playbook,
// yet is locked out of rate changes and any privilege-escalation path.

const jwtAuth = require('./auth');

const STAFF = ['admin', 'super_admin', 'tax_consultant'];
const ELEVATED = ['super_admin', 'tax_consultant'];
const SUPER_ADMIN = ['super_admin'];

// Build a [jwtAuth, roleCheck] middleware chain for the given allow-list.
const gate = (allowed, message) => [
  jwtAuth,
  (req, res, next) => {
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Access denied', message });
    }
    next();
  },
];

const requireStaff = gate(STAFF, 'Admin privileges required');
const requireElevated = gate(ELEVATED, 'Super-admin or tax-consultant privileges required');
const requireSuperAdmin = gate(SUPER_ADMIN, 'Super admin privileges required');

// Predicate helpers for in-controller checks (where the gate has already passed
// but the handler needs to branch — e.g. "elevated callers may delete, plain
// admins may not").
const isStaff = (role) => STAFF.includes(role);
const isElevated = (role) => ELEVATED.includes(role);
const isSuperAdmin = (role) => role === 'super_admin';

module.exports = {
  requireStaff,
  requireElevated,
  requireSuperAdmin,
  isStaff,
  isElevated,
  isSuperAdmin,
  ROLE_TIERS: { STAFF, ELEVATED, SUPER_ADMIN },
};
