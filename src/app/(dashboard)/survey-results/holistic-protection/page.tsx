// src/app/(dashboard)/survey-results/holistic-protection/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function HolisticProtectionPage() {
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center space-x-4 mb-4">
            <Link 
              href="/survey-results"
              className="text-blue-100 hover:text-white transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Survey Results
            </Link>
          </div>
          <h1 className="text-4xl font-bold">Holistic Protection</h1>
          <p className="text-xl text-blue-100 mt-2">
            Dual Standards and Matrix Standards for Comprehensive Environmental Protection
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Overview Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-6">
              The concept of holistic protection represents a fundamental shift from single-purpose standards to comprehensive frameworks that address multiple environmental protection goals simultaneously. This approach recognizes that sediment quality affects not just benthic organisms, but entire food webs and human health.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-xl font-semibold text-blue-800 mb-3">🛡️ Dual Standards Approach</h3>
                <p className="text-blue-700">
                  Separate but complementary standards for benthic organism protection and bioaccumulation prevention, recognizing that these require different assessment methodologies and risk thresholds.
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-3">🔬 Matrix Standards Framework</h3>
                <p className="text-green-700">
                  Multi-dimensional assessment approach that considers contaminant type, site characteristics, and receptor sensitivity in a unified evaluation system.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dual Standards Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Dual Standards Approach</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Why Dual Standards?</h3>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Current single-threshold standards fail to address the different exposure pathways and risk mechanisms for benthic organisms versus higher trophic levels. A dual approach provides:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                  <li><strong>Benthic Protection Standards:</strong> Focus on direct sediment contact and acute toxicity</li>
                  <li><strong>Bioaccumulation Standards:</strong> Address food web transfer and long-term exposure risks</li>
                  <li><strong>Flexible Implementation:</strong> Allow site-specific application based on local conditions</li>
                  <li><strong>Comprehensive Coverage:</strong> Protect both local ecosystem health and human health</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
                  <h4 className="text-lg font-semibold text-red-800 mb-3">Benthic Organism Protection</h4>
                  <ul className="space-y-2 text-red-700 text-sm">
                    <li>• Direct sediment contact toxicity</li>
                    <li>• Acute and chronic effects</li>
                    <li>• Community structure impacts</li>
                    <li>• Habitat quality assessment</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
                  <h4 className="text-lg font-semibold text-orange-800 mb-3">Bioaccumulation Protection</h4>
                  <ul className="space-y-2 text-orange-700 text-sm">
                    <li>• Food web transfer pathways</li>
                    <li>• Biomagnification potential</li>
                    <li>• Human health implications</li>
                    <li>• Long-term exposure risks</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Matrix Standards Section */}
        <section className="mb-16">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Matrix Standards Framework</h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Multi-Dimensional Assessment</h3>
                <p className="text-gray-700 leading-relaxed mb-6">
                  Matrix standards provide a flexible framework that considers multiple factors simultaneously, allowing for nuanced decision-making that reflects real-world complexity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3">Contaminant Type</h4>
                  <ul className="space-y-2 text-purple-700 text-sm">
                    <li>• Chemical properties</li>
                    <li>• Toxicity mechanisms</li>
                    <li>• Persistence factors</li>
                    <li>• Bioavailability</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
                  <h4 className="text-lg font-semibold text-teal-800 mb-3">Site Characteristics</h4>
                  <ul className="space-y-2 text-teal-700 text-sm">
                    <li>• Sediment composition</li>
                    <li>• Hydrology patterns</li>
                    <li>• Land use context</li>
                    <li>• Climate factors</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
                  <h4 className="text-lg font-semibold text-indigo-800 mb-3">Receptor Sensitivity</h4>
                  <ul className="space-y-2 text-indigo-700 text-sm">
                    <li>• Species vulnerability</li>
                    <li>• Life stage sensitivity</li>
                    <li>• Population status</li>
                    <li>• Ecological importance</li>
                  </ul>
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Matrix Decision Framework</h4>
                <p className="text-gray-700 text-sm leading-relaxed">
                  The matrix approach allows regulators and practitioners to evaluate sites using a combination of factors, resulting in more appropriate and protective standards that reflect local conditions while maintaining consistency across the province.
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
                        <span className="text-green-800 font-medium">Support for Dual Standards</span>
                        <span className="text-green-600 font-bold">83%</span>
                      </div>
                      <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '83%' }}></div>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-800 font-medium">Matrix Framework Support</span>
                        <span className="text-blue-600 font-bold">76%</span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: '76%' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-4">Implementation Considerations</h3>
                  <ul className="space-y-3 text-gray-700">
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Clear guidance on when to apply each standard type
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Training programs for regulators and practitioners
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-600 mr-3 mt-1">📋</span>
                      Decision trees for matrix assessment
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
                    Develop draft dual standards for key contaminants
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Create matrix assessment framework
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 mr-3 mt-1">📋</span>
                    Establish stakeholder consultation process
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
              <Link href="/survey-results/tiered-framework" className="group">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 hover:border-green-300 transition-colors">
                  <h3 className="font-semibold text-green-800 group-hover:text-green-700">Tiered Framework</h3>
                  <p className="text-green-600 text-sm">Site-specific modification protocols</p>
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
