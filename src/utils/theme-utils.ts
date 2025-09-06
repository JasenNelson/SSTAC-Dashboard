// Theme utility functions for consistent dark mode implementation

export const themeClasses = {
  // Background gradients
  pageBackground: "bg-gradient-to-br from-blue-50 via-green-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900",
  cardBackground: "bg-white dark:bg-gray-800",
  heroBackground: "bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800",
  
  // Text colors
  primaryText: "text-gray-900 dark:text-white",
  secondaryText: "text-gray-700 dark:text-gray-300",
  mutedText: "text-gray-600 dark:text-gray-400",
  
  // Border colors
  border: "border-gray-200 dark:border-gray-700",
  borderLight: "border-gray-100 dark:border-gray-800",
  
  // Button styles
  primaryButton: "bg-blue-600 hover:bg-blue-700 text-white",
  secondaryButton: "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white",
  
  // Card styles
  card: "bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700",
  cardHover: "hover:shadow-xl transition-shadow duration-300",
  
  // Input styles
  input: "bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white",
  
  // Poll styles
  pollContainer: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg",
  pollOption: "bg-white dark:bg-gray-700 border-blue-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 text-gray-800 dark:text-white",
  pollOptionVoted: "bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-300",
  
  // Accordion styles
  accordionHeader: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700",
  accordionContent: "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  
  // Matrix grid styles
  matrixCell: "bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 text-gray-900 dark:text-white",
  matrixCellHover: "hover:shadow-lg hover:-translate-y-1 transition-all duration-300",
  
  // Section backgrounds
  sectionLight: "bg-white dark:bg-gray-800",
  sectionDark: "bg-gray-50 dark:bg-gray-900",
  sectionGradient: "bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800"
};

export const getThemeClasses = (key: keyof typeof themeClasses) => {
  return themeClasses[key];
};
