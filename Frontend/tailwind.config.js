/** @type {import('tailwindcss').Config} */
module.exports = {
  // UX-07 dark mode: class strategy. ThemeProvider toggles `.dark` on <html>
  // (with a no-flash bootstrap in public/index.html); components opt surfaces
  // into dark via `dark:` variants, and the brand CSS variables flip under
  // `.dark`/[data-theme="dark"] in index.css.
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        green: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // ── Brand palette — SINGLE SOURCE OF TRUTH (UX-06; mirrors :root in
        // index.css). The shell (Landing/Dashboard/Sidebar/Header) uses these;
        // UX-01 migrates the tax-form modules off the legacy sky-blue `primary`.
        navy: { DEFAULT: '#28396C', dark: '#1e2d5a', mid: '#3d5a90', ink: '#1e2a4a' },
        lime: { DEFAULT: '#B5E18B', soft: '#c0da94' },
        cream: { DEFAULT: '#F0FFC2', bg: '#fdfcf8', track: '#EAE6BC' },
        ink: '#1c1d1a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        display: ['Bricolage Grotesque', 'ui-sans-serif', 'system-ui'],
        body: ['Nunito', 'ui-sans-serif', 'system-ui'],
      },
      borderRadius: {
        brand: '12px',
        'brand-lg': '18px',
      },
      boxShadow: {
        brand: '0 4px 20px rgba(26,28,32,0.07)',
        'brand-lg': '0 16px 40px rgba(40,57,108,0.10)',
      },
    },
  },
  plugins: [],
}