import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';

export interface PollOptionResult {
  option_index: number;
  option_text: string;
  votes: number;
  averageRank?: number;
}

export interface PollGroupSource {
  poll_id?: string;
  ranking_poll_id?: string;
  wordcloud_poll_id?: string;
  page_path: string;
  poll_index: number;
  question: string;
  options?: string[];
  total_votes?: number;
  results?: PollOptionResult[];
  survey_results?: unknown;
  cew_results?: unknown;
  combined_survey_votes?: number | null;
  combined_cew_votes?: number | null;
  words?: WordcloudWord[];
  surveyWords?: WordcloudWord[];
  cewWords?: WordcloudWord[];
  max_words?: number | null;
  word_limit?: number | null;
  total_responses?: number | null;
}

export type SingleChoiceRow = PollGroupSource & {
  options: string[];
  total_votes: number;
};

export type RankingRow = SingleChoiceRow;

export interface WordcloudWord {
  text: string;
  value: number;
}

export interface WordcloudRow {
  poll_id: string;
  page_path: string;
  poll_index: number;
  question: string;
  max_words: number | null;
  word_limit: number | null;
  total_responses: number | null;
  word: string | null;
  frequency: number | null;
}

export interface PollResultsFetchResult {
  singleChoice: SingleChoiceRow[];
  ranking: RankingRow[];
  wordcloud: WordcloudRow[];
  errors: {
    singleChoice?: PostgrestError;
    ranking?: PostgrestError;
    wordcloud?: PostgrestError;
  };
}

export async function fetchPollResultsData(
  client: SupabaseClient
): Promise<PollResultsFetchResult> {
  const [singleChoiceResult, rankingResult, wordcloudResult] = await Promise.all([
    client
      .from('poll_results')
      .select('*')
      .order('page_path', { ascending: true })
      .order('poll_index', { ascending: true }),
    client
      .from('ranking_results')
      .select('*')
      .order('page_path', { ascending: true })
      .order('poll_index', { ascending: true }),
    client
      .from('wordcloud_results')
      .select('*')
      .order('page_path', { ascending: true })
      .order('poll_index', { ascending: true })
  ]);

  const coerceResults = (results: unknown): PollOptionResult[] =>
    Array.isArray(results)
      ? (results as PollOptionResult[]).map((result) => ({
          option_index: result.option_index,
          option_text: result.option_text,
          votes: result.votes,
          averageRank: result.averageRank
        }))
      : [];

  const enrichSingleChoice = (singleChoiceResult.data ?? []).map((row) => ({
    ...row,
    options: row.options ?? [],
    results: coerceResults(row.results),
    survey_results: coerceResults(row.survey_results),
    cew_results: coerceResults(row.cew_results)
  })) as SingleChoiceRow[];

  const enrichRanking = (rankingResult.data ?? []).map((row) => ({
    ...row,
    options: row.options ?? [],
    results: coerceResults(row.results),
    survey_results: coerceResults(row.survey_results),
    cew_results: coerceResults(row.cew_results)
  })) as RankingRow[];

  const enrichWordcloud = (wordcloudResult.data ?? []).map((row) => ({
    ...row,
    max_words: row.max_words ?? null,
    word_limit: row.word_limit ?? null,
    total_responses: row.total_responses ?? null,
    word: row.word ?? null,
    frequency: row.frequency ?? null
  })) as WordcloudRow[];

  return {
    singleChoice: enrichSingleChoice,
    ranking: enrichRanking,
    wordcloud: enrichWordcloud,
    errors: {
      singleChoice: singleChoiceResult.error ?? undefined,
      ranking: rankingResult.error ?? undefined,
      wordcloud: wordcloudResult.error ?? undefined
    }
  };
}

export interface CombinedPollResult {
  poll_id?: string;
  ranking_poll_id?: string;
  wordcloud_poll_id?: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[];
  total_votes: number;
  results: PollOptionResult[];
  is_ranking?: boolean;
  is_wordcloud?: boolean;
  wordcloud_words?: WordcloudWord[];
  combined_survey_votes?: number;
  combined_cew_votes?: number;
  survey_results?: PollOptionResult[];
  cew_results?: PollOptionResult[];
}

interface PollGroupEntry {
  surveyPoll?: PollGroupSource;
  cewPoll?: PollGroupSource;
  isRanking: boolean;
  isWordcloud?: boolean;
  question: string;
  poll_index: number;
  options: string[];
}

interface WordcloudAggregate {
  poll_id: string;
  page_path: string;
  poll_index: number;
  question: string;
  max_words: number;
  word_limit: number;
  total_votes: number;
  words: WordcloudWord[];
  surveyWords: WordcloudWord[];
  cewWords: WordcloudWord[];
}

export const DEFAULT_ACTIVE_POLL_QUESTIONS: string[] = [
  // Holistic Protection Questions
  'Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)',
  'Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)',
  'Rank the importance of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = very important to 5 = not important)',
  'Rank the feasibility of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = easily achievable to 5 = not feasible)',
  'Rank the importance of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = very important to 5 = not important)',
  'Rank the feasibility of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = easily achievable to 5 = not feasible)',
  'Rank the importance of developing CSR sediment standards for food-related toxicity to human receptors. (1 = very important to 5 = not important)',
  'Rank the feasibility of developing CSR sediment standards for food-related toxicity to human receptors. (1 = easily achievable to 5 = not feasible)',
  // Tiered Framework Questions
  'What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  'In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?',
  'What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?',
  // Prioritization Questions
  'Rank the importance of incorporating bioavailability adjustments into sediment standards. (1 = very important to 5 = not important)',
  'Rank the feasibility of incorporating bioavailability adjustments into sediment standards. (1 = easily achievable to 5 = not feasible)',
  'To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.',
  'Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)',
  'Overall, what is the greatest constraint to advancing holistic sediment protection in BC?'
];

const createTopicKey = (pagePath: string, pollIndex: number): string => {
  if (pagePath.includes('holistic-protection')) return `holistic-protection_${pollIndex}`;
  if (pagePath.includes('tiered-framework')) return `tiered-framework_${pollIndex}`;
  if (pagePath.includes('prioritization')) return `prioritization_${pollIndex}`;
  if (pagePath.includes('wiks')) return `wiks_${pollIndex}`;
  const topic = pagePath.split('/').pop() || 'unknown';
  return `${topic}_${pollIndex}`;
};

const questionMatches = (question: string, candidate: string): boolean => {
  const questionStart = question.substring(0, 100).toLowerCase();
  const candidateStart = candidate.substring(0, 100).toLowerCase();
  return (
    questionStart.includes(candidateStart.substring(0, 50)) ||
    candidateStart.includes(questionStart.substring(0, 50)) ||
    (questionStart.includes('matrix sediment standards') && candidateStart.includes('matrix sediment standards')) ||
    (questionStart.includes('matrix standards') && candidateStart.includes('matrix standards')) ||
    (questionStart.includes('barrier') && candidateStart.includes('barrier'))
  );
};

export interface BuildPollResultsOptions {
  activeQuestions?: string[];
  enableDebugLogs?: boolean;
}

export interface BuildPollResultsOutput {
  combinedResults: CombinedPollResult[];
  fallbackResults: CombinedPollResult[];
}

export function buildCombinedPollResults(
  singleChoiceData: SingleChoiceRow[],
  rankingData: RankingRow[],
  wordcloudData: WordcloudRow[],
  options?: BuildPollResultsOptions
): BuildPollResultsOutput {
  const activeQuestions = options?.activeQuestions ?? DEFAULT_ACTIVE_POLL_QUESTIONS;
  const debugEnabled = options?.enableDebugLogs ?? true;
  const log = (...args: unknown[]) => {
    if (debugEnabled) {
      console.log(...args);
    }
  };

  const pollGroups = new Map<string, PollGroupEntry>();

  // Single-choice processing
  singleChoiceData.forEach((poll) => {
    const matchingQuestion = activeQuestions.find((question) => questionMatches(poll.question, question));

    if (!matchingQuestion) {
      log('🔍 Single-choice poll not matching current questions:', {
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        question_preview: poll.question.substring(0, 100)
      });
      return;
    }

    log('✅ Single-choice poll matched:', {
      page_path: poll.page_path,
      poll_index: poll.poll_index,
      total_votes: poll.total_votes,
      question_preview: poll.question.substring(0, 100)
    });

    if (poll.page_path.includes('holistic-protection') && poll.poll_index === 0) {
      log('🔍 HOLISTIC Q1 DEBUG:', {
        poll_question: poll.question,
        expected_question: activeQuestions[0],
        match_found: Boolean(matchingQuestion),
        matched_question_preview: matchingQuestion.substring(0, 100).toLowerCase(),
        poll_start: poll.question.substring(0, 100).toLowerCase(),
        expected_start: activeQuestions[0].substring(0, 100).toLowerCase()
      });
    }

    const key = createTopicKey(poll.page_path, poll.poll_index);

    if (!pollGroups.has(key)) {
      pollGroups.set(key, {
        isRanking: false,
        question: poll.question,
        poll_index: poll.poll_index,
        options: poll.options || []
      });
    }

    const group = pollGroups.get(key)!;
    if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
      group.surveyPoll = poll;
      log('📊 Added survey poll to group:', {
        key,
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        total_votes: poll.total_votes
      });
    } else if (poll.page_path.startsWith('/cew-polls')) {
      group.cewPoll = poll;
      log('📊 Added CEW poll to group:', {
        key,
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        total_votes: poll.total_votes
      });
      if (poll.page_path.includes('holistic-protection')) {
        group.question = poll.question;
        group.options = poll.options || [];
      }
    }
  });

  // Ranking processing
  rankingData.forEach((poll) => {
    log('🔍 Processing ranking poll:', {
      page_path: poll.page_path,
      poll_index: poll.poll_index,
      question_preview: poll.question.substring(0, 100),
      total_votes: poll.total_votes
    });

    const matchesCurrentQuestion = activeQuestions.some((question) => questionMatches(poll.question, question));

    if (!matchesCurrentQuestion) {
      log('❌ Ranking poll filtered out - no matching question:', {
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        question_preview: poll.question.substring(0, 100)
      });
      return;
    }

    log('✅ Ranking poll matched:', {
      page_path: poll.page_path,
      poll_index: poll.poll_index,
      total_votes: poll.total_votes
    });

    const key = createTopicKey(poll.page_path, poll.poll_index);

    if (!pollGroups.has(key)) {
      pollGroups.set(key, {
        isRanking: true,
        question: poll.question,
        poll_index: poll.poll_index,
        options: poll.options || []
      });
    } else {
      pollGroups.get(key)!.isRanking = true;
    }

    const group = pollGroups.get(key)!;
    if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
      group.surveyPoll = poll;
    } else if (poll.page_path.startsWith('/cew-polls')) {
      group.cewPoll = poll;
      if (poll.page_path.includes('holistic-protection')) {
        group.question = poll.question;
        group.options = poll.options || [];
      }
    }
  });

  // Wordcloud processing
  const wordcloudPollsMap = new Map<string, WordcloudAggregate>();

  wordcloudData.forEach((poll) => {
    const matchesCurrentQuestion = activeQuestions.some((question) => questionMatches(poll.question, question));

    if (!matchesCurrentQuestion) {
      log('🔍 Wordcloud poll not matching current questions:', {
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        question_preview: poll.question.substring(0, 100)
      });
      return;
    }

    const pollId = poll.poll_id;
    if (!wordcloudPollsMap.has(pollId)) {
      wordcloudPollsMap.set(pollId, {
        poll_id: pollId,
        page_path: poll.page_path,
        poll_index: poll.poll_index,
        question: poll.question,
        max_words: poll.max_words ?? 3,
        word_limit: poll.word_limit ?? 20,
        total_votes: poll.total_responses ?? 0,
        words: [],
        surveyWords: [],
        cewWords: []
      });
    }

    const pollData = wordcloudPollsMap.get(pollId)!;

    if (poll.word && poll.frequency) {
      const wordData = { text: poll.word, value: poll.frequency };
      pollData.words.push(wordData);

      if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
        pollData.surveyWords.push(wordData);
      } else if (poll.page_path.startsWith('/cew-polls')) {
        pollData.cewWords.push(wordData);
      }
    }
  });

  wordcloudPollsMap.forEach((pollData) => {
    const key = createTopicKey(pollData.page_path, pollData.poll_index);

    pollData.words.sort((a, b) => b.value - a.value);
    pollData.surveyWords.sort((a, b) => b.value - a.value);
    pollData.cewWords.sort((a, b) => b.value - a.value);

    if (!pollGroups.has(key)) {
      pollGroups.set(key, {
        isRanking: false,
        isWordcloud: true,
        question: pollData.question,
        poll_index: pollData.poll_index,
        options: []
      });
    } else {
      pollGroups.get(key)!.isWordcloud = true;
    }

    const group = pollGroups.get(key)!;

    if (pollData.surveyWords.length > 0) {
      group.surveyPoll = {
        ...pollData,
        words: pollData.surveyWords,
        total_votes: pollData.total_votes
      };
    }

    if (pollData.cewWords.length > 0) {
      group.cewPoll = {
        ...pollData,
        words: pollData.cewWords,
        total_votes: pollData.total_votes
      };
    }

    if (pollData.surveyWords.length === 0 && pollData.cewWords.length === 0) {
      group.surveyPoll = {
        ...pollData,
        words: [],
        total_votes: pollData.total_votes
      };
      group.cewPoll = {
        ...pollData,
        words: [],
        total_votes: pollData.total_votes
      };
    }

    if (pollData.page_path.includes('prioritization')) {
      log('🔍 Wordcloud poll data processing:', {
        pollId: pollData.poll_id,
        pagePath: pollData.page_path,
        pollIndex: pollData.poll_index,
        totalVotes: pollData.total_votes,
        surveyWords: pollData.surveyWords,
        cewWords: pollData.cewWords,
        surveyPoll: group.surveyPoll ? { total_votes: group.surveyPoll.total_votes } : null,
        cewPoll: group.cewPoll ? { total_votes: group.cewPoll.total_votes } : null
      });
    }
  });

  const combinedResults: CombinedPollResult[] = [];

  pollGroups.forEach((group, key) => {
    const surveyPoll = group.surveyPoll;
    const cewPoll = group.cewPoll;

    let totalVotes = 0;
    let surveyVotes = 0;
    let cewVotes = 0;
    let pollResults: PollOptionResult[] = [];
    let surveyResults: PollOptionResult[] = [];
    let cewResults: PollOptionResult[] = [];
    let wordcloudWords: WordcloudWord[] = [];

    if (group.isRanking) {
      surveyVotes = surveyPoll && surveyPoll.page_path?.includes('/survey-results') ? surveyPoll.total_votes || 0 : 0;
      cewVotes = cewPoll && cewPoll.page_path?.includes('/cew-polls') ? cewPoll.total_votes || 0 : 0;
    } else if (group.isWordcloud) {
      surveyVotes = surveyPoll && surveyPoll.page_path?.includes('/survey-results') ? surveyPoll.total_votes || 0 : 0;
      cewVotes = cewPoll && cewPoll.page_path?.includes('/cew-polls') ? cewPoll.total_votes || 0 : 0;

      if (key.includes('prioritization')) {
        log('🔍 Wordcloud vote calculation:', {
          key,
          surveyVotes,
          cewVotes,
          totalVotes: surveyVotes + cewVotes,
          surveyPoll: surveyPoll
            ? {
                total_votes: surveyPoll.total_votes,
                words: (surveyPoll as PollGroupSource & { words?: WordcloudWord[] }).words?.length
              }
            : null,
          cewPoll: cewPoll
            ? {
                total_votes: cewPoll.total_votes,
                words: (cewPoll as PollGroupSource & { words?: WordcloudWord[] }).words?.length
              }
            : null
        });
      }
    } else {
      surveyVotes = surveyPoll && surveyPoll.page_path?.includes('/survey-results')
        ? (surveyPoll.results || []).reduce((sum, result) => sum + (result.votes || 0), 0)
        : 0;
      cewVotes = cewPoll && cewPoll.page_path?.includes('/cew-polls')
        ? (cewPoll.results || []).reduce((sum, result) => sum + (result.votes || 0), 0)
        : 0;
    }

    totalVotes = surveyVotes + cewVotes;

    if (key.includes('prioritization')) {
      log('🔍 Prioritization vote calculation:', {
        key,
        isRanking: group.isRanking,
        isWordcloud: group.isWordcloud,
        surveyVotes,
        cewVotes,
        totalVotes,
        surveyPoll: surveyPoll ? { total_votes: surveyPoll.total_votes, page_path: surveyPoll.page_path } : null,
        cewPoll: cewPoll ? { total_votes: cewPoll.total_votes, page_path: cewPoll.page_path } : null
      });
    }

    if (group.isRanking) {
      if (surveyPoll && cewPoll) {
        surveyResults = (surveyPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: surveyVotes,
            averageRank: result.averageRank || 0
          }))
          .sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));

        cewResults = (cewPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: cewVotes,
            averageRank: result.averageRank || 0
          }))
          .sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));

        const allResults = [...(surveyPoll.results || []), ...(cewPoll.results || [])];

        const optionMap = new Map<
          number,
          {
            totalRank: number;
            count: number;
            option_text: string;
          }
        >();

        allResults.forEach((result) => {
          if (!optionMap.has(result.option_index)) {
            optionMap.set(result.option_index, {
              totalRank: 0,
              count: 0,
              option_text: result.option_text || group.options[result.option_index] || ''
            });
          }
          const option = optionMap.get(result.option_index)!;
          option.totalRank += (result.averageRank || 0) * (result.votes || 0);
          option.count += result.votes || 0;
        });

        pollResults = Array.from(optionMap.entries())
          .map(([optionIndex, data]) => ({
            option_index: optionIndex,
            option_text: data.option_text,
            votes: totalVotes,
            averageRank: data.count > 0 ? data.totalRank / data.count : 0
          }))
          .sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
      } else if (surveyPoll) {
        surveyResults = (surveyPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: surveyVotes,
            averageRank: result.averageRank || 0
          }))
          .sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
        pollResults = surveyResults;
      } else if (cewPoll) {
        cewResults = (cewPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: cewVotes,
            averageRank: result.averageRank || 0
          }))
          .sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
        pollResults = cewResults;
      } else {
        pollResults = [];
      }
    } else if (group.isWordcloud) {
      if (surveyPoll && cewPoll) {
        const wordMap = new Map<string, number>();

        const surveyWords = (surveyPoll as PollGroupSource & { words?: WordcloudWord[] }).words || [];
        surveyWords.forEach((word) => {
          if (!word.text) return;
          wordMap.set(word.text, (wordMap.get(word.text) || 0) + (word.value || 0));
        });

        const cewWordsArray = (cewPoll as PollGroupSource & { words?: WordcloudWord[] }).words || [];
        cewWordsArray.forEach((word) => {
          if (!word.text) return;
          wordMap.set(word.text, (wordMap.get(word.text) || 0) + (word.value || 0));
        });

        wordcloudWords = Array.from(wordMap.entries())
          .map(([text, value]) => ({ text, value }))
          .sort((a, b) => b.value - a.value);
      } else if (surveyPoll) {
        wordcloudWords = ((surveyPoll as PollGroupSource & { words?: WordcloudWord[] }).words || []).slice();
      } else if (cewPoll) {
        wordcloudWords = ((cewPoll as PollGroupSource & { words?: WordcloudWord[] }).words || []).slice();
      }
      pollResults = [];
    } else {
      if (surveyPoll && cewPoll) {
        surveyResults = (surveyPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: result.votes || 0
          }))
          .sort((a, b) => (b.votes || 0) - (a.votes || 0));

        cewResults = (cewPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: result.votes || 0
          }))
          .sort((a, b) => (b.votes || 0) - (a.votes || 0));

        const optionMap = new Map<number, { votes: number; option_text: string }>();

        [...(surveyPoll.results || []), ...(cewPoll.results || [])].forEach((result) => {
          if (!optionMap.has(result.option_index)) {
            optionMap.set(result.option_index, {
              votes: 0,
              option_text: result.option_text || group.options[result.option_index] || ''
            });
          }
          optionMap.get(result.option_index)!.votes += result.votes || 0;
        });

        pollResults = Array.from(optionMap.entries())
          .map(([optionIndex, data]) => ({
            option_index: optionIndex,
            option_text: data.option_text,
            votes: data.votes
          }))
          .sort((a, b) => (b.votes || 0) - (a.votes || 0));
      } else if (surveyPoll) {
        surveyResults = (surveyPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: result.votes || 0
          }))
          .sort((a, b) => (b.votes || 0) - (a.votes || 0));
        pollResults = surveyResults;
      } else if (cewPoll) {
        cewResults = (cewPoll.results || [])
          .map((result) => ({
            option_index: result.option_index,
            option_text: result.option_text,
            votes: result.votes || 0
          }))
          .sort((a, b) => (b.votes || 0) - (a.votes || 0));
        pollResults = cewResults;
      } else {
        pollResults = [];
      }
    }

    const basePoll = surveyPoll || cewPoll;
    const combinedPoll: CombinedPollResult = {
      poll_id: basePoll?.poll_id,
      ranking_poll_id: basePoll?.ranking_poll_id,
      wordcloud_poll_id: basePoll?.wordcloud_poll_id,
      page_path: surveyPoll?.page_path || cewPoll?.page_path || '/survey-results/holistic-protection',
      poll_index: group.poll_index,
      question: group.question,
      options: group.options,
      total_votes: totalVotes,
      results: pollResults,
      is_ranking: group.isRanking,
      is_wordcloud: group.isWordcloud,
      wordcloud_words: group.isWordcloud ? wordcloudWords : undefined,
      combined_survey_votes: surveyVotes,
      combined_cew_votes: cewVotes,
      survey_results: surveyResults.length ? surveyResults : undefined,
      cew_results: cewResults.length ? cewResults : undefined
    };

    if (key.includes('wiks')) {
      log('🔍 DEBUG: WIKS Poll:', {
        key,
        page_path: combinedPoll.page_path,
        question: `${combinedPoll.question.substring(0, 100)}...`,
        surveyVotes,
        cewVotes,
        totalVotes,
        combined_survey_votes: combinedPoll.combined_survey_votes,
        combined_cew_votes: combinedPoll.combined_cew_votes,
        isRanking: group.isRanking,
        surveyPoll: surveyPoll ? { total_votes: surveyPoll.total_votes, results_count: surveyPoll.results?.length } : null,
        cewPoll: cewPoll ? { total_votes: cewPoll.total_votes, results_count: cewPoll.results?.length } : null
      });
    }

    combinedResults.push(combinedPoll);
  });

  combinedResults.sort((a, b) => {
    if (a.page_path !== b.page_path) {
      return a.page_path.localeCompare(b.page_path);
    }
    return a.poll_index - b.poll_index;
  });

  const fallbackResults: CombinedPollResult[] = [
    ...singleChoiceData.map<CombinedPollResult>((poll) => ({
      poll_id: poll.poll_id,
      ranking_poll_id: poll.ranking_poll_id,
      wordcloud_poll_id: poll.wordcloud_poll_id,
      page_path: poll.page_path,
      poll_index: poll.poll_index,
      question: poll.question,
      options: poll.options || [],
      total_votes: poll.total_votes || 0,
      results: poll.results || [],
      is_ranking: false,
      is_wordcloud: false,
      combined_survey_votes: poll.total_votes || 0,
      combined_cew_votes: 0,
      survey_results: poll.survey_results as PollOptionResult[] | undefined,
      cew_results: poll.cew_results as PollOptionResult[] | undefined
    })),
    ...rankingData.map<CombinedPollResult>((poll) => ({
      poll_id: poll.poll_id,
      ranking_poll_id: poll.ranking_poll_id,
      wordcloud_poll_id: poll.wordcloud_poll_id,
      page_path: poll.page_path,
      poll_index: poll.poll_index,
      question: poll.question,
      options: poll.options || [],
      total_votes: poll.total_votes || 0,
      results: poll.results || [],
      is_ranking: true,
      is_wordcloud: false,
      combined_survey_votes: poll.total_votes || 0,
      combined_cew_votes: 0,
      survey_results: poll.survey_results as PollOptionResult[] | undefined,
      cew_results: poll.cew_results as PollOptionResult[] | undefined
    }))
  ];

  return {
    combinedResults,
    fallbackResults
  };
}

