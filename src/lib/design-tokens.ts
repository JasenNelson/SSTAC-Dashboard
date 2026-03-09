/**
 * Design Tokens — Single source of truth for the SSTAC Dashboard palette.
 *
 * Government / Public-Service palette (#14 ui-ux-pro-max).
 *
 * Primary:     slate-900  #0F172A  — headers, nav, hero
 * CTA:         sky-700    #0369A1  — buttons, links, active states
 * Background:  slate-50   #F8FAFC  (light)  /  slate-900 #0F172A (dark)
 *
 * Semantic colours (green, amber, red, blue, purple) are intentionally
 * NOT redefined here — they live in the badge components and must not
 * be overridden by the palette.
 */

// ---------------------------------------------------------------------------
// Core palette
// ---------------------------------------------------------------------------
export const palette = {
  primary: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },
  cta: {
    50:  '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
    800: '#075985',
    900: '#0C4A6E',
  },
  // Accent colors for stat-card icons / category accents (non-semantic)
  accent: {
    teal:   { bg: '#F0FDFA', icon: '#0D9488', bgDark: '#134E4A', iconDark: '#5EEAD4' },
    purple: { bg: '#FAF5FF', icon: '#7C3AED', bgDark: '#3B0764', iconDark: '#C4B5FD' },
    amber:  { bg: '#FFFBEB', icon: '#D97706', bgDark: '#451A03', iconDark: '#FCD34D' },
    rose:   { bg: '#FFF1F2', icon: '#E11D48', bgDark: '#4C0519', iconDark: '#FDA4AF' },
  },
} as const;

// ---------------------------------------------------------------------------
// Chart colors — 6 harmonious values drawn from the palette
// ---------------------------------------------------------------------------
export const chartColors = [
  '#0369A1', // sky-700  (CTA)
  '#0D9488', // teal-600
  '#7C3AED', // violet-600
  '#D97706', // amber-600
  '#E11D48', // rose-600
  '#475569', // slate-600
] as const;

// ---------------------------------------------------------------------------
// Gradients (Tailwind class strings)
// ---------------------------------------------------------------------------
export const gradients = {
  hero:       'bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900',
  heroDark:   'bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950',
  pageLight:  'bg-gradient-to-br from-slate-50 via-white to-sky-50',
  pageDark:   'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
  ctaLight:   'bg-gradient-to-r from-sky-50 to-slate-50',
  ctaDark:    'bg-gradient-to-r from-slate-800 to-slate-900',
} as const;

// ---------------------------------------------------------------------------
// Tailwind class presets (consumed by components via themeClasses)
// ---------------------------------------------------------------------------
export const tokens = {
  // Page backgrounds
  pageBackground:  `${gradients.pageLight} dark:${gradients.pageDark.replace('bg-gradient', 'bg-gradient')}`,

  // Hero
  heroBackground:  gradients.hero,

  // Cards
  card:            'bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700',
  cardHover:       'hover:shadow-xl transition-shadow duration-300',

  // Text
  primaryText:     'text-slate-900 dark:text-white',
  secondaryText:   'text-slate-700 dark:text-slate-300',
  mutedText:       'text-slate-500 dark:text-slate-400',

  // Borders
  border:          'border-slate-200 dark:border-slate-700',
  borderLight:     'border-slate-100 dark:border-slate-800',

  // Buttons
  primaryButton:   'bg-sky-700 hover:bg-sky-800 text-white',
  secondaryButton: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white',
  outlineButton:   'border border-sky-700 text-sky-700 dark:text-sky-400 dark:border-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800',

  // Inputs
  input:           'bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white',

  // Sections
  sectionLight:    'bg-white dark:bg-slate-800',
  sectionDark:     'bg-slate-50 dark:bg-slate-900',
  sectionGradient: 'bg-gradient-to-br from-slate-50 to-sky-50 dark:from-slate-900 dark:to-slate-800',

  // CTA banner
  ctaBanner:       `${gradients.ctaLight} dark:from-slate-800 dark:to-slate-900`,
} as const;
