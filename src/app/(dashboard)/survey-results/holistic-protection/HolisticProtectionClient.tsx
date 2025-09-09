'use client';

import React, { useState } from 'react';
import PollWithResults from '@/components/PollWithResults';
import RankingPoll from '@/components/dashboard/RankingPoll';

interface PollData {
  question: string;
  options: string[];
  questionNumber?: number;
}

export default function HolisticProtectionClient() {
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const [polls, setPolls] = useState<PollData[]>([
    {
      question: "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
      questionNumber: 1,
      options: [
        "Metals known to biomagnify",
        "Polycyclic Aromatic Hydrocarbons",
        "Polychlorinated Biphenyls",
        "Per-and Polyfluoroalkyl Substances",
        "All of the above",
        "Other"
      ]
    },
    {
      question: "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
      questionNumber: 2,
      options: [
        "Technical Hurdles: Limited data availability for many contaminants and species native to BC",
        "Practical Challenges: Discretionary matrix sediment standards may be a barrier for some practitioners",
        "Enhanced Protection: Comprehensive safeguards for BC's diverse aquatic ecosystems and peoples",
        "Scientific Advancement: Opportunity to pioneer innovative approaches to sediment management",
        "Societal Expectations: Given the challenges of modern society, holistic protection may not be feasible"
      ]
    }
  ]);

  const toggleAccordion = (id: string) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero/Header Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1559827260-dc66d52bef19?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')",
            filter: "brightness(0.8)"
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
            Matrix Sediment Standards Framework
          </h1>
          <p className="text-xl md:text-2xl lg:text-3xl mb-8 font-['Lato'] font-light">
            Holistic Protection for Aquatic Ecosystems
          </p>
          
          {/* Framework Description */}
          <div className="bg-black/30 backdrop-blur-sm rounded-2xl p-6 max-w-4xl mx-auto">
            <p className="text-lg md:text-xl italic leading-relaxed">
              "A comprehensive approach to sediment quality protection that considers multiple environmental 
              protection goals simultaneously, recognizing that sediment quality affects not just benthic 
              organisms, but entire food webs and human health."
            </p>
          </div>
        </div>
      </section>

      {/* Framework Overview Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            From Single-Threshold to Matrix Protection
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: The Challenge */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-2xl font-bold mb-4">The Challenge</h3>
                <p className="text-red-100 leading-relaxed">
                  Current single-threshold standards fail to address the different exposure pathways 
                  and risk mechanisms for benthic organisms versus higher trophic levels, creating 
                  protection gaps in our aquatic ecosystems.
                </p>
              </div>
            </div>

            {/* Card 2: The Solution */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🔬</div>
                <h3 className="text-2xl font-bold mb-4">The Matrix Framework</h3>
                <p className="text-blue-100 leading-relaxed">
                  A Matrix Sediment Standards Framework that organizes standards based on two distinct axes: 
                  protection goal (Ecological Health vs. Human Health) and exposure pathway (Direct vs. Food Pathway).
                </p>
              </div>
            </div>

            {/* Card 3: The Benefits */}
            <div className="group cursor-pointer transform transition-all duration-500 hover:-translate-y-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl shadow-2xl h-full">
                <div className="text-4xl mb-4">🛡️</div>
                <h3 className="text-2xl font-bold mb-4">Holistic Protection</h3>
                <p className="text-green-100 leading-relaxed">
                  Comprehensive protection that addresses both ecological and human health through 
                  four distinct sediment standards: SedS-directECO, SedS-directHH, SedS-foodECO, and SedS-foodHH.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Matrix Framework Components Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            The Matrix Sediment Standards Framework
          </h2>
          
          {/* 2x2 Matrix Grid */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-gray-800 mb-4">Matrix Sediment Standards</h3>
              <p className="text-gray-600 text-xl">Organized by Protection Goal and Exposure Pathway</p>
            </div>
            
            {/* Desktop Matrix Grid */}
            <div className="hidden lg:grid grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Header Row */}
              <div className="text-center font-bold text-gray-800 p-6"></div>
              <div className="text-center font-bold text-gray-800 p-6 bg-blue-100 rounded-xl text-xl">Direct Exposure</div>
              <div className="text-center font-bold text-gray-800 p-6 bg-green-100 rounded-xl text-xl">Food Web Exposure</div>
              
              {/* Ecological Row */}
              <div className="text-center font-bold text-gray-800 p-6 bg-purple-100 rounded-xl flex items-center justify-center">
                <span className="transform -rotate-90 text-xl">Ecological Health</span>
              </div>
              <div 
                className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-blue-300"
                onClick={() => toggleAccordion('seds-directeco')}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold">SedS-directECO</h4>
                  <div className="text-blue-200 text-sm bg-blue-700 px-2 py-1 rounded-full">Click for details</div>
                </div>
                <p className="text-blue-100 text-base mb-4">Ecological Direct Exposure</p>
                <div className="space-y-1 text-sm">
                  <div>• SSDs & EqP principles</div>
                  <div>• Benthic organisms</div>
                  <div>• Direct sediment contact</div>
                </div>
              </div>
              <div 
                className="bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-green-300"
                onClick={() => toggleAccordion('seds-foodeco')}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold">SedS-foodECO</h4>
                  <div className="text-green-200 text-sm bg-green-700 px-2 py-1 rounded-full">Click for details</div>
                </div>
                <p className="text-green-100 text-base mb-4">Ecological Food Web</p>
                <div className="space-y-1 text-sm">
                  <div>• BAFs & FWMs</div>
                  <div>• Higher trophic levels</div>
                  <div>• Biomagnification</div>
                </div>
              </div>
              
              {/* Human Health Row */}
              <div className="text-center font-bold text-gray-800 p-6 bg-orange-100 rounded-xl flex items-center justify-center">
                <span className="transform -rotate-90 text-xl">Human Health</span>
              </div>
              <div 
                className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-8 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-purple-300"
                onClick={() => toggleAccordion('seds-directhh')}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold">SedS-directHH</h4>
                  <div className="text-purple-200 text-sm bg-purple-700 px-2 py-1 rounded-full">Click for details</div>
                </div>
                <p className="text-purple-100 text-base mb-4">Human Direct Exposure</p>
                <div className="space-y-1 text-sm">
                  <div>• Risk assessment</div>
                  <div>• Dermal exposure</div>
                  <div>• Intertidal areas</div>
                </div>
              </div>
              <div 
                className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-8 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300 border-2 border-transparent hover:border-orange-300"
                onClick={() => toggleAccordion('seds-foodhh')}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-bold">SedS-foodHH</h4>
                  <div className="text-orange-200 text-sm bg-orange-700 px-2 py-1 rounded-full">Click for details</div>
                </div>
                <p className="text-orange-100 text-base mb-4">Human Food Web</p>
                <div className="space-y-1 text-sm">
                  <div>• BSAFs & BBSGV</div>
                  <div>• Traditional foods</div>
                  <div>• Community-specific consumption rates</div>
                </div>
              </div>
            </div>

            {/* Mobile Matrix Layout */}
            <div className="lg:hidden space-y-6">
              {/* Direct Exposure Column */}
              <div className="space-y-4">
                <div className="text-center font-bold text-gray-800 p-4 bg-blue-100 rounded-xl text-lg">
                  Direct Exposure
                </div>
                
                {/* Ecological Direct */}
                <div 
                  className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300"
                  onClick={() => toggleAccordion('seds-directeco')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold">SedS-directECO</h4>
                    <div className="text-blue-200 text-xs bg-blue-700 px-2 py-1 rounded-full">Tap for details</div>
                  </div>
                  <p className="text-blue-100 text-sm mb-3">Ecological Direct Exposure</p>
                  <div className="space-y-1 text-xs">
                    <div>• SSDs & EqP principles</div>
                    <div>• Benthic organisms</div>
                    <div>• Direct sediment contact</div>
                  </div>
                </div>

                {/* Human Direct */}
                <div 
                  className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300"
                  onClick={() => toggleAccordion('seds-directhh')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold">SedS-directHH</h4>
                    <div className="text-purple-200 text-xs bg-purple-700 px-2 py-1 rounded-full">Tap for details</div>
                  </div>
                  <p className="text-purple-100 text-sm mb-3">Human Direct Exposure</p>
                  <div className="space-y-1 text-xs">
                    <div>• Risk assessment</div>
                    <div>• Dermal exposure</div>
                    <div>• Intertidal areas</div>
                  </div>
                </div>
              </div>

              {/* Food Web Exposure Column */}
              <div className="space-y-4">
                <div className="text-center font-bold text-gray-800 p-4 bg-green-100 rounded-xl text-lg">
                  Food Web Exposure
                </div>
                
                {/* Ecological Food Web */}
                <div 
                  className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300"
                  onClick={() => toggleAccordion('seds-foodeco')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold">SedS-foodECO</h4>
                    <div className="text-green-200 text-xs bg-green-700 px-2 py-1 rounded-full">Tap for details</div>
                  </div>
                  <p className="text-green-100 text-sm mb-3">Ecological Food Web</p>
                  <div className="space-y-1 text-xs">
                    <div>• BAFs & FWMs</div>
                    <div>• Higher trophic levels</div>
                    <div>• Biomagnification</div>
                  </div>
                </div>

                {/* Human Food Web */}
                <div 
                  className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg cursor-pointer transform hover:scale-105 hover:shadow-2xl transition-all duration-300"
                  onClick={() => toggleAccordion('seds-foodhh')}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold">SedS-foodHH</h4>
                    <div className="text-orange-200 text-xs bg-orange-700 px-2 py-1 rounded-full">Tap for details</div>
                  </div>
                  <p className="text-orange-100 text-sm mb-3">Human Food Web</p>
                  <div className="space-y-1 text-xs">
                    <div>• BSAFs & BBSGV</div>
                    <div>• Traditional foods</div>
                    <div>• Community-specific consumption rates</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Information Panels */}
          {activeAccordion && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {activeAccordion === 'seds-directeco' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">SedS-directECO: Ecological Direct Exposure</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h4>
                      <p className="text-gray-600">
                        Protects ecological organisms from adverse effects associated with direct exposure to contaminated sediment.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Derivation Method</h4>
                      <p className="text-gray-600">
                        Uses Species Sensitivity Distributions (SSDs) based on chronic aquatic ecological toxicity data, 
                        supplemented by Equilibrium Partitioning (EqP) principles and bioavailability adjustments.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Protection Focus</h4>
                      <p className="text-gray-600">
                        Direct sediment contact toxicity for benthic organisms and other ecological receptors 
                        that come into direct contact with contaminated sediments.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeAccordion === 'seds-directhh' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">SedS-directHH: Human Health Direct Exposure</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h4>
                      <p className="text-gray-600">
                        Protects human health from adverse effects associated with direct exposure to contaminated sediment.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Derivation Method</h4>
                      <p className="text-gray-600">
                        Uses direct contact risk assessment for human health, considering dermal exposure 
                        and incidental ingestion pathways.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Protection Focus</h4>
                      <p className="text-gray-600">
                        Direct human contact with contaminated sediments, particularly in intertidal areas 
                        and recreational settings.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeAccordion === 'seds-foodeco' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">SedS-foodECO: Ecological Food Web Exposure</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h4>
                      <p className="text-gray-600">
                        Protects higher-trophic-level organisms, including piscivorous wildlife, from adverse effects 
                        of contaminants through food transfer and bioaccumulation.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Derivation Method</h4>
                      <p className="text-gray-600">
                        Links protective tissue residue levels in relevant wildlife back to corresponding sediment 
                        concentrations using validated Bioaccumulation Factors (BAFs) or Food Web Multipliers (FWMs).
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Protection Focus</h4>
                      <p className="text-gray-600">
                        Food web transfer pathways, biomagnification, and protection of apex predators and 
                        other higher-trophic-level wildlife.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {activeAccordion === 'seds-foodhh' && (
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">SedS-foodHH: Human Health Food Web Exposure</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Purpose</h4>
                      <p className="text-gray-600">
                        Protects human consumers of aquatic foods from adverse effects of contaminants 
                        through food web transfer and bioaccumulation.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Derivation Method</h4>
                      <p className="text-gray-600">
                        Links human health risk-based tissue concentrations back to sediment concentrations using 
                        validated BSAFs, FWMs, or Bioaccumulation Based Sediment Guideline Values (BBSGV) approach.
                      </p>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-800 mb-3">Protection Focus</h4>
                      <p className="text-gray-600">
                        Human consumption of contaminated aquatic foods, prioritizing community-specific ingestion 
                        rates determined through area-based research and engagement.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Survey Findings Section */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-800 font-['Merriweather']">
            What We Heard: Stakeholder Perspectives
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Key Survey Findings</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">✓</span>
                  <span><strong>87%</strong> of respondents support comprehensive ecosystem protection approaches that consider multiple exposure pathways</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">✓</span>
                  <span><strong>92%</strong> recognize that current single-threshold standards have significant protection gaps</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">✓</span>
                  <span><strong>78%</strong> emphasize the need for site-specific flexibility within a consistent framework</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 dark:text-blue-400 mr-3 mt-1">✓</span>
                  <span><strong>85%</strong> identify food web exposure pathways as inadequately addressed by current standards</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Stakeholder Concerns</h3>
              <ul className="space-y-4 text-gray-700 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">⚠️</span>
                  <span><strong>65%</strong> express concerns about implementation complexity of matrix approach</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">⚠️</span>
                  <span><strong>71%</strong> highlight need for clear decision trees and guidance documents</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">⚠️</span>
                  <span><strong>58%</strong> request training programs for practitioners</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 dark:text-green-400 mr-3 mt-1">⚠️</span>
                  <span><strong>82%</strong> emphasize importance of case studies and worked examples</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Polls Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-50 to-blue-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-8 text-gray-800 font-['Merriweather']">
            Your Input on Matrix Standards
          </h2>
          <p className="text-xl text-center text-gray-600 mb-16 max-w-4xl mx-auto">
            Help inform the development of the matrix sediment standards framework by sharing your perspectives on these key questions.
          </p>
          
          <div className="space-y-16">
            {polls.map((poll, pollIndex) => {
              // Use RankingPoll if question contains "rank"
              if (poll.question.toLowerCase().includes('rank')) {
                return (
                  <RankingPoll
                    key={pollIndex}
                    pollIndex={pollIndex}
                    question={poll.question}
                    options={poll.options}
                    pagePath="/survey-results/holistic-protection"
                    onVote={(pollIndex, rankings) => {
                      console.log(`Ranking submitted for poll ${pollIndex}:`, rankings);
                    }}
                  />
                );
              }
              
              // Use regular PollWithResults for single-choice questions
              return (
                <PollWithResults
                  key={pollIndex}
                  pollIndex={pollIndex}
                  question={poll.question}
                  options={poll.options}
                  pagePath="/survey-results/holistic-protection"
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
      <section className="py-20 px-6 bg-gradient-to-br from-gray-800 to-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 font-['Merriweather']">
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
