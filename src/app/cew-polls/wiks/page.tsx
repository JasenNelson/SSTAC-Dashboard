'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function CEWWIKSPage() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  const polls = [
    {
      question: "What is the most effective starting point for developing a holistic baseline study that combines co-located sampling (e.g., sediment, porewater, tissue, surface water) with area-based Indigenous Knowledge and Science?",
      questionNumber: 1,
      options: [
        "A co-developed conceptual site model that integrates Indigenous Knowledge with Western science from the outset",
        "A comprehensive literature review of existing Indigenous Knowledge and Western scientific studies in the area",
        "A pilot-scale field study to test the integration of both knowledge systems",
        "Community engagement sessions to understand Indigenous Knowledge holders' priorities and concerns",
        "A technical working group with equal representation from Indigenous Knowledge holders and Western scientists",
        "Other"
      ]
    },
    {
      question: "How should Indigenous Knowledge and Western science be weighted when they provide conflicting information about environmental conditions or risks?",
      questionNumber: 2,
      options: [
        "Equal weight (50/50) with transparent documentation of both perspectives",
        "Indigenous Knowledge should be given priority as it represents long-term, place-based understanding",
        "Western science should be given priority as it provides quantifiable, standardized data",
        "Weighting should be determined on a case-by-case basis by a joint Indigenous-Western science committee",
        "Both should be presented equally but with clear identification of the source and methodology",
        "Other"
      ]
    },
    {
      question: "What is the most important factor for ensuring Indigenous Knowledge is properly integrated into sediment quality standards development?",
      questionNumber: 3,
      options: [
        "Early and ongoing engagement with Indigenous communities throughout the process",
        "Training Western scientists in Indigenous Knowledge protocols and cultural sensitivity",
        "Establishing clear intellectual property rights and data sovereignty for Indigenous Knowledge",
        "Creating dedicated funding streams for Indigenous Knowledge holder participation",
        "Developing standardized protocols for documenting and validating Indigenous Knowledge",
        "Other"
      ]
    },
    {
      question: "How should conflicts between Indigenous Knowledge and Western scientific findings be resolved in the context of sediment quality assessment?",
      questionNumber: 4,
      options: [
        "Through facilitated dialogue between Indigenous Knowledge holders and Western scientists",
        "By conducting additional research that specifically addresses the conflicting information",
        "By presenting both perspectives equally and letting decision-makers choose",
        "Through a formal dispute resolution process involving both knowledge systems",
        "By seeking guidance from Indigenous Knowledge holders on how to proceed",
        "Other"
      ]
    },
    {
      question: "What is the most effective way to ensure Indigenous Knowledge holders have meaningful input into sediment quality standards development?",
      questionNumber: 5,
      options: [
        "Including Indigenous Knowledge holders as equal partners in all technical working groups",
        "Providing dedicated funding and resources for Indigenous community participation",
        "Conducting regular community consultations and feedback sessions",
        "Establishing Indigenous Knowledge advisory committees with decision-making authority",
        "Creating culturally appropriate communication and engagement protocols",
        "Other"
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-blue-800 dark:text-blue-200 text-sm">
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
