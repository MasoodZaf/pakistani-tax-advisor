import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Theme controls (UX-07).
 *
 * <ThemeToggle> — compact icon button for the header. Shows the icon of the
 *   current *preference* (sun/moon/monitor) and cycles Light → Dark → System on
 *   click. aria-label announces the next state.
 *
 * <ThemeSegmented> — a 3-way Light / Dark / System segmented control for the
 *   Settings page, where the choice should be explicit.
 */

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export const ThemeToggle = ({ className = '' }) => {
  const { preference, cyclePreference } = useTheme();
  const current = OPTIONS.find((o) => o.value === preference) || OPTIONS[2];
  const next = OPTIONS[(OPTIONS.findIndex((o) => o.value === current.value) + 1) % OPTIONS.length];
  const { Icon } = current;

  return (
    <button
      type="button"
      onClick={cyclePreference}
      aria-label={`Theme: ${current.label}. Switch to ${next.label}.`}
      title={`Theme: ${current.label} (click for ${next.label})`}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-navy dark:text-[#aab2cc] dark:hover:bg-[#1a2238] dark:hover:text-lime ${className}`}
    >
      <Icon size={18} />
    </button>
  );
};

export const ThemeSegmented = ({ className = '' }) => {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className={`inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-[#2a3450] dark:bg-[#0f1426] ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${
              active
                ? 'bg-navy text-white shadow-sm dark:bg-navy-mid'
                : 'text-gray-600 hover:text-navy dark:text-[#aab2cc] dark:hover:text-[#e7eaf3]'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
