'use client';

import React, { useState } from 'react';
import CEWCodeInput from '@/components/CEWCodeInput';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function CEWTieredFrameworkPage() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(null);

  const handleCodeEntered = (code: string) => {
    setAuthCode(code);
  };

  if (!authCode) {
    return <CEWCodeInput onCodeEntered={handleCodeEntered} />;
  }
  
  // Define polls with proper structure for the new poll system
  const polls = [
    {
      question: "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
      questionNumber: 1,
      options: [
        "Yes",
        "No",
        "It depends",
        "Unsure",
        "Other"
      ]
    },
    {
      question: "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
      questionNumber: 2,
      options: [
        "Environmental Conditions: Physical and chemical data",
        "Bioaccumulation Data in Tissues of Local Species",
        "Benthic Community Structure Analysis",
        "Other"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              CEW 2025 Live Polling
            </h1>
            <h2 className="text-xl text-purple-600 dark:text-purple-400 font-semibold">
              Tiered Framework
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
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-purple-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-gray-700 dark:text-purple-200 text-sm">
            Select your response for each question below. Your answers will be saved anonymously and combined with other conference participants' responses.
          </p>
        </div>

        {/* Polls */}
        <div className="space-y-8">
          {polls.map((poll, pollIndex) => {
            // Check if this is a ranking question
            const isRankingQuestion = poll.question.toLowerCase().includes('rank');
            
            if (isRankingQuestion) {
              return (
                <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                  <RankingPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/cew-polls/tiered-framework"
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
                    pagePath="/cew-polls/tiered-framework"
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
