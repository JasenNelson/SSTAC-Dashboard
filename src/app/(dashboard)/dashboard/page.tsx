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
          try { cookieStore.set({ name, value, ...options }); } catch (_error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (_error) {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Header with Aquatic Theme */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white shadow-2xl relative overflow-hidden">
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
                         <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-white to-sky-200 bg-clip-text text-transparent">
               Sediment Standards Project
             </h1>
            <p className="text-xl text-sky-200 max-w-4xl mx-auto leading-relaxed mb-8">
              Developing a modern, robust scientific framework for updating BC&apos;s Contaminated Sites Regulation sediment standards
            </p>
            <div className="inline-flex items-center px-6 py-3 bg-white/90 backdrop-blur-sm rounded-full border border-white/30 shadow-lg">
              <span className="text-slate-900 text-sm font-semibold">
                🎯 Phase 1: Scientific Framework Development
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
        {/* Project Context Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 mb-12 border border-slate-200 dark:border-slate-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
              About the Sediment Standards Project
            </h2>
            
            <div className="grid lg:grid-cols-2 gap-12">
              {/* Project Overview */}
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🏛️</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">Project Overview</h3>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                      The Science Advisory Board for Contaminated Sites (SABCS) has partnered with the BC Ministry of Environment & Parks to collaboratively develop a scientific framework for modernizing the CSR standards.
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      The Science & Standards Technical Advisory Committee (SSTAC) is leading the Sediment Standards Project, which integrates best-available science to protect aquatic ecosystems and the communities that depend on them.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Project Phases */}
              <ProjectPhases />
            </div>
            
            {/* Elevator Pitch */}
            <div className="mt-10 p-6 bg-gradient-to-r from-sky-50 to-slate-50 dark:from-sky-900/40 dark:to-slate-900 rounded-xl border border-sky-200 dark:border-sky-700">
              <div className="text-center">
                <h4 className="text-xl font-semibold text-slate-900 dark:text-sky-100 mb-3">Project Mission</h4>
                <p className="text-slate-800 dark:text-sky-200 italic text-lg leading-relaxed max-w-4xl mx-auto">
                  &quot;The Sediment Standards Project is developing a modern, robust scientific framework for updating BC&apos;s Contaminated Sites Regulation sediment standards, integrating best-available science to protect aquatic ecosystems and the communities that depend on them.&quot;
                </p>
              </div>
            </div>
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 mb-8 mx-auto max-w-md">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Quick Navigation</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Survey Results */}
            <Link href="/survey-results" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-500">
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-sky-200 transition-colors">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors mb-3">
                  Survey
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Explore comprehensive stakeholder feedback and expert insights on modernizing BC sediment standards.
                </p>
              </div>
            </Link>

            {/* CEW 2025 */}
            <Link href="/cew-2025" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-500">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <span className="text-3xl">🌊</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors mb-3">
                  CEW 2025
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Session details and conference information for the Canadian Ecotoxicity Workshop 2025 in Victoria.
                </p>
              </div>
            </Link>

            {/* TWG Documents */}
            <Link href="/twg/documents" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-500">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <span className="text-3xl">📋</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-3">
                  Documents
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Access and manage Technical Working Group documents, reports, and technical materials.
                </p>
              </div>
            </Link>

            {/* Discussion Forum */}
            <Link href="/twg/discussions" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-500">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                  <span className="text-3xl">💬</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-3">
                  Forum
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Engage in technical discussions and collaborate with stakeholders on sediment standards.
                </p>
              </div>
            </Link>

            {/* WIKS - Weaving Indigenous Knowledge & Science */}
            <Link href="/wiks" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-500">
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-amber-200 dark:group-hover:bg-amber-800 transition-colors">
                  <span className="text-3xl">🌿</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-3">
                  WIKS
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Explore the strategic plan to integrate Indigenous-led WQCIU framework into BC&apos;s modernized sediment standards.
                </p>
              </div>
            </Link>

            {/* Admin Panel */}
            <Link href="/admin" className="group">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                  <span className="text-3xl">⚙️</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors mb-3">
                  Admin
                </h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Access the admin dashboard to manage users, announcements, milestones, and system settings (Admin access required).
                </p>
              </div>
            </Link>

          </div>
        </section>

        {/* Project Status Summary */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-800 dark:to-emerald-900 rounded-2xl shadow-2xl p-10 text-white">
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
                    <span className="text-sky-200 mr-3 mt-1">📋</span>
                    <span>TWG review of &ldquo;What We Heard&rdquo; report begins mid-August 2025</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-sky-200 mr-3 mt-1">📋</span>
                    <span>CEW 2025 session presentation and stakeholder feedback collection (Oct 7)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-sky-200 mr-3 mt-1">📋</span>
                    <span>Collaboratively refine interim scientific framework (Phase 1 completion by Dec 2025)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="mb-12">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-10 border border-slate-200 dark:border-slate-700">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">Get in Touch</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Email Support</h3>
                <div className="text-slate-500 dark:text-slate-300 space-y-3">
                  <div>
                    <strong className="text-slate-700 dark:text-slate-200">SABCS:</strong>{' '}
                    <a 
                      href="mailto:info@sabcs.ca" 
                      className="text-sky-700 hover:text-sky-800 underline font-medium"
                    >
                      info@sabcs.ca
                    </a>
                  </div>
                  <div>
                    <strong className="text-slate-700 dark:text-slate-200">Ministry of Environment and Parks:</strong>{' '}
                    <a 
                      href="mailto:jasen.nelson@gov.bc.ca" 
                      className="text-sky-700 hover:text-sky-800 underline font-medium"
                    >
                      jasen.nelson@gov.bc.ca
                    </a>
                  </div>
                </div>
              </div>
              <div>
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">📋</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Project Updates</h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
                  Stay informed about project progress and milestones
                </p>
              </div>
              <div>
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Stakeholder Engagement</h3>
                <p className="text-slate-500 dark:text-slate-300 leading-relaxed">
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


