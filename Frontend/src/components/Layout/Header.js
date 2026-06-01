import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxYear } from '../../contexts/TaxYearContext';
import { LogOut, Settings, ChevronDown, Bell, AlertTriangle } from 'lucide-react';

const Header = () => {
  const { user, logout, sessionExpiresAt, sessionWarning } = useAuth();
  const { currentTaxYear } = useTaxYear();
  const [menuOpen, setMenuOpen] = useState(false);
  const [countdown, setCountdown] = useState('');

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
          background: #fff; border-bottom: 1px solid #e3e2dc;
          display: flex; align-items: center;
          padding: 0 20px 0 232px; z-index: 39; gap: 16px;
          -webkit-font-smoothing: antialiased;
          transition: padding-left 0.28s cubic-bezier(0.4,0,0.2,1);
        }
        .hdr-root.collapsed { padding-left: 76px; }
        .hdr-root.session-warn { background: #fffbeb; border-bottom-color: #f59e0b; }

        .hdr-year-badge {
          display: inline-flex; align-items: center; gap: 5px;
          background: #F0FFC2; border: 1px solid #c0da94;
          color: #3d6020; font-size: 11px; font-weight: 700;
          padding: 3px 10px; border-radius: 100px; letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .hdr-user-btn {
          display: flex; align-items: center; gap: 9px;
          background: none; border: 1.5px solid #e3e2dc; border-radius: 12px;
          padding: 6px 10px 6px 6px; cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          font-family: 'Nunito', sans-serif;
        }
        .hdr-user-btn:hover { border-color: #a8c890; background: #f5f8ea; }
        .hdr-avatar {
          width: 28px; height: 28px; background: #28396C; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Bricolage Grotesque', sans-serif;
          font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0;
        }
        .hdr-dropdown {
          position: absolute; top: calc(100% + 6px); right: 0; width: 220px;
          background: #fff; border: 1.5px solid #e3e2dc; border-radius: 14px;
          box-shadow: 0 8px 32px rgba(26,28,24,0.10); overflow: hidden; z-index: 200;
          animation: dropIn 0.18s ease;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hdr-drop-item {
          display: flex; align-items: center; gap: 10px; padding: 11px 14px;
          font-size: 13px; font-weight: 600; color: #3d3e37; text-decoration: none;
          background: none; border: none; width: 100%; cursor: pointer;
          font-family: 'Nunito', sans-serif; transition: background 0.15s;
        }
        .hdr-drop-item:hover { background: #f5f8ea; }
        .hdr-drop-item.danger { color: #c0392b; }
        .hdr-drop-item.danger:hover { background: #fdf2f2; }
        .hdr-notif {
          width: 34px; height: 34px; background: none;
          border: 1.5px solid #e3e2dc; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; flex-shrink: 0;
          transition: border-color 0.2s, background 0.2s;
        }
        .hdr-notif:hover { border-color: #a8c890; background: #f5f8ea; }
        .hdr-notif-dot {
          position: absolute; top: 6px; right: 6px;
          width: 7px; height: 7px;
          background: #c0392b; border-radius: 50%; border: 1.5px solid #fff;
        }
        .hdr-session-warn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fef3c7; border: 1px solid #f59e0b;
          color: #92400e; font-size: 12px; font-weight: 700;
          padding: 4px 12px; border-radius: 100px; white-space: nowrap;
          animation: pulseWarn 1.8s ease-in-out infinite;
        }
        @keyframes pulseWarn {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.72; }
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

        <button className="hdr-notif">
          <Bell size={15} color="#6b6c64" />
          <span className="hdr-notif-dot" />
        </button>

        <div style={{ position: 'relative' }}>
          <button className="hdr-user-btn" onClick={() => setMenuOpen(v => !v)}>
            <div className="hdr-avatar">{initials}</div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2a4a', lineHeight: 1.2, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </p>
              <p style={{ fontSize: 11, color: '#7a8890', fontWeight: 600, textTransform: 'capitalize', lineHeight: 1.2 }}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown size={13} color="#7a8890" style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setMenuOpen(false)} />
              <div className="hdr-dropdown">
                <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #f0efeb' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2a4a' }}>{user?.name}</p>
                  <p style={{ fontSize: 12, color: '#7a8890', fontWeight: 500, marginTop: 2 }}>{user?.email}</p>
                  <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F0FFC2', border: '1px solid #c0da94', borderRadius: 100, padding: '3px 9px' }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#B5E18B' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#3d6020', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</span>
                  </div>
                  {sessionExpiresAt && (
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>
                      Session expires {sessionExpiresAt.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div style={{ padding: '6px 0' }}>
                  <Link to="/settings" className="hdr-drop-item" onClick={() => setMenuOpen(false)}>
                    <Settings size={15} color="#6b6c64" /> Settings
                  </Link>
                  <div style={{ height: 1, background: '#f0efeb', margin: '4px 14px' }} />
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
