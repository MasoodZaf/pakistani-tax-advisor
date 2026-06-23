import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxForm } from '../../contexts/TaxFormContext';
import {
  Home, FileText, BarChart3, Settings,
  Users, Shield, FileSpreadsheet, TrendingUp, MessageCircle,
  ChevronLeft, ChevronRight, LogOut,
  Percent, UserCog, Activity, Archive, BookOpen, LayoutGrid
} from 'lucide-react';
import { isStaff as isStaffRole, isElevated as isElevatedRole } from '../../utils/roles';
import BrandMark from '../common/BrandMark';

const Styles = () => (
  <style>{`
    /* Brand fonts loaded once in public/index.html (UX-06) */

    .sb-root {
      font-family: 'Nunito', sans-serif;
      position: fixed; top: 0; left: 0; height: 100vh;
      background: #28396C;
      display: flex; flex-direction: column;
      overflow: hidden;
      transition: width 0.28s cubic-bezier(0.4,0,0.2,1);
      z-index: 40;
      -webkit-font-smoothing: antialiased;
    }
    .sb-root::before {
      content: '';
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
      background-size: 32px 32px;
      pointer-events: none;
    }
    .sb-inner {
      position: relative; z-index: 1;
      display: flex; flex-direction: column; height: 100%;
      overflow: hidden;
    }
    .sb-logo {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 16px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0; min-height: 60px;
    }
    .sb-logo-icon {
      width: 32px; height: 32px;
      background: rgba(181,225,139,0.18);
      border: 1px solid rgba(181,225,139,0.3);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-logo-text {
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 16px; font-weight: 800;
      color: #fff; letter-spacing: -0.02em;
      white-space: nowrap; overflow: hidden;
    }
    .sb-logo-text span { color: #B5E18B; }

    .sb-nav {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      padding: 12px 10px;
      scrollbar-width: none;
    }
    .sb-nav::-webkit-scrollbar { display: none; }

    .sb-section {
      font-size: 10px; font-weight: 700;
      color: rgba(255,255,255,0.25);
      text-transform: uppercase; letter-spacing: 0.1em;
      padding: 14px 8px 6px;
      white-space: nowrap; overflow: hidden;
    }

    .sb-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 10px;
      text-decoration: none;
      color: rgba(255,255,255,0.55);
      font-size: 13.5px; font-weight: 600;
      white-space: nowrap; overflow: hidden;
      transition: background 0.18s, color 0.18s;
      position: relative; margin-bottom: 1px;
    }
    .sb-item:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
    .sb-item.active { background: rgba(255,255,255,0.09); color: #fff; }
    .sb-item.active::before {
      content: '';
      position: absolute; left: 0; top: 7px; bottom: 7px;
      width: 3px; background: #B5E18B;
      border-radius: 0 3px 3px 0;
    }
    .sb-item-icon {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; border-radius: 8px;
    }
    .sb-item.active .sb-item-icon { background: rgba(181,225,139,0.12); }
    .sb-item-label { flex: 1; overflow: hidden; text-overflow: ellipsis; }

    .sb-item[data-tip]:hover::after {
      content: attr(data-tip);
      position: absolute; left: calc(100% + 10px); top: 50%;
      transform: translateY(-50%);
      background: #1e2a4a; color: #fff;
      font-size: 12px; font-weight: 600;
      padding: 5px 10px; border-radius: 7px;
      white-space: nowrap; pointer-events: none; z-index: 100;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }

    .sb-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 10px; }

    .sb-bottom {
      border-top: 1px solid rgba(255,255,255,0.06);
      padding: 12px 10px; flex-shrink: 0;
    }
    .sb-progress-track {
      height: 3px; background: rgba(255,255,255,0.1);
      border-radius: 100px; overflow: hidden; margin: 6px 0 10px;
    }
    .sb-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #B5E18B, #d4f09a);
      border-radius: 100px;
      transition: width 0.6s ease;
    }
    .sb-user {
      display: flex; align-items: center; gap: 10px;
      padding: 8px; border-radius: 10px;
    }
    .sb-avatar {
      width: 32px; height: 32px;
      background: rgba(181,225,139,0.18);
      border: 1px solid rgba(181,225,139,0.25);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Bricolage Grotesque', sans-serif;
      font-size: 11px; font-weight: 800; color: #B5E18B;
      flex-shrink: 0;
    }
    .sb-logout {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,0.3); padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.2s, background 0.2s; flex-shrink: 0;
    }
    .sb-logout:hover { color: #f87171; background: rgba(248,113,113,0.1); }

    .sb-toggle {
      position: absolute; right: -12px; top: 20px;
      width: 24px; height: 24px;
      background: #28396C;
      border: 1.5px solid rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 50;
      transition: background 0.2s;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .sb-toggle:hover { background: #1e2d5a; }
  `}</style>
);

const MAIN_NAV = [
  { name: 'Dashboard',        href: '/dashboard',        icon: Home           },
  { name: 'Income Tax Forms', href: '/income-tax',       icon: FileText       },
  { name: 'Wealth Statement', href: '/wealth-statement', icon: TrendingUp     },
];
const TOOLS_NAV = [
  { name: 'AI Tax Consultant', href: '/consultant',       icon: MessageCircle  },
  { name: 'Prior-Year Returns', href: '/tax-history',     icon: Archive        },
  { name: 'Reports',          href: '/reports',          icon: BarChart3      },
  { name: 'Excel Tools',      href: '/excel',            icon: FileSpreadsheet },
  { name: 'Settings',         href: '/settings',         icon: Settings       },
];

const Sidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { getCompletionPercentage, completedSteps, activeSteps } = useTaxForm();

  const pct      = getCompletionPercentage();
  const done     = activeSteps.filter(s => completedSteps.has(s.id)).length;
  const total    = activeSteps.length;
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const isAdmin      = isStaffRole(user);
  const isElevated   = isElevatedRole(user);
  const isSuperAdmin = user?.role === 'super_admin';

  // Staff can be in two places: the Admin/Consultant area (/admin/*) or the
  // App (their own return). The sidebar follows them — App nav while in the
  // App, admin nav while in the admin area. Regular users always see App nav.
  const inAdminArea  = location.pathname.startsWith('/admin');
  const showUserNav  = !isAdmin || !inAdminArea;
  const showAdminNav = isAdmin && inAdminArea;

  const isActive = (href) => {
    if (href === '/income-tax')       return location.pathname.startsWith('/income-tax') || location.pathname.startsWith('/tax-forms');
    if (href === '/wealth-statement') return location.pathname.startsWith('/wealth-statement');
    if (href === '/admin')            return location.pathname.startsWith('/admin');
    return location.pathname === href;
  };

  const NavItem = ({ item }) => {
    const Icon   = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        to={item.href}
        className={`sb-item${active ? ' active' : ''}`}
        data-tip={collapsed ? item.name : undefined}
        style={collapsed ? { justifyContent: 'center', padding: '9px 0' } : {}}
      >
        <div className="sb-item-icon">
          <Icon size={17} color={active ? '#B5E18B' : 'rgba(255,255,255,0.5)'} />
        </div>
        {!collapsed && <span className="sb-item-label">{item.name}</span>}
        {!collapsed && active && (
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#B5E18B', flexShrink: 0 }} />
        )}
      </Link>
    );
  };

  return (
    <>
      <Styles />
      <div className="sb-root" style={{ width: collapsed ? 60 : 220 }}>
        <button
          className="sb-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          {collapsed
            ? <ChevronRight size={13} color="rgba(255,255,255,0.6)" />
            : <ChevronLeft  size={13} color="rgba(255,255,255,0.6)" />
          }
        </button>

        <div className="sb-inner">
          {/* Logo */}
          <div className="sb-logo" style={collapsed ? { justifyContent: 'center', padding: '14px 0' } : {}}>
            <div className="sb-logo-icon">
              <BrandMark size={18} glyphOnly />
            </div>
            {!collapsed && <span className="sb-logo-text">Mera<span>Tax</span></span>}
          </div>

          {/* Nav */}
          <nav className="sb-nav">
            {collapsed && <div style={{ height: 10 }} />}

            {/* Workspace hub switcher — staff only, lets them jump back to the
                chooser to swap between the App and the Admin/Consultant area. */}
            {isAdmin && (
              <NavItem item={{ name: 'Workspace Hub', href: '/hub', icon: LayoutGrid }} />
            )}

            {/* App nav — regular users always; staff while they're in the App */}
            {showUserNav && (
              <>
                {!collapsed && <div className="sb-section">Main</div>}
                {MAIN_NAV.map(item => <NavItem key={item.href} item={item} />)}
                <div className="sb-divider" />
                {!collapsed && <div className="sb-section">Tools</div>}
                {TOOLS_NAV.map(item => <NavItem key={item.href} item={item} />)}
              </>
            )}

            {/* Staff nav (admin, super_admin and tax_consultant) — only shown
                while in the admin area, so the App view stays clean. */}
            {showAdminNav && (
              <>
                {!collapsed && <div className="sb-section">Admin</div>}
                <NavItem item={{ name: 'Admin Panel',      href: '/admin',                 icon: Shield   }} />
                <NavItem item={{ name: 'User Management',  href: '/admin/users',           icon: Users    }} />

                {/* System Settings: admin + super_admin only (backend requireAdmin) — NOT tax_consultant */}
                {((isAdmin && !isElevated) || isSuperAdmin) && (
                  <NavItem item={{ name: 'System Settings',  href: '/admin/system-settings', icon: Settings }} />
                )}

                {/* Elevated (super_admin + tax_consultant): audit logs + playbook curation */}
                {isElevated && (
                  <>
                    <NavItem item={{ name: 'Audit Logs',       href: '/admin/audit-logs', icon: Activity }} />
                    <NavItem item={{ name: 'AI Tax Efficiency', href: '/admin/playbook',  icon: BookOpen }} />
                  </>
                )}

                {/* Super Admin only */}
                {isSuperAdmin && (
                  <>
                    <div className="sb-divider" />
                    {!collapsed && <div className="sb-section">Super Admin</div>}
                    <NavItem item={{ name: 'Tax Rates',       href: '/admin/tax-rates',       icon: Percent  }} />
                    <NavItem item={{ name: 'Admin Accounts',  href: '/admin/admin-accounts',  icon: UserCog  }} />
                  </>
                )}
              </>
            )}
          </nav>

          {/* Bottom */}
          <div className="sb-bottom">
            {/* Progress bar — shown wherever the App nav is (regular users,
                and staff while they're in the App) */}
            {showUserNav && (!collapsed ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Return</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: pct > 0 ? '#B5E18B' : 'rgba(255,255,255,0.25)' }}>{done}/{total}</span>
                </div>
                <div className="sb-progress-track">
                  <div className="sb-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <div style={{ position: 'relative', width: 28, height: 28 }}>
                  <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" fill="none" />
                    <circle cx="14" cy="14" r="11" stroke="#B5E18B" strokeWidth="2.5" fill="none"
                      strokeLinecap="round" strokeDasharray={69.1}
                      strokeDashoffset={69.1 - (69.1 * pct) / 100}
                    />
                  </svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: '#B5E18B' }}>{pct}%</span>
                </div>
              </div>
            ))}

            <div className="sb-user" style={collapsed ? { justifyContent: 'center' } : {}}>
              <div className="sb-avatar">{initials}</div>
              {!collapsed && (
                <>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <button className="sb-logout" onClick={logout} title="Sign out" aria-label="Sign out">
                    <LogOut size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
