import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxYear } from '../../contexts/TaxYearContext';
import { LogOut, Settings, ChevronDown, AlertTriangle, Bell, Shield, CalendarClock, KeyRound, UserCheck, LayoutGrid } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { isStaff } from '../../utils/roles';

const NOTIF_ICONS = {
  access: Shield,
  consultant: UserCheck,
  security: KeyRound,
  deadline: CalendarClock,
};

function timeAgo(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
}

const Header = () => {
  const { user, logout, sessionExpiresAt, sessionWarning } = useAuth();
  const { currentTaxYear } = useTaxYear();
  const [menuOpen, setMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState([]);
  const [notifUnread, setNotifUnread] = useState(0);

  // The feed is derived server-side from the audit log (account access,
  // consultant changes, password resets) + the filing-deadline reminder.
  const fetchNotifications = async () => {
    try {
      const res = await axios.get('/api/notifications');
      if (res.data?.success) {
        setNotifItems(res.data.data.items || []);
        setNotifUnread(res.data.data.unread || 0);
      }
    } catch { /* non-critical — leave the bell quiet */ }
  };

  useEffect(() => { if (user) fetchNotifications(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNotifications = async () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    setMenuOpen(false);
    if (opening && notifUnread > 0) {
      setNotifUnread(0);
      try { await axios.post('/api/notifications/seen'); } catch { /* noop */ }
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  // Live countdown ticker when warning is active
  useEffect(() => {
    if (!sessionWarning || !sessionExpiresAt) {
      setCountdown('');
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, sessionExpiresAt - Date.now());
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionWarning, sessionExpiresAt]);

  return (
    <>
      <style>{`
        /* Brand fonts loaded once in public/index.html (UX-06) */
        .hdr-root {
          font-family: 'Nunito', sans-serif;
          position: fixed; top: 0; left: 0; right: 0; height: 56px;
          background: var(--surface-raised); border-bottom: 1px solid var(--line);
          display: flex; align-items: center;
          padding: 0 20px 0 232px; z-index: 39; gap: 16px;
          -webkit-font-smoothing: antialiased;
          transition: padding-left 0.28s cubic-bezier(0.4,0,0.2,1);
        }
        .hdr-root.collapsed { padding-left: 76px; }
        .hdr-root.session-warn { background: #fffbeb; border-bottom-color: #f59e0b; }
        [data-theme="dark"] .hdr-root.session-warn { background: #2a230b; border-bottom-color: #b45309; }

        .hdr-year-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: var(--brand-cream); border: 1px solid var(--brand-cream-track);
          color: var(--brand-on-cream); font-size: 11px; font-weight: 700;
          padding: 3px 10px; border-radius: 100px; letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .hdr-user-btn {
          display: flex; align-items: center; gap: 9px;
          background: none; border: 1.5px solid var(--line); border-radius: 12px;
          padding: 6px 10px 6px 6px; cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          font-family: 'Nunito', sans-serif;
        }
        .hdr-user-btn:hover { border-color: #a8c890; background: var(--brand-hover-bg); }
        .hdr-avatar {
          width: 28px; height: 28px; background: #28396C; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0;
        }
        [data-theme="dark"] .hdr-avatar { background: var(--brand-navy-mid); }
        .hdr-dropdown {
          position: absolute; top: calc(100% + 6px); right: 0; width: 220px;
          background: var(--surface-raised); border: 1.5px solid var(--line); border-radius: 14px;
          box-shadow: 0 8px 32px rgba(26,28,24,0.10); overflow: hidden; z-index: 200;
          animation: dropIn 0.18s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hdr-drop-item {
          display: flex; align-items: center; gap: 10px; padding: 11px 14px;
          font-size: 13px; font-weight: 600; color: var(--content); text-decoration: none;
          background: none; border: none; width: 100%; cursor: pointer;
          font-family: 'Nunito', sans-serif; transition: background 0.15s;
        }
        .hdr-drop-item:hover { background: var(--brand-hover-bg); }
        .hdr-drop-item.danger { color: #c0392b; }
        [data-theme="dark"] .hdr-drop-item.danger { color: #f87171; }
        .hdr-drop-item.danger:hover { background: #fdf2f2; }
        [data-theme="dark"] .hdr-drop-item.danger:hover { background: #2a1414; }
        .hdr-notif {
          width: 34px; height: 34px; background: none;
          border: 1.5px solid var(--line); border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; flex-shrink: 0;
          transition: border-color 0.2s, background 0.2s;
        }
        .hdr-notif:hover { border-color: #a8c890; background: var(--brand-hover-bg); }
        .hdr-notif-dot {
          position: absolute; top: 6px; right: 6px;
          width: 7px; height: 7px;
          background: #c0392b; border-radius: 50%; border: 1.5px solid var(--surface-raised);
        }
        .hdr-notif-panel {
          position: absolute; top: calc(100% + 6px); right: 0; width: 320px;
          background: var(--surface-raised); border: 1.5px solid var(--line); border-radius: 14px;
          box-shadow: 0 8px 32px rgba(26,28,24,0.10); overflow: hidden; z-index: 200;
          animation: dropIn 0.18s ease;
        }
        .hdr-notif-item {
          display: flex; gap: 10px; padding: 11px 14px;
          border-bottom: 1px solid var(--line);
        }
        .hdr-notif-item:last-child { border-bottom: none; }
        .hdr-notif-item.unread { background: var(--brand-hover-bg); }
        @media (prefers-reduced-motion: reduce) {
          .hdr-notif-panel { animation: none; }
        }
        .hdr-session-warn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fef3c7; border: 1px solid #f59e0b;
          color: #92400e; font-size: 12px; font-weight: 700;
          padding: 4px 12px; border-radius: 100px; white-space: nowrap;
          animation: pulseWarn 1.8s ease-in-out infinite;
        }
        [data-theme="dark"] .hdr-session-warn { background: #2a230b; border-color: #b45309; color: #fcd34d; }
        @keyframes pulseWarn {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hdr-dropdown { animation: none; }
          .hdr-session-warn { animation: none; }
        }
      `}</style>

      <header className={`hdr-root${sessionWarning ? ' session-warn' : ''}`}>
        <div className="hdr-year-badge">
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#B5E18B' }} />
          {currentTaxYear || '—'}
        </div>

        {sessionWarning && (
          <div className="hdr-session-warn">
            <AlertTriangle size={13} />
            Session expires in {countdown || '…'} — please save your work
          </div>
        )}

        <div style={{ flex: 1 }} />

        <ThemeToggle />

        {/* Notifications — a real feed (phase-z10): account-access events,
            consultant changes, password resets (from the audit log) + the
            filing-deadline countdown. The dot only lights for unread events. */}
        <div style={{ position: 'relative' }}>
          <button
            className="hdr-notif"
            onClick={openNotifications}
            aria-label={notifUnread > 0 ? `Notifications — ${notifUnread} unread` : 'Notifications'}
            aria-expanded={notifOpen}
          >
            <Bell size={15} color="var(--content-subtle)" />
            {notifUnread > 0 && <span className="hdr-notif-dot" />}
          </button>

          {notifOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setNotifOpen(false)} />
              <div className="hdr-notif-panel" role="region" aria-label="Notifications">
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--content)' }}>Notifications</p>
                </div>
                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                  {notifItems.length === 0 ? (
                    <p style={{ padding: '22px 16px', fontSize: 13, color: 'var(--content-muted)', fontWeight: 500, textAlign: 'center', lineHeight: 1.6 }}>
                      Nothing yet. Deadline reminders and account activity
                      (like a consultant working on your return) will appear here.
                    </p>
                  ) : (
                    notifItems.map(item => {
                      const Icon = NOTIF_ICONS[item.type] || Bell;
                      return (
                        <div key={item.id} className={`hdr-notif-item${item.unread ? ' unread' : ''}`}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--brand-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <Icon size={14} color="var(--brand-on-cream-navy)" />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--content)', lineHeight: 1.35 }}>{item.title}</p>
                            <p style={{ fontSize: 12, color: 'var(--content-muted)', fontWeight: 500, lineHeight: 1.45, marginTop: 2 }}>{item.body}</p>
                            <p style={{ fontSize: 10.5, color: 'var(--content-subtle)', fontWeight: 600, marginTop: 3 }}>{timeAgo(item.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          <button className="hdr-user-btn" onClick={() => { setMenuOpen(v => !v); setNotifOpen(false); }}>
            <div className="hdr-avatar">{initials}</div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--content)', lineHeight: 1.2, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: 11, color: 'var(--content-muted)', fontWeight: 600, textTransform: 'capitalize', lineHeight: 1.2 }}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown size={13} color="var(--content-subtle)" style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(false)} />
              <div className="hdr-dropdown">
                <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--line)' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--content)' }}>{user?.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--content-muted)', fontWeight: 500, marginTop: 2 }}>{user?.email}</p>
                  <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--brand-cream)', border: '1px solid var(--brand-cream-track)', borderRadius: 100, padding: '3px 9px' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#B5E18B' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-on-cream)', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
                  </div>
                  {sessionExpiresAt && (
                    <p style={{ fontSize: 11, color: 'var(--content-subtle)', marginTop: 6, fontWeight: 500 }}>
                      Session expires {sessionExpiresAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div style={{ padding: '6px 0' }}>
                  {isStaff(user) && (
                    <Link to="/hub" className="hdr-drop-item" onClick={() => setMenuOpen(false)}>
                      <LayoutGrid size={15} color="var(--content-subtle)" /> Switch workspace
                    </Link>
                  )}
                  <Link to="/settings" className="hdr-drop-item" onClick={() => setMenuOpen(false)}>
                    <Settings size={15} color="var(--content-subtle)" /> Settings
                  </Link>
                  <div style={{ height: 1, background: 'var(--line)', margin: '4px 14px' }} />
                  <button className="hdr-drop-item danger" onClick={() => { setMenuOpen(false); logout(); }}>
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
