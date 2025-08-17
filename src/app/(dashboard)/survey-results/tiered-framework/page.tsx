// src/app/(dashboard)/survey-results/tiered-framework/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function TieredFrameworkPage() {
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
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center space-x-4 mb-4">
            <Link 
              href="/survey-results"
              className="text-green-100 hover:text-white transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Survey Results
            </Link>
          </div>
          <h1 className="text-4xl font-bold">Tiered Framework</h1>
          <p className="text-xl text-green-100 mt-2">
            Site-Specific Modification Protocols and Assessment Frameworks
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              A tiered framework provides a structured approach to sediment quality assessment that allows for site-specific modifications while maintaining consistency and scientific rigor. This approach recognizes that one-size-fits-all standards cannot adequately address the diverse environmental conditions across British Columbia.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-3">🏗️ Structured Assessment</h3>
                <p className="text-green-700">
                  Multi-level evaluation process that escalates complexity based on site-specific needs and risk factors.
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-3">🔍 Site-Specific Flexibility</h3>
                <p className="text-blue-700">
                  Adaptation of assessment methods and standards to local environmental conditions and receptor sensitivity.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Tiered Approach Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">The Tiered Approach</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Why Tiered Assessment?</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Traditional single-threshold approaches fail to account for the complexity of real-world environmental conditions. A tiered framework provides:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>Efficiency:</strong> Start with simple assessments and escalate only when necessary</li>
                  <li><strong>Cost-Effectiveness:</strong> Avoid expensive testing when not required</li>
                  <li><strong>Site-Appropriate:</strong> Tailor assessment methods to local conditions</li>
                  <li><strong>Scientific Rigor:</strong> Maintain quality while allowing flexibility</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                  <h4 className="text-lg font-semibold text-green-800 mb-3">Tier 1: Screening</h4>
                  <ul className="space-y-2 text-green-700 text-sm">
                    <li>• Basic contaminant screening</li>
                    <li>• Historical site review</li>
                    <li>• Simple risk assessment</li>
                    <li>• Standard protocols</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                  <h4 className="text-lg font-semibold text-yellow-800 mb-3">Tier 2: Detailed</h4>
                  <ul className="space-y-2 text-yellow-700 text-sm">
                    <li>• Advanced testing methods</li>
                    <li>• Site-specific factors</li>
                    <li>• Receptor sensitivity</li>
                    <li>• Modified standards</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
                  <h4 className="text-lg font-semibold text-red-800 mb-3">Tier 3: Comprehensive</h4>
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li>• Full risk assessment</li>
                    <li>• Custom protocols</li>
                    <li>• Advanced modeling</li>
                    <li>• Expert consultation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Site-Specific Modification Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Site-Specific Modification Protocols</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Key Modification Factors</h3>
                <p className="text-gray-700 leading-relaxed mb-6">
                  Site-specific modifications allow standards to be adapted based on local environmental conditions, receptor characteristics, and risk factors.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-800 mb-3">Environmental Factors</h4>
                    <ul className="space-y-2 text-blue-700 text-sm">
                      <li>• Sediment composition and chemistry</li>
                      <li>• Hydrology and flow patterns</li>
                      <li>• Climate and seasonal variations</li>
                      <li>• Land use and development history</li>
                    </ul>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                    <h4 className="text-lg font-semibold text-purple-800 mb-3">Receptor Characteristics</h4>
                    <ul className="space-y-2 text-purple-700 text-sm">
                      <li>• Species sensitivity and vulnerability</li>
                      <li>• Population status and trends</li>
                      <li>• Ecological importance and function</li>
                      <li>• Human use and exposure patterns</li>
                    </ul>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                    <h4 className="text-lg font-semibold text-green-800 mb-3">Risk Assessment Factors</h4>
                    <ul className="space-y-2 text-green-700 text-sm">
                      <li>• Contaminant bioavailability</li>
                      <li>• Exposure pathways and duration</li>
                      <li>• Toxicity mechanisms and interactions</li>
                      <li>• Uncertainty and data quality</li>
                    </ul>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
                    <h4 className="text-lg font-semibold text-orange-800 mb-3">Implementation Considerations</h4>
                    <ul className="space-y-2 text-orange-700 text-sm">
                      <li>• Technical feasibility and cost</li>
                      <li>• Regulatory acceptance and consistency</li>
                      <li>• Stakeholder engagement and support</li>
                      <li>• Monitoring and verification requirements</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Assessment Framework Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Assessment Framework Components</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Decision Trees</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Structured decision-making processes that guide practitioners through assessment choices based on site characteristics and risk factors.
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Clear decision points and criteria</li>
                    <li>• Escalation triggers and thresholds</li>
                    <li>• Documentation requirements</li>
                    <li>• Expert consultation triggers</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Quality Assurance</h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    Robust quality control measures to ensure that site-specific modifications maintain scientific integrity and regulatory consistency.
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li>• Peer review requirements</li>
                    <li>• Data quality standards</li>
                    <li>• Method validation protocols</li>
                    <li>• Documentation standards</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Framework Integration</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  The tiered framework integrates with existing regulatory processes while providing the flexibility needed for site-specific applications. This ensures that modifications are scientifically sound, legally defensible, and practically implementable.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stakeholder Support Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Stakeholder Support & Implementation</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Expert Consensus</h3>
                  <div className="space-y-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between">
                        <span className="text-green-800 font-medium">Support for Tiered Approach</span>
                        <span className="text-green-600 font-bold">86%</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '86%' }}></div>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-800 font-medium">Site-Specific Flexibility</span>
                        <span className="text-blue-600 font-bold">79%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '79%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Implementation Considerations</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Clear guidance on tier selection criteria
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Training programs for framework application
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Quality assurance protocols
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Case studies and worked examples
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Next Steps Section */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl shadow-lg p-8 border border-green-200">
            <h2 className="text-2xl font-semibold text-green-900 mb-6">Next Steps for Implementation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-4">Immediate Actions</h3>
                <ul className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Develop tier selection criteria and decision trees
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Create site-specific modification protocols
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Establish quality assurance framework
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-4">Long-term Development</h3>
                <ul className="space-y-3 text-green-700">
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Comprehensive guidance documents
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Training and certification programs
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Monitoring and evaluation framework
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Navigation */}
        <section>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Explore Other CEW 2025 Themes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/survey-results/holistic-protection" className="group">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 hover:border-blue-300 transition-colors">
                  <h3 className="font-semibold text-blue-800 group-hover:text-blue-700">Holistic Protection</h3>
                  <p className="text-blue-600 text-sm">Dual standards and matrix approaches</p>
                </div>
              </Link>
              <Link href="/survey-results/modern-approaches" className="group">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200 hover:border-purple-300 transition-colors">
                  <h3 className="font-semibold text-purple-800 group-hover:text-purple-700">Modern Approaches</h3>
                  <p className="text-purple-600 text-sm">Cutting-edge methodologies</p>
                </div>
              </Link>
              <Link href="/survey-results/contaminants-expansion" className="group">
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 hover:border-orange-300 transition-colors">
                  <h3 className="font-semibold text-orange-800 group-hover:text-orange-700">Contaminants Expansion</h3>
                  <p className="text-orange-600 text-sm">Emerging substances coverage</p>
                </div>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
