'use client';

import React, { useState } from 'react';
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

      {/* Survey Findings Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            What We Heard: Survey Insights
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

      {/* Modernizing BC's Sediment Standards Framework Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 dark:text-white font-['Merriweather']">
            Modernizing BC&apos;s Sediment Standards Framework
          </h2>

          {/* Why Modernize Section */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Why Modernize BC&apos;s Sediment Standards?</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-900 dark:to-blue-800 rounded-xl p-6 shadow-lg">
                <div className="text-3xl mb-4">🔬</div>
                <h4 className="text-xl font-semibold text-white mb-3">Evolving Scientific Understanding</h4>
                <p className="text-white">
                  Scientific knowledge of sediment contamination and its ecological impacts continues to advance rapidly, creating opportunities for improvement.
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-900 dark:to-purple-800 rounded-xl p-6 shadow-lg">
                <div className="text-3xl mb-4">⚗️</div>
                <h4 className="text-xl font-semibold text-white mb-3">Non-scheduled & Emerging Contaminants</h4>
                <p className="text-white">
                  New chemicals and complex mixtures pose challenges not addressed by current standards.
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-900 dark:to-green-800 rounded-xl p-6 shadow-lg">
                <div className="text-3xl mb-4">🎯</div>
                <h4 className="text-xl font-semibold text-white mb-3">Site-Specific & Risk-Based Approaches</h4>
                <p className="text-white">
                  Modern frameworks offer more flexible, site-specific assessment methods that can be integrated into our standards.
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-900 dark:to-orange-800 rounded-xl p-6 shadow-lg">
                <div className="text-3xl mb-4">🛡️</div>
                <h4 className="text-xl font-semibold text-white mb-3">Ecosystem Protection</h4>
                <p className="text-white">
                  We must ensure our standards remain protective, practical, and aligned with the best available science.
                </p>
              </div>
            </div>
          </div>

          {/* Key Areas for Modernizing */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Key Areas for Modernizing the Sediment Standards Framework</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 dark:from-blue-900/30 dark:to-blue-800/30 rounded-2xl shadow-lg p-8 border-2 border-blue-300 dark:border-blue-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Matrix Sediment Standards</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Holistic protection of ecological organisms and people, from direct and food-related toxicity.
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 dark:from-green-900/30 dark:to-green-800/30 rounded-2xl shadow-lg p-8 border-2 border-green-300 dark:border-green-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Tiered, Site-Specific Sediment Standards</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Moving beyond fixed standards to adaptable, risk-based assessments that account for local conditions.
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 dark:from-purple-900/30 dark:to-purple-800/30 rounded-2xl shadow-lg p-8 border-2 border-purple-300 dark:border-purple-700">
                <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Emerging Contaminants / Mixtures</h4>
                <p className="text-gray-700 dark:text-gray-300 text-lg">
                  Addressing non-scheduled substances of concern and their combined effects on ecosystems.
                </p>
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

          {/* Matrix Sediment Standards Framework */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Matrix Sediment Standards (SedS) Framework</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8">
              <div className="flex justify-center mb-8">
                <img 
                  src="/matrix-graph.jpg" 
                  alt="Matrix Sediment Standards Framework showing Direct Toxicity and Food Pathway Toxicity for Ecological and Human Health"
                  className="max-w-full h-auto rounded-lg shadow-lg"
                  onError={(e) => {
                    // Fallback if image doesn't load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Direct Toxicity (SedS-direct)</h4>
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                      <h5 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-directECO</h5>
                      <p className="text-gray-700 dark:text-gray-300">
                        Protect aquatic organisms from direct exposure from contaminants in sediment.
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                      <h5 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-directHH</h5>
                      <p className="text-gray-700 dark:text-gray-300">
                        Protects people from direct contact risks (e.g., incidental ingestion, dermal contact) during recreational or cultural activities.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Food Pathway Toxicity (SedS-food)</h4>
                  <div className="space-y-4">
                    <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                      <h5 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-foodECO</h5>
                      <p className="text-gray-700 dark:text-gray-300">
                        Protects piscivorous wildlife (e.g., otters, eagles, orcas) from the bioaccumulation and biomagnification of contaminants through the food chain.
                      </p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                      <h5 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">SedS-foodHH</h5>
                      <p className="text-gray-700 dark:text-gray-300">
                        Protects human consumers of fish, shellfish, and other aquatic foods.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center">
                <a 
                  href="/survey-results/holistic-protection" 
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold underline"
                >
                  Learn more about the Matrix Standards Framework →
                </a>
              </div>
            </div>
          </div>

          {/* Expanding the Tiered Framework */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Expanding the Tiered Framework</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">Tier 1: Matrix Sediment Standards</h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    &apos;Safe&apos; for any location due to conservative assumptions
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6">
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">Tier 2: Site-Specific Sediment Standards</h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    Bioavailability-adjusted and protective for site conditions
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-6">
                  <h4 className="text-2xl font-semibold text-gray-800 dark:text-white mb-3">Tier 3: Risk-Based Standards</h4>
                  <p className="text-gray-700 dark:text-gray-300">
                    Protective for site conditions in accordance with Protocol 1
                  </p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <a 
                  href="/survey-results/tiered-framework" 
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 font-semibold underline"
                >
                  Learn more about the Tiered Framework →
                </a>
              </div>
            </div>
          </div>

          {/* Emerging Contaminants & Mixtures */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Emerging Contaminants & Mixtures</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <p className="text-xl text-gray-700 dark:text-gray-300 mb-6 text-center">
                The chemical landscape is constantly changing, requiring proactive approaches to address potential health hazards.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Non-scheduled Substances</h4>
                  <p className="text-gray-700 dark:text-gray-300">Standards for priority contaminants</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Complex Mixtures</h4>
                  <p className="text-gray-700 dark:text-gray-300">Combined effects often not predicted by simple tests</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Adaptive Frameworks</h4>
                  <p className="text-gray-700 dark:text-gray-300">Flexible tools & incorporate new science in standards framework</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                  <h4 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">Proactive Hazard Identification</h4>
                  <p className="text-gray-700 dark:text-gray-300">Develop the scientific and regulatory tools to proactively address new hazards as they are identified.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Gap, Feasibility & Prioritization Framework */}
          <div>
            <h3 className="text-3xl font-bold text-center mb-12 text-gray-800 dark:text-white">Data Gap, Feasibility & Prioritization Framework</h3>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
              <div className="space-y-6">
                <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
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
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
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
                <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-6">
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

      {/* Framework Overview Section */}
      <section className="py-12 px-6 bg-white/80 dark:bg-gray-800 backdrop-blur-sm">
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
