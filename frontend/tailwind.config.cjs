// Tokens live in src/styles/tokens.css and DESIGN.md. Tailwind only maps names
// onto those variables, so a colour is defined exactly once and dark mode is a
// variable swap rather than a second set of classes.
const v = (name) => `var(--${name})`;

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        line: { DEFAULT: v('border'), 2: v('border-2') },
        ink: { DEFAULT: v('text'), 2: v('text-2'), 3: v('text-3') },
        accent: { DEFAULT: v('accent'), hover: v('accent-hover'), tint: v('accent-tint') },
        link: v('link'),
        ok: { DEFAULT: v('ok'), tint: v('ok-tint') },
        warn: { DEFAULT: v('warn'), tint: v('warn-tint') },
        bad: { DEFAULT: v('bad'), tint: v('bad-tint') },
        // The old scales stay resolvable during the migration; nothing new
        // should use them. Both now point at the accent so any straggler still
        // renders in brand colour rather than the retired lighter blue.
        primary: {
          50: v('accent-tint'), 100: v('accent-tint'), 200: v('accent-tint'),
          300: v('link'), 400: v('accent'), 500: v('accent'), 600: v('accent'),
          700: v('accent-hover'), 800: v('accent-hover'), 900: v('accent-hover'),
        },
      },
      fontFamily: {
        display: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '10px',
        xl: '16px',
        '2xl': '16px',
        '3xl': '16px',
      },
      boxShadow: {
        sm: v('shadow-sm'),
        DEFAULT: v('shadow-sm'),
        md: v('shadow-md'),
        lg: v('shadow-lg'),
        xl: v('shadow-lg'),
        '2xl': v('shadow-lg'),
        card: v('shadow-sm'),
      },
      transitionDuration: {
        hover: '120ms',
        state: '200ms',
        layout: '320ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        'in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
      },
    },
  },
  plugins: [],
};
