import React from 'react';

/**
 * MeraTax full logo lockup — stylised green "M" with a navy check-card,
 * the "MeraTax" wordmark, and an optional tagline. Vector + transparent, so it
 * sits on any background.
 *
 * Props:
 *   width       — rendered width in px (height scales to keep the ratio)
 *   tone        — 'dark'  → white wordmark/tagline (for dark/navy surfaces)
 *                 'light' → navy wordmark/tagline (for light/cream surfaces)
 *   showTagline — include the "PAKISTAN'S SMART TAX COMPANION" line (default true)
 *
 * The mark itself (green M + navy card + white check) is colour-stable across
 * tones; only the wordmark/tagline text colour flips. "Tax" stays brand green.
 */
let _seq = 0;

const BrandLockup = ({ width = 240, tone = 'dark', showTagline = true, className, style, title = 'MeraTax' }) => {
  // Unique gradient/filter ids so multiple lockups on one page don't collide.
  const uid = React.useMemo(() => `mtl${++_seq}`, []);
  const textColor = tone === 'light' ? '#0A2742' : '#FFFFFF';
  const vbHeight = showTagline ? 900 : 792;
  const height = Math.round((width * vbHeight) / 1200);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 1200 ${vbHeight}`}
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${uid}-green`} x1="260" y1="170" x2="790" y2="530" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00E887" />
          <stop offset="0.58" stopColor="#00C978" />
          <stop offset="1" stopColor="#06945E" />
        </linearGradient>
        <linearGradient id={`${uid}-greenDark`} x1="260" y1="420" x2="420" y2="650" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#04B978" />
          <stop offset="1" stopColor="#007A51" />
        </linearGradient>
        <linearGradient id={`${uid}-navy`} x1="735" y1="365" x2="930" y2="605" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0A2742" />
          <stop offset="1" stopColor="#061726" />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Logo mark */}
      <g filter={`url(#${uid}-shadow)`}>
        <path d="M285 260 Q285 215 330 215 L390 215 Q425 215 425 250 L425 610 L330 610 Q285 610 285 565 Z" fill={`url(#${uid}-greenDark)`} />
        <path d="M319 210 Q349 188 378 213 L600 405 L822 213 Q851 188 881 210 Q910 230 910 268 L910 330 L602 585 Q590 595 578 585 L285 332 L285 268 Q285 230 319 210 Z" fill={`url(#${uid}-green)`} />
        <path d="M745 445 L920 300 L920 565 Q920 610 875 610 L775 610 Q735 610 735 570 L735 480 Q735 458 745 445 Z" fill={`url(#${uid}-navy)`} />
        <path d="M790 525 L835 570 L890 490" fill="none" stroke="#FFFFFF" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Wordmark */}
      <text
        x="600"
        y="745"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque', Manrope, Inter, Arial, sans-serif"
        fontWeight="800"
        fontSize="132"
        letterSpacing="-5"
      >
        <tspan fill={textColor}>Mera</tspan>
        <tspan fill="#00D47C">Tax</tspan>
      </text>

      {/* Tagline */}
      {showTagline && (
        <text
          x="600"
          y="810"
          textAnchor="middle"
          fontFamily="'Bricolage Grotesque', Manrope, Inter, Arial, sans-serif"
          fontSize="33"
          fontWeight="700"
          letterSpacing="10"
          fill={textColor}
        >
          PAKISTAN&#8217;S SMART TAX COMPANION
        </text>
      )}
    </svg>
  );
};

export default BrandLockup;
