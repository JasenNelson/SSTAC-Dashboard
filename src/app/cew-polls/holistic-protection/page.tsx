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
  
  // Define polls with proper structure matching CEW_Poll_Questions.txt
  // Webpage Question 1 = Database poll_index 0, etc.
  const polls = [
    {
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
      questionNumber: 1, // poll_index 0
      options: [
        "Very Important",
        "Important",
        "Moderately Important", 
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      questionNumber: 2, // poll_index 1
      options: [
        "Easily Achievable",
        "Achievable", 
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = very important to 5 = not important)",
      questionNumber: 3, // poll_index 2
      options: [
        "Very Important",
        "Important",
        "Moderately Important", 
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = easily achievable to 5 = not feasible)",
      questionNumber: 4, // poll_index 3
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult", 
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = very important to 5 = not important)",
      questionNumber: 5, // poll_index 4
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important",
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 6, // poll_index 5
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable", 
        "Difficult",
        "Not Feasible"
      ]
    },
    {
      question: "Rank the importance of developing CSR sediment standards for food-related toxicity to human receptors. (1 = very important to 5 = not important)",
      questionNumber: 7, // poll_index 6
      options: [
        "Very Important",
        "Important",
        "Moderately Important",
        "Less Important", 
        "Not Important"
      ]
    },
    {
      question: "Rank the feasibility of developing CSR sediment standards for food-related toxicity to human receptors. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 8, // poll_index 7
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
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
            Select your response for each question below. Your answers will be saved anonymously and combined with other conference participants&apos; responses.
          </p>
        </div>

        {/* Polls */}
        <div className="space-y-8">
          {polls.map((poll, pollIndex) => {
            // All questions are now single-choice polls
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
