// src/app/(dashboard)/dashboard/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import Announcements from '@/components/dashboard/Announcements';
import ProjectTimeline from '@/components/dashboard/ProjectTimeline';
import ProjectPhases from '@/components/dashboard/ProjectPhases';

export default async function DashboardPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Header with Aquatic Theme */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white shadow-2xl relative overflow-hidden">
        {/* Aquatic Texture Overlay */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full">
            {/* Multiple Wave Patterns for Textured Water Effect */}
            <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-r from-transparent via-white/15 to-transparent transform -skew-y-12"></div>
            <div className="absolute top-20 left-0 w-full h-32 bg-gradient-to-r from-transparent via-white/12 to-transparent transform skew-y-8"></div>
            <div className="absolute top-40 left-0 w-full h-28 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-y-6"></div>
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-transparent via-white/8 to-transparent transform skew-y-4"></div>
            <div className="absolute top-16 left-0 w-full h-20 bg-gradient-to-r from-transparent via-white/6 to-transparent transform -skew-y-3"></div>
            <div className="absolute top-32 left-0 w-full h-16 bg-gradient-to-r from-transparent via-white/4 to-transparent transform skew-y-2"></div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
          <div className="text-center">
                         <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
               Sediment Standards Project
             </h1>
            <p className="text-xl text-blue-100 max-w-4xl mx-auto leading-relaxed mb-8">
              Developing a modern, robust scientific framework for updating BC's Contaminated Sites Regulation sediment standards
            </p>
            <div className="inline-flex items-center px-6 py-3 bg-white/90 backdrop-blur-sm rounded-full border border-white/30 shadow-lg">
              <span className="text-blue-900 text-sm font-semibold">
                🎯 Phase 1: Scientific Framework Development
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        {/* Project Context Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-12 border border-gray-100 dark:border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
              About the Sediment Standards Project
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Project Overview */}
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🏛️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Project Overview</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                      The Science Advisory Board for Contaminated Sites (SABCS) has partnered with the BC Ministry of Environment & Parks to collaboratively develop a scientific framework for modernizing the CSR standards.
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      The Science & Standards Technical Advisory Committee (SSTAC) is leading the Sediment Standards Project, which integrates best-available science to protect aquatic ecosystems and the communities that depend on them.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Project Phases */}
              <ProjectPhases />
            </div>
            
            {/* Elevator Pitch */}
            <div className="mt-10 p-6 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-xl border border-blue-200 dark:border-blue-700">
              <div className="text-center">
                <h4 className="text-xl font-semibold text-blue-950 dark:text-blue-100 mb-3">Project Mission</h4>
                <p className="text-blue-900 dark:text-blue-200 italic text-lg leading-relaxed max-w-4xl mx-auto">
                  &quot;The Sediment Standards Project is developing a modern, robust scientific framework for updating BC&apos;s Contaminated Sites Regulation sediment standards, integrating best-available science to protect aquatic ecosystems and the communities that depend on them.&quot;
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-2">7</div>
            <div className="text-gray-600 dark:text-gray-300 text-sm font-medium">Project Milestones</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📝</span>
            </div>
            <div className="text-3xl font-bold text-green-600 mb-2">61</div>
            <div className="text-gray-600 dark:text-gray-300 text-sm font-medium">Survey Responses</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📢</span>
            </div>
            <div className="text-3xl font-bold text-purple-600 mb-2">3</div>
            <div className="text-gray-600 dark:text-gray-300 text-sm font-medium">Active Announcements</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-2">Dec 2025</div>
            <div className="text-gray-600 dark:text-gray-300 text-sm font-medium">Phase 1 Completion</div>
          </div>
        </div>
        
        {/* CEW Early Bird Notice */}
        <div className="mb-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full backdrop-blur-sm mb-4">
              <span className="text-3xl">🎯</span>
            </div>
            <p className="text-xl font-semibold mb-2">
              CEW 2025 Early Bird Pricing Available
            </p>
            <p className="text-green-100 text-lg mb-3">
              Register by <strong>August 22, 2025</strong> for reduced rates!
            </p>
            <p className="text-green-100 text-sm">
              Don&apos;t miss the opportunity to register for the Canadian Ecotoxicity Workshop 2025 at reduced rates!
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Announcements */}
          <div>
            <Announcements />
          </div>

          {/* Project Timeline */}
          <div>
            <ProjectTimeline />
          </div>
        </div>

        {/* Quick Navigation */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-8 mx-auto max-w-md">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Quick Navigation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Survey Results */}
            <Link href="/survey-results" className="group">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-200 transition-colors">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-3">
                  Survey
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Explore comprehensive stakeholder feedback and expert insights on modernizing BC sediment standards.
                </p>
              </div>
            </Link>

            {/* CEW 2025 */}
            <Link href="/cew-2025" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-green-300">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-200 transition-colors">
                  <span className="text-3xl">🌊</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors mb-3">
                  CEW
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Session details and conference information for the Canadian Ecotoxicity Workshop 2025 in Victoria.
                </p>
              </div>
            </Link>

            {/* TWG Documents */}
            <Link href="/twg/documents" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-purple-300">
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-200 transition-colors">
                  <span className="text-3xl">📋</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-3">
                  Documents
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Access and manage Technical Working Group documents, reports, and technical materials.
                </p>
              </div>
            </Link>

            {/* Discussion Forum */}
            <Link href="/twg/discussions" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-orange-300">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-200 transition-colors">
                  <span className="text-3xl">💬</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-3">
                  Forum
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Engage in technical discussions and collaborate with stakeholders on sediment standards.
                </p>
              </div>
            </Link>

            {/* WIKS - Weaving Indigenous Knowledge & Science */}
            <Link href="/wiks" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-amber-300">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-200 transition-colors">
                  <span className="text-3xl">🌿</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-3">
                  WIKS
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Explore the strategic plan to integrate Indigenous-led WQCIU framework into BC's modernized sediment standards.
                </p>
              </div>
            </Link>

            {/* Admin Panel */}
            <Link href="/admin" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-red-300">
                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-200 transition-colors">
                  <span className="text-3xl">⚙️</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mb-3">
                  Admin
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Access the admin dashboard to manage users, announcements, milestones, and system settings (Admin access required).
                </p>
              </div>
            </Link>

            {/* Project Resources */}
            <Link href="/survey-results" className="group">
              <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-teal-300">
                <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-teal-200 transition-colors">
                  <span className="text-3xl">📚</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors mb-3">
                  Project Resources
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Access project documentation, research materials, and technical resources.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Project Status Summary */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-2xl p-10 text-white">
            <h2 className="text-3xl font-bold mb-8 text-center">Current Project Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-6 flex items-center">
                  <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">✓</span>
                  Recent Achievements
                </h3>
                <ul className="space-y-4 text-green-100">
                  <li className="flex items-start">
                    <span className="text-green-200 mr-3 mt-1">✓</span>
                    <span>Completed comprehensive stakeholder survey with 61 responses (ended July 31, 2025)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-200 mr-3 mt-1">✓</span>
                    <span>Established SSTAC oversight committee and project structure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-200 mr-3 mt-1">✓</span>
                    <span>Secured CEW 2025 conference session for October 7, 2025</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-6 flex items-start">
                  <span className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center mr-3">📋</span>
                  Next Steps
                </h3>
                <ul className="space-y-4 text-green-100">
                  <li className="flex items-start">
                    <span className="text-blue-200 mr-3 mt-1">📋</span>
                    <span>TWG review of "What We Heard" report begins mid-August 2025</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-200 mr-3 mt-1">📋</span>
                    <span>CEW 2025 session presentation and stakeholder feedback collection (Oct 7)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-200 mr-3 mt-1">📋</span>
                    <span>Collaboratively refine interim scientific framework (Phase 1 completion by Dec 2025)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-10 border border-gray-100 dark:border-gray-700">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Get in Touch</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Email Support</h3>
                <div className="text-gray-600 dark:text-gray-300 space-y-3">
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200">SABCS:</strong>{' '}
                    <a 
                      href="mailto:info@sabcs.ca" 
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      info@sabcs.ca
                    </a>
                  </div>
                  <div>
                    <strong className="text-gray-800">Ministry of Environment and Parks:</strong>{' '}
                    <a 
                      href="mailto:jasen.nelson@gov.bc.ca" 
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      jasen.nelson@gov.bc.ca
                    </a>
                  </div>
                </div>
              </div>
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📋</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Project Updates</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Stay informed about project progress and milestones
                </p>
              </div>
              <div>
                <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Stakeholder Engagement</h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  Participate in discussions and provide feedback
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


