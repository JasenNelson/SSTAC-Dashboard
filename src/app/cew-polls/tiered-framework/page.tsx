'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function CEWTieredFrameworkPage() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  const polls = [
    {
      question: "What is the most important factor for determining which tier a contaminated site should be assigned to in a tiered framework?",
      questionNumber: 1,
      options: [
        "The level of ecological risk based on comprehensive risk assessment",
        "The potential for human health impacts through food web exposure",
        "The complexity and uncertainty of the site conditions and contamination",
        "The availability of site-specific data and scientific certainty",
        "The level of community concern and stakeholder engagement",
        "Other"
      ]
    },
    {
      question: "How should a tiered framework balance the need for site-specific flexibility with the need for consistent, protective standards?",
      questionNumber: 2,
      options: [
        "Use conservative default standards with clear pathways for site-specific adjustments",
        "Develop separate standards for each tier with clear criteria for tier assignment",
        "Allow for case-by-case decision making within each tier based on site conditions",
        "Use a combination of prescriptive and performance-based standards",
        "Develop guidance documents that provide flexibility within each tier",
        "Other"
      ]
    },
    {
      question: "What is the most effective way to ensure transparency and consistency in tier assignment decisions?",
      questionNumber: 3,
      options: [
        "Develop clear, quantitative criteria for tier assignment with documented decision processes",
        "Require peer review and independent verification of tier assignment decisions",
        "Establish a centralized decision-making body with standardized procedures",
        "Use decision trees and flowcharts to guide tier assignment",
        "Require public disclosure and stakeholder input for tier assignment decisions",
        "Other"
      ]
    },
    {
      question: "How should a tiered framework address the transition between tiers as new information becomes available?",
      questionNumber: 4,
      options: [
        "Allow for automatic tier adjustment based on predefined criteria and triggers",
        "Require formal review and approval process for tier changes",
        "Use adaptive management approaches that allow for iterative refinement",
        "Develop clear protocols for tier reassessment and adjustment",
        "Require stakeholder consultation before tier changes",
        "Other"
      ]
    },
    {
      question: "What is the most important consideration for ensuring a tiered framework is practical and implementable?",
      questionNumber: 5,
      options: [
        "Clear, simple criteria that can be easily understood and applied",
        "Adequate resources and capacity for implementation and oversight",
        "Flexibility to accommodate different site conditions and contexts",
        "Strong stakeholder buy-in and support for the framework",
        "Integration with existing regulatory and management systems",
        "Other"
      ]
    },
    {
      question: "Please rank these potential benefits of a tiered framework for sediment quality standards (1= highest benefit):",
      questionNumber: 6,
      options: [
        "Improved efficiency in decision-making and resource allocation",
        "Better protection of sensitive ecosystems and species",
        "Increased flexibility for site-specific considerations",
        "Enhanced transparency and consistency in standard application",
        "Better integration of Indigenous Knowledge and local expertise",
        "Reduced regulatory burden for low-risk sites"
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Instructions */}
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
            📱 Mobile-Friendly Polling
          </h3>
          <p className="text-purple-800 dark:text-purple-200 text-sm">
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
