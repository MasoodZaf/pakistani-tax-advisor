import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Shield, Users, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/roles';
import BrandMark from '../common/BrandMark';

// Intermediate "workspace hub" shown to staff (owner / super_admin / admin /
// tax_consultant) right after login. Instead of force-routing staff straight
// into the admin console, it lets them choose which surface to land in:
//   • the MeraTax App  — file & manage their own return like any taxpayer
//   • the Admin Console — full system administration (super_admin / admin)
//   • the Consultant Workspace — manage their assigned clients
//
// Cards are role-aware. A super_admin (the app owner) sees all three; a
// tax_consultant sees the App + their Consultant Workspace; a plain admin
// sees the App + Admin Console.
const Launcher = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const superAdmin = isSuperAdmin(user);
  const consultant = user?.role === 'tax_consultant';

  // Build the card list for this role. `to` is the route we drop them into.
  const cards = [
    {
      key: 'app',
      title: 'MeraTax App',
      desc: 'File and manage your own tax return — the full taxpayer experience.',
      icon: LayoutDashboard,
      to: '/dashboard',
      show: true,
    },
    {
      key: 'admin',
      title: 'Admin Console',
      desc: superAdmin
        ? 'Users, tax rates, admin accounts, audit logs and system settings.'
        : 'User management and system administration.',
      icon: Shield,
      to: '/admin',
      show: superAdmin || user?.role === 'admin',
    },
    {
      key: 'consultant',
      title: 'Consultant Workspace',
      desc: 'Manage your assigned clients — returns, bulk tools and AI tax efficiency.',
      icon: Users,
      to: '/admin/users',
      show: superAdmin || consultant,
    },
  ].filter((c) => c.show);

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: 880 }}>
        {/* Brand + greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#28396C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BrandMark size={22} glyphOnly />
          </div>
          <div>
            <h1
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--content)',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Welcome, {firstName}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--content-muted)', margin: '2px 0 0', fontWeight: 600 }}>
              Where would you like to go?
            </p>
          </div>
        </div>

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(cards.length, 3)}, minmax(0, 1fr))`,
            gap: 16,
          }}
        >
          {cards.map(({ key, title, desc, icon: Icon, to }) => (
            <button
              key={key}
              onClick={() => navigate(to)}
              className="launcher-card"
              style={{
                textAlign: 'left',
                background: 'var(--surface-raised)',
                border: '1px solid var(--line)',
                borderRadius: 16,
                padding: '22px 20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--brand-cream)',
                  border: '1px solid var(--brand-cream-track)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={22} color="var(--brand-on-cream-navy)" />
              </div>
              <div>
                <h2
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--content)',
                    margin: '0 0 4px',
                  }}
                >
                  {title}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--content-muted)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                  {desc}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', color: 'var(--brand-on-cream-navy)', fontWeight: 700, fontSize: 13 }}>
                Enter <ArrowRight size={15} />
              </div>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={logout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--content-muted)',
              cursor: 'pointer',
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      <style>{`
        .launcher-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(40,57,108,0.12);
          border-color: var(--brand-cream-track);
        }
        .launcher-card:focus-visible {
          outline: 2px solid var(--brand-on-cream-navy);
          outline-offset: 2px;
        }
        @media (max-width: 720px) {
          .launcher-card { }
        }
      `}</style>
    </div>
  );
};

export default Launcher;
