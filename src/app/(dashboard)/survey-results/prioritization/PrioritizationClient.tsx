'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';
import WordCloudPoll from '@/components/dashboard/WordCloudPoll';
import SurveyMatrixGraph from '@/components/graphs/SurveyMatrixGraph';

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
  const [_activeAccordion, _setActiveAccordion] = useState<string | null>(null);
  
  // Define polls with proper structure for the new poll system
  // Updated structure: Q1-Q2 single-choice, Q3-Q4 ranking, Q5 wordcloud
  const polls: PollData[] = [
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
        "Distinguish \"direct toxicity\" and \"food pathway toxicity\" pathways explicitly.",
        "Clarify approach for incorporating human health endpoints in matrix standards.",
        "Clarify how spatial scale (areal spatial extent, vertical depth profile) is incorporated in application of matrix standards.",
        "Clarify whether and how multiple levels of protection are applied to account for differences in ecological sensitivity."
      ]
    },
    {
      question: "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
      questionNumber: 4,
      isRanking: true,
      options: [
        "Push guidance beyond generic numerical standards: Apply models and other technical tools to help develop Site-Specific Sediment Standards (Tier 2) for ecological health (e.g., equilibrium partitioning [EqP], acid volatile sulphides/simultaneously extractable metals [AVS/SEM], other modifying factors)",
        "Fill gaps and use surrogates: Develop Sediment Standards for missing substances and groups, using contaminants with an analogue (e.g., quantitative structure-activity relationship [QSAR]).",
        "Increase guidance for effects-based tools: Develop guidance for site-specific toxicity testing and/or biological monitoring, to evaluate site-specific risks beyond screening level assessment.",
        "Incorporate models and/or approaches for common mixtures: Develop sediment standards based on mixture models (e.g., target lipid model for petroleum hydrocarbons, toxic equivalents) rather than individual substances."
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
        { display: "Data availability (quantity, quality)", keyword: "Data" },
        { display: "Tools (models, test protocols, decision trees)", keyword: "Tools" },
        { display: "Agreement on application (e.g., protection goals, spatial scale, matrix approach)", keyword: "Agreement" },
        { display: "Prescription (balance between consistency and flexibility [tiering] across different sites)", keyword: "Prescription" },
        { display: "Resourcing (e.g., effort of developing approach/tools, consultation, documentation)", keyword: "Resourcing" }
      ]
    }
  ];

  const _toggleAccordion = (id: string) => {
    _setActiveAccordion(_activeAccordion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/Lindsay.JPG"
            alt="Lindsay landscape for prioritization planning"
            fill
            className="object-cover"
            style={{ filter: "brightness(0.65)" }}
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

      {/* Survey Findings Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            What We Heard: Survey Insights
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl shadow-lg p-8 border-2 border-blue-300 dark:border-blue-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Key Survey Findings</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300 text-center">
                <li>Strong support for comprehensive contaminant coverage</li>
                <li>Need for systematic prioritization approach</li>
                <li>Importance of addressing emerging contaminants</li>
                <li>Recognition that resource allocation requires prioritization</li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl shadow-lg p-8 border-2 border-purple-300 dark:border-purple-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">Stakeholder Concerns</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300 text-center">
                <li><strong>79%</strong> express concerns about complexity of prioritization methodology</li>
                <li><strong>84%</strong> highlight need for clear criteria and decision frameworks</li>
                <li><strong>71%</strong> request guidance on emerging contaminant assessment</li>
                <li><strong>76%</strong> emphasize importance of stakeholder input in prioritization process</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Developing a Prioritization Framework Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Developing a Prioritization Framework for Strategic Planning
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The Challenge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-900 dark:to-blue-800 text-white p-8 rounded-2xl shadow-2xl h-full">
                <h3 className="text-2xl font-bold mb-4">The Challenge</h3>
                <p className="text-white leading-relaxed">
                  There are many opportunities to modernize and improve sediment standards, but we have limited resources. 
                  We need to prioritize by determining what is both feasible and important to make the most effective 
                  use of our capacity and ensure meaningful progress.
                </p>
              </div>
            </div>

            {/* Card 2: The Solution */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-900 dark:to-orange-800 text-white p-8 rounded-2xl shadow-2xl h-full">
                <h3 className="text-2xl font-bold mb-4">Collaborative Framework</h3>
                <p className="text-white leading-relaxed">
                  A collaborative approach that brings together stakeholders to assess feasibility, evaluate importance, 
                  and develop strategic priorities for short-, medium-, and long-term modernization goals that reflect 
                  diverse perspectives and expertise.
                </p>
              </div>
            </div>

            {/* Card 3: The Benefits */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-900 dark:to-green-800 text-white p-8 rounded-2xl shadow-2xl h-full">
                <h3 className="text-2xl font-bold mb-4">Strategic Implementation</h3>
                <p className="text-white leading-relaxed">
                  By prioritizing initiatives based on both feasibility and importance, we can allocate resources 
                  strategically to maximize impact and ensure efficient progress while maintaining scientific rigor 
                  and practical implementation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Areas for Modernizing */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Key Areas for Modernizing the Sediment Standards Framework</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl shadow-lg p-8 border-2 border-blue-300 dark:border-blue-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Matrix Sediment Standards</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">
                  Holistic protection of ecological organisms and people, from direct and food-related toxicity.
                </p>
                <a 
                  href="/survey-results/holistic-protection" 
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold underline"
                >
                  Learn more about the Matrix Standards Framework →
                </a>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl shadow-lg p-8 border-2 border-green-300 dark:border-green-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Tiered, Site-Specific Sediment Standards</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg mb-4">
                  Moving beyond fixed standards to adaptable, risk-based assessments that account for local conditions.
                </p>
                <a 
                  href="/survey-results/tiered-framework" 
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold underline"
                >
                  Learn more about the Tiered Framework →
                </a>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl shadow-lg p-8 border-2 border-purple-300 dark:border-purple-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Emerging Contaminants & Mixtures</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg mb-3">
                  The chemical landscape is constantly changing, requiring proactive approaches to address potential health hazards:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg list-disc list-inside ml-4">
                  <li><strong>Non-scheduled Substances:</strong> Standards for priority contaminants</li>
                  <li><strong>Complex Mixtures:</strong> Combined effects often not predicted by simple tests</li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 dark:from-orange-900/30 dark:to-orange-800/30 rounded-2xl shadow-lg p-8 border-2 border-orange-300 dark:border-orange-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Harnessing Available Knowledge</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg mb-3">
                  Address prioritized data gaps such as:
                </p>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg list-disc list-inside">
                  <li>Determining regional background levels</li>
                  <li>Using results from recent field studies and research</li>
                  <li>Incorporating area-based Indigenous Knowledge & Science</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Gap, Feasibility & Prioritization Framework */}
          <div>
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Data Gap, Feasibility & Prioritization Framework</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Address Information Gaps</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-lg mb-2">
                    Collaborative research to address priorities such as:
                  </p>
                  <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-lg list-disc list-inside ml-4">
                    <li>Missing substance groups</li>
                    <li>Incorporating validated models</li>
                    <li>Addressing all relevant pathways</li>
                    <li>Acknowledging Indigenous Knowledge & Science</li>
                  </ul>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Acknowledge Feasibility</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-lg">
                    Make use of existing resources where appropriate. Recognize limitations to time and expense of creating and approving new procedures.
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Prioritization</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-lg">
                    Develop a systemic approach for introducing the most important changes and easiest improvements first.
                  </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Goal</h4>
                  <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">
                    A framework for identifying and resolving data gaps, with short- and long-term goals for strategic research planning.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
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
                  <div key={pollIndex}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
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
                    
                    {/* Add matrix graph after Q2 (pollIndex 1) - the feasibility question */}
                    {pollIndex === 1 && (
                      <SurveyMatrixGraph
                        questionPair={{
                          importanceQuestion: polls[0].question,
                          feasibilityQuestion: polls[1].question,
                          title: 'Site-Specific Standards (Bioavailability)'
                        }}
                        pagePath="prioritization"
                        importanceIndex={0}
                        feasibilityIndex={1}
                      />
                    )}
                  </div>
                );
              }
            })}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-12 px-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
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
