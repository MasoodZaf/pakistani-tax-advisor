import React from 'react';

/**
 * MeraTax brand mark — a green "M" whose right leg is an outlined check-card
 * with a green tick. Single source of truth for the small in-app logo icon;
 * the full lockup (mark + wordmark + tagline) lives in BrandLockup.js.
 *
 * Props:
 *   size      — rendered width/height in px (default 32)
 *   glyphOnly — render just the mark (no navy tile), for use inside an existing
 *               container or on its own. The card outline + M use the `stem`
 *               colour so the glyph stays visible on the host background.
 *   stem      — outline/stroke colour for glyphOnly mode (default '#fff' for
 *               dark backgrounds; pass '#28396C' on light backgrounds)
 *
 * Default (tiled) mode renders the mark on a navy rounded tile, so it reads on
 * any background.
 */

// Shared mark artwork in 1200-unit space (matches BrandLockup). `outline` is the
// check-card stroke colour; the green M + green tick are colour-stable.
const MarkPaths = ({ outline = '#FFFFFF', mGreen = '#00C979', mGreenDark = '#00A96B' }) => (
  <>
    <path d="M330 350 L455 468 L455 720 L382 720 Q330 720 330 668 Z" fill={mGreenDark} />
    <path d="M382 230 Q407 230 425 248 L600 414 L775 248 Q793 230 818 230 L832 230 Q870 230 870 268 L870 348 L626 584 Q600 609 574 584 L330 348 L330 268 Q330 230 368 230 Z" fill={mGreen} />
    <path d="M870 400 L870 638 Q870 681 827 681 L759 681 Q735 681 719 665 L679 625 Q655 601 679 577 Z" fill="none" stroke={outline} strokeWidth="34" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M748 603 L781 636 L839 563" fill="none" stroke="#06D884" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

const BrandMark = ({ size = 32, glyphOnly = false, stem = '#fff' }) => {
  if (glyphOnly) {
    return (
      <svg width={size} height={size} viewBox="315 185 580 580" fill="none" aria-hidden="true">
        <MarkPaths outline={stem} />
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
      <g transform="translate(-16.8 -6.3) scale(0.0807)">
        <MarkPaths outline="#FFFFFF" />
      </g>
    </svg>
  );
};

export default BrandMark;
