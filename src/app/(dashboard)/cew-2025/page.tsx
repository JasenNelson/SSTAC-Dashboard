// src/app/(dashboard)/cew-2025/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// Updated data with correct conference information
const sessionData = {
  title: 'Holistic Protection of Aquatic Ecosystems - Modern Sediment Quality Assessment',
  coChairs: ['Jasen Nelson', 'Shannon Bard', 'Marc Cameron'],
  summary:
    'This session explores the holistic protection of aquatic ecosystems through modern sediment quality assessment. Our guest speakers will lead interactive discussions covering widespread contamination challenges, the latest in assessment science, and the critical importance of weaving Indigenous Knowledges into environmental monitoring and protection frameworks.',
  conferenceDate: 'October 5-9, 2025',
  sessionDate: 'Tuesday, October 7, 2025',
  sessionTime: 'Morning Session',
  location: 'Victoria, British Columbia',
  duration: 'Half Day',
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
      {/* Main Title Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl shadow-lg p-12 mb-8 text-center">
        <h1 className="text-5xl font-bold mb-4">Canadian Ecotoxicity Workshop (CEW) 2025 Victoria</h1>
        <p className="text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
          Join us for this premier ecotoxicology conference in Canada
        </p>
      </div>

      {/* Conference Information Banner */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">CEW 2025 Conference</h2>
            <p className="text-green-100 text-lg">
              October 5-9, 2025 • Victoria, British Columbia
            </p>
          </div>
          <a 
            href={sessionData.conferenceWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            Visit Conference Website
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4 leading-tight">
            {sessionData.title}
          </h2>
          
          <p className="text-lg text-gray-600 mb-6">
            A featured session at the Canadian Ecotoxicity Workshop (CEW) 2025
          </p>
        </div>
        
        {/* Session Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-1">Conference Dates</h3>
            <p className="text-lg font-semibold text-blue-900">{sessionData.conferenceDate}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-800 mb-1">Session Date</h3>
            <p className="text-lg font-semibold text-green-900">{sessionData.sessionDate}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-purple-800 mb-1">Session Time</h3>
            <p className="text-lg font-semibold text-purple-900">{sessionData.sessionTime}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-orange-800 mb-1">Duration</h3>
            <p className="text-lg font-semibold text-orange-900">{sessionData.duration}</p>
          </div>
        </div>

        {/* Location and Format */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-indigo-800 mb-1">Location</h3>
            <p className="text-lg font-semibold text-indigo-900">{sessionData.location}</p>
            <p className="text-indigo-600 text-sm">Beautiful coastal city on Vancouver Island</p>
          </div>
          <div className="bg-teal-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-teal-800 mb-1">Format</h3>
            <p className="text-lg font-semibold text-teal-900">{sessionData.format}</p>
            <p className="text-teal-600 text-sm">Engaging discussions and presentations</p>
          </div>
        </div>

        {/* Co-Chairs */}
        <div className="mb-8">
          <h3 className="text-2xl font-semibold text-gray-700 mb-4">Session Co-Chairs</h3>
          <div className="flex flex-wrap gap-4">
            {sessionData.coChairs.map((chair) => (
              <span key={chair} className="bg-indigo-100 text-indigo-800 text-lg font-medium px-6 py-3 rounded-full">
                {chair}
              </span>
            ))}
          </div>
        </div>

        {/* Session Summary */}
        <div>
          <h3 className="text-2xl font-semibold text-gray-700 mb-4">Session Summary</h3>
          <p className="text-gray-700 leading-relaxed text-lg">
            {sessionData.summary}
          </p>
        </div>
      </div>

      {/* CEW Session Schedule */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">CEW Session Schedule</h2>
        <p className="text-lg text-gray-600 mb-8 text-center">
          Tuesday, October 7, 2025 - Half Day (Morning)
        </p>
        
        <div className="space-y-6">
          {/* Session 1 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h3 className="text-xl font-semibold text-blue-800 mb-3">Session 1: Whales, Water and Sediments</h3>
            <p className="text-blue-700 font-medium mb-2">Peter Ross</p>
            <p className="text-blue-600 italic">Towards a renewed risk-based approach to environmental contamination</p>
          </div>

          {/* Session 2 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <h3 className="text-xl font-semibold text-green-800 mb-3">Session 2: Holistic Protection Framework</h3>
            <p className="text-green-700 font-medium mb-2">Jasen Nelson, Marc Cameron</p>
            <p className="text-green-600 italic">Holistic protection of aquatic ecosystems: Developing a scientific framework to modernize sediment quality standards</p>
          </div>

          {/* Session 3 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
            <h3 className="text-xl font-semibold text-purple-800 mb-3">Session 3: Bioaccumulation Assessment</h3>
            <p className="text-purple-700 font-medium mb-2">Joline (Jo) Widmeyer</p>
            <p className="text-purple-600 italic">Bioaccumulation and sediment assessment: evaluating Canada&apos;s regulatory readiness</p>
          </div>

          {/* Session 4 */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-6 border border-orange-200">
            <h3 className="text-xl font-semibold text-orange-800 mb-3">Session 4: Cause-Effect Pathways</h3>
            <p className="text-orange-700 font-medium mb-2">Wayne Landis</p>
            <p className="text-orange-600 italic">Applying cause-effect pathways to the holistic integration of sediment quality assessments for long-term management</p>
          </div>

          {/* Session 5 */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200">
            <h3 className="text-xl font-semibold text-teal-800 mb-3">Session 5: Dual Sediment Standards</h3>
            <p className="text-teal-700 font-medium mb-2">Beth Power, Jasen Nelson</p>
            <p className="text-teal-600 italic">Holistic protection: integrating modern science into dual sediment standards</p>
          </div>

          {/* Session 6 */}
          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
            <h3 className="text-xl font-semibold text-red-800 mb-3">Session 6: Tiered Framework Development</h3>
            <p className="text-red-700 font-medium mb-2">Wayne Landis, Jasen Nelson</p>
            <p className="text-red-600 italic">Developing a tiered framework: integrating site-specific data for sediment standards</p>
          </div>

          {/* Session 7 */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-200">
            <h3 className="text-xl font-semibold text-indigo-800 mb-3">Session 7: New Sediment Quality Guidelines</h3>
            <p className="text-indigo-700 font-medium mb-2">Sushil Dixit</p>
            <p className="text-indigo-600 italic">Development of a new sediment quality guideline protocol and applying it to the derivation of tributyltin sediment quality guidelines</p>
          </div>

          {/* Session 8 */}
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
            <h3 className="text-xl font-semibold text-emerald-800 mb-3">Session 8: Modernizing BC Standards (Part 1)</h3>
            <p className="text-emerald-700 font-medium mb-2">Beth Power, Gary Lawrence, Jasen Nelson</p>
            <p className="text-emerald-600 italic">Modernizing BC's sediment standards: Prioritizing options and approaches (Part 1 - presentation)</p>
          </div>

          {/* Session 9 */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
            <h3 className="text-xl font-semibold text-amber-800 mb-3">Session 9: Modernizing BC Standards (Part 2)</h3>
            <p className="text-amber-700 font-medium mb-2">Beth Power, Gary Lawrence, Jasen Nelson</p>
            <p className="text-amber-600 italic">Modernizing BC's sediment standards: Prioritizing options and approaches (Part 2 - interactive discussion)</p>
          </div>

          {/* Session 10 */}
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl p-6 border border-rose-200">
            <h3 className="text-xl font-semibold text-rose-800 mb-3">Session 10: Indigenous Wisdom Integration</h3>
            <p className="text-rose-700 font-medium mb-2">Shannon Waters</p>
            <p className="text-rose-600 italic">Weaving knowledges: Indigenous wisdom in modernizing sediment standards for planetary health</p>
          </div>

          {/* Session 11 */}
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-6 border border-violet-200">
            <h3 className="text-xl font-semibold text-violet-800 mb-3">Session 11: Merging Western and Indigenous Science</h3>
            <p className="text-violet-700 font-medium mb-2">Anuradha Rao</p>
            <p className="text-violet-600 italic">Setting a New Standard: Merging Western and Indigenous Science to Apply the Burrard Inlet Water Quality Objectives to Contaminated Sites</p>
          </div>

          {/* Session 12 */}
          <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl p-6 border border-sky-200">
            <h3 className="text-xl font-semibold text-sky-800 mb-3">Session 12: Interactive Discussion</h3>
            <p className="text-sky-700 font-medium mb-2">Anuradha Rao, Shannon Waters</p>
            <p className="text-sky-600 italic">Interactive Discussion on Weaving Indigenous Knowledges into Standards</p>
          </div>
        </div>
      </div>

      {/* Conference Highlights */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow-lg p-8 mb-8 border border-green-200">
        <h2 className="text-2xl font-bold text-green-900 mb-6">Why Attend CEW 2025?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🌊</div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">Victoria Location</h3>
            <p className="text-green-700 text-sm">
              Beautiful coastal city with rich environmental heritage and stunning natural surroundings
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🔬</div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">Scientific Excellence</h3>
            <p className="text-green-700 text-sm">
              Premier ecotoxicology conference featuring cutting-edge research and expert presentations
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-3">🤝</div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">Networking</h3>
            <p className="text-green-700 text-sm">
              Connect with leading researchers, practitioners, and industry professionals
            </p>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">What to Expect</h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-3 mt-1">✓</span>
              Expert presentations on modern assessment methods
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 mt-1">✓</span>
              Interactive discussions on contamination challenges
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 mt-1">✓</span>
              Indigenous Knowledge integration approaches
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 mt-1">✓</span>
              Networking opportunities with peers
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Key Topics</h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="text-blue-500 mr-3 mt-1">🔬</span>
              Advanced sediment quality assessment techniques
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-3 mt-1">🌊</span>
              Aquatic ecosystem protection strategies
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-3 mt-1">🏛️</span>
              Indigenous Knowledge integration
            </li>
            <li className="flex items-start">
              <span className="text-blue-500 mr-3 mt-1">📊</span>
              Modern monitoring and assessment frameworks
            </li>
          </ul>
        </div>
      </div>

      {/* Registration Call to Action */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-8 mt-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-4">Ready to Join Us?</h2>
        <p className="text-indigo-100 text-lg mb-6">
          Don&apos;t miss this opportunity to participate in the premier ecotoxicology conference in Canada
        </p>
        <div className="space-x-4">
          <a 
            href={sessionData.conferenceWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Visit Conference Website
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a 
            href="/survey-results"
            className="inline-flex items-center px-6 py-3 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white hover:text-indigo-600 transition-colors"
          >
            View Survey Results
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l-7-7 7-7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
