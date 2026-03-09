// Theme utility functions for consistent dark mode implementation
// Re-exports tokens from design-tokens as the canonical themeClasses object.

import { tokens, gradients } from '@/lib/design-tokens';

export const themeClasses = {
  // Background gradients
  pageBackground: "bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950",
  cardBackground: "bg-white dark:bg-slate-800",
  heroBackground: gradients.hero,

  // Text colors
  primaryText: tokens.primaryText,
  secondaryText: tokens.secondaryText,
  mutedText: tokens.mutedText,

  // Border colors
  border: tokens.border,
  borderLight: tokens.borderLight,

  // Button styles
  primaryButton: tokens.primaryButton,
  secondaryButton: tokens.secondaryButton,

  // Card styles
  card: tokens.card,
  cardHover: tokens.cardHover,

  // Input styles
  input: tokens.input,

  // Poll styles
  pollContainer: "bg-gradient-to-br from-sky-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-8 shadow-lg",
  pollOption: "bg-white dark:bg-slate-700 border-sky-300 dark:border-slate-600 hover:border-sky-500 dark:hover:border-sky-400 text-slate-800 dark:text-white",
  pollOptionVoted: "bg-slate-100 dark:bg-slate-600 border-slate-300 dark:border-slate-500 text-slate-600 dark:text-slate-300",

  // Accordion styles
  accordionHeader: "bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700",
  accordionContent: "bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300",

  // Matrix grid styles
  matrixCell: "bg-white dark:bg-slate-800 border-2 border-sky-200 dark:border-slate-600 hover:border-sky-400 dark:hover:border-sky-500 text-slate-900 dark:text-white",
  matrixCellHover: "hover:shadow-lg hover:-translate-y-1 transition-all duration-300",

  // Section backgrounds
  sectionLight: tokens.sectionLight,
  sectionDark: tokens.sectionDark,
  sectionGradient: tokens.sectionGradient,
};

export const getThemeClasses = (key: keyof typeof themeClasses) => {
  return themeClasses[key];
};
