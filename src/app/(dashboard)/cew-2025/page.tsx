// src/app/(dashboard)/cew-2025/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// Updated data with correct conference information
const sessionData = {
  title: 'Holistic Protection of Aquatic Ecosystems - Modern Sediment Quality Assessment',
  sstacMembers: ['Geoff Wickstrom', 'Jennifer Trowell', 'Jasen Nelson', 'Marc Cameron', 'Peter Ross', 'Shannon Bard'],
  twgMembers: ['Beth Power', 'Gary Lawrence', 'Joline (Jo) Widmeyer', 'Shannon Waters', 'Wayne Landis'],
  guestSpeakers: ['Anuradha Rao', 'Melany Sanchez Solano', 'Sushil Dixit'],
  summary:
    'This session explores the holistic protection of aquatic ecosystems through modern sediment quality assessment. Our guest speakers will lead interactive discussions covering widespread contamination challenges, the latest in assessment science, and the critical importance of weaving Indigenous Knowledges into environmental monitoring and protection frameworks.',
  conferenceDate: 'October 5-9, 2025',
  sessionDate: 'Tuesday, October 7, 2025',
  sessionTime: '8:30 am to 12:00 pm',
  location: 'Victoria, British Columbia',
  format: 'Engaging Presentations and Interactive Discussions',
  conferenceWebsite: 'https://www.ecotoxcan.ca/cew-conference-home'
};

// This is now a Server Component by default.
export default async function Cew2025Page() {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Main Title Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white rounded-2xl shadow-2xl mb-12">
        <div className="relative px-8 py-16 text-center">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-6 leading-tight">
              Holistic Protection of Aquatic Ecosystems - Modern Sediment Quality Assessment
            </h1>
            <p className="text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed mb-8">
              SABCS interactive session at the Canadian Ecotoxicity Workshop (CEW)
            </p>
            
            {/* Conference Details Card */}
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-6 mb-8 max-w-2xl mx-auto border border-white/30 shadow-lg">
              <div className="flex items-center justify-center space-x-8 text-lg">
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white font-semibold">October 5-9, 2025</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white font-semibold">Victoria, BC</span>
                </div>
              </div>
            </div>
            
            <a 
              href={sessionData.conferenceWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-10 py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 hover:scale-105 transition-all duration-300 text-xl shadow-lg"
            >
              Visit Conference Website
              <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900 dark:to-purple-900 rounded-2xl shadow-xl border border-indigo-200 dark:border-indigo-700 overflow-hidden mb-12">
        
        <div className="p-8">
          {/* Session Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 p-6 rounded-xl border border-indigo-200 dark:border-indigo-600 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">Session Date</h3>
              </div>
              <p className="text-xl font-bold text-indigo-950 dark:text-indigo-100">{sessionData.sessionDate}</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 p-6 rounded-xl border border-purple-200 dark:border-purple-600 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-purple-900 dark:text-purple-200 uppercase tracking-wide">Session Time</h3>
              </div>
              <p className="text-xl font-bold text-purple-950 dark:text-purple-100">{sessionData.sessionTime}</p>
            </div>
            
            <div className="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-800 dark:via-indigo-800 dark:to-purple-800 p-6 rounded-xl border border-blue-200 dark:border-blue-600 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wide">Format</h3>
              </div>
              <p className="text-lg font-bold text-blue-950 dark:text-blue-100">{sessionData.format}</p>
            </div>
          </div>

          {/* Presenters, Facilitators, and Moderators */}
          <div className="mb-8">
            <div className="text-center mb-8">
              <h3 className="text-3xl font-bold text-indigo-900 dark:text-gray-100 mb-2">Presenters, Facilitators, and Moderators</h3>
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 mx-auto rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* SSTAC Members */}
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-800 dark:to-purple-800 rounded-xl p-6 border border-indigo-200 dark:border-indigo-600 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-indigo-950 dark:text-indigo-100">SSTAC Members</h4>
                  </div>
                </div>
                <div className="space-y-3">
                  {sessionData.sstacMembers.map((member) => (
                    <div key={member} className="bg-white/70 dark:bg-indigo-700/50 rounded-lg px-4 py-3 border border-indigo-200/50 dark:border-indigo-500/50 hover:bg-white dark:hover:bg-indigo-600/70 transition-colors">
                      <p className="text-indigo-950 dark:text-indigo-100 font-medium text-center">{member}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* TWG Members */}
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-800 dark:to-pink-800 rounded-xl p-6 border border-purple-200 dark:border-purple-600 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-purple-950 dark:text-purple-100">TWG Members</h4>
                  </div>
                </div>
                <div className="space-y-3">
                  {sessionData.twgMembers.map((member) => (
                    <div key={member} className="bg-white/70 dark:bg-purple-700/50 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-500/50 hover:bg-white dark:hover:bg-purple-600/70 transition-colors">
                      <p className="text-purple-950 dark:text-purple-100 font-medium text-center">{member}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guest Speakers */}
              <div className="bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 dark:from-blue-800 dark:via-indigo-800 dark:to-purple-800 rounded-xl p-6 border border-blue-200 dark:border-blue-600 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 4a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-blue-950 dark:text-blue-100">Guest Speakers</h4>
                  </div>
                </div>
                <div className="space-y-3">
                  {sessionData.guestSpeakers.map((speaker) => (
                    <div key={speaker} className="bg-white/70 dark:bg-blue-700/50 rounded-lg px-4 py-3 border border-blue-200/50 dark:border-blue-500/50 hover:bg-white dark:hover:bg-blue-600/70 transition-colors">
                      <p className="text-blue-950 dark:text-blue-100 font-medium text-center">{speaker}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Session Summary */}
          <div>
            <h3 className="text-2xl font-semibold text-indigo-900 dark:text-gray-100 mb-4">Session Summary</h3>
            <p className="text-indigo-800 dark:text-gray-200 leading-relaxed text-lg">
              {sessionData.summary}
            </p>
          </div>
        </div>
      </div>

      {/* CEW Session Schedule */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 dark:from-blue-800 dark:via-indigo-800 dark:to-purple-800 rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-3xl font-bold text-white mb-6 text-center">CEW Session Schedule</h2>
        
        <div className="space-y-6">
          {/* Session 1 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 1: Whales, water and sediments: Towards a renewed risk-based approach to environmental contamination</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">8:30 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Peter Ross</p>
          </div>

          {/* Session 2 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 2: Holistic protection of aquatic ecosystems: Developing a scientific framework to modernize sediment quality standards</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">8:45 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Jasen Nelson</p>
          </div>

          {/* Session 3 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 3: Bioaccumulation and sediment assessment: evaluating Canada&apos;s regulatory readiness</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">9:00 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Joline (Jo) Widmeyer</p>
          </div>

          {/* Session 4 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 4: Applying cause-effect pathways to the holistic integration of sediment quality assessments for long-term management</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">9:15 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Wayne Landis</p>
          </div>

          {/* Session 5 */}
          <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 rounded-xl p-6 border border-sky-200 dark:border-sky-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-sky-800 dark:text-sky-100">Presentation 5: Interactive Discussion - Holistic protection: integrating modern science into matrix sediment standards</h3>
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">9:30 AM</span>
            </div>
            <p className="text-sky-700 dark:text-sky-200 font-medium">by Beth Power</p>
          </div>

          {/* Session 6 */}
          <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 rounded-xl p-6 border border-sky-200 dark:border-sky-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-sky-800 dark:text-sky-100">Presentation 6: Interactive Discussion - Expanding the tiered framework: developing a procedure for deriving site-specific sediment standards</h3>
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">9:45 AM</span>
            </div>
            <p className="text-sky-700 dark:text-sky-200 font-medium">by Wayne Landis</p>
          </div>

          {/* Break */}
          <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-800 dark:via-pink-800 dark:to-rose-800 rounded-xl p-6 border border-purple-200 dark:border-purple-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">Break</h3>
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium">10:00 - 10:30 AM</span>
            </div>
            <p className="text-purple-700 dark:text-purple-300 italic mt-2 font-semibold">30-minute break</p>
          </div>

          {/* Session 7 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 7: Development of a new sediment quality guideline protocol and applying it to the derivation of tributyltin sediment quality guidelines</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">10:30 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Sushil Dixit</p>
          </div>

          {/* Session 8 */}
          <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 rounded-xl p-6 border border-sky-200 dark:border-sky-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-sky-800 dark:text-sky-100">Presentation 8: Interactive Discussion - Modernizing BC&apos;s sediment standards: Prioritizing options and approaches (Part 1)</h3>
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">10:45 AM</span>
            </div>
            <p className="text-sky-700 dark:text-sky-200 font-medium">by Gary Lawrence & Beth Power</p>
          </div>

          {/* Session 9 */}
          <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 rounded-xl p-6 border border-sky-200 dark:border-sky-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-sky-800 dark:text-sky-100">Presentation 9: Interactive Discussion - Modernizing BC&apos;s sediment standards: Prioritizing options and approaches (Part 2)</h3>
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">11:00 AM</span>
            </div>
            <p className="text-sky-700 dark:text-sky-200 font-medium">by Gary Lawrence & Beth Power</p>
          </div>

          {/* Session 10 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 10: Weaving knowledges: Indigenous wisdom in modernizing sediment standards for planetary health</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">11:15 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Shannon Waters</p>
          </div>

          {/* Session 11 */}
          <div className="bg-gradient-to-br from-teal-50 via-cyan-50 to-blue-50 dark:from-teal-800 dark:via-cyan-800 dark:to-blue-800 rounded-xl p-6 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-teal-800 dark:text-teal-100">Presentation 11: Setting a New Standard: Merging Western and Indigenous Science to Apply the Burrard Inlet Water Quality Objectives to Contaminated Sites</h3>
              <span className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">11:30 AM</span>
            </div>
            <p className="text-teal-700 dark:text-teal-200 font-medium">by Anuradha Rao & Melany Sanchez Solano</p>
          </div>

          {/* Session 12 */}
          <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 dark:from-sky-800 dark:via-blue-800 dark:to-indigo-800 rounded-xl p-6 border border-sky-200 dark:border-sky-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xl font-semibold text-sky-800 dark:text-sky-100">Presentation 12: Interactive Discussion - Weaving Indigenous Knowledges & Science into the Sediment Standards Framework</h3>
              <span className="bg-gradient-to-r from-sky-500 to-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">11:45 AM</span>
            </div>
            <p className="text-sky-700 dark:text-sky-200 font-medium">by Jasen Nelson, Shannon Waters, Anuradha Rao & Melany Sanchez Solano</p>
          </div>

          {/* Lunch Break */}
          <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-800 dark:via-pink-800 dark:to-rose-800 rounded-xl p-6 border border-purple-200 dark:border-purple-600 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-purple-800 dark:text-purple-200">Lunch Break</h3>
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium">12:00 PM</span>
            </div>
            <p className="text-purple-700 dark:text-purple-300 italic mt-2 font-semibold">Lunch break - Session concludes</p>
          </div>
        </div>
      </div>

      {/* Explore CEW Core Themes */}
      <div className="bg-indigo-600 dark:bg-indigo-700 rounded-xl shadow-lg p-8 mt-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Explore CEW Core Themes</h2>
        <p className="text-indigo-100 text-lg mb-6">
          Discover the key themes and frameworks that will be discussed at CEW 2025
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a 
            href="/survey-results/holistic-protection"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Holistic Protection
          </a>
          <a 
            href="/survey-results/tiered-framework"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Tiered Framework
          </a>
          <a 
            href="/survey-results/prioritization"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Prioritization Framework
          </a>
          <a 
            href="/wiks"
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Weaving Indigenous Knowledges & Science
          </a>
        </div>
      </div>

    </div>
  );
}