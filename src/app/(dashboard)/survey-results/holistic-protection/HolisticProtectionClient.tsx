'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import PollWithResults from '@/components/PollWithResults';
import SurveyMatrixGraph from '@/components/graphs/SurveyMatrixGraph';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function HolisticProtectionClient() {
  const [_activeAccordion, _setActiveAccordion] = useState<string | null>(null);
  const [polls, _setPolls] = useState<PollData[]>([
    {
      question: "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
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
      question: "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
      questionNumber: 2,
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
      questionNumber: 3,
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
      questionNumber: 4,
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
      questionNumber: 5,
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
      questionNumber: 6,
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
      questionNumber: 7,
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
      questionNumber: 8,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable",
        "Difficult",
        "Not Feasible"
      ]
    }
  ]);

  const _toggleAccordion = (id: string) => {
    _setActiveAccordion(_activeAccordion === id ? null : id);
  };

  // Helper function to generate matrix titles based on question index
  const getMatrixTitle = (pollIndex: number) => {
    switch (pollIndex) {
      case 1: return 'Ecosystem Health - Direct Toxicity';
      case 3: return 'Human Health - Direct Toxicity';
      case 5: return 'Ecosystem Health - Food-Related';
      case 7: return 'Human Health - Food-Related';
      default: return 'Matrix Standards';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/Minnekhada2.JPG"
            alt="Minnekhada Regional Park landscape for holistic protection"
            fill
            className="object-cover"
            style={{ filter: "brightness(0.6)" }}
            priority
          />
        </div>
        
        {/* Dark Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Navigation */}
        <div className="absolute top-6 left-6 z-20">
          <a 
            href="/survey-results"
            className="inline-flex items-center text-white/90 hover:text-white transition-colors bg-black/20 backdrop-blur-sm rounded-lg px-4 py-2"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Survey Results
          </a>
        </div>
        
        {/* Content Overlay */}
        <div className="relative z-10 text-center text-white px-6 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 font-['Merriweather']">
            Holistic Protection for BC Sediments
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            Matrix Sediment Standards Framework
          </p>
          
          {/* Framework Description */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              &quot;A comprehensive approach to sediment quality protection that ensures the ecological health of
              bottom-dwelling and pelagic organisms, while addressing food pathway toxicity that affects
              fish, birds, wildlife and people.&quot;
            </p>
          </div>
        </div>
      </section>

      {/* What We Heard: Survey Insights Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            What We Heard: Survey Insights
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Bioaccumulation Prevention</h3>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-900 dark:text-blue-400 mb-2">73%</div>
                    <p className="text-gray-700 dark:text-gray-300 text-lg">
                      Current Sediment Standards are Not or Slightly Effective
                    </p>
                  </div>
                  <div className="mt-6 text-center">
                    <div className="text-4xl font-bold text-blue-900 dark:text-blue-400 mb-2">76.7%</div>
                    <p className="text-gray-700 dark:text-gray-300 text-lg">
                      Necessary in Future Matrix Sediment Standards
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Stakeholder Perspective</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg italic leading-relaxed mt-4 text-center">
                  &quot;The BC CSR sediment standards are not appropriate or adequate to protect upper trophic level 
                  organisms, apex predators and humans at the top of foodwebs, as these sediment standards were or 
                  are designed for the protection of low tropic level species and benthic organisms.&quot;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Holistic Protection Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Why &quot;Holistic Protection&quot; for BC Sediments
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Direct Toxicity to Amphipods Only */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">The Challenge</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Direct Toxicity to Amphipods Only: Current standards based on amphipod toxicity, and assumed to be protective of other organisms.
              </p>
            </div>

            {/* Ecosystem Integrity */}
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">The Matrix Framework</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Ecosystem Integrity: Holistic protection requires ensuring the ecological health of bottom-dwelling and pelagic organisms.
              </p>
            </div>

            {/* Food Pathway Toxicity */}
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Holistic Protection</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Food Pathway Toxicity: Contaminants in sediment move through food webs, affecting fish, birds, wildlife and people.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Matrix Framework Components Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Proposed Matrix Sediment Standards (SedS) Framework
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="flex justify-center mb-8">
              <Image
                src="/matrix-graph.jpg"
                alt="Matrix Sediment Standards Framework showing Direct Toxicity and Food Pathway Toxicity for Ecological and Human Health"
                width={900}
                height={600}
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Direct Toxicity (SedS-direct)</h3>
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-directECO</h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      Protect aquatic organisms from direct exposure from contaminants in sediment.
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                    <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-directHH</h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      Protects people from direct contact risks (e.g., incidental ingestion, dermal contact) during recreational or cultural activities.
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Food Pathway Toxicity (SedS-food)</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                    <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-foodECO</h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      Protects piscivorous wildlife (e.g., otters, eagles, orcas) from the bioaccumulation and biomagnification of contaminants through the food chain.
                    </p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                    <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-foodHH</h4>
                    <p className="text-gray-700 dark:text-gray-300">
                      Protects human consumers of fish, shellfish, and other aquatic foods.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-white font-['Merriweather']">
            Your Input on Matrix Standards
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-16 max-w-4xl mx-auto">
            We&apos;re looking for your input on the feasibility and importance of the proposed matrix sediment standards framework, to help prioritize them.
          </p>
          
          <div className="mb-12 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Feasible</h3>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-lg">
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-3 mt-1">•</span>
                    <span>Supporting technical information is available</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-3 mt-1">•</span>
                    <span>Capacity in BC - expertise, technology</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-600 dark:text-orange-400 mr-3 mt-1">•</span>
                    <span>Likely affordable</span>
                  </li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Important</h3>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300 text-lg">
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">•</span>
                    <span>Will improve regulatory decisions related to contaminated sediments</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">•</span>
                    <span>Addresses a critical gap in current regime</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">•</span>
                    <span>Environmental protection</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // All questions are now single-choice polls
              return (
                <div key={pollIndex}>
                  <PollWithResults
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/survey-results/holistic-protection"
                    questionNumber={poll.questionNumber}
                    onVote={(pollIndex, optionIndex) => {
                      console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}`);
                    }}
                  />
                  
                  {/* Add matrix graph after each feasibility question (even indices: 1, 3, 5, 7) */}
                  {pollIndex % 2 === 1 && (
                    <SurveyMatrixGraph
                      questionPair={{
                        importanceQuestion: polls[pollIndex - 1].question,
                        feasibilityQuestion: polls[pollIndex].question,
                        title: `Matrix Standards (${getMatrixTitle(pollIndex)})`
                      }}
                      pagePath="holistic-protection"
                      importanceIndex={pollIndex - 1}
                      feasibilityIndex={pollIndex}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-12 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather'] text-white">
            Next Steps for Implementation
          </h2>
          
          <div className="space-y-8 text-lg">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Immediate Actions</h3>
              <p className="text-gray-200 leading-relaxed">
                Develop draft matrix standards for key contaminants, create assessment frameworks, 
                and establish stakeholder consultation processes to refine the approach.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Long-term Development</h3>
              <p className="text-gray-200 leading-relaxed">
                Comprehensive guidance documents, training programs, and monitoring frameworks 
                to ensure successful implementation of the matrix sediment standards framework.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-blue-300">Your Continued Input</h3>
              <p className="text-gray-200 mb-4">
                We welcome your ongoing perspectives as we develop this framework together. 
                Your input is essential for creating effective, practical matrix standards.
              </p>
              <a 
                href="mailto:info@sabcs.ca"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-300 text-lg"
              >
                Email: info@sabcs.ca
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-gray-400">
            &copy; 2024 SSTAC & TWG Dashboard | Matrix Sediment Standards Framework
          </p>
        </div>
      </footer>
    </div>
  );
}
