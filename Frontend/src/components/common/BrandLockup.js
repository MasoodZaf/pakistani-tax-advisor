import React from 'react';

/**
 * MeraTax full logo lockup — stylised green "M" whose right leg is an outlined
 * check-card, the "MeraTax" wordmark, and an optional tagline. Vector +
 * transparent (no baked background, transparent card interior), so it sits
 * cleanly on any surface.
 *
 * Props:
 *   width       — rendered width in px (height scales to keep the ratio)
 *   tone        — 'dark'  → white wordmark/tagline + white card outline
 *                 'light' → navy wordmark/tagline + navy card outline
 *   showTagline — include the "PAKISTAN'S SMART TAX COMPANION" line (default true)
 *
 * The green "M" and the green check are colour-stable; only the wordmark,
 * tagline, and the card OUTLINE flip with tone (so the outline stays visible on
 * both dark and light backgrounds). "Tax" stays brand green.
 */
let _seq = 0;

const BrandLockup = ({ width = 220, tone = 'dark', showTagline = true, className, style, title = 'MeraTax' }) => {
  const uid = React.useMemo(() => `mtl${++_seq}`, []);
  const ink = tone === 'light' ? '#0A2742' : '#FFFFFF'; // wordmark/tagline + card outline
  // Heights include the wordmark; the taller one also fits the tagline line.
  const vb = showTagline ? { y: 188, h: 840 } : { y: 188, h: 792 };
  const height = Math.round((width * vb.h) / 1200);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 ${vb.y} 1200 ${vb.h}`}
      className={className}
      style={style}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${uid}-gMain`} x1="315" y1="230" x2="875" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#08F08B" />
          <stop offset="0.55" stopColor="#00C979" />
          <stop offset="1" stopColor="#00A96B" />
        </linearGradient>
        <linearGradient id={`${uid}-gDark`} x1="335" y1="355" x2="460" y2="720" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#05B96E" />
          <stop offset="1" stopColor="#008E62" />
        </linearGradient>
        <linearGradient id={`${uid}-gTax`} x1="690" y1="780" x2="1015" y2="930" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#05E889" />
          <stop offset="1" stopColor="#00B86E" />
        </linearGradient>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000000" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* Logo mark */}
      <g filter={`url(#${uid}-shadow)`}>
        {/* left stem */}
        <path d="M330 350 L455 468 L455 720 L382 720 Q330 720 330 668 Z" fill={`url(#${uid}-gDark)`} />
        {/* main M ribbon */}
        <path d="M382 230 Q407 230 425 248 L600 414 L775 248 Q793 230 818 230 L832 230 Q870 230 870 268 L870 348 L626 584 Q600 609 574 584 L330 348 L330 268 Q330 230 368 230 Z" fill={`url(#${uid}-gMain)`} />
        {/* right leg = outlined check-card (transparent interior) */}
        <path d="M870 400 L870 638 Q870 681 827 681 L759 681 Q735 681 719 665 L679 625 Q655 601 679 577 Z" fill="none" stroke={ink} strokeWidth="30" strokeLinejoin="round" strokeLinecap="round" />
        {/* green check */}
        <path d="M748 603 L781 636 L839 563" fill="none" stroke="#06D884" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Wordmark */}
      <text
        x="600"
        y="922"
        textAnchor="middle"
        fontFamily="'Bricolage Grotesque', Inter, Manrope, Arial, sans-serif"
        fontWeight="800"
        fontSize="170"
        letterSpacing="-8"
      >
        <tspan fill={ink}>Mera</tspan>
        <tspan fill={`url(#${uid}-gTax)`}>Tax</tspan>
      </text>

      {/* Tagline */}
      {showTagline && (
        <text
          x="600"
          y="986"
          textAnchor="middle"
          fontFamily="'Bricolage Grotesque', Inter, Manrope, Arial, sans-serif"
          fontSize="31"
          fontWeight="800"
          letterSpacing="10"
          fill={ink}
        >
          PAKISTAN&#8217;S SMART TAX COMPANION
        </text>
      )}
    </svg>
  );
};

export default BrandLockup;
