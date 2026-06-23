import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown, ArrowRight, Check, Menu, X,
} from 'lucide-react';
import BrandMark from '../common/BrandMark';

/* ───────────────────────────────────────────────────────────────────────────
   Landing page — dark, system-font aesthetic modelled on mtplx.com.
   Self-contained palette (always dark, independent of the app theme) so the
   look matches the reference: near-black canvas, SF-Pro/system type, big
   tight-tracked headings, monospace eyebrows with a lime status dot.

   COPY RULE: every claim here must be true of the actual product. MeraTax
   PREPARES and COMPUTES a return and EXPORTS it in FBR's IRIS format — it does
   NOT e-file with FBR. The user files on FBR's IRIS portal. No invented stats,
   testimonials, or "submit to FBR" promises.
   ─────────────────────────────────────────────────────────────────────────── */

const Styles = () => (
  <style>{`
    .land-root {
      /* Self-contained dark palette — does not read the app's theme tokens. */
      --l-bg: #0a0a0a;
      --l-bg2: #0f0f0f;
      --l-card: #151515;
      --l-card2: #1b1b1b;
      --l-border: rgba(255,255,255,0.09);
      --l-border2: rgba(255,255,255,0.16);
      --l-head: #f2f2f2;
      --l-text: #c7c7c7;
      --l-muted: #8c8c8c;
      --l-faint: #6a6a6a;
      --l-lime: #B5E18B;
      --l-sans: -apple-system, system-ui, "SF Pro Display", "Segoe UI", Inter, Roboto, sans-serif;
      --l-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

      font-family: var(--l-sans);
      background: var(--l-bg);
      color: var(--l-text);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    .land-root *, .land-root *::before, .land-root *::after { box-sizing: border-box; }

    .l-wrap { max-width: 1120px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }

    /* Monospace eyebrow with a lime status dot */
    .l-eyebrow {
      font-family: var(--l-mono);
      font-size: 12px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--l-muted);
      display: inline-flex;
      align-items: center;
      gap: 9px;
    }
    .l-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--l-lime); box-shadow: 0 0 10px rgba(181,225,139,0.7); flex-shrink: 0; }

    .l-h1 {
      font-family: var(--l-sans);
      font-weight: 700;
      font-size: clamp(40px, 6.4vw, 74px);
      line-height: 1.02;
      letter-spacing: -0.035em;
      color: var(--l-head);
      margin: 0;
    }
    .l-h2 {
      font-family: var(--l-sans);
      font-weight: 700;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: var(--l-head);
      margin: 0;
    }
    .l-h3 {
      font-family: var(--l-sans);
      font-weight: 600;
      font-size: 19px;
      letter-spacing: -0.015em;
      color: var(--l-head);
      margin: 0;
    }
    .l-lime { color: var(--l-lime); }
    .l-lead { font-size: clamp(16px, 1.6vw, 19px); line-height: 1.6; color: var(--l-muted); }

    /* Buttons — primary is a white pill (mtplx), secondary is a ghost outline */
    .l-btn {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--l-sans); font-weight: 600; font-size: 15px;
      padding: 12px 22px; border-radius: 100px; cursor: pointer;
      text-decoration: none; border: 1px solid transparent;
      transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, opacity 0.18s ease;
    }
    .l-btn-primary { background: #f5f5f5; color: #0a0a0a; }
    .l-btn-primary:hover { background: #fff; transform: translateY(-1px); }
    .l-btn-ghost { background: transparent; color: var(--l-head); border-color: var(--l-border2); }
    .l-btn-ghost:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }

    .l-meta { font-family: var(--l-mono); font-size: 12px; letter-spacing: 0.04em; color: var(--l-faint); }

    /* Surfaces */
    .l-card { background: var(--l-card); border: 1px solid var(--l-border); border-radius: 18px; }
    .l-chip {
      display: inline-flex; align-items: center; gap: 7px;
      background: var(--l-card2); border: 1px solid var(--l-border);
      border-radius: 100px; padding: 6px 13px; font-size: 13px; color: var(--l-text);
    }

    /* Nav */
    .l-nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: rgba(10,10,10,0.6); backdrop-filter: blur(14px);
      border-bottom: 1px solid transparent; transition: border-color 0.3s ease, background 0.3s ease;
    }
    .l-nav.scrolled { background: rgba(10,10,10,0.86); border-bottom-color: var(--l-border); }
    .l-navlink {
      background: none; border: none; cursor: pointer; font-family: var(--l-sans);
      color: var(--l-muted); font-size: 14px; font-weight: 500; padding: 6px 2px;
      transition: color 0.18s;
    }
    .l-navlink:hover { color: var(--l-head); }

    /* Scroll reveal */
    .l-fade { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease, transform 0.6s ease; }
    .l-fade.vis { opacity: 1; transform: translateY(0); }

    /* Feature row: text + visual, alternating */
    .l-feat { display: grid; grid-template-columns: 1fr; gap: 36px; align-items: center; }
    @media (min-width: 900px) {
      .l-feat { grid-template-columns: 1fr 1fr; gap: 64px; }
      .l-feat.rev .l-feat-text { order: 2; }
    }

    .l-hero { display: grid; grid-template-columns: 1fr; gap: 56px; align-items: center; }
    @media (min-width: 980px) { .l-hero { grid-template-columns: 1.04fr 0.96fr; gap: 56px; } }

    .l-mock-glow {
      position: absolute; inset: -10% -6%;
      background: radial-gradient(ellipse at 60% 30%, rgba(181,225,139,0.16) 0%, transparent 62%);
      filter: blur(10px); pointer-events: none;
    }

    .l-faq-a { max-height: 0; overflow: hidden; transition: max-height 0.32s ease; }
    .l-faq-a.open { max-height: 320px; }

    @media (max-width: 768px) {
      .l-hide-m { display: none !important; }
      .l-show-m { display: inline-flex !important; }
    }
    @media (min-width: 769px) { .l-show-m { display: none !important; } }
    @media (prefers-reduced-motion: reduce) {
      .l-fade { opacity: 1; transform: none; transition: none; }
    }
  `}</style>
);

/* ─── Scroll-reveal hook ─────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('vis'); obs.disconnect(); }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── Truthful content ───────────────────────────────────────────────────── */
// FBR Finance Act 2025 salaried slabs applied to Rs 2,400,000 → Rs 162,000.
// Shown as an EXAMPLE in the hero mockup, labelled as such.
const SLABS = [
  { rate: '0%',  width: 25,    color: '#3a3a3a' },
  { rate: '1%',  width: 25,    color: '#6f7f55' },
  { rate: '11%', width: 41.67, color: '#90b56a' },
  { rate: '23%', width: 8.33,  color: '#B5E18B' },
];

const FEATURES = [
  {
    n: '01', kicker: 'COVERAGE',
    title: 'All 12 FBR forms, in one place.',
    body: 'Income, wealth statement and reconciliation, capital gains, final and minimum tax, adjustable tax, credits and deductions — the full individual return, built from the official FBR format.',
    visual: 'forms',
  },
  {
    n: '02', kicker: 'INCOME',
    title: 'Salary, and everything alongside it.',
    body: 'Add rental, capital gains and securities, dividends, bank profit, foreign income, pension and more. Only the sections that apply to you appear. Coverage is strongest for salaried individuals.',
    visual: 'income',
  },
  {
    n: '03', kicker: 'AI CONSULTANT',
    title: 'A tax consultant, on call.',
    body: 'Ask questions in plain language. Answers are grounded in FBR documents and the current year’s slabs — guidance to help you understand your return, not a substitute for a professional advisor.',
    visual: 'chat',
  },
  {
    n: '04', kicker: 'EXPORT',
    title: 'A return ready for IRIS.',
    body: 'Download your return in FBR’s IRIS 114(1) format, then file it yourself on FBR’s IRIS portal. Upload last year’s IRIS PDF to carry figures forward.',
    visual: 'export',
  },
];

const INCOME_TYPES = [
  'Salary & allowances', 'Rental income', 'Capital gains & securities',
  'Dividends & bank profit', 'Foreign income', 'Pension', 'Agriculture', 'Prizes & winnings',
];

const STEPS = [
  { n: '01', title: 'Create your account', body: 'Name, email and CNIC — or sign in with Google or Apple. Under a minute.' },
  { n: '02', title: 'Tell us your income', body: 'Pick your income types and the matching forms load. Fill only what applies.' },
  { n: '03', title: 'Review the computation', body: 'See your liability slab by slab, with your wealth statement reconciled.' },
  { n: '04', title: 'Export and file', body: 'Download your IRIS-format return and file it on FBR’s IRIS portal.' },
];

const FAQS = [
  { q: 'Is MeraTax affiliated with FBR?', a: 'No. MeraTax is an independent tool that helps you prepare your return in the official FBR format. Always review your figures before filing on FBR’s IRIS portal.' },
  { q: 'Does MeraTax file my return for me?', a: 'No. MeraTax prepares and computes your return and exports it in FBR’s IRIS format. You submit it yourself on FBR’s IRIS portal — there is no direct e-filing.' },
  { q: 'Which tax year does it cover?', a: 'Tax Year 2025-26 (income earned July 2025 – June 2026), updated for Finance Act 2025 slabs, surcharge and super tax.' },
  { q: 'What income types are supported?', a: 'Salary plus rental, capital gains and securities, dividends, bank profit, foreign income, pension and more — in a single return. Coverage is strongest for salaried individuals.' },
  { q: 'What happens to my data?', a: 'Your return lives in your account and we don’t sell your financial data. If you use the AI consultant, your question is sent to our AI provider to generate an answer.' },
  { q: 'How much does it cost?', a: 'MeraTax is free to use.' },
];

/* ─── Nav ────────────────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const go = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setOpen(false); };
  const links = [['features', 'Features'], ['how', 'How it works'], ['faq', 'FAQ']];

  return (
    <nav className={`l-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="l-wrap" style={{ height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button type="button" aria-label="MeraTax — top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <BrandMark size={30} />
          <span style={{ fontFamily: 'var(--l-sans)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--l-head)' }}>
            Mera<span className="l-lime">Tax</span>
          </span>
        </button>

        <div className="l-hide-m" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          {links.map(([id, label]) => <button key={id} type="button" className="l-navlink" onClick={() => go(id)}>{label}</button>)}
        </div>

        <div className="l-hide-m" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to="/login" className="l-navlink" style={{ textDecoration: 'none' }}>Sign in</Link>
          <Link to="/onboarding" className="l-btn l-btn-primary" style={{ padding: '9px 18px', fontSize: 14 }}>Get started</Link>
        </div>

        <button className="l-show-m" onClick={() => setOpen(v => !v)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          {open ? <X size={22} color="var(--l-head)" /> : <Menu size={22} color="var(--l-head)" />}
        </button>
      </div>

      {open && (
        <div style={{ background: 'var(--l-bg)', borderTop: '1px solid var(--l-border)', padding: '14px 24px 22px' }}>
          {links.map(([id, label]) => (
            <button key={id} type="button" onClick={() => go(id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--l-border)', padding: '12px 0', fontFamily: 'var(--l-sans)', fontWeight: 500, color: 'var(--l-text)', cursor: 'pointer', fontSize: 15 }}>{label}</button>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <Link to="/login" className="l-btn l-btn-ghost" style={{ justifyContent: 'center' }}>Sign in</Link>
            <Link to="/onboarding" className="l-btn l-btn-primary" style={{ justifyContent: 'center' }}>Get started</Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Hero ───────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="l-wrap" style={{ padding: '132px 24px 72px' }}>
      <div className="l-hero">
        {/* Left */}
        <div>
          <div className="l-eyebrow" style={{ marginBottom: 26 }}>
            <span className="l-dot" /> FINANCE ACT 2025 · TAX YEAR 2025-26
          </div>
          <h1 className="l-h1">
            Your tax return,<br />
            <span className="l-lime">prepared properly.</span>
          </h1>
          <p className="l-lead" style={{ maxWidth: 500, margin: '26px 0 34px' }}>
            MeraTax builds your FBR return as you type — income, wealth statement, and every
            Finance Act 2025 slab computed for you. Export it in FBR’s IRIS format, ready to file.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 30 }}>
            <Link to="/onboarding" className="l-btn l-btn-primary">Start free <ArrowRight size={16} /></Link>
            <button type="button" className="l-btn l-btn-ghost" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</button>
          </div>
          <p className="l-meta">Free to use · Google &amp; Apple sign-in · Not affiliated with FBR</p>
        </div>

        {/* Right — example computation mockup */}
        <div style={{ position: 'relative', maxWidth: 460, width: '100%', margin: '0 auto' }}>
          <div className="l-mock-glow" />
          <div className="l-card" style={{ position: 'relative', padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <p className="l-meta" style={{ marginBottom: 4 }}>TAX COMPUTATION · EXAMPLE</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--l-head)', fontFamily: 'var(--l-sans)' }}>Tax Year 2025-26</p>
              </div>
              <span className="l-chip" style={{ fontFamily: 'var(--l-mono)', fontSize: 11, letterSpacing: '0.06em', color: 'var(--l-lime)' }}>IRIS FORMAT</span>
            </div>

            {[
              { label: 'Total income', value: 'Rs 24,00,000', sub: 'Salary + allowances' },
              { label: 'Tax liability', value: 'Rs 1,62,000', sub: 'Finance Act 2025 slabs' },
              { label: 'Withholding credit', value: '− Rs 1,38,000', sub: 'Deducted by employer' },
            ].map(({ label, value, sub }, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '11px 2px', borderTop: i === 0 ? 'none' : '1px solid var(--l-border)' }}>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--l-head)' }}>{label}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--l-faint)' }}>{sub}</p>
                </div>
                <p style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--l-head)', whiteSpace: 'nowrap', fontFamily: 'var(--l-mono)' }}>{value}</p>
              </div>
            ))}

            <div style={{ margin: '8px 0 16px' }}>
              <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                {SLABS.map(s => <div key={s.rate} style={{ width: `${s.width}%`, background: s.color, borderRadius: 2 }} />)}
              </div>
              <p className="l-meta">COMPUTED SLAB BY SLAB · 0% · 1% · 11% · 23%</p>
            </div>

            <div style={{ background: 'var(--l-card2)', border: '1px solid var(--l-border)', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, background: 'var(--l-lime)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Check size={15} color="#0a0a0a" strokeWidth={3} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--l-head)' }}>Balance payable</p>
                  <p style={{ fontSize: 11, color: 'var(--l-faint)' }}>After withholding credit</p>
                </div>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--l-lime)', whiteSpace: 'nowrap', fontFamily: 'var(--l-mono)' }}>Rs 24,000</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Stat strip ─────────────────────────────────────────────────────────── */
function Stats() {
  const ref = useReveal();
  const items = [
    ['12', 'FBR return forms'],
    ['2025-26', 'Tax year supported'],
    ['IRIS', 'Export format'],
    ['Free', 'No subscription'],
  ];
  return (
    <div ref={ref} className="l-fade" style={{ borderTop: '1px solid var(--l-border)', borderBottom: '1px solid var(--l-border)', background: 'var(--l-bg2)' }}>
      <div className="l-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, padding: '30px 24px' }}>
        {items.map(([v, l]) => (
          <div key={l} style={{ textAlign: 'center', padding: '12px 8px' }}>
            <p style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--l-head)', fontFamily: 'var(--l-sans)', marginBottom: 5 }}>{v}</p>
            <p className="l-meta">{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature visuals ────────────────────────────────────────────────────── */
function FeatureVisual({ kind }) {
  if (kind === 'forms') {
    const forms = ['Income', 'Wealth statement', 'Reconciliation', 'Capital gains', 'Final / min tax', 'Adjustable tax', 'Credits', 'Deductions'];
    return (
      <div className="l-card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {forms.map((f, i) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'var(--l-card2)', border: '1px solid var(--l-border)', borderRadius: 10, padding: '10px 12px' }}>
            <Check size={14} color="var(--l-lime)" strokeWidth={3} />
            <span style={{ fontSize: 13, color: 'var(--l-text)' }}>{f}</span>
            {i === 7 && <span className="l-meta" style={{ marginLeft: 'auto' }}>+4</span>}
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'income') {
    return (
      <div className="l-card" style={{ padding: 22, display: 'flex', flexWrap: 'wrap', gap: 9 }}>
        {INCOME_TYPES.map(t => <span key={t} className="l-chip">{t}</span>)}
      </div>
    );
  }
  if (kind === 'chat') {
    return (
      <div className="l-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <span style={{ background: 'var(--l-card2)', border: '1px solid var(--l-border)', borderRadius: '14px 14px 4px 14px', padding: '10px 14px', fontSize: 13, color: 'var(--l-head)', maxWidth: '85%' }}>
            Can I claim my mutual-fund investment as a tax credit?
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--l-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BrandMark size={16} glyphOnly stem="#0a0a0a" />
          </div>
          <span style={{ background: 'var(--l-card2)', border: '1px solid var(--l-border)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', fontSize: 13, color: 'var(--l-text)', lineHeight: 1.55, maxWidth: '85%' }}>
            Under Finance Act 2025, an eligible investment can qualify for a tax credit, subject to limits. Here’s how it applies to your return…
          </span>
        </div>
        <p className="l-meta" style={{ marginTop: 14 }}>GUIDANCE · NOT A SUBSTITUTE FOR PROFESSIONAL ADVICE</p>
      </div>
    );
  }
  // export
  return (
    <div className="l-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 48, borderRadius: 7, background: 'var(--l-card2)', border: '1px solid var(--l-border2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6 }}>
          <span style={{ fontFamily: 'var(--l-mono)', fontSize: 9, color: 'var(--l-lime)' }}>PDF</span>
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--l-head)' }}>Return_2025-26_114(1).pdf</p>
          <p className="l-meta">FBR IRIS 114(1) FORMAT</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--l-text)' }}>
        <Check size={14} color="var(--l-lime)" strokeWidth={3} /> File it yourself on FBR’s IRIS portal
      </div>
    </div>
  );
}

/* ─── Feature sections ───────────────────────────────────────────────────── */
function Features() {
  return (
    <section id="features" className="l-wrap" style={{ padding: '96px 24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
        {FEATURES.map((f, i) => <FeatureRow key={f.n} f={f} rev={i % 2 === 1} />)}
      </div>
    </section>
  );
}

function FeatureRow({ f, rev }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`l-fade l-feat${rev ? ' rev' : ''}`}>
      <div className="l-feat-text">
        <div className="l-eyebrow" style={{ marginBottom: 16 }}><span className="l-dot" /> {f.n} · {f.kicker}</div>
        <h2 className="l-h2" style={{ marginBottom: 18 }}>{f.title}</h2>
        <p className="l-lead" style={{ maxWidth: 460 }}>{f.body}</p>
      </div>
      <div><FeatureVisual kind={f.visual} /></div>
    </div>
  );
}

/* ─── How it works ───────────────────────────────────────────────────────── */
function HowItWorks() {
  const ref = useReveal();
  return (
    <section id="how" style={{ padding: '96px 24px', background: 'var(--l-bg2)', borderTop: '1px solid var(--l-border)', borderBottom: '1px solid var(--l-border)' }}>
      <div className="l-wrap" style={{ padding: 0 }}>
        <div ref={ref} className="l-fade" style={{ marginBottom: 56 }}>
          <div className="l-eyebrow" style={{ marginBottom: 16 }}><span className="l-dot" /> HOW IT WORKS</div>
          <h2 className="l-h2" style={{ maxWidth: 600 }}>From signup to a filing-ready return.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 28 }}>
          {STEPS.map(s => (
            <div key={s.n}>
              <p style={{ fontFamily: 'var(--l-mono)', fontSize: 13, color: 'var(--l-lime)', letterSpacing: '0.08em', marginBottom: 14 }}>{s.n}</p>
              <h3 className="l-h3" style={{ marginBottom: 9, fontSize: 17 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--l-muted)', lineHeight: 1.6 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ────────────────────────────────────────────────────────────────── */
function FAQ() {
  const [open, setOpen] = useState(null);
  const ref = useReveal();
  return (
    <section id="faq" className="l-wrap" style={{ padding: '96px 24px', maxWidth: 760 }}>
      <div ref={ref} className="l-fade" style={{ marginBottom: 44, textAlign: 'center' }}>
        <div className="l-eyebrow" style={{ marginBottom: 16, justifyContent: 'center' }}><span className="l-dot" /> FAQ</div>
        <h2 className="l-h2">Honest answers.</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQS.map((f, i) => (
          <div key={i} className="l-card" style={{ overflow: 'hidden', borderColor: open === i ? 'var(--l-border2)' : 'var(--l-border)' }}>
            <button onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', gap: 16, textAlign: 'left' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--l-head)', lineHeight: 1.4, fontFamily: 'var(--l-sans)' }}>{f.q}</span>
              <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: open === i ? 'var(--l-lime)' : 'var(--l-card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s, transform 0.3s', transform: open === i ? 'rotate(180deg)' : 'none' }}>
                <ChevronDown size={14} color={open === i ? '#0a0a0a' : 'var(--l-muted)'} />
              </span>
            </button>
            <div className={`l-faq-a ${open === i ? 'open' : ''}`}>
              <p style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--l-muted)', lineHeight: 1.7 }}>{f.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA ────────────────────────────────────────────────────────────────── */
function CTA() {
  const ref = useReveal();
  return (
    <section className="l-wrap" style={{ padding: '40px 24px 96px' }}>
      <div ref={ref} className="l-fade l-card" style={{ textAlign: 'center', padding: 'clamp(44px, 6vw, 80px) 24px', background: 'var(--l-bg2)' }}>
        <div className="l-eyebrow" style={{ marginBottom: 20, justifyContent: 'center' }}><span className="l-dot" /> READY WHEN YOU ARE</div>
        <h2 className="l-h2" style={{ maxWidth: 560, margin: '0 auto 18px' }}>Start your return today.</h2>
        <p className="l-lead" style={{ maxWidth: 440, margin: '0 auto 32px' }}>
          It’s free, guided, and most people finish in under an hour.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Link to="/onboarding" className="l-btn l-btn-primary">Start free <ArrowRight size={16} /></Link>
          <Link to="/login" className="l-btn l-btn-ghost">Sign in</Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--l-border)', padding: '36px 24px' }}>
      <div className="l-wrap" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrandMark size={28} />
          <span style={{ fontFamily: 'var(--l-sans)', fontSize: 15, fontWeight: 700, color: 'var(--l-head)' }}>MeraTax</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--l-faint)', maxWidth: 460, lineHeight: 1.6, textAlign: 'center', flex: '1 1 280px', fontFamily: 'var(--l-mono)' }}>
          Independent tool for preparing Pakistani income tax returns. Not affiliated with FBR. Review your return before filing.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy', 'Terms', 'Help'].map(l => (
            <span key={l} className="l-navlink" style={{ fontSize: 13, cursor: 'pointer' }}>{l}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export default function Landing() {
  return (
    <div className="land-root">
      <Styles />
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
