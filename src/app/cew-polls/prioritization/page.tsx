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
  const polls = [
    {
      question: "Please rank these potential feasibility criteria to help inform the development of a prioritization framework (1= highest):",
      questionNumber: 1,
      options: [
        "Adequacy and reliability of available data for key research topics",
        "Need for new or specialized technologies",
        "Level of complexity and corresponding expertise and resource requirements",
        "Level of likelihood/uncertainty in successful completion of project or meeting research goals"
      ]
    },
    {
      question: "Please rank these timeframe considerations for developing a prioritization framework and strategic planning for research to support modernizing BC's sediment standards (1= highest):",
      questionNumber: 2,
      options: [
        "Outcome-driven priority, regardless of timeframe (i.e., disregard timeframe when prioritizing research)",
        "Focus on short-term progress (e.g., identify opportunities to quickly address regulatory gaps)",
        "Focus on progressing the highest potential impact, following a clear long-term strategic goal, avoiding convenient short-term efforts if they will distract from the goal and divert resources away from more meaningful progress.",
        "Consistent progress prioritized, with a balance of short- and long-term research efforts."
      ]
    },
    {
      question: "Based on Today's discussion and your experience, please rank these four areas for modernization priority in BC's sediment standards (1= highest):",
      questionNumber: 3,
      options: [
        "Development of a Scientific Framework for Deriving Site-Specific Sediment Standards (Bioavailability Adjustment)",
        "Development of a Matrix Sediment Standards Framework - Focus on Ecological Protection",
        "Development of a Matrix Sediment Standards Framework - Focus on Human Health Protection",
        "Develop Sediment Standards for Non-scheduled Contaminants & Mixtures"
      ]
    },
    {
      question: "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
      questionNumber: 4,
      options: [
        "Equilibrium partitioning models (e.g., based on organic carbon content).",
        "Normalization using Acid-Volatile Sulfides and Simultaneously Extracted Metals (AVS/SEM)",
        "Application of the Biotic Ligand Model (BLM) for sediments",
        "Direct measurement using passive sampling devices (PSDs)"
      ]
    },
    {
      question: "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible and practically achievable for BC's regulatory framework (1= highest):",
      questionNumber: 5,
      options: [
        "A simple additive model (e.g., hazard index)",
        "A weighted approach based on toxicological similarity",
        "Site-specific toxicity testing for all complex mixtures",
        "The development of new, mixture-specific standards"
      ]
    },
    {
      question: "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical for modernizing BC's sediment standards?",
      questionNumber: 6,
      options: [
        "Developing a robust framework for assessing the bioavailability of metals and metalloids.",
        "Establishing standardized analytical methods for a priority list of contaminants of emerging concern (CECs).",
        "Creating a predictive model for contaminant mixture toxicity based on concentration addition.",
        "Generating sufficient toxicity data to derive new guidelines for 3-5 high-priority legacy contaminants."
      ]
    },
    {
      question: "To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1= highest importance):",
      questionNumber: 7,
      options: [
        "Research into the ecosystem-level impacts of chronic, low-level contaminant exposure",
        "Development of advanced in-vitro and high-throughput screening methods for rapid hazard assessment",
        "Investigating the toxicological impacts of climate change variables (e.g., temperature, hypoxia) on sediment contaminant toxicity",
        "Building a comprehensive, open-access database of sediment chemistry and toxicology data for all of BC"
      ]
    },
    {
      question: "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?",
      questionNumber: 8,
      options: [
        "A lack of high-quality toxicity data for many individual components of common mixtures",
        "Poor understanding of the modes of action for many contaminants to justify grouping them",
        "Difficulty in validating model predictions with whole sediment toxicity testing results",
        "The inability of current models to account for significant synergistic or antagonistic interactions"
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
