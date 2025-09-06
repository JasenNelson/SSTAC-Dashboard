'use client';

import React, { useState } from 'react';

interface PollData {
  question: string;
  options: string[];
  votes: number[];
  totalVotes: number;
}

export default function TieredFrameworkClient() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [polls, setPolls] = useState<PollData[]>([
    {
      question: "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
      options: [
        "Yes",
        "No",
        "It depends",
        "Unsure",
        "Other"
      ],
      votes: [0, 0, 0, 0, 0],
      totalVotes: 0
    },
    {
      question: "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
      options: [
        "Environmental Conditions: Physical and chemical data",
        "Bioaccumulation Data in Tissues of Local Species",
        "Benthic Community Structure Analysis",
        "Other"
      ],
      votes: [0, 0, 0, 0],
      totalVotes: 0
    }
  ]);

  const [votedPolls, setVotedPolls] = useState<Set<number>>(new Set());

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  const handleVote = (pollIndex: number, optionIndex: number) => {
    if (votedPolls.has(pollIndex)) return; // Prevent multiple votes

    const newPolls = [...polls];
    newPolls[pollIndex].votes[optionIndex]++;
    newPolls[pollIndex].totalVotes++;
    setPolls(newPolls);
    
    const newVotedPolls = new Set(votedPolls);
    newVotedPolls.add(pollIndex);
    setVotedPolls(newVotedPolls);
  };

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-emerald-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1439066615861-d1af74d74000?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')",
            filter: "brightness(0.9)"
          }}
        />
        
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
            Tiered Assessment Framework
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            Site-Specific Modification Protocols for Sediment Quality Assessment
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
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            From Single-Threshold to Tiered Assessment
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The Challenge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold mb-4">The Challenge</h3>
                <p className="text-red-100 leading-relaxed">
                  Current "bright-line" standards are often overly conservative, leading to unnecessary 
                  investigations and remediation costs, while the "sensitive sediment" designation 
                  is applied too broadly, negating the purpose of a two-tiered system.
                </p>
              </div>
            </div>

            {/* Card 2: The Solution */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-2xl font-bold mb-4">Tiered Framework</h3>
                <p className="text-orange-100 leading-relaxed">
                  A formal, tiered assessment framework incorporating multiple lines of evidence 
                  for complex sediment site assessments, supported by 86% of survey respondents.
                </p>
              </div>
            </div>

            {/* Card 3: The Benefits */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🎯</div>
                <h3 className="text-2xl font-bold mb-4">Weight-of-Evidence</h3>
                <p className="text-yellow-100 leading-relaxed">
                  Simple screening at Tier 1 with clear pathways for detailed, multi-faceted 
                  investigations combining chemistry, toxicity testing, and biological surveys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tiered Framework Components Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            The Three-Tier Assessment Framework
          </h2>
          
          <div className="space-y-6">
            {/* Accordion 1: Tier 1 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-1')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Tier 1: Screening Level Numerical Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-1' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-1' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose:</h4>
                      <p className="text-gray-600 text-lg">
                        Uses conservative, generic standards for initial site screening to quickly identify sites 
                        needing more assessment.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Approach:</h4>
                      <p className="text-gray-600 text-lg">
                        Matrix sediment standards with generic (non-site-specific) assumptions, 
                        applicable at any sites in BC.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">When to Use:</h4>
                      <p className="text-gray-600 text-lg">
                        First step in sediment quality assessment for all sites, providing a conservative 
                        screening approach to identify potential concerns.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 2: Tier 2a */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-2a')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Tier 2a: Refined Numerical Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-2a' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-2a' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose:</h4>
                      <p className="text-gray-600 text-lg">
                        Uses models and procedures (e.g., Cause-Effect) to derive site-specific standards, 
                        primarily for bioavailability adjustments.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Approach:</h4>
                      <p className="text-gray-600 text-lg">
                        Systematically incorporates bioavailability adjustments using standard OC normalization 
                        and AVS/SEM assessments, with provisions for advanced tools like passive sampling devices.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">When to Use:</h4>
                      <p className="text-gray-600 text-lg">
                        When Tier 1 screening identifies exceedances and site-specific conditions differ 
                        from generic assumptions, particularly for bioavailability considerations.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 3: Tier 2b */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-2b')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Tier 2b: Screening-Level Risk-Based Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-2b' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-2b' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose:</h4>
                      <p className="text-gray-600 text-lg">
                        Similar to Tier 2a but adds prescribed lines of evidence, such as community analysis, 
                        within an enhanced screening-level risk assessment process.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Approach:</h4>
                      <p className="text-gray-600 text-lg">
                        Prescribed process with precluding conditions to determine if receptor-pathway-contaminant 
                        is complete and fails screening-level, or incomplete and may pass screening-level.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">When to Use:</h4>
                      <p className="text-gray-600 text-lg">
                        When additional lines of evidence are needed beyond numerical standards, including 
                        benthic community analysis and habitat assessment requirements.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion 4: Tier 3 */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <button
                onClick={() => toggleAccordion('tier-3')}
                className="w-full text-left p-8 hover:bg-gray-50 transition-colors duration-300"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-800">Tier 3: Detailed Risk-Based Assessment</h3>
                  <span className={`text-3xl transition-transform duration-300 ${
                    activeAccordion === 'tier-3' ? 'rotate-180' : ''
                  }`}>
                    ▼
                  </span>
                </div>
              </button>
              
              {activeAccordion === 'tier-3' && (
                <div className="px-8 pb-8 border-t border-gray-200">
                  <div className="pt-6 space-y-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose:</h4>
                      <p className="text-gray-600 text-lg">
                        A full risk assessment using multiple lines of evidence and site-specific factors 
                        for complex scenarios.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Approach:</h4>
                      <p className="text-gray-600 text-lg">
                        Detailed risk assessment in accordance with Protocol 1, integrating chemistry, 
                        toxicity testing, biological community analysis, and bioaccumulation information 
                        using cause-effect models like Bayesian Network - Relative Risk Model framework.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">When to Use:</h4>
                      <p className="text-gray-600 text-lg">
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
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            What We Heard: Stakeholder Perspectives
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Key Survey Findings</h3>
              <ul className="space-y-4 text-gray-700">
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
            
            <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Implementation Priorities</h3>
              <ul className="space-y-4 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📋</span>
                  <span>Develop clear tier escalation criteria and decision trees</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📋</span>
                  <span>Establish standardized bioavailability adjustment protocols</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📋</span>
                  <span>Create guidance for site-specific modification applications</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 mt-1">📋</span>
                  <span>Provide training and support for practitioners</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-green-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 font-['Merriweather']">
            Your Input on Tiered Assessment
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-4xl mx-auto">
            Help inform the tiered framework development by sharing your perspectives on these key questions.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => (
              <div key={pollIndex} className="bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl p-8 shadow-lg">
                <h3 className="text-2xl font-bold text-gray-800 mb-8 text-center">
                  {poll.question}
                </h3>
                
                <div className="space-y-4">
                  {poll.options.map((option, optionIndex) => {
                    const percentage = getPercentage(poll.votes[optionIndex], poll.totalVotes);
                    const hasVoted = votedPolls.has(pollIndex);
                    
                    return (
                      <div key={optionIndex} className="relative">
                        <button
                          onClick={() => handleVote(pollIndex, optionIndex)}
                          disabled={hasVoted}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                            hasVoted 
                              ? 'bg-gray-100 border-gray-300 cursor-not-allowed' 
                              : 'bg-white border-green-300 hover:border-green-500 hover:shadow-md cursor-pointer'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`font-medium ${
                              hasVoted ? 'text-gray-600' : 'text-gray-800'
                            }`}>
                              {option}
                            </span>
                            {hasVoted && (
                              <span className="text-green-600 font-semibold">
                                {percentage}%
                              </span>
                            )}
                          </div>
                          
                          {/* Progress bar for voted polls */}
                          {hasVoted && (
                            <div className="mt-3 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                {votedPolls.has(pollIndex) && (
                  <div className="mt-6 text-center">
                    <p className="text-gray-600">
                      Total votes: <span className="font-semibold text-green-600">{poll.totalVotes}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Next Steps Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather']">
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