// Frontend mirror of backend/src/middleware/roleGuard.js tiers — keep in sync.
//
//   staff    = admin + super_admin + tax_consultant  (sees the admin panel)
//   elevated = super_admin + tax_consultant          (bulk user ops, playbook)
//   super    = super_admin only                      (rates/slabs, admin accounts)
export const STAFF_ROLES = ['admin', 'super_admin', 'tax_consultant'];
export const ELEVATED_ROLES = ['super_admin', 'tax_consultant'];

export const isStaff = (user) => STAFF_ROLES.includes(user?.role);
export const isElevated = (user) => ELEVATED_ROLES.includes(user?.role);
export const isSuperAdmin = (user) => user?.role === 'super_admin';
