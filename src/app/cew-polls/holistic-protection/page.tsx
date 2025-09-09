'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function CEWHolisticProtectionPage() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  const polls = [
    {
      question: "What is the most important consideration when developing sediment quality standards that protect both ecological and human health?",
      questionNumber: 1,
      options: [
        "Protecting the most sensitive species and life stages in the ecosystem",
        "Ensuring human health protection through food web exposure pathways",
        "Balancing ecological protection with economic feasibility and practicality",
        "Incorporating Indigenous Knowledge and traditional ecological knowledge",
        "Addressing cumulative effects and multiple stressors simultaneously",
        "Other"
      ]
    },
    {
      question: "How should sediment quality standards account for bioaccumulation and biomagnification in food webs?",
      questionNumber: 2,
      options: [
        "Develop separate standards for different trophic levels based on bioaccumulation potential",
        "Use the most sensitive endpoint (highest trophic level) as the protective standard",
        "Apply bioaccumulation factors to existing standards to account for food web transfer",
        "Develop integrated standards that consider both direct sediment exposure and food web exposure",
        "Use probabilistic approaches that account for variability in bioaccumulation",
        "Other"
      ]
    },
    {
      question: "What is the most effective approach for protecting Indigenous communities who rely on traditional food sources from contaminated sediments?",
      questionNumber: 3,
      options: [
        "Develop community-specific standards based on local consumption patterns and cultural practices",
        "Use the most conservative (protective) standards for all areas with Indigenous communities",
        "Implement adaptive management that allows for community-specific adjustments",
        "Develop separate standards for areas with high traditional food consumption",
        "Include Indigenous Knowledge holders in the standard-setting process",
        "Other"
      ]
    },
    {
      question: "How should sediment quality standards address the protection of both benthic organisms and higher trophic level species?",
      questionNumber: 4,
      options: [
        "Develop separate standards for benthic and water column organisms",
        "Use a tiered approach with different standards for different ecosystem components",
        "Focus on protecting the most sensitive species regardless of trophic level",
        "Develop integrated standards that protect the entire food web",
        "Use ecosystem-based approaches that consider species interactions",
        "Other"
      ]
    },
    {
      question: "What is the most important factor for ensuring sediment quality standards provide adequate protection for human health?",
      questionNumber: 5,
      options: [
        "Including bioaccumulation and biomagnification in the risk assessment",
        "Considering multiple exposure pathways (direct contact, food consumption, etc.)",
        "Using appropriate uncertainty factors for human health protection",
        "Incorporating community-specific consumption patterns and cultural practices",
        "Developing standards that protect the most vulnerable populations",
        "Other"
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
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-green-800 dark:text-green-200 text-sm">
            Select your response for each question below. Your answers will be saved anonymously and combined with other conference participants' responses.
          </p>
        </div>

        {/* Polls */}
        <div className="space-y-8">
          {polls.map((poll, pollIndex) => (
            <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <PollWithResults
                key={pollIndex}
                pollIndex={pollIndex}
                question={poll.question}
                options={poll.options}
                pagePath="/cew-polls/holistic-protection"
                questionNumber={poll.questionNumber}
                onVote={(pollIndex, optionIndex, otherText) => {
                  console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}${otherText ? `, otherText: "${otherText}"` : ''}`);
                }}
              />
            </div>
          ))}
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
