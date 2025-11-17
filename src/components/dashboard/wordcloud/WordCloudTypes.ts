// src/components/dashboard/wordcloud/WordCloudTypes.ts
// Shared types for WordCloud components

export interface WordCloudData {
  text: string;
  value: number;
}

export interface WordCloudDisplayOptions {
  colors?: string[];
  fontFamily?: string;
  fontWeight?: string;
}

export interface WordCloudPollProps {
  pollIndex: number;
  question: string;
  maxWords: number;
  wordLimit: number;
  pagePath: string;
  questionNumber?: number;
  authCode?: string;
  predefinedOptions?: Array<{ display: string; keyword: string }>;
  onVote?: (pollIndex: number, words: string[]) => void;
}

export interface WordCloudResults {
  total_votes: number;
  words: WordCloudData[];
  user_words?: string[];
}

export type ColorSchemeKey = 'aquatic' | 'ocean' | 'marine' | 'teal';

export interface ColorScheme {
  colors: string[];
  background: string;
}

export const COLOR_SCHEMES: Record<ColorSchemeKey, ColorScheme> = {
  aquatic: {
    colors: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
    background: 'transparent'
  },
  ocean: {
    colors: ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'],
    background: 'transparent'
  },
  marine: {
    colors: ['#1e3a8a', '#1e40af', '#3b82f6', '#06b6d4', '#0891b2', '#0e7490'],
    background: 'transparent'
  },
  teal: {
    colors: ['#134e4a', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#a7f3d0'],
    background: 'transparent'
  }
};

