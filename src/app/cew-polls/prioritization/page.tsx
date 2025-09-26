'use client';

import React, { useState } from 'react';
import CEWCodeInput from '@/components/CEWCodeInput';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';
import WordCloudPoll from '@/components/dashboard/WordCloudPoll';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
  isRanking?: boolean;
  isWordcloud?: boolean;
  maxWords?: number;
  wordLimit?: number;
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
  
  // Define polls with proper structure for the new poll system - 12 Tiered Framework Questions
  const polls = [
    // Questions 1-3: Single-Choice Polls
    {
      question: "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
      questionNumber: 1,
      options: [
        "It provides a formal structure for quantifying and communicating uncertainty in the final standard.",
        "It allows for the systematic integration of existing literature data as priors, reducing site-specific data needs.",
        "It produces a full risk distribution rather than a single point value, allowing for more flexible management decisions.",
        "It improves the technical defensibility by making all assumptions (priors, model structure) explicit",
        "Other"
      ]
    },
    {
      question: "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
      questionNumber: 2,
      options: [
        "A large number of sediment chemistry samples to better characterize spatial heterogeneity.",
        "High-quality, in-situ passive sampling data to directly measure and constrain bioavailable concentrations.",
        "Site-specific toxicity testing data to develop more relevant priors for the dose-response relationship.",
        "Detailed measurements of secondary geochemical parameters (e.g., black carbon, iron oxides) that influence partitioning.",
        "Other"
      ]
    },
    {
      question: "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
      questionNumber: 3,
      options: [
        "Defining appropriate priors, especially when site-specific information is sparse and literature values vary widely",
        "The high level of statistical expertise required by both the practitioner and the regulatory reviewer to ensure proper application.",
        "The challenge of communicating probabilistic outputs (e.g., posterior distributions) to non-technical stakeholders and decision-makers.",
        "The lack of standardized software and guidance, leading to potential inconsistencies across different site assessments.",
        "Other"
      ]
    },
    // Questions 4-11: Ranking Polls
    {
      question: "Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)",
      questionNumber: 4,
      isRanking: true,
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 5,
      isRanking: true,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)",
      questionNumber: 6,
      isRanking: true,
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 7,
      isRanking: true,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)",
      questionNumber: 8,
      isRanking: true,
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 9,
      isRanking: true,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)",
      questionNumber: 10,
      isRanking: true,
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 11,
      isRanking: true,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    },
    // Question 12: Wordcloud Poll
    {
      question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
      questionNumber: 12,
      isWordcloud: true,
      maxWords: 3,
      wordLimit: 20,
      options: [] // Wordcloud doesn't use options array
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
                    options={poll.options}
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
                    options={poll.options}
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
