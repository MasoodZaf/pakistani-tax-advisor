import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Mail, Lock, Eye, EyeOff, Phone, MapPin, CreditCard,
  Briefcase, Building2, FileText, ChevronRight, ChevronLeft,
  CheckCircle2, ArrowRight, Shield, Check
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

/* ─── Global styles ─────────────────────────────────────────────────────────── */
const Styles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Nunito:wght@400;500;600;700&display=swap');

    .ob-root {
      font-family: 'Nunito', sans-serif;
      background: #fdfcf8;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .ob-display { font-family: 'Bricolage Grotesque', sans-serif; }

    .ob-input {
      width: 100%;
      padding: 11px 14px 11px 40px;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #1c1d1a;
      background: #fff;
      border: 1.5px solid #e0dfd9;
      border-radius: 12px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ob-input:focus {
      border-color: #28396C;
      box-shadow: 0 0 0 3px rgba(40,57,108,0.1);
    }
    .ob-input.error { border-color: #f87171; }
    .ob-input.no-icon { padding-left: 14px; }

    .ob-select {
      width: 100%;
      padding: 11px 14px;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 500;
      color: #1c1d1a;
      background: #fff;
      border: 1.5px solid #e0dfd9;
      border-radius: 12px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237c7d75' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 36px;
      cursor: pointer;
    }
    .ob-select:focus {
      border-color: #28396C;
      box-shadow: 0 0 0 3px rgba(40,57,108,0.1);
    }

    .ob-btn-primary {
      width: 100%;
      padding: 13px 20px;
      background: #28396C;
      color: #fff;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 700;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s, transform 0.15s;
    }
    .ob-btn-primary:hover:not(:disabled) { background: #1e2d5a; transform: translateY(-1px); }
    .ob-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    .ob-btn-secondary {
      flex: 1;
      padding: 13px 20px;
      background: #fff;
      color: #5c5d55;
      font-family: 'Nunito', sans-serif;
      font-size: 15px;
      font-weight: 700;
      border: 1.5px solid #e0dfd9;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: border-color 0.2s, background 0.2s;
    }
    .ob-btn-secondary:hover { border-color: #7a8890; background: #f5f8ea; }

  `}</style>
);

/* ─── Data ───────────────────────────────────────────────────────────────────── */
const INCOME_STREAMS = [
  { id: 'bank_profit',    icon: '🏦', title: 'Bank / Savings Profit',         desc: 'Savings accounts, NSS, term deposits, defence savings' },
  { id: 'dividends',      icon: '📈', title: 'Dividends from Shares',          desc: 'Dividends from listed or unlisted companies' },
  { id: 'securities',     icon: '📊', title: 'Listed Shares / Mutual Funds',   desc: 'Capital gains on PSX shares, mutual funds, REIT units' },
  { id: 'sukuk',          icon: '🕌', title: 'Sukuk / Bond Income',            desc: 'Profit from sukuk and Islamic investment instruments' },
  { id: 'rental',         icon: '🏠', title: 'Rental Income',                  desc: 'Rent received from residential or commercial property' },
  { id: 'property_gain',  icon: '🏘️', title: 'Property Sale (Capital Gain)',   desc: 'Gain on sale of immovable property (house, plot, shop)' },
  { id: 'directorship',   icon: '🧑‍💼', title: 'Directorship / Board Fees',     desc: 'Fees from company board membership or directorship' },
  { id: 'foreign_income', icon: '🌐', title: 'Foreign Income / Remittances',   desc: 'Income earned abroad or foreign remittances received' },
  { id: 'prizes',         icon: '🎟️', title: 'Prize Bonds / Winnings',         desc: 'Winnings from prize bonds, lottery, or raffle' },
  { id: 'pension',        icon: '🏛️', title: 'Pension from Former Employer',   desc: 'Pension / gratuity from a previous employer (Finance Act 2025: taxable above Rs. 10M)' },
  { id: 'agriculture',    icon: '🌾', title: 'Agriculture Income',             desc: 'Income from agricultural land (federally exempt; declaration required by FBR)' },
];

const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'AJK', 'Gilgit-Baltistan', 'ICT'];
const STEPS = ['Account', 'Details', 'Income streams', 'Done'];

/* ─── Step progress bar ─────────────────────────────────────────────────────── */
function StepBar({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontSize: 13, fontWeight: 700,
                background: done || active ? '#28396C' : '#f0efeb',
                color: done || active ? '#fff' : '#7a8890',
                boxShadow: active ? '0 0 0 4px rgba(40,57,108,0.15)' : 'none',
                transition: 'all 0.3s',
              }}>
                {done ? <Check size={14} strokeWidth={2.5} /> : i + 1}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: active ? '#28396C' : done ? '#5c5d55' : '#b0b1a9',
                letterSpacing: '0.02em',
              }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 2, width: 48, background: done ? '#28396C' : '#e5e4de', marginBottom: 18, transition: 'background 0.3s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ─── Field wrapper ─────────────────────────────────────────────────────────── */
function Field({ label, error, optional, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d3e37', marginBottom: 6, letterSpacing: '0.01em' }}>
        {label}
        {optional && <span style={{ marginLeft: 5, fontWeight: 500, color: '#7a8890', fontSize: 12 }}>optional</span>}
      </label>
      {children}
      {error && <p style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</p>}
    </div>
  );
}

/* ─── Input with icon ───────────────────────────────────────────────────────── */
function IconInput({ icon: Icon, error, type = 'text', suffix, ...props }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon size={16} color="#7a8890" />
      </div>
      <input type={type} className={`ob-input${error ? ' error' : ''}${suffix ? ' pr-10' : ''}`} {...props} />
      {suffix}
    </div>
  );
}

/* ─── Step 1: Account ───────────────────────────────────────────────────────── */
function StepAccount({ form, setForm, errors, setErrors, onNext, loading }) {
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name?.trim())          e.name = 'Please enter your name';
    if (!form.email?.trim())         e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.password)              e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords don\'t match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const PwdToggle = ({ show, onToggle }) => (
    <button type="button" onClick={onToggle} style={{
      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
      background: 'none', border: 'none', cursor: 'pointer', color: '#7a8890', display: 'flex', padding: 2,
    }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Your full name" error={errors.name}>
        <IconInput icon={User} placeholder="Muhammad Ahmed" value={form.name || ''} error={errors.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
      </Field>

      <Field label="Email address" error={errors.email}>
        <IconInput icon={Mail} type="email" placeholder="ahmed@example.com" value={form.email || ''} error={errors.email}
          onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
      </Field>

      <Field label="Password" error={errors.password}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Lock size={16} color="#7a8890" />
          </div>
          <input type={showPwd ? 'text' : 'password'} className={`ob-input${errors.password ? ' error' : ''}`}
            placeholder="Minimum 8 characters" value={form.password || ''}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          <PwdToggle show={showPwd} onToggle={() => setShowPwd(v => !v)} />
        </div>
      </Field>

      <Field label="Confirm password" error={errors.confirmPassword}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Lock size={16} color="#7a8890" />
          </div>
          <input type={showCfm ? 'text' : 'password'} className={`ob-input${errors.confirmPassword ? ' error' : ''}`}
            placeholder="Re-enter password" value={form.confirmPassword || ''}
            onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
          <PwdToggle show={showCfm} onToggle={() => setShowCfm(v => !v)} />
        </div>
      </Field>

      <button className="ob-btn-primary" onClick={() => validate() && onNext()} disabled={loading} style={{ marginTop: 4 }}>
        {loading ? 'Creating your account…' : <>Continue <ChevronRight size={16} /></>}
      </button>
    </div>
  );
}

/* ─── Step 2: Personal details ──────────────────────────────────────────────── */
function StepPersonal({ form, setForm, errors, setErrors, onNext, onBack, loading }) {
  const validate = () => {
    const e = {};
    if (!form.cnic?.trim()) e.cnic = 'CNIC is required';
    else if (!/^\d{13}$/.test(form.cnic.replace(/-/g, ''))) e.cnic = '13 digits only, no dashes';
    if (!form.mobile?.trim()) e.mobile = 'Mobile number is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="CNIC" error={errors.cnic}>
          <IconInput icon={CreditCard} placeholder="3520112345671" maxLength={13} value={form.cnic || ''} error={errors.cnic} onChange={set('cnic')} />
        </Field>
        <Field label="Mobile" error={errors.mobile}>
          <IconInput icon={Phone} type="tel" placeholder="03001234567" value={form.mobile || ''} error={errors.mobile} onChange={set('mobile')} />
        </Field>
      </div>

      <Field label="Father's name" optional>
        <IconInput icon={User} placeholder="Father's full name" value={form.father_name || ''} onChange={set('father_name')} />
      </Field>

      <Field label="NTN" optional>
        <IconInput icon={FileText} placeholder="1234567-8" value={form.ntn || ''} onChange={set('ntn')} />
      </Field>

      <Field label="Address" optional>
        <IconInput icon={MapPin} placeholder="House No., Street, Area" value={form.address || ''} onChange={set('address')} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
        <Field label="City" optional>
          <IconInput icon={Building2} placeholder="Lahore" value={form.city || ''} onChange={set('city')} />
        </Field>
        <Field label="Province" optional>
          <select className="ob-select" value={form.province || ''} onChange={set('province')}>
            <option value="">Select…</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Postal" optional>
          <input type="text" className="ob-input no-icon" placeholder="54000" maxLength={5} value={form.postal_code || ''} onChange={set('postal_code')} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button className="ob-btn-secondary" onClick={onBack}><ChevronLeft size={16} /> Back</button>
        <button className="ob-btn-primary" onClick={() => validate() && onNext()} disabled={loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : <>Continue <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

/* ─── Step 3: Income streams ────────────────────────────────────────────────── */
function StepIncomeStreams({ selected, setSelected, onNext, onBack, loading }) {
  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {/* Primary type — locked */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F0FFC2', border: '1.5px solid #b5d97a', borderRadius: 12, padding: '11px 14px', marginBottom: 18 }}>
        <span style={{ fontSize: 18 }}><Briefcase size={17} color="#28396C" /></span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#28396C', margin: 0 }}>Salaried Employee</p>
          <p style={{ fontSize: 11, color: '#4a6020', margin: 0, fontWeight: 500 }}>Your primary income type — always included</p>
        </div>
        <div style={{ marginLeft: 'auto', width: 20, height: 20, background: '#28396C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Check size={11} color="#fff" strokeWidth={3} />
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, color: '#3d3e37', marginBottom: 10 }}>
        Do you also have income from any of these? <span style={{ fontWeight: 500, color: '#7a8890' }}>(select all that apply)</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 20, maxHeight: 340, overflowY: 'auto', paddingRight: 2 }}>
        {INCOME_STREAMS.map(s => {
          const isSel = selected.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: isSel ? '#f0f7ff' : '#fff',
                border: `1.5px solid ${isSel ? '#28396C' : '#e0dfd9'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{s.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#1c1d1a', margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 11, color: '#6b6c64', margin: 0, fontWeight: 500, lineHeight: 1.4 }}>{s.desc}</p>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSel ? '#28396C' : '#c8c8c0'}`,
                background: isSel ? '#28396C' : '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s',
              }}>
                {isSel && <Check size={11} color="#fff" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: '#7a8890', fontWeight: 500, marginBottom: 14, lineHeight: 1.5 }}>
        Don't worry if you're unsure — you can update your income streams from Settings at any time.
      </p>

      <div style={{ display: 'flex', gap: 10 }}>
        <button className="ob-btn-secondary" onClick={onBack}><ChevronLeft size={16} /> Back</button>
        <button className="ob-btn-primary" onClick={onNext} disabled={loading} style={{ flex: 2 }}>
          {loading ? 'Saving…' : <>Continue <ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

/* ─── Step 4: Done ──────────────────────────────────────────────────────────── */
function StepDone({ name, addonCount, onGo }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ width: 60, height: 60, background: '#F0FFC2', border: '2px solid #c0da94', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        <CheckCircle2 size={28} color="#28396C" />
      </div>
      <h2 className="ob-display" style={{ fontSize: 22, fontWeight: 800, color: '#1c1d1a', marginBottom: 8, letterSpacing: '-0.02em' }}>
        You're all set{name ? `, ${name.split(' ')[0]}` : ''}!
      </h2>
      <p style={{ fontSize: 15, color: '#5c5d55', marginBottom: 28, lineHeight: 1.6, fontWeight: 500 }}>
        Your account is ready. We've loaded{' '}
        <strong style={{ color: '#1c1d1a' }}>
          {addonCount > 0 ? `salary + ${addonCount} additional income stream${addonCount > 1 ? 's' : ''}` : 'salary-only forms'}
        </strong>. Your forms are waiting.
      </p>

      <div style={{ background: '#f5f8ea', borderRadius: 14, padding: '18px 20px', marginBottom: 28, textAlign: 'left' }}>
        {[
          'Fill in your income details form by form',
          'Review the auto-calculated tax summary',
          'Download your FBR-compliant return',
        ].map((tip, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 2 ? '1px solid #e5e4de' : 'none' }}>
            <div style={{ width: 22, height: 22, background: '#F0FFC2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#3d6020' }}>{i + 1}</span>
            </div>
            <p style={{ fontSize: 14, color: '#3d3e37', fontWeight: 600 }}>{tip}</p>
          </div>
        ))}
      </div>

      <button className="ob-btn-primary" onClick={onGo} style={{ gap: 10 }}>
        Go to my dashboard <ArrowRight size={16} />
      </button>
    </div>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────────── */
export default function Onboarding() {
  const navigate = useNavigate();
  const { register, completeOnboarding, user } = useAuth();

  // Already-authenticated users (e.g., registered via API) must skip the
  // account-creation step — re-running /register here 409s on the existing
  // email and traps them in a loop.
  const isAuthed = !!user;
  const [step, setStep]           = useState(isAuthed ? 1 : 0);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});
  // Initialize as null so we can tell "still loading" apart from a stale
  // hardcoded default. handlePersonalNext refuses to fire until the API
  // resolves — prevents writing personal-info against a wrong tax year if
  // the user races through step 2 before the network resolves.
  const [currentTaxYear, setCurrentTaxYear] = useState(null);

  useEffect(() => {
    axios.get('/api/tax-year/current')
      .then(r => { setCurrentTaxYear(r.data?.currentTaxYear || '2025-26'); })
      .catch(() => { setCurrentTaxYear('2025-26'); }); // fallback on network failure
  }, []);

  const [accountForm, setAccountForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    confirmPassword: '',
  });
  const [personalForm, setPersonalForm] = useState({ cnic: '', mobile: '', father_name: '', ntn: '', address: '', city: '', province: '', postal_code: '' });
  const [selectedAddons, setSelectedAddons] = useState([]);

  const handleAccountNext = async () => {
    setLoading(true);
    try {
      const result = await register({ name: accountForm.name, email: accountForm.email, password: accountForm.password });
      if (result.success) setStep(1);
    } finally { setLoading(false); }
  };

  const handlePersonalNext = async () => {
    if (!currentTaxYear) {
      toast.error('Loading current tax year — please retry in a moment.');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`/api/personal-info/${currentTaxYear}`, {
        full_name: accountForm.name,
        cnic: personalForm.cnic,
        mobile_number: personalForm.mobile,
        father_name: personalForm.father_name,
        ntn: personalForm.ntn,
        address: personalForm.address,
        city: personalForm.city,
        province: personalForm.province,
        postal_code: personalForm.postal_code,
      });
      setStep(2);
    } catch {
      toast.error('Could not save personal info — you can complete it later.');
      setStep(2);
    } finally { setLoading(false); }
  };

  const handleIncomeStreamsNext = async () => {
    setLoading(true);
    try {
      await axios.post('/api/tax-forms/income-profile', {
        addons: selectedAddons,
        taxYear: currentTaxYear,
      });
    } catch {
      // Non-fatal — user can adjust from Settings; proceed anyway
    } finally {
      setLoading(false);
      setStep(3);
    }
  };

  const stepTitles    = ['Create your account', 'Personal details', 'Your income streams', null];
  const stepSubtitles = [
    'You\'ll use these to log in and secure your return.',
    'Used to pre-fill your FBR return. Marked fields are optional.',
    'We\'ll load only the forms you need. You can change this later in Settings.',
    null,
  ];

  return (
    <div className="ob-root">
      <Styles />

      {/* Minimal nav */}
      <nav style={{ height: 56, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e5e4de', background: 'rgba(253,252,248,0.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <div style={{ width: 30, height: 30, background: '#28396C', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={14} color="#fff" />
          </div>
          <span className="ob-display" style={{ fontSize: 15, fontWeight: 700, color: '#1c1d1a', letterSpacing: '-0.02em' }}>PakTax</span>
        </Link>
        <Link to="/login" style={{ fontSize: 14, fontWeight: 600, color: '#5c5d55', textDecoration: 'none' }}>
          Already have an account? <span style={{ color: '#28396C' }}>Sign in</span>
        </Link>
      </nav>

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px 80px', minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <StepBar current={step} />

          {/* Card */}
          <div style={{ background: '#fff', border: '1px solid #e5e4de', borderRadius: 20, padding: 'clamp(24px, 5vw, 36px)', boxShadow: '0 4px 24px rgba(26,28,24,0.06)' }}>
            {step < 3 && (
              <div style={{ marginBottom: 28 }}>
                <h1 className="ob-display" style={{ fontSize: 22, fontWeight: 800, color: '#1c1d1a', letterSpacing: '-0.025em', marginBottom: 6 }}>
                  {stepTitles[step]}
                </h1>
                <p style={{ fontSize: 14, color: '#6b6c64', lineHeight: 1.6, fontWeight: 500 }}>{stepSubtitles[step]}</p>
              </div>
            )}

            {step === 0 && <StepAccount form={accountForm} setForm={setAccountForm} errors={errors} setErrors={setErrors} onNext={handleAccountNext} loading={loading} />}
            {step === 1 && <StepPersonal form={personalForm} setForm={setPersonalForm} errors={errors} setErrors={setErrors} onNext={handlePersonalNext} onBack={isAuthed ? undefined : () => setStep(0)} loading={loading} />}
            {step === 2 && <StepIncomeStreams selected={selectedAddons} setSelected={setSelectedAddons} onNext={handleIncomeStreamsNext} onBack={() => setStep(1)} loading={loading} />}
            {step === 3 && (
              <StepDone
                name={accountForm.name}
                addonCount={selectedAddons.length}
                onGo={async () => {
                  await completeOnboarding();
                  navigate('/dashboard');
                }}
              />
            )}
          </div>

          {step < 3 && (
            <p style={{ textAlign: 'center', fontSize: 12, color: '#b0b1a9', fontWeight: 500, marginTop: 16 }}>
              Step {step + 1} of {STEPS.length} — your data is encrypted and never shared
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
