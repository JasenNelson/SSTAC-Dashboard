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

export default function CEWHolisticProtectionPage() {
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
      question: "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
      questionNumber: 1,
      options: [
        "Metals known to biomagnify",
        "Polycyclic Aromatic Hydrocarbons",
        "Polychlorinated Biphenyls",
        "Per-and Polyfluoroalkyl Substances",
        "All of the above",
        "Other"
      ]
    },
    {
      question: "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
      questionNumber: 2,
      options: [
        "Technical Hurdles: Limited data availability for many contaminants and species native to BC",
        "Practical Challenges: Discretionary matrix sediment standards may be a barrier for some practitioners",
        "Enhanced Protection: Comprehensive safeguards for BC's diverse aquatic ecosystems and peoples",
        "Scientific Advancement: Opportunity to pioneer innovative approaches to sediment management",
        "Societal Expectations: Given the challenges of modern society, holistic protection may not be feasible"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              CEW 2025 Live Polling
            </h1>
            <h2 className="text-xl text-green-600 dark:text-green-400 font-semibold">
              Holistic Protection
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Interactive polling for conference attendees
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-green-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-gray-700 dark:text-green-200 text-sm">
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
                    pagePath="/cew-polls/holistic-protection"
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
                    pagePath="/cew-polls/holistic-protection"
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
