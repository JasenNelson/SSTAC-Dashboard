export interface PollResult {
  poll_id?: string;
  ranking_poll_id?: string;
  wordcloud_poll_id?: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[];
  total_votes: number;
  results: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  is_ranking?: boolean;
  is_wordcloud?: boolean;
  wordcloud_words?: Array<{
    text: string;
    value: number;
  }>;
  combined_survey_votes?: number;
  combined_cew_votes?: number;
  survey_results?: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  cew_results?: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
}

export interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

export interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
}

