'use client';

import React from 'react';
import PollWithResults from '@/components/PollWithResults';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function TieredFrameworkClient() {
  // Define polls with proper structure for the Tiered Framework - 3 questions total
  const polls = [
    // Question 1: Single-choice poll
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
    // Question 2: Single-choice poll
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
    // Question 3: Single-choice poll
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
    }
  ];

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
            Tiered Framework with Site-Specific Sediment Standards
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            A structured approach that allows for site-specific modifications while maintaining scientific rigor
          </p>
          
          {/* Framework Description */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              "Expanding the tiered framework to incorporate site-specific sediment standards that reduce uncertainty 
              and streamline remediation while improving decision-making and environmental outcomes."
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
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Tiered Framework Beneficial</h3>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-green-800 dark:text-green-400 mb-2">86.4%</div>
                  <p className="text-gray-700 dark:text-gray-300 text-lg">
                    of respondents found a tiered framework would be beneficial for the future sediment standards framework
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Bioavailability Adjustments Important</h3>
                <div className="text-center mb-4">
                  <div className="text-5xl font-bold text-blue-900 dark:text-blue-400 mb-2">88.1%</div>
                  <p className="text-gray-700 dark:text-gray-300 text-lg">
                    felt that incorporating bioavailability adjustments is important or essential for the future sediment standards framework
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Expand the Tiered Framework? Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Why Expand the Tiered Framework with Site-Specific Sediment Standards?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Current Limitations */}
            <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-6">
              <div className="text-4xl mb-4 text-center">⚠️</div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Current Limitations of Generic Sediment Standards</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300 text-lg">
                <li className="flex items-start">
                  <span className="text-red-600 dark:text-red-400 mr-3 mt-1">•</span>
                  <span>High uncertainty</span>
                </li>
                <li className="flex items-start">
                  <span className="text-red-600 dark:text-red-400 mr-3 mt-1">•</span>
                  <span>Conservative or underprotective</span>
                </li>
              </ul>
            </div>

            {/* Proposed Benefits */}
            <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
              <div className="text-4xl mb-4 text-center">✅</div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Proposed Site-Specific Sediment Standards</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300 text-lg">
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">•</span>
                  <span>Reduced uncertainty</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">•</span>
                  <span>Streamlined remediation</span>
                </li>
              </ul>
            </div>

            {/* Enhanced Protection */}
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
              <div className="text-4xl mb-4 text-center">🛡️</div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4 text-center">Enhanced Protection</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300 text-lg">
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">•</span>
                  <span>Improved decision-making and environmental outcomes</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">•</span>
                  <span>Effective resource allocation</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Tier Framework Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Three-Tier Framework
          </h2>
          
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Tier 1 */}
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Tier 1: Matrix Sediment Standards</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Assumes generic site conditions
                </p>
              </div>

              {/* Tier 2 */}
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Tier 2: Site-Specific Sediment Standards</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Bioavailability-adjusted using Equilibrium Partitioning (EqP) and/or Biotic Ligand Model (BLM)
                </p>
              </div>

              {/* Tier 3 */}
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Tier 3: Risk-Based Standards</h3>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Site-specific risk assessment
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-white font-['Merriweather']">
            Your Input on Tiered Assessment
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-16 max-w-4xl mx-auto">
            This leads us to the core questions for our discussion today. Your insights will help inform this collaborative process.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // All Tiered Framework polls are single-choice polls
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
              <h3 className="text-2xl font-semibold mb-4 text-green-300">Immediate Actions</h3>
              <p className="text-gray-200 leading-relaxed">
                Develop tier escalation criteria, establish bioavailability adjustment protocols, and create 
                guidance for site-specific modifications within the three-tier framework.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-green-300">Long-term Development</h3>
              <p className="text-gray-200 leading-relaxed">
                Comprehensive training programs, practitioner support tools, and continuous refinement 
                of the tiered approach based on real-world application experience.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-green-300">Your Continued Input</h3>
              <p className="text-gray-200 mb-4">
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
