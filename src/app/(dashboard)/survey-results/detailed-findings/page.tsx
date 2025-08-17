// src/app/(dashboard)/survey-results/detailed-findings/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import InteractivePieChart from '@/components/dashboard/InteractivePieChart';
import InteractiveBarChart from '@/components/dashboard/InteractiveBarChart';
import VoicesCarousel from '@/components/dashboard/VoicesCarousel';

export default function DetailedFindingsPage() {
  const [activeTab, setActiveTab] = useState('demographics');

  const tabs = [
    { id: 'demographics', label: 'Who We Heard', icon: '👥' },
    { id: 'effectiveness', label: 'Effectiveness of Current Standards', icon: '⚠️' },
    { id: 'solutions', label: 'Recommended Solutions & Modernization', icon: '🆕' },
  ];

  // Data for interactive charts
  const professionalInvolvementData = [
    { label: 'Yes, regularly', value: 39, color: '#3B82F6', description: 'Direct involvement in sediment quality assessment' },
    { label: 'Sometimes', value: 13, color: '#6366F1', description: 'Occasional involvement in sediment projects' },
    { label: 'No', value: 9, color: '#6B7280', description: 'No direct involvement in sediment quality' },
  ];

  const familiarityData = [
    { label: 'Very Familiar', value: 20, color: '#10B981', description: 'Extensive experience with BC CSR standards' },
    { label: 'Familiar', value: 19, color: '#059669', description: 'Good working knowledge of standards' },
    { label: 'Somewhat Familiar', value: 15, color: '#6B7280', description: 'Basic understanding of standards' },
  ];

  const benthicEffectivenessData = [
    { label: 'Very Effective', value: 9, color: '#10B981', description: 'Excellent protection for benthic organisms' },
    { label: 'Moderately Effective', value: 28, color: '#059669', description: 'Good protection for benthic organisms' },
    { label: 'Slightly Effective', value: 15, color: '#F59E0B', description: 'Limited protection for benthic organisms' },
    { label: 'Not Effective', value: 7, color: '#EF4444', description: 'Poor protection for benthic organisms' },
  ];

  const bioaccumulationEffectivenessData = [
    { label: 'Very Effective', value: 3, color: '#10B981', description: 'Excellent bioaccumulation protection' },
    { label: 'Moderately Effective', value: 13, color: '#059669', description: 'Good bioaccumulation protection' },
    { label: 'Slightly Effective', value: 19, color: '#F59E0B', description: 'Limited bioaccumulation protection' },
    { label: 'Not Effective', value: 24, color: '#EF4444', description: 'Poor bioaccumulation protection' },
  ];

  const recommendedApproachesData = [
    { label: 'Expand Contaminant List', value: 54, color: '#3B82F6', description: 'Include emerging contaminants and PFAS' },
    { label: 'Incorporate Bioavailability', value: 52, color: '#10B981', description: 'Site-specific bioavailability adjustments' },
    { label: 'Formal Tiered Framework', value: 49, color: '#8B5CF6', description: 'Structured assessment approach' },
    { label: 'Dual Standard Approach', value: 47, color: '#6366F1', description: 'Separate benthic and bioaccumulation standards' },
  ];

  const dualStandardData = [
    { label: 'Essential', value: 26, color: '#10B981', description: 'Critical for comprehensive protection' },
    { label: 'Very Necessary', value: 22, color: '#059669', description: 'Highly important for modernization' },
    { label: 'Moderately Necessary', value: 10, color: '#F59E0B', description: 'Important but not critical' },
  ];

  const tieredFrameworkData = [
    { label: 'Very Beneficial', value: 30, color: '#8B5CF6', description: 'Significant improvement to current system' },
    { label: 'Beneficial', value: 20, color: '#EC4899', description: 'Good improvement to current system' },
    { label: 'Somewhat Beneficial', value: 8, color: '#6B7280', description: 'Minor improvement to current system' },
  ];

  // Quotes for the carousel
  const stakeholderQuotes = [
    {
      id: 1,
      text: "The BC CSR sediment standards are not appropriate or adequate to protect upper trophic level organisms, apex predators and humans at the top of foodwebs, as these sediment standards were or are designed for the protection of low tropic level species and benthic organisms.",
      context: "Environmental Consultant",
      category: 'effectiveness' as const,
    },
    {
      id: 2,
      text: "No bioaccumulation protection is also a scary consideration, resulting in the need to clean up to levels below standards but having a challenging time making a convincing argument.",
      context: "Industry Representative",
      category: 'challenges' as const,
    },
    {
      id: 3,
      text: "We need a tiered approach that allows for site-specific considerations while maintaining protective standards. The current one-size-fits-all approach is too rigid.",
      context: "Government Regulator",
      category: 'solutions' as const,
    },
    {
      id: 4,
      text: "Expanding the contaminant list is essential. We're missing emerging substances like PFAS that pose real risks to aquatic ecosystems and human health.",
      context: "Academic Researcher",
      category: 'recommendations' as const,
    },
    {
      id: 5,
      text: "The standards need to incorporate bioavailability adjustments. Natural background levels in some regions exceed current standards, leading to unnecessary investigations.",
      context: "Environmental Consultant",
      category: 'solutions' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-6">
            <Link href="/survey-results" className="inline-flex items-center text-indigo-100 hover:text-white transition-colors">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Survey Results Overview
            </Link>
          </div>
          <h1 className="text-4xl font-bold mb-4">Detailed Findings</h1>
          <p className="text-xl text-indigo-100 max-w-3xl">
            Explore the comprehensive expert feedback through interactive visualizations and detailed analysis
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-102'
                }`}
              >
                <span className="mr-2 text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Tab 1: Who We Heard (Respondent Demographics) */}
          {activeTab === 'demographics' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Who We Heard</h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Establish the credibility and deep expertise of the survey respondents
                </p>
              </div>

              {/* Interactive Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                  <InteractivePieChart
                    data={professionalInvolvementData}
                    title="Professional Involvement in Sediment Quality"
                    size="md"
                    interactive={true}
                  />
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
                  <InteractivePieChart
                    data={familiarityData}
                    title="Familiarity with Current Standards"
                    size="md"
                    interactive={true}
                  />
                </div>
              </div>

              {/* Supporting Text */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Diverse Professional Backgrounds</h3>
                <p className="text-gray-700 leading-relaxed">
                  The survey successfully reached a targeted audience of highly experienced professionals who work directly 
                  with the BC CSR sediment standards. Respondents included environmental consultants, industry representatives, 
                  academics, non-government organizations, and government regulators from various levels. This mix of perspectives 
                  provides a balanced and comprehensive overview of how the standards are used and perceived across different sectors.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  The strong consensus on key issues that emerges from this diverse group underscores the validity of their 
                  shared concerns and recommendations. Over 70% of respondents described themselves as "Very Familiar" or 
                  "Familiar" with the current BC CSR Schedule 3.4 numerical sediment standards, ensuring that the critiques 
                  and suggestions provided are based on years of practical application rather than speculation.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Effectiveness of Current Standards */}
          {activeTab === 'effectiveness' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Effectiveness of Current Standards</h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Visually illustrate the perceived gap between protecting benthic organisms and preventing food web bioaccumulation
                </p>
              </div>

              {/* Interactive Side-by-Side Comparison Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
                  <InteractiveBarChart
                    data={benthicEffectivenessData}
                    title="Protecting Benthic Organisms"
                    orientation="horizontal"
                    showValues={true}
                    showPercentages={true}
                    interactive={true}
                  />
                </div>

                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6">
                  <InteractiveBarChart
                    data={bioaccumulationEffectivenessData}
                    title="Preventing Harmful Bioaccumulation"
                    orientation="horizontal"
                    showValues={true}
                    showPercentages={true}
                    interactive={true}
                  />
                </div>
              </div>

              {/* Key Takeaway Box */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-6 border-l-4 border-red-500">
                <h3 className="text-xl font-semibold text-red-800 mb-3">Key Takeaway</h3>
                <p className="text-red-700 text-lg leading-relaxed">
                  While over 60% of experts believe the standards are at least 'moderately effective' for benthic organisms, 
                  a striking 73% find them 'Not Effective' or 'Slightly Effective' for preventing harmful bioaccumulation. 
                  This direct comparison powerfully highlights the stark contrast in expert confidence between the two protective goals.
                </p>
              </div>

              {/* Voices from the Field Section */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <VoicesCarousel
                  quotes={stakeholderQuotes.filter(q => q.category === 'effectiveness' || q.category === 'challenges')}
                  autoRotate={true}
                  rotationInterval={6000}
                  showNavigation={true}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Recommended Solutions & Modernization */}
          {activeTab === 'solutions' && (
            <div className="space-y-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Recommended Solutions & Modernization</h2>
                <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                  Clearly present the strong expert consensus on the preferred path forward
                </p>
              </div>

              {/* Central Interactive Visualization */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">Respondents' Most Recommended Approaches</h3>
                <InteractiveBarChart
                  data={recommendedApproachesData}
                  title=""
                  orientation="horizontal"
                  showValues={true}
                  showPercentages={true}
                  interactive={true}
                />
                <p className="text-sm text-gray-600 mt-4 italic text-center">
                  Based on Figure 8 and supporting text from the survey data
                </p>
              </div>

              {/* Supporting Interactive Visualizations */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
                  <InteractivePieChart
                    data={dualStandardData}
                    title="Necessity of 'Dual Standard' Approach"
                    size="md"
                    interactive={true}
                  />
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
                  <InteractivePieChart
                    data={tieredFrameworkData}
                    title="Benefit of Formal, Tiered Framework"
                    size="md"
                    interactive={true}
                  />
                </div>
              </div>

              {/* Additional Voices from the Field */}
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <VoicesCarousel
                  quotes={stakeholderQuotes.filter(q => q.category === 'solutions' || q.category === 'recommendations')}
                  autoRotate={true}
                  rotationInterval={7000}
                  showNavigation={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Report Link */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-6 inline-block">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Access the Full Report</h3>
            <p className="text-gray-600 mb-4">
              Download the complete "Draft Sediment Standards Review: What We Heard" report for detailed analysis
            </p>
            <a
              href="https://docs.google.com/document/d/1ZVgujJykXr0rflcd5yck5OYmpEzpLIX7UYDz9SUfibc/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View Full Report
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
