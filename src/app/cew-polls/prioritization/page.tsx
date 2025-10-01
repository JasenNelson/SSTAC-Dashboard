'use client';

import React, { useState } from 'react';
import CEWCodeInput from '@/components/CEWCodeInput';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';
import WordCloudPoll from '@/components/dashboard/WordCloudPoll';

interface PollData {
  question: string;
  options?: string[];
  questionNumber?: number;
  isRanking?: boolean;
  isWordcloud?: boolean;
  maxWords?: number;
  wordLimit?: number;
  predefinedOptions?: Array<{ display: string; keyword: string }>;
}

export default function CEWPrioritizationPage() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);

  const handleCodeEntered = (code: string) => {
    setAuthCode(code);
  };

  if (!authCode) {
    return <CEWCodeInput onCodeEntered={handleCodeEntered} />;
  }
  
  // Define polls with proper structure for the new poll system
  // Updated structure: Q1-Q2 single-choice, Q3-Q4 ranking, Q5 wordcloud
  const polls = [
    // Questions 1-2: Single-Choice Polls (kept from original Q1-Q2)
    {
      question: "Rank the importance of incorporating bioavailability adjustments into sediment standards. (1 = very important to 5 = not important)",
      questionNumber: 1,
      options: [
        "Very Important",
        "Important", 
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of incorporating bioavailability adjustments into sediment standards. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 2,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable", 
        "Difficult",
        "Not Feasible"
      ]
    },
    // Questions 3-4: Ranking Polls (moved from original Q11-Q12)
    {
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.",
      questionNumber: 3,
      isRanking: true,
      options: [
        "Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.",
        "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.",
        "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).",
        "Determining if environmental sensitivity should be factored into matrix standards for ecological health."
      ]
    },
    {
      question: "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
      questionNumber: 4,
      isRanking: true,
      options: [
        "Selecting and using models and other tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (these would include, for example, acid volatile sulphides/simultaneously extractable metals (AVS/SEM), equilibrium partitioning (EqP), target lipid model)",
        "Selecting and using approaches to develop Sediment Standards for contaminants with an analogue (e.g., quantitative structure-activity relationship (QSAR))",
        "Developing guidance and/or framework to use site-specific toxicity testing to evaluate the risks of mixtures to ecological receptors.",
        "Developing models and/or approaches to derive mixture-specific sediment standards for ecological receptors (e.g., for water quality, there are biotic ligand models for metals mixtures)."
      ]
    },
    // Question 5: Wordcloud Poll (moved from original Q13)
    {
      question: "Overall, what is the greatest constraint to advancing holistic sediment protection in BC?",
      questionNumber: 5,
      isWordcloud: true,
      maxWords: 1,
      wordLimit: 20,
      predefinedOptions: [
        { display: "Data availability", keyword: "Data" },
        { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
        { display: "Agreement on protection goals and spatial scale", keyword: "Policy" },
        { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              CEW 2025 Live Polling
            </h1>
            <h2 className="text-xl text-orange-600 dark:text-orange-400 font-semibold">
              Prioritization Framework
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Interactive polling for conference attendees
            </p>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Authenticated as: <span className="font-mono font-semibold">{authCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-orange-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-gray-700 dark:text-orange-200 text-sm">
            Select your response for each question below. Your answers will be saved anonymously and combined with other conference participants&apos; responses.
          </p>
        </div>

        {/* Polls */}
        <div className="space-y-8">
          {polls.map((poll, pollIndex) => {
            // Handle different poll types
            if (poll.isWordcloud) {
              return (
                <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <WordCloudPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    maxWords={poll.maxWords || 3}
                    wordLimit={poll.wordLimit || 20}
                    pagePath="/cew-polls/prioritization"
                    questionNumber={poll.questionNumber}
                    authCode={authCode}
                    predefinedOptions={poll.predefinedOptions}
                    onVote={(pollIndex, words) => {
                      console.log(`Words submitted for poll ${pollIndex}:`, words);
                    }}
                  />
                </div>
              );
            } else if (poll.isRanking) {
              return (
                <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <RankingPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options || []}
                    pagePath="/cew-polls/prioritization"
                    questionNumber={poll.questionNumber}
                    authCode={authCode}
                    onVote={(pollIndex, rankings) => {
                      console.log(`Ranking submitted for poll ${pollIndex}:`, rankings);
                    }}
                  />
                </div>
              );
            } else {
              return (
                <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <PollWithResults
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options || []}
                    pagePath="/cew-polls/prioritization"
                    questionNumber={poll.questionNumber}
                    authCode={authCode}
                    onVote={(pollIndex, optionIndex, otherText) => {
                      console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}${otherText ? `, otherText: "${otherText}"` : ''}`);
                    }}
                  />
                </div>
              );
            }
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Canadian Ecotoxicity Workshop 2025 • Victoria, BC
          </p>
        </div>
      </div>
    </div>
  );
}
