// src/app/(dashboard)/survey-results/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import SurveyResultsChart from '@/components/dashboard/SurveyResultsChart';
import ShareButton from '@/components/dashboard/ShareButton';
import VoicesCarousel from '@/components/dashboard/VoicesCarousel';

export default async function SurveyResultsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              Modernizing BC's Sediment Standards
            </h1>
            <p className="text-xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
              A Summary of Expert Feedback from the "What We Heard" Report
            </p>
            <p className="text-lg text-blue-200 mt-4">
              Interactive dashboard showcasing the strong mandate for modernizing British Columbia's sediment standards
            </p>
            
            {/* Share Button */}
            <div className="mt-8">
              <ShareButton 
                title="BC Sediment Standards Review Dashboard"
                description="Interactive dashboard showcasing expert feedback on modernizing BC's sediment standards"
                className="inline-block"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Purpose Statement */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-8 border border-blue-200">
            <h2 className="text-2xl font-bold text-blue-900 mb-6 flex items-center">
              <span className="text-3xl mr-3">🎯</span>
              Project Purpose & Background
            </h2>
            <div className="space-y-6 text-blue-800">
              <p className="text-lg leading-relaxed">
                A partnership undertaken between the British Columbia (BC) Ministry of Environment and Parks (the Ministry) and the Science Advisory Board for Contaminated Sites (SABCS) has launched the first phase of a multi‑year effort to modernize Contaminated Sites Regulation (CSR) sediment standards. The initiative will develop a transparent, risk‑based scientific framework that incorporates bioavailability, contaminant mixtures, and cumulative‑effects endpoints to ensure holistic protection of aquatic ecosystems, including the wildlife and people who depend on them.
              </p>
              <p className="text-lg leading-relaxed">
                In April 2025, the SABCS initiated the Sediment Standards Project to develop a scoping plan for reviewing and updating the CSR sediment standards. The SABCS established the Science and Standards Technical Advisory Committee (SSTAC) to oversee and directly support the Sediment Standards Project, including a multi-faceted public engagement process. On May 30, 2025, the public survey was started to gather feedback on the effectiveness and practicality of the current CSR Schedule 3.4 sediment standards from those who work with them most closely. The feedback from the public survey will be used to inform the next phase of public engagement, which is a half-day session at the Canadian Ecotoxicity Workshop (CEW) 2025 in Victoria, BC.
              </p>
            </div>
            <div className="mt-6 pt-6 border-t border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">BC Ministry</div>
                  <div className="text-blue-600 text-sm">Environment and Parks</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">SABCS</div>
                  <div className="text-blue-600 text-sm">Science Advisory Board for Contaminated Sites</div>
                </div>
                <div className="bg-white/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-700">SSTAC</div>
                  <div className="text-blue-600 text-sm">Science and Standards Technical Advisory Committee</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Metrics (KPIs) - Interactive Cards */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Key Findings at a Glance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI Card 1 */}
            <div className="group relative bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-red-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  73%
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2">
                  Rate Standards as Ineffective
                </div>
                <div className="text-gray-600 text-sm">
                  For bioaccumulation protection
                </div>
              </div>
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
                A striking 73% stated the standards are 'Not Effective' or 'Slightly Effective' at preventing harmful bioaccumulation, pointing to a critical gap in the current framework.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>

            {/* KPI Card 2 */}
            <div className="group relative bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-green-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  95%
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2">
                  Support Expanding Contaminant List
                </div>
                <div className="text-gray-600 text-sm">
                  As Essential or Very Important
                </div>
              </div>
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
                95% of respondents rate expanding the list of regulated contaminants as 'Essential' or 'Very Important' for comprehensive protection.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>

            {/* KPI Card 3 */}
            <div className="group relative bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-blue-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  91%
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2">
                  See Bioavailability as Essential
                </div>
                <div className="text-gray-600 text-sm">
                  For modernized standards
                </div>
              </div>
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
                91% see incorporating bioavailability adjustments as 'Essential' or 'Very Important' for scientifically robust standards.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>

            {/* KPI Card 4 */}
            <div className="group relative bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-purple-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  84%
                </div>
                <div className="text-gray-800 font-semibold text-lg mb-2">
                  Believe New Standards Essential
                </div>
                <div className="text-gray-600 text-sm">
                  For modernized framework
                </div>
              </div>
              {/* Hover Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
                84% believe developing new numerical standards is 'Very Important' or 'Essential' for environmental protection.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
        </section>

        {/* TRANSFORMED: Stakeholder Feedback Overview - Now Highly Engaging */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">Stakeholder Feedback Overview</h2>
              <p className="text-gray-600 text-lg">
                Interactive visualization of feedback across major assessment categories and stakeholder groups.
              </p>
            </div>
            
            {/* Enhanced Interactive Content - Reconfigured Layout */}
            <div className="space-y-6">
              {/* Top Row: Compact Statistics Above Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Professional Background Distribution */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <h3 className="text-lg font-semibold text-green-800 mb-3 flex items-center">
                    <span className="text-xl mr-2">👥</span>
                    Who We Heard From
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-green-700 text-sm font-medium">Environmental Consultants</span>
                        <span className="font-bold text-green-800">45%</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: '45%' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-green-700 text-sm font-medium">Industry Representatives</span>
                        <span className="font-bold text-green-800">28%</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: '28%' }}></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-green-700 text-sm font-medium">Government & Academia</span>
                        <span className="font-bold text-green-800">27%</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: '27%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engagement Statistics */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                  <h3 className="text-lg font-semibold text-purple-800 mb-3 flex items-center">
                    <span className="text-xl mr-2">📊</span>
                    Survey Engagement
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">43</div>
                      <div className="text-purple-700 text-xs font-medium">Complete Responses</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">18</div>
                      <div className="text-purple-700 text-xs font-medium">Partial Responses</div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-purple-600 text-xs font-medium">Survey Period</div>
                    <div className="text-purple-700 text-sm font-semibold">May 30 - July 31, 2025</div>
                  </div>
                </div>
              </div>

                      {/* Middle: Full-Width Chart */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                        <div className="h-96">
                          <SurveyResultsChart />
                        </div>
                      </div>

                      {/* Bottom: Wide Quote Box */}
                      <VoicesCarousel />
                    </div>

            {/* Key Insights Summary - Full Width Below */}
            <div className="mt-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Insights from the Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-3xl font-bold text-red-600 mb-2">73%</div>
                  <div className="text-gray-700 text-sm">Find current standards ineffective for bioaccumulation protection</div>
                </div>
                <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-3xl font-bold text-orange-600 mb-2">95%</div>
                  <div className="text-gray-700 text-sm">Rate expanding contaminant list as essential or very important</div>
                </div>
                <div className="text-center bg-white rounded-lg p-4 shadow-sm">
                  <div className="text-3xl font-bold text-green-600 mb-2">91%</div>
                  <div className="text-gray-700 text-sm">See bioavailability adjustments as essential or very important</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Key Themes Summary */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Key Themes Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Widespread Dissatisfaction</h3>
                    <p className="text-gray-600">Consensus that current standards are outdated and not sufficiently protective of the environment.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Call for Broader Scope</h3>
                    <p className="text-gray-600">Overwhelming demand to expand the list of regulated contaminants and address bioaccumulation risks.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Mandate for Science-Based Approach</h3>
                    <p className="text-gray-600">Strong desire for a nuanced, evidence-based system that incorporates bioavailability and tiered frameworks.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Need for Clear Guidance</h3>
                    <p className="text-gray-600">Emphasis on comprehensive guidance, standardized methods, and training for new standards implementation.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Ready to Explore the Detailed Findings?</h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-3xl mx-auto">
              Dive deeper into the expert feedback, explore interactive visualizations, and understand the comprehensive recommendations for modernizing BC's sediment standards.
            </p>
            <Link 
              href="/survey-results/detailed-findings"
              className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl text-lg hover:bg-indigo-50 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Explore the Detailed Findings
              <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* CEW 2025 Conference Connection */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl shadow-lg p-12 text-white">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Connecting to CEW 2025 Victoria</h2>
              <p className="text-xl text-green-100 max-w-4xl mx-auto">
                These survey findings directly inform our session at the Canadian Ecotoxicity Workshop 2025 in Victoria, BC
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold mb-4">Conference Details</h3>
                <div className="space-y-3 text-green-100">
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📅</span>
                    <span><strong>Dates:</strong> October 5-9, 2025</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">📍</span>
                    <span><strong>Location:</strong> Victoria, British Columbia</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">⏰</span>
                    <span><strong>Our Session:</strong> Tuesday, October 7, 2025 (Morning)</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">🎯</span>
                    <span><strong>Focus:</strong> Holistic Protection of Aquatic Ecosystems</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <a 
                    href="https://www.ecotoxcan.ca/cew-conference-home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
                  >
                    Visit CEW 2025 Website
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4">Survey Themes → Conference Topics</h3>
                <div className="space-y-3 text-green-100">
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Holistic Protection:</strong> Dual standards and matrix approaches</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Tiered Framework:</strong> Site-specific modification protocols</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Modern Approaches:</strong> Cutting-edge assessment methodologies</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Contaminants Expansion:</strong> Emerging substances coverage</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Complex Mixtures:</strong> Synergistic effects assessment</span>
                  </div>
                  <div className="flex items-start">
                    <span className="text-green-300 mr-2 mt-1">→</span>
                    <span><strong>Cumulative Effects:</strong> Long-term impact evaluation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FIXED: CEW Theme Navigation - Now Points to Actual Themes */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">Explore CEW 2025 Themes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Holistic Protection Card */}
            <Link href="/survey-results/holistic-protection" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-blue-300">
                <div className="text-4xl mb-4">🛡️</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-blue-600 transition-colors mb-3">
                  Holistic Protection
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Dual standards approach and matrix standards for comprehensive environmental protection.
                </p>
                <div className="mt-4 flex items-center text-blue-600 group-hover:text-blue-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Tiered Framework Card */}
            <Link href="/survey-results/tiered-framework" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-green-300">
                <div className="text-4xl mb-4">🏗️</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-green-600 transition-colors mb-3">
                  Tiered Framework
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Site-specific modification protocols and assessment frameworks for flexible implementation.
                </p>
                <div className="mt-4 flex items-center text-green-600 group-hover:text-green-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Modern Approaches Card */}
            <Link href="/survey-results/modern-approaches" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-purple-300">
                <div className="text-4xl mb-4">🚀</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-purple-600 transition-colors mb-3">
                  Modern Approaches
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Prioritization of cutting-edge methodologies and scientific advancements in sediment assessment.
                </p>
                <div className="mt-4 flex items-center text-purple-600 group-hover:text-purple-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Contaminants Expansion Card */}
            <Link href="/survey-results/contaminants-expansion" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-orange-300">
                <div className="text-4xl mb-4">🧪</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-orange-600 transition-colors mb-3">
                  Expanding Contaminants List
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Comprehensive coverage of emerging contaminants and substances of concern.
                </p>
                <div className="mt-4 flex items-center text-orange-600 group-hover:text-orange-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Complex Mixtures Card */}
            <Link href="/survey-results/complex-mixtures" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-red-300">
                <div className="text-4xl mb-4">🔬</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-red-600 transition-colors mb-3">
                  Complex Mixtures
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Assessment methodologies for complex contaminant mixtures and synergistic effects.
                </p>
                <div className="mt-4 flex items-center text-red-600 group-hover:text-red-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            {/* Cumulative Effects Card */}
            <Link href="/survey-results/cumulative-effects" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-200 hover:border-teal-300">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-xl font-semibold text-gray-800 group-hover:text-teal-600 transition-colors mb-3">
                  Cumulative Effects
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Long-term impact assessment and cumulative risk evaluation frameworks.
                </p>
                <div className="mt-4 flex items-center text-teal-600 group-hover:text-teal-700">
                  <span className="text-sm font-medium">Explore Theme</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Next Steps Summary */}
        <section>
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-lg p-8 border border-green-200">
            <h2 className="text-2xl font-semibold text-green-900 mb-6">Next Steps</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-4">Immediate Actions</h3>
                <ul className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Develop dual standards for benthic and bioaccumulation protection
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Expand list of regulated contaminants including emerging substances
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Establish tiered assessment framework with clear guidance
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-4">Implementation Support</h3>
                <ul className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Create comprehensive guidance documents and decision trees
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Develop training programs for regulators and practitioners
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Establish regional background concentration databases
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
