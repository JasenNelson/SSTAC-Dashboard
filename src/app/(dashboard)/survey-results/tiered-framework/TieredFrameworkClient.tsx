'use client';

import React, { useState } from 'react';
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

export default function TieredFrameworkClient() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system - 12 questions total
  const polls = [
    // Questions 1-3: Single-choice polls
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
    // Questions 4-11: Ranking polls
    {
      question: "Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)",
      questionNumber: 4,
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
      isRanking: true
    },
    {
      question: "Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 5,
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
      isRanking: true
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)",
      questionNumber: 6,
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
      isRanking: true
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 7,
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
      isRanking: true
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)",
      questionNumber: 8,
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
      isRanking: true
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 9,
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
      isRanking: true
    },
    {
      question: "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)",
      questionNumber: 10,
      options: ["Very Important", "Important", "Moderately Important", "Less Important", "Not Important"],
      isRanking: true
    },
    {
      question: "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 11,
      options: ["Easily Achievable", "Achievable", "Moderately Achievable", "Difficult", "Not Feasible"],
      isRanking: true
    },
    // Question 12: Wordcloud poll
    {
      question: "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?",
      questionNumber: 12,
      options: [],
      isWordcloud: true,
      maxWords: 3,
      wordLimit: 20
    }
  ];

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden z-0">
          <img 
            src="/Malcolm2.jpg" 
            alt="Malcolm landscape for tiered framework assessment"
            className="w-full h-full object-cover"
            style={{ 
              objectPosition: "center 30%",
              filter: "brightness(0.6)" 
            }}
          />
        </div>
        
        {/* Dark Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-black/30 z-10"></div>
        
        {/* Navigation */}
        <div className="absolute top-6 left-6 z-30">
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
        <div className="relative z-20 text-center text-white px-6 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 font-['Merriweather']">
            Tiered Assessment Framework
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            Site-Specific Sediment Standards
          </p>
          
          {/* Framework Description */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              "A structured approach to sediment quality assessment that allows for site-specific 
              modifications while maintaining consistency and scientific rigor, recognizing that 
              one-size-fits-all standards cannot adequately address diverse environmental conditions."
            </p>
          </div>
        </div>
      </section>

      {/* Framework Overview Section */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            From Single-Threshold to Tiered Assessment
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The Challenge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold mb-4 text-white">The Challenge</h3>
                <p className="text-white leading-relaxed">
                  Current "bright-line" standards are often overly conservative, leading to unnecessary 
                  investigations and remediation costs, while the "sensitive sediment" designation 
                  is applied too broadly, negating the purpose of a two-tiered system.
                </p>
              </div>
            </div>

            {/* Card 2: Survey Findings - Site-Specific Bioavailability */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-2xl font-bold mb-4 text-white">Site-Specific Bioavailability</h3>
                <p className="text-white leading-relaxed">
                  <strong>89%</strong> of respondents support site-specific bioavailability adjustments. 
                  <strong>76%</strong> emphasize the need for environmental condition data (pH, organic carbon, 
                  particle size) to refine sediment standards for local conditions.
                </p>
              </div>
            </div>

            {/* Card 3: Survey Findings - Tiered Options */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold mb-4 text-white">Tiered Assessment Options</h3>
                <p className="text-white leading-relaxed">
                  <strong>82%</strong> support clear decision trees for tier selection. 
                  <strong>71%</strong> want flexibility to move between tiers based on site complexity 
                  and data availability, with <strong>68%</strong> prioritizing cost-effectiveness.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tiered Framework Components Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            The Three-Tier Assessment Framework
          </h2>
          
          <div className="space-y-6">
            {/* Accordion 1: Tier 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-1')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Tier 1: Screening Level Numerical Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-1' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-1' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Purpose:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Uses conservative, generic standards for initial site screening to quickly identify sites 
                        needing more assessment.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Approach:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Matrix sediment standards with generic (non-site-specific) assumptions, 
                        applicable at any sites in BC.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">When to Use:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        First step in sediment quality assessment for all sites, providing a conservative 
                        screening approach to identify potential concerns.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Tier 2a */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-2a')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Tier 2a: Refined Numerical Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-2a' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-2a' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Purpose:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Uses models and procedures (e.g., Cause-Effect) to derive site-specific standards, 
                        primarily for bioavailability adjustments.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Approach:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Systematically incorporates bioavailability adjustments using standard OC normalization 
                        and AVS/SEM assessments, with provisions for advanced tools like passive sampling devices.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">When to Use:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        When Tier 1 screening identifies exceedances and site-specific conditions differ 
                        from generic assumptions, particularly for bioavailability considerations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Tier 2b */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-2b')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Tier 2b: Screening-Level Risk-Based Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-2b' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-2b' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Purpose:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Similar to Tier 2a but adds prescribed lines of evidence, such as community analysis, 
                        within an enhanced screening-level risk assessment process.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Approach:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Prescribed process with precluding conditions to determine if receptor-pathway-contaminant 
                        is complete and fails screening-level, or incomplete and may pass screening-level.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">When to Use:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        When additional lines of evidence are needed beyond numerical standards, including 
                        benthic community analysis and habitat assessment requirements.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Tier 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-3')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Tier 3: Detailed Risk-Based Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-3' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-3' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Purpose:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        A full risk assessment using multiple lines of evidence and site-specific factors 
                        for complex scenarios.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Approach:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Detailed risk assessment in accordance with Protocol 1, integrating chemistry, 
                        toxicity testing, biological community analysis, and bioaccumulation information 
                        using cause-effect models like Bayesian Network - Relative Risk Model framework.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">When to Use:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        For complex sites where Tier 2 assessments are insufficient or when multiple 
                        stressors and pathways need comprehensive evaluation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Survey Findings Section */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            What We Heard: Stakeholder Perspectives
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Key Survey Findings</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✓</span>
                  <span>86.4% of respondents found a tiered framework would be beneficial</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✓</span>
                  <span>88.1% felt that incorporating bioavailability adjustments is important or essential</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✓</span>
                  <span>Strong support for site-specific modifications and flexibility</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✓</span>
                  <span>Recognition that current standards are often overly conservative</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Stakeholder Concerns</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">⚠️</span>
                  <span><strong>73%</strong> express concerns about complexity of tier selection criteria</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">⚠️</span>
                  <span><strong>67%</strong> highlight need for clear bioavailability adjustment protocols</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">⚠️</span>
                  <span><strong>81%</strong> request guidance for site-specific modification applications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">⚠️</span>
                  <span><strong>69%</strong> emphasize importance of training and support for practitioners</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-white font-['Merriweather']">
            Your Input on Tiered Assessment
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-16 max-w-4xl mx-auto">
            Help inform the tiered framework development by sharing your perspectives on these key questions.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // Handle different poll types
              if (poll.isWordcloud) {
                return (
                  <WordCloudPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    maxWords={poll.maxWords || 3}
                    wordLimit={poll.wordLimit || 20}
                    pagePath="/survey-results/tiered-framework"
                    questionNumber={poll.questionNumber}
                    onVote={(pollIndex, words) => {
                      console.log(`Words submitted for poll ${pollIndex}:`, words);
                    }}
                  />
                );
              } else if (poll.isRanking) {
                return (
                  <RankingPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/survey-results/tiered-framework"
                    questionNumber={poll.questionNumber}
                    onVote={(pollIndex, rankings) => {
                      console.log(`Ranking submitted for poll ${pollIndex}:`, rankings);
                    }}
                  />
                );
              } else {
                return (
                  <PollWithResults
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/survey-results/tiered-framework"
                    questionNumber={poll.questionNumber}
                    onVote={(pollIndex, optionIndex) => {
                      console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}`);
                    }}
                  />
                );
              }
            })}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather'] text-white">
            Next Steps for Implementation
          </h2>
          
          <div className="space-y-8 text-lg">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-green-300 !text-green-300">Immediate Actions</h3>
              <p className="text-gray-200 !text-gray-200 leading-relaxed">
                Develop tier escalation criteria, establish bioavailability adjustment protocols, and create 
                guidance for site-specific modifications within the three-tier framework.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-green-300 !text-green-300">Long-term Development</h3>
              <p className="text-gray-200 !text-gray-200 leading-relaxed">
                Comprehensive training programs, practitioner support tools, and continuous refinement 
                of the tiered approach based on real-world application experience.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-green-300 !text-green-300">Your Continued Input</h3>
              <p className="text-gray-200 !text-gray-200 mb-4">
                We welcome your ongoing perspectives as we develop this tiered framework together. 
                Your input is essential for creating effective, practical assessment protocols.
              </p>
              <a 
                href="mailto:info@sabcs.ca"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-300 text-lg"
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
            &copy; 2024 SSTAC & TWG Dashboard | Tiered Assessment Framework
          </p>
        </div>
      </footer>
    </div>
  );
}