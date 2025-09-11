'use client';

import React, { useState } from 'react';
import CEWCodeInput from '@/components/CEWCodeInput';
import PollWithResults from '@/components/PollWithResults';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function CEWWIKSPage() {
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
      question: "What is the most effective starting point for developing a holistic baseline study that combines co-located sampling (e.g., sediment, porewater, tissue, surface water) with area-based Indigenous Knowledge and Science?",
      questionNumber: 1,
      options: [
        "A co-developed conceptual site model that uses Indigenous Knowledge to first identify key species, exposure pathways, and areas of cultural significance to guide the scientific sampling plan",
        "A comprehensive literature and data review that compiles all existing scientific and Indigenous knowledge for the area to identify critical data gaps that the baseline study must fill",
        "A pilot-scale field study conducted collaboratively with community members to test and validate sampling methods and ensure they are effective and culturally appropriate",
        "A series of collaborative workshops where knowledge holders and scientists share information to establish a shared understanding of the ecosystem's history, health, and stressors"
      ]
    },
    {
      question: "How can the scientific framework incorporate protection goals related to Indigenous Stewardship principles such as the 'connectedness of all life' and '7-generations'?",
      questionNumber: 2,
      options: [
        "By using food-web models that scientifically map contaminant pathways between species",
        "By developing Species Sensitivity Distributions (SSDs) that must include culturally significant local species",
        "By setting protective tissue residue guidelines for key indicator species to ensure long-term safety",
        "By incorporating ecosystem function metrics (e.g., nutrient cycling) as formal scientific endpoints"
      ]
    },
    {
      question: "Within a tiered framework, where can place-based Indigenous Knowledge provide the most direct scientific value for modifying a generic baseline value to be more site-specific?",
      questionNumber: 3,
      options: [
        "Informing bioavailability models with specific knowledge of local sediment characteristics and processes",
        "Identifying sensitive local species or life stages not included in the generic models for a more accurate risk calculation",
        "Characterizing unique, site-specific contaminant exposure pathways that would alter baseline risk model assumptions",
        "Identifying potential confounding environmental factors (e.g., freshwater seeps) influencing scientific measurements"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              CEW 2025 Live Polling
            </h1>
            <h2 className="text-xl text-indigo-600 dark:text-indigo-400 font-semibold">
              Indigenous Knowledge & Science
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
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-blue-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-gray-700 dark:text-blue-200 text-sm">
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
                pagePath="/cew-polls/wiks"
                questionNumber={poll.questionNumber}
                authCode={authCode}
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
