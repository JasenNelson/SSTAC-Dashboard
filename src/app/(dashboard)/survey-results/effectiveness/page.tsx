// src/app/(dashboard)/survey-results/effectiveness/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function EffectivenessPage() {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Navigation */}
      <div className="mb-6">
        <Link href="/survey-results" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Survey Results Overview
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Effectiveness of Current Standards</h1>
        <p className="text-xl text-gray-600 max-w-3xl">
          Analysis of current BC CSR Schedule 3.4 sediment standards' effectiveness for protecting benthic organisms and preventing harmful bioaccumulation.
        </p>
      </header>

      {/* Key Findings Summary */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-xl shadow-md p-8 mb-8 border border-red-200">
        <h2 className="text-2xl font-bold text-red-900 mb-6">Key Findings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600 mb-2">73%</div>
            <div className="text-red-800 font-medium">Rate Standards as Ineffective</div>
            <div className="text-red-600 text-sm">For bioaccumulation protection</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">60%+</div>
            <div className="text-orange-800 font-medium">Rate Standards as Effective</div>
            <div className="text-orange-600 text-sm">For benthic organism protection</div>
          </div>
        </div>
        <p className="text-red-800 text-lg mt-6 leading-relaxed">
          There is a stark contrast in how respondents view the standards' ability to protect different parts of the ecosystem. 
          While over 60% believe the standards are at least "moderately effective" at protecting benthic organisms, 
          this confidence plummets when considering the broader food web.
        </p>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="space-y-8">
        {/* Benthic Organism Protection */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">Benthic Organism Protection</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Survey Results</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-green-500 mr-3 mt-1">✓</span>
                  Over 60% rate standards as at least "moderately effective"
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-500 mr-3 mt-1">⚠</span>
                  Standards focus on direct toxicity to sediment-dwelling organisms
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">💡</span>
                  Standards serve as basic screening tools for benthic protection
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Key Insights</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Standards are perceived as adequate for basic benthic protection
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Focus is on direct toxicity rather than ecosystem-wide effects
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Limited scope to low trophic level species
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bioaccumulation Protection */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">Bioaccumulation Protection</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Critical Gap Identified</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  73% rate standards as "Not Effective" or "Slightly Effective"
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  Standards fail to address food web transfer of contaminants
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  No protection for upper trophic levels or human health
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Stakeholder Quotes</h4>
              <div className="space-y-3 text-gray-600 italic">
                <blockquote className="border-l-4 border-red-200 pl-4">
                  "The BC CSR sediment standards are not appropriate or adequate to protect upper trophic level organisms, 
                  apex predators and humans at the top of foodwebs, as these sediment standards were or are designed for 
                  the protection of low tropic level species and benthic organisms."
                </blockquote>
                <blockquote className="border-l-4 border-red-200 pl-4">
                  "No bioaccumulation protection is also a scary consideration, resulting in the need to clean up to levels 
                  below standards but having a challenging time making a convincing argument."
                </blockquote>
              </div>
            </div>
          </div>
        </div>

        {/* Over-Protection Issues */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">Over-Protection Concerns</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Stakeholder Feedback</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-yellow-500 mr-3 mt-1">⚠</span>
                  Standards can be overly conservative in some areas
                </li>
                <li className="flex items-start">
                  <span className="text-yellow-500 mr-3 mt-1">⚠</span>
                  Generic province-wide standards vs. natural background levels
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">💡</span>
                  One-size-fits-all approach leads to unnecessary costs
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Examples Cited</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Fraser River arsenic and copper naturally higher than standards
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Natural background concentrations exceed regulatory limits
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Unnecessary investigations and remediation costs
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Human Health Considerations */}
        <div className="bg-white rounded-xl shadow-md p-8">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6">Human Health Considerations</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Current Gaps</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  No human health risk assessment integration
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  Missing fish/shellfish consumption considerations
                </li>
                <li className="flex items-start">
                  <span className="text-red-500 mr-3 mt-1">🔴</span>
                  Indigenous communities relying on traditional seafood harvesting
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-medium text-gray-700 mb-4">Stakeholder Recommendations</h4>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Link sediment quality to Human Health Risk Assessment
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Consider dermal exposure in intertidal areas
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-3 mt-1">📋</span>
                  Address bioaccumulation risks for human consumers
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-md p-8 mt-8">
        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Recommendations for Improvement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-4">Immediate Priorities</h4>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="text-red-500 mr-3 mt-1">🔴</span>
                Develop bioaccumulation-based standards
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-3 mt-1">🔴</span>
                Integrate human health considerations
              </li>
              <li className="flex items-start">
                <span className="text-red-500 mr-3 mt-1">🔴</span>
                Address food web transfer pathways
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-medium text-gray-700 mb-4">Long-term Improvements</h4>
            <ul className="space-y-3 text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 mt-1">📋</span>
                Establish regional background concentrations
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 mt-1">📋</span>
                Develop site-specific assessment tools
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-3 mt-1">📋</span>
                Create tiered protection framework
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
