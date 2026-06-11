import React from 'react';

/**
 * MeraTax brand mark — an "M" whose centre stroke is a lime checkmark,
 * on a navy tile. Single source of truth for the in-app logo; the same
 * artwork ships as Frontend/public/favicon.svg and the PWA/mobile icons.
 *
 * Props:
 *   size      — rendered width/height in px (default 32)
 *   glyphOnly — render just the M-check glyph (no navy tile), for use
 *               inside an existing container (e.g. the sidebar icon box
 *               or the dark login brand panel)
 *   stem      — stem colour for glyphOnly mode (default '#fff'; use
 *               '#28396C' on light backgrounds)
 */
const BrandMark = ({ size = 32, glyphOnly = false, stem = '#fff' }) => {
  if (glyphOnly) {
    return (
      <svg width={size} height={size} viewBox="14 16 36 32" fill="none" aria-hidden="true">
        <path d="M18 21 L32 39.5 L46 21" stroke="#B5E18B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 44 V20" stroke={stem} strokeWidth="7" strokeLinecap="round" />
        <path d="M46 44 V20" stroke={stem} strokeWidth="7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mtTileGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#33477f" />
          <stop offset="1" stopColor="#1f2c52" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#mtTileGrad)" />
      <rect x="1" y="1" width="62" height="62" rx="14" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      <path d="M18 21 L32 39.5 L46 21" stroke="#B5E18B" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 44 V20" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M46 44 V20" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
};

export default BrandMark;
