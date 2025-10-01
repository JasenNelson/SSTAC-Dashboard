'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';
import WordCloudPoll from '@/components/dashboard/WordCloudPoll';

interface PollData {
  question: string;
  options?: string[];
  questionNumber?: number;
  isRanking?: boolean;
  isWordcloud?: boolean;
  maxWords?: number;
  wordLimit?: number;
  predefinedOptions?: Array<{ display: string; keyword: string }>;
}

export default function PrioritizationClient() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  // Updated structure: Q1-Q2 single-choice, Q3-Q4 ranking, Q5 wordcloud
  const polls = [
    // Questions 1-2: Single-Choice Polls (kept from original Q1-Q2)
    {
      question: "Rank the importance of incorporating bioavailability adjustments into sediment standards. (1 = very important to 5 = not important)",
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
      question: "Rank the feasibility of incorporating bioavailability adjustments into sediment standards. (1 = easily achievable to 5 = not feasible)",
      questionNumber: 2,
      options: [
        "Easily Achievable",
        "Achievable",
        "Moderately Achievable", 
        "Difficult",
        "Not Feasible"
      ]
    },
    // Questions 3-4: Ranking Polls (moved from original Q11-Q12)
    {
      question: "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.",
      questionNumber: 3,
      isRanking: true,
      options: [
        "Developing the technical approach to define what \"direct toxicity\" and \"food pathway toxicity\" mean for the framework.",
        "Determining what approach ENV should take to develop human health standards, given there are other agencies working on like standards.",
        "Developing the technical approach to address how matrix standards would be applied in a spatial context (e.g., over what spatial areas, for what depths, etc.).",
        "Determining if environmental sensitivity should be factored into matrix standards for ecological health."
      ]
    },
    {
      question: "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
      questionNumber: 4,
      isRanking: true,
      options: [
        "Selecting and using models and other tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (these would include, for example, acid volatile sulphides/simultaneously extractable metals (AVS/SEM), equilibrium partitioning (EqP), target lipid model)",
        "Selecting and using approaches to develop Sediment Standards for contaminants with an analogue (e.g., quantitative structure-activity relationship (QSAR))",
        "Developing guidance and/or framework to use site-specific toxicity testing to evaluate the risks of mixtures to ecological receptors.",
        "Developing models and/or approaches to derive mixture-specific sediment standards for ecological receptors (e.g., for water quality, there are biotic ligand models for metals mixtures)."
      ]
    },
    // Question 5: Wordcloud Poll (moved from original Q13)
    {
      question: "Overall, what is the greatest constraint to advancing holistic sediment protection in BC?",
      questionNumber: 5,
      isWordcloud: true,
      maxWords: 1,
      wordLimit: 20,
      predefinedOptions: [
        { display: "Data availability", keyword: "Data" },
        { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
        { display: "Agreement on protection goals and spatial scale", keyword: "Policy" },
        { display: "Resourcing (e.g., developing approach/tools, agreeing across peers)", keyword: "Resourcing" }
      ]
    }
  ];

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src="/Lindsay.JPG" 
            alt="Lindsay landscape for prioritization planning"
            className="w-full h-full object-cover"
            style={{ filter: "brightness(0.65)" }}
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
            Prioritization Framework
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            Collaborative Strategic Planning for Sediment Standards Modernization
          </p>
          
          {/* Framework Description */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              &quot;A comprehensive framework for collaboratively prioritizing research initiatives, assessing feasibility, 
              and developing strategic plans for short-, medium-, and long-term modernization goals across all aspects of sediment standards.&quot;
            </p>
          </div>
        </div>
      </section>

      {/* Framework Overview Section */}
      <section className="py-20 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Strategic Research Planning & Feasibility Assessment
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The Challenge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold mb-4">The Challenge</h3>
                <p className="text-white leading-relaxed">
                  Multiple modernization approaches need coordination: matrix standards, tiered frameworks, 
                  bioavailability adjustments, and contaminant expansion require strategic prioritization and feasibility assessment.
                </p>
              </div>
            </div>

            {/* Card 2: The Solution */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-2xl font-bold mb-4">Collaborative Framework</h3>
                <p className="text-white leading-relaxed">
                  A comprehensive approach that assesses feasibility, prioritizes research initiatives, 
                  and develops strategic plans for short-, medium-, and long-term modernization goals.
                </p>
              </div>
            </div>

            {/* Card 3: The Benefits */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold mb-4">Strategic Implementation</h3>
                <p className="text-white leading-relaxed">
                  Coordinated resource allocation across all modernization approaches ensures 
                  efficient progress while maintaining scientific rigor and practical implementation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prioritization Framework Section */}
      <section className="py-20 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Framework Components & Research Priorities
          </h2>
          
          <div className="space-y-6">
            {/* Accordion 1: Legacy Contaminants */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('legacy-contaminants')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Legacy Contaminants Priority</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'legacy-contaminants' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'legacy-contaminants' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Current Status:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Existing sediment standards primarily address legacy contaminants with established 
                        toxicity data and clear derivation methods.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Priority Actions:</h4>
                      <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg">
                        <li>• Review and update existing standards based on new scientific data</li>
                        <li>• Ensure all legacy contaminants are covered by the Matrix Sediment Standards Framework</li>
                        <li>• Validate existing standards against current risk assessment methodologies</li>
                        <li>• Address any gaps in legacy contaminant coverage</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Emerging Contaminants */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('emerging-contaminants')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Emerging Contaminants Strategy</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'emerging-contaminants' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'emerging-contaminants' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">High Priority Emerging Contaminants:</h4>
                      <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg">
                        <li>• PFAS (Per- and polyfluoroalkyl substances)</li>
                        <li>• Organotins (e.g., tributyltin or TBT)</li>
                        <li>• Dioxins/furans (as toxic equivalents or TEQs)</li>
                        <li>• Current-use pesticides</li>
                        <li>• Microplastics (narrative standards initially)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Implementation Approach:</h4>
                      <p className="text-gray-600 dark:text-gray-300 text-lg">
                        Develop narrative standards and monitoring triggers for contaminants with limited 
                        data, while building scientific foundation for numerical thresholds as science matures.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Prioritization Criteria */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('prioritization-criteria')}
                className="w-full text-left p-8 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Prioritization Criteria</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'prioritization-criteria' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'prioritization-criteria' && (
                <div className="px-8 pb-8 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Scientific Criteria:</h4>
                        <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg">
                          <li>• Detection frequency in BC waters</li>
                          <li>• Toxicity data availability and quality</li>
                          <li>• Persistence in environmental media</li>
                          <li>• Bioaccumulation potential</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Implementation Criteria:</h4>
                        <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg">
                          <li>• Derivation method feasibility</li>
                          <li>• Data quality and availability</li>
                          <li>• Regulatory urgency</li>
                          <li>• Resource requirements</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Survey Findings Section */}
      <section className="py-20 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            What We Heard: Stakeholder Perspectives
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Key Survey Findings</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-orange-600 mr-3 mt-1">✓</span>
                  <span>Strong support for comprehensive contaminant coverage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-600 mr-3 mt-1">✓</span>
                  <span>Need for systematic prioritization approach</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-600 mr-3 mt-1">✓</span>
                  <span>Importance of addressing emerging contaminants</span>
                </li>
                <li className="flex items-start">
                  <span className="text-orange-600 mr-3 mt-1">✓</span>
                  <span>Recognition that resource allocation requires prioritization</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Stakeholder Concerns</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-yellow-600 dark:text-yellow-400 mr-3 mt-1">⚠️</span>
                  <span><strong>79%</strong> express concerns about complexity of prioritization methodology</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 dark:text-yellow-400 mr-3 mt-1">⚠️</span>
                  <span><strong>84%</strong> highlight need for clear criteria and decision frameworks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 dark:text-yellow-400 mr-3 mt-1">⚠️</span>
                  <span><strong>71%</strong> request guidance on emerging contaminant assessment</span>
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-600 dark:text-yellow-400 mr-3 mt-1">⚠️</span>
                  <span><strong>76%</strong> emphasize importance of stakeholder input in prioritization process</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-20 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 dark:text-white font-['Merriweather']">
            Your Input on Prioritization Framework
          </h2>
          <p className="text-xl text-center text-gray-600 dark:text-gray-300 mb-16 max-w-4xl mx-auto">
            Help inform the collaborative development of strategic research plans and feasibility assessments by sharing your perspectives on these key questions.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // Handle different poll types
              if (poll.isWordcloud) {
                return (
                  <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    <WordCloudPoll
                      key={pollIndex}
                      pollIndex={pollIndex}
                      question={poll.question}
                      maxWords={poll.maxWords || 3}
                      wordLimit={poll.wordLimit || 20}
                      pagePath="/survey-results/prioritization"
                      questionNumber={poll.questionNumber}
                      predefinedOptions={poll.predefinedOptions}
                      onVote={(pollIndex, words) => {
                        console.log(`Words submitted for poll ${pollIndex}:`, words);
                      }}
                    />
                  </div>
                );
              } else if (poll.isRanking) {
                return (
                  <div key={pollIndex} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
                    <RankingPoll
                      key={pollIndex}
                      pollIndex={pollIndex}
                      question={poll.question}
                      options={poll.options || []}
                      pagePath="/survey-results/prioritization"
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
                      options={poll.options || []}
                      pagePath="/survey-results/prioritization"
                      questionNumber={poll.questionNumber}
                      onVote={(pollIndex, optionIndex) => {
                        console.log(`Vote submitted for poll ${pollIndex}, option ${optionIndex}`);
                      }}
                    />
                  </div>
                );
              }
            })}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-20 px-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather']">
            Next Steps for Implementation
          </h2>
          
          <div className="space-y-8 text-lg">
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">Immediate Actions</h3>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                Develop prioritization criteria, establish rolling review processes, and create 
                phased implementation strategies for expanding contaminant coverage.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">Long-term Development</h3>
              <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
                Comprehensive contaminant coverage, emerging substance standards, and adaptive 
                management frameworks to ensure continued relevance and effectiveness.
              </p>
            </div>
            
            <div>
              <h3 className="text-2xl font-semibold mb-4 text-orange-600 dark:text-orange-400">Your Continued Input</h3>
              <p className="text-gray-700 dark:text-gray-200 mb-4">
                We welcome your ongoing perspectives as we develop this prioritization framework together. 
                Your input is essential for creating effective, practical contaminant prioritization strategies.
              </p>
              <a 
                href="mailto:info@sabcs.ca"
                className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors duration-300 text-lg"
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
            &copy; 2024 SSTAC & TWG Dashboard | Contaminant Prioritization Framework
          </p>
        </div>
      </footer>
    </div>
  );
}
