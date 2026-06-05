import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Clock, FileText, BarChart3,
  ChevronDown, Briefcase, TrendingUp,
  Building2, Home, Globe, Check, ArrowRight, Star,
  Calculator, Lock, Menu, X
} from 'lucide-react';

/* ─── Google Fonts ─────────────────────────────────────────────────────────── */
const FontLoader = () => (
  <style>{`
    /* Brand fonts loaded once in public/index.html (UX-06) */

    *, *::before, *::after { box-sizing: border-box; }

    .land-root {
      font-family: 'Nunito', sans-serif;
      background: var(--surface);
      color: var(--content);
      -webkit-font-smoothing: antialiased;
    }

    .display { font-family: 'Bricolage Grotesque', sans-serif; }

    /* Navy brand ink that sits directly on the page bg flips to the lime accent
       in dark mode (navy on the dark page would fail contrast). */
    [data-theme="dark"] .land-brand-ink { color: #B5E18B; }

    /* Animated underline */
    .underline-grow {
      position: relative;
      display: inline-block;
    }
    .underline-grow::after {
      content: '';
      position: absolute;
      bottom: -3px;
      left: 0;
      width: 100%;
      height: 3px;
      background: #B5E18B;
      border-radius: 2px;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.35s ease;
    }
    .underline-grow:hover::after { transform: scaleX(1); }

    /* Fade-in on scroll */
    .fade-up {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .fade-up.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Card hover */
    .feature-card {
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .feature-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 40px rgba(40,57,108,0.10);
    }

    /* Profile card */
    .profile-card {
      transition: transform 0.22s ease, background 0.22s ease, box-shadow 0.22s ease;
    }
    .profile-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 32px rgba(40,57,108,0.12);
    }

    /* Pill badge */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--brand-cream);
      border: 1px solid var(--brand-cream-track);
      color: var(--brand-on-cream);
      font-size: 13px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 100px;
      letter-spacing: 0.01em;
    }

    /* Nav */
    .nav-link {
      /* Reset so a real <button> renders identically to the old <span>. */
      background: none;
      border: none;
      font-family: inherit;
      color: var(--content-muted);
      font-size: 15px;
      font-weight: 600;
      padding: 6px 2px;
      cursor: pointer;
      transition: color 0.2s;
    }
    .nav-link:hover { color: #28396C; }
    [data-theme="dark"] .nav-link:hover { color: var(--content); }

    /* Scroll shimmer on stats */
    @keyframes countUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .stat-animated { animation: countUp 0.5s ease forwards; }

    /* Accordion */
    .faq-answer {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.35s ease, padding 0.2s ease;
    }
    .faq-answer.open { max-height: 300px; }

    /* Green CTA button */
    .btn-primary {
      background: #28396C;
      color: #fff;
      font-family: 'Nunito', sans-serif;
      font-weight: 700;
      font-size: 15px;
      padding: 13px 28px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: background 0.2s, transform 0.15s;
      text-decoration: none;
    }
    .btn-primary:hover { background: #1e2d5a; transform: translateY(-1px); }

    .btn-secondary {
      background: var(--surface-raised);
      color: #28396C;
      font-family: 'Nunito', sans-serif;
      font-weight: 700;
      font-size: 15px;
      padding: 13px 28px;
      border-radius: 12px;
      border: 2px solid #c0da94;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: border-color 0.2s, background 0.2s, transform 0.15s;
      text-decoration: none;
    }
    .btn-secondary:hover { border-color: #28396C; background: #F0FFC2; transform: translateY(-1px); }
    [data-theme="dark"] .btn-secondary { color: var(--content); }
    [data-theme="dark"] .btn-secondary:hover { border-color: #B5E18B; background: var(--brand-hover-bg); }

    /* Warm section bg */
    .section-alt { background: #f5f8ea; }
    [data-theme="dark"] .section-alt { background: var(--surface-sunken); }
    .section-green { background: #28396C; color: #fff; }

    /* Noise texture overlay for CTA */
    .cta-section {
      background: #28396C;
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(181,225,139,0.15) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 50%);
    }

    /* Divider */
    .section-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--line), transparent);
      margin: 0 auto;
      max-width: 80%;
    }

    /* Step connector line */
    .step-line {
      position: absolute;
      top: 20px;
      left: calc(50% + 24px);
      right: calc(-50% + 24px);
      height: 2px;
      background: #d1fae5;
    }
    [data-theme="dark"] .step-line { background: var(--line); }
  `}</style>
);

/* ─── Scroll fade hook ──────────────────────────────────────────────────────── */
function useFadeUp() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Data ──────────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: Calculator, color: '#28396C', bg: '#F0FFC2', title: 'Smart auto-calculation', desc: 'Every Finance Act 2025 slab, surcharge, and super tax rate is handled. You enter numbers, we do the math.' },
  { icon: Shield,     color: '#1d4ed8', bg: '#eff6ff', title: 'FBR-compliant forms',   desc: 'Built from the actual FBR Excel template — every field maps exactly to your official return.' },
  { icon: Clock,      color: '#b45309', bg: '#F0FFC2', title: 'Save & resume anytime', desc: 'Your return stays exactly where you left it. Come back tomorrow, next week — it\'s all there.' },
  { icon: FileText,   color: '#7c3aed', bg: '#f5f3ff', title: 'Complete form coverage', desc: '12 forms in one place: income, wealth statement, capital gains, final tax, and more.' },
  { icon: BarChart3,  color: '#be185d', bg: '#fdf2f8', title: 'Wealth reconciliation',  desc: 'Automatically reconciles opening and closing wealth so your statement always balances.' },
  { icon: Lock,       color: '#0f766e', bg: '#f0fdfa', title: 'Your data stays yours',  desc: 'Hosted on your own instance. No third-party access, no selling your financial data.' },
];

const PROFILES = [
  { icon: Briefcase, label: 'Salaried',        color: '#28396C', bg: '#F0FFC2',  desc: 'Salary, allowances, employer benefits' },
  { icon: TrendingUp,label: 'Salary + Extra',   color: '#b45309', bg: '#F0FFC2',  desc: 'Freelance, rental, or investment income' },
  { icon: Building2, label: 'Business',         color: '#1d4ed8', bg: '#eff6ff',  desc: 'Business, directorship, professional' },
  { icon: Home,      label: 'Property',         color: '#7c3aed', bg: '#f5f3ff',  desc: 'Rental income, property transactions' },
  { icon: BarChart3, label: 'Investor',         color: '#be185d', bg: '#fdf2f8',  desc: 'Capital gains, dividends, securities' },
  { icon: Globe,     label: 'Non-Resident',     color: '#0f766e', bg: '#f0fdfa',  desc: 'Pakistan-source income, remittances' },
];

const STEPS = [
  { n: '01', title: 'Create your account',    body: 'Enter your name, email and CNIC. Takes under a minute.' },
  { n: '02', title: 'Tell us about your income', body: 'Pick your profile and fill in only the sections that apply to you.' },
  { n: '03', title: 'Review the calculation', body: 'See your tax liability broken down — slab by slab, no surprises.' },
  { n: '04', title: 'Download and file',      body: 'Export your return, verify it, and submit directly to FBR.' },
];

const FAQS = [
  { q: 'Is this app official or affiliated with FBR?', a: 'No — it\'s an independent tool built to help individuals prepare their returns using the official FBR format. Always review before submitting.' },
  { q: 'Which tax year does it cover?',         a: 'Tax Year 2025-26 (income earned July 2025 – June 2026), fully updated for Finance Act 2025 including new slabs, surcharge, and super tax.' },
  { q: 'Does it handle salary AND rental income?', a: 'Yes. You can combine salaried income with rent, freelance, capital gains, and other sources in the same return.' },
  { q: 'What happens to my data?',             a: 'Your data lives in your own account. We don\'t share, sell, or transmit it to any third party.' },
  { q: 'Is the wealth statement included?',    a: 'Yes — the wealth statement, reconciliation, and all 12 FBR return forms are included.' },
];

/* ─── Components ──────────────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const scroll = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  };

  return (
    <nav className={`land-nav${scrolled ? ' scrolled' : ''}`} style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      backdropFilter: 'blur(12px)',
      borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      transition: 'all 0.3s ease',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <button type="button" aria-label="PakTax — back to top" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'none', border: 'none', padding: 0, font: 'inherit' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{ width: 34, height: 34, background: '#28396C', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={17} color="#fff" />
          </div>
          <span className="display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--content)', letterSpacing: '-0.02em' }}>
            Pak<span className="land-brand-ink" style={{ color: '#28396C' }}>Tax</span>
          </span>
        </button>

        {/* Desktop nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hide-mobile">
          {[['features','Features'],['profiles','Tax Profiles'],['how','How It Works'],['faq','FAQ']].map(([id, label]) => (
            <button type="button" key={id} className="nav-link underline-grow" onClick={() => scroll(id)}>{label}</button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hide-mobile">
          <Link to="/login" style={{ color: 'var(--content-muted)', fontWeight: 600, fontSize: 15, textDecoration: 'none', padding: '6px 4px', transition: 'color 0.2s' }}
            onMouseOver={e => e.target.style.color='#28396C'} onMouseOut={e => e.target.style.color='var(--content-muted)'}>
            Sign in
          </Link>
          <Link to="/onboarding" className="btn-primary" style={{ padding: '9px 20px', fontSize: 14, borderRadius: 10 }}>
            Get started free
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button onClick={() => setMobileOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'none' }} className="show-mobile">
          {mobileOpen ? <X size={22} color="var(--content)" /> : <Menu size={22} color="var(--content)" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--line)', padding: '16px 24px 24px' }}>
          {[['features','Features'],['profiles','Tax Profiles'],['how','How It Works'],['faq','FAQ']].map(([id, label]) => (
            <button type="button" key={id} onClick={() => scroll(id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', padding: '12px 0', fontFamily: 'inherit', fontWeight: 600, color: 'var(--content-muted)', cursor: 'pointer', fontSize: 15 }}>{label}</button>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <Link to="/login" className="btn-secondary" style={{ justifyContent: 'center' }}>Sign in</Link>
            <Link to="/onboarding" className="btn-primary" style={{ justifyContent: 'center' }}>Get started free</Link>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
        .land-nav { background: rgba(253,252,248,0.8); }
        .land-nav.scrolled { background: rgba(253,252,248,0.95); }
        [data-theme="dark"] .land-nav { background: rgba(15,20,38,0.8); }
        [data-theme="dark"] .land-nav.scrolled { background: rgba(15,20,38,0.95); }
      `}</style>
    </nav>
  );
}

/* ─── Hero ──────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section style={{ paddingTop: 100, paddingBottom: 80, maxWidth: 1120, margin: '0 auto', padding: '100px 24px 80px' }}>
      <div style={{ maxWidth: 720 }}>
        {/* Badge */}
        <div className="badge" style={{ marginBottom: 28 }}>
          <Star size={12} fill="#B5E18B" color="#B5E18B" />
          Finance Act 2025 — fully updated
        </div>

        {/* Headline */}
        <h1 className="display" style={{
          fontSize: 'clamp(38px, 5.5vw, 62px)',
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          color: 'var(--content)',
          marginBottom: 22,
        }}>
          File your Pakistan tax<br />
          return —{' '}
          <span className="land-brand-ink" style={{ color: '#28396C', position: 'relative', display: 'inline-block' }}>
            without the stress
            <svg style={{ position: 'absolute', bottom: -4, left: 0, width: '100%' }} height="6" viewBox="0 0 300 6" preserveAspectRatio="none">
              <path d="M0 5 Q75 0 150 4 Q225 8 300 3" stroke="#B5E18B" strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          </span>
        </h1>

        {/* Subtext */}
        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--content-muted)', maxWidth: 560, marginBottom: 36 }}>
          Guided, FBR-compliant tax preparation for salaried individuals,
          investors, and business owners. Auto-calculations. Zero guesswork.
          Built specifically for Pakistani taxpayers.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 44 }}>
          <Link to="/onboarding" className="btn-primary" style={{ fontSize: 15 }}>
            Start your free return <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn-secondary" style={{ fontSize: 15 }}>
            Sign in to existing account
          </Link>
        </div>

        {/* Social proof strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
          {[
            { icon: Check, text: 'No credit card needed' },
            { icon: Check, text: 'FBR-format export' },
            { icon: Check, text: 'Tax Year 2025-26' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--content-muted)', fontSize: 14, fontWeight: 600 }}>
              <div style={{ width: 18, height: 18, background: 'var(--brand-cream)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={10} color="#4a7a2a" strokeWidth={3} />
              </div>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Hero visual — tax summary card mockup */}
      <div style={{ marginTop: 64 }}>
        <div style={{ background: 'var(--surface-raised)', borderRadius: 20, border: '1px solid var(--line)', boxShadow: '0 8px 48px rgba(26,28,24,0.07)', padding: 28, maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--content-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Tax Computation Summary</p>
              <p className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--content)' }}>Tax Year 2025-26</p>
            </div>
            <div style={{ background: 'var(--brand-cream)', border: '1px solid var(--brand-cream-track)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 700, color: 'var(--brand-on-cream)' }}>FBR Compliant</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Total Income',     value: 'Rs 18,00,000', sub: 'Annual salary + allowances' },
              { label: 'Tax Liability',    value: 'Rs 1,02,600',  sub: 'After Finance Act 2025 slabs' },
              { label: 'Withholding Tax',  value: 'Rs 85,500',    sub: 'Deducted by employer' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ background: 'var(--surface-sunken)', borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--content-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</p>
                <p className="display" style={{ fontSize: 17, fontWeight: 700, color: 'var(--content)', marginBottom: 3 }}>{value}</p>
                <p style={{ fontSize: 11, color: 'var(--content-subtle)', fontWeight: 500 }}>{sub}</p>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--brand-cream)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#28396C', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={16} color="#fff" strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-on-cream-navy)' }}>Balance payable to FBR</p>
                <p style={{ fontSize: 11, color: 'var(--brand-on-cream-navy)', fontWeight: 500 }}>After withholding tax credit</p>
              </div>
            </div>
            <p className="display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-on-cream-navy)' }}>Rs 17,100</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats Bar ─────────────────────────────────────────────────────────────── */
function StatsBar() {
  const ref = useFadeUp();
  return (
    <div ref={ref} className="fade-up section-alt" style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {[
          { value: '12', unit: 'forms',   label: 'Complete return coverage' },
          { value: '2025', unit: '-26',   label: 'Tax year supported'       },
          { value: '100%', unit: '',      label: 'FBR-format compliant'     },
          { value: 'Free', unit: '',      label: 'No subscription, no fees' },
        ].map(({ value, unit, label }) => (
          <div key={label} style={{ textAlign: 'center', padding: '16px 8px' }}>
            <p className="display" style={{ fontSize: 30, fontWeight: 800, color: '#28396C', lineHeight: 1, marginBottom: 4 }}>
              {value}<span style={{ fontSize: 16 }}>{unit}</span>
            </p>
            <p style={{ fontSize: 13, color: 'var(--content-muted)', fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Features ──────────────────────────────────────────────────────────────── */
function Features() {
  const ref = useFadeUp();
  return (
    <section id="features" style={{ padding: '88px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div ref={ref} className="fade-up" style={{ marginBottom: 56 }}>
          <p className="land-brand-ink" style={{ fontSize: 13, fontWeight: 700, color: '#28396C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Built for accuracy</p>
          <h2 className="display" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: 520 }}>
            Everything you need to file correctly
          </h2>
          <p style={{ marginTop: 14, fontSize: 17, color: 'var(--content-muted)', lineHeight: 1.65, maxWidth: 480 }}>
            Built around the FBR return format — not a generic tax tool adapted for Pakistan.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }, i) => (
            <FeatureCard key={title} Icon={Icon} color={color} bg={bg} title={title} desc={desc} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ Icon, color, bg, title, desc, delay }) {
  const ref = useFadeUp();
  return (
    <div ref={ref} className="fade-up feature-card" style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: '24px 24px 26px',
      transitionDelay: `${delay}ms`,
    }}>
      <div style={{ width: 44, height: 44, background: bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon size={20} color={color} />
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--content)', marginBottom: 8, lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--content-muted)', lineHeight: 1.65, fontWeight: 500 }}>{desc}</p>
    </div>
  );
}

/* ─── Tax Profiles ──────────────────────────────────────────────────────────── */
function TaxProfiles() {
  const ref = useFadeUp();
  return (
    <section id="profiles" className="section-alt" style={{ padding: '88px 24px', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div ref={ref} className="fade-up" style={{ marginBottom: 52 }}>
          <p className="land-brand-ink" style={{ fontSize: 13, fontWeight: 700, color: '#28396C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Who it's for</p>
          <h2 className="display" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Built for your situation
          </h2>
          <p style={{ marginTop: 14, fontSize: 17, color: 'var(--content-muted)', lineHeight: 1.65, maxWidth: 480 }}>
            Whether you're salaried, run a business, or earn from investments — the right forms are pre-loaded for you.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {PROFILES.map(({ icon: Icon, label, color, bg, desc }, i) => (
            <ProfileCard key={label} Icon={Icon} label={label} color={color} bg={bg} desc={desc} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfileCard({ Icon, label, color, bg, desc, delay }) {
  const ref = useFadeUp();
  return (
    <div ref={ref} className="fade-up profile-card" style={{
      background: 'var(--surface-raised)',
      border: '1px solid var(--line)',
      borderRadius: 16,
      padding: '22px 20px',
      cursor: 'default',
      transitionDelay: `${delay}ms`,
    }}>
      <div style={{ width: 42, height: 42, background: bg, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon size={19} color={color} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--content)', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 13, color: 'var(--content-muted)', fontWeight: 500, lineHeight: 1.5 }}>{desc}</p>
    </div>
  );
}

/* ─── How It Works ──────────────────────────────────────────────────────────── */
function HowItWorks() {
  const ref = useFadeUp();
  return (
    <section id="how" style={{ padding: '88px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div ref={ref} className="fade-up" style={{ marginBottom: 56 }}>
          <p className="land-brand-ink" style={{ fontSize: 13, fontWeight: 700, color: '#28396C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Simple process</p>
          <h2 className="display" style={{ fontSize: 'clamp(28px, 3.5vw, 40px)', fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            From signup to submission<br />in four steps
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
          {STEPS.map(({ n, title, body }, i) => (
            <StepCard key={n} n={n} title={title} body={body} delay={i * 90} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCard({ n, title, body, delay }) {
  const ref = useFadeUp();
  return (
    <div ref={ref} className="fade-up" style={{ transitionDelay: `${delay}ms` }}>
      <div style={{ marginBottom: 16 }}>
        <span className="display" style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-on-cream-navy)', letterSpacing: '0.04em', background: 'var(--brand-cream)', border: '1px solid var(--brand-cream-track)', padding: '3px 10px', borderRadius: 100 }}>{n}</span>
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--content)', marginBottom: 8, lineHeight: 1.3 }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--content-muted)', lineHeight: 1.65, fontWeight: 500 }}>{body}</p>
    </div>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState(null);
  const ref = useFadeUp();
  return (
    <section id="faq" className="section-alt" style={{ padding: '88px 24px', borderTop: '1px solid var(--line)' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div ref={ref} className="fade-up" style={{ marginBottom: 48, textAlign: 'center' }}>
          <p className="land-brand-ink" style={{ fontSize: 13, fontWeight: 700, color: '#28396C', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Common questions</p>
          <h2 className="display" style={{ fontSize: 'clamp(26px, 3.5vw, 36px)', fontWeight: 800, color: 'var(--content)', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            Honest answers, no jargon
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map(({ q, a }, i) => (
            <FaqItem key={i} q={q} a={a} isOpen={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s', ...(isOpen ? { borderColor: '#c0da94' } : {}) }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 20px', gap: 16, textAlign: 'left',
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--content)', lineHeight: 1.4, fontFamily: "'Nunito', sans-serif" }}>{q}</span>
        <span style={{ flexShrink: 0, width: 24, height: 24, background: isOpen ? '#28396C' : 'var(--surface-sunken)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s, transform 0.3s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}>
          <ChevronDown size={14} color={isOpen ? '#fff' : 'var(--content-muted)'} />
        </span>
      </button>
      <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
        <p style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--content-muted)', lineHeight: 1.7, fontWeight: 500 }}>{a}</p>
      </div>
    </div>
  );
}

/* ─── CTA ────────────────────────────────────────────────────────────────────── */
function CTA() {
  const ref = useFadeUp();
  return (
    <section style={{ padding: '80px 24px' }}>
      <div ref={ref} className="fade-up cta-section" style={{ maxWidth: 1120, margin: '0 auto', borderRadius: 24, padding: 'clamp(40px, 6vw, 72px) clamp(28px, 5vw, 64px)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#B5E18B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Ready when you are</p>
        <h2 className="display" style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: 18 }}>
          Stop putting off your tax return
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, maxWidth: 460, margin: '0 auto 36px', fontWeight: 500 }}>
          It's free, guided, and takes most people under an hour. Start now and file with confidence.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link to="/onboarding" style={{
            background: '#B5E18B', color: '#1c1100', fontFamily: "'Nunito', sans-serif",
            fontWeight: 800, fontSize: 15, padding: '13px 28px', borderRadius: 12, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'background 0.2s, transform 0.15s',
          }} onMouseOver={e => e.currentTarget.style.background='#4a7a2a'} onMouseOut={e => e.currentTarget.style.background='#B5E18B'}>
            Start your free return <ArrowRight size={16} />
          </Link>
          <Link to="/login" style={{
            background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)',
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 15, padding: '13px 28px',
            borderRadius: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'background 0.2s',
          }} onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.18)'} onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}>
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', padding: '36px 24px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#28396C', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={14} color="#fff" />
          </div>
          <span className="display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--content)' }}>PakTax</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--content-subtle)', fontWeight: 500, maxWidth: 420, lineHeight: 1.5, textAlign: 'center', flex: '1 1 260px' }}>
          An independent tool for preparing Pakistani income tax returns. Not affiliated with FBR.
          Always review your return before submission.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Help'].map(label => (
            <span key={label} style={{ fontSize: 13, color: 'var(--content-muted)', fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseOver={e => e.target.style.color='#28396C'} onMouseOut={e => e.target.style.color='var(--content-muted)'}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="land-root">
      <FontLoader />
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <Features />
        <TaxProfiles />
        <HowItWorks />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
