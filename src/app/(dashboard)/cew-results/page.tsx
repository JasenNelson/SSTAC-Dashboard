// src/app/(dashboard)/cew-results/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ReportBarChart from '@/components/charts/ReportBarChart';
import ReportWordCloudChart from '@/components/charts/ReportWordCloudChart';
import CEWMatrixChart from '@/components/charts/CEWMatrixChart';
import {
  g1Data, g2Data, g3Data, g4Data, g5Data, g6Data, g7Data, g8Data,
  g9Data, g10Data, g11Data, g12Data, g13Data, g14Data, g15Data,
  g18Data
} from '@/lib/chart_data';

export default async function CewResultsPage() {
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
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              CEW Session: What We Heard
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Key Metrics (KPIs) - Interactive Cards */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Key Findings at a Glance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* KPI Card 1 */}
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-green-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  5/5
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  High Priority Near-Term
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  All key topics categorized as high priority
                </div>
              </div>
            </div>

            {/* KPI Card 2 */}
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-blue-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  1.6
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Top Priority Ranking
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Distinguish pathways (avg. rank)
                </div>
              </div>
            </div>

            {/* KPI Card 3 */}
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-purple-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  2.0
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Top Focus Ranking
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Site-Specific Tools (avg. rank)
                </div>
              </div>
            </div>

            {/* KPI Card 4 */}
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-orange-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  Split
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Bioavailability Opinion
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Divided on feasibility
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 1.0 Executive Summary */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              1.0 Executive Summary
            </h2>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                This report summarizes feedback from the CEW technical session (October 7, 2025) on modernizing sediment quality assessment. Feedback was collected through real-time polling and a panel discussion. Key findings:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Strong Technical Mandate:</strong> Experts overwhelmingly support the modernization of standards. All five key topics presented in the prioritization (Importance vs. Feasibility) polls were categorized by the group consensus as &ldquo;High Priority Near-Term&rdquo;.</li>
                <li><strong>Clear Prioritization:</strong> When asked to rank actions to improve matrix standards, the clear top priority was to &ldquo;Distinguish &apos;direct toxicity&apos; and &apos;food pathway toxicity&apos; pathways explicitly&rdquo; (1.6 avg. rank).</li>
                <li><strong>Focus on Site-Specific Tools:</strong> The top-ranked focus for providing the greatest value to holistic sediment management was to &ldquo;Push guidance beyond generic numerical standards&rdquo; by applying models and tools to develop Site-Specific Sediment Standards (2.0 avg. rank).</li>
                <li><strong>Nuanced Views on Feasibility:</strong> While there was broad agreement on the importance of all proposed topics, the polling revealed significant expert debate on feasibility. Incorporating bioavailability adjustments, in particular, showed a clear split in opinion on whether it is &ldquo;feasible now&rdquo; or a &ldquo;longer-term&rdquo; goal.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2.0 Introduction & Context */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            2.0 Introduction & Context
          </h2>
          
          {/* 2.1 Session Methodology */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              2.1 Session Methodology
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                The session presented the proposed scientific framework and gathered insights from the technical community. Structured around four key themes: Holistic Protection (matrix sediment standards), Tiered Framework (site-specific standards), Prioritization Framework, and Weaving Indigenous Knowledges.
              </p>
              <p>
                Feedback gathered through two polling methods: live polling during CEW (all attendees) and authenticated polling for SSTAC/TWG members (open until November 8, 2025). This report summarizes quantitative findings from live polling. Qualitative findings from the panel discussion are in Section 6.0.
              </p>
            </div>
          </div>

          {/* Section 2.2 Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-blue-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  88%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Support Modernization
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Respondents supporting modernization
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-red-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  73%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Standards Ineffective
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Find standards ineffective for bioaccumulation
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-green-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  95%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Expand Contaminant List
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Support expanding contaminant list
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-purple-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  91%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Bioavailability Essential
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  See bioavailability as essential
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-orange-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  86%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Tiered Framework
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  See tiered framework as beneficial
                </div>
              </div>
            </div>

            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-l-4 border-indigo-500">
              <div className="text-center">
                <div className="text-4xl font-bold text-indigo-600 mb-2 group-hover:scale-110 transition-transform duration-300">
                  83%
                </div>
                <div className="text-gray-900 dark:text-gray-200 font-semibold text-lg mb-2">
                  Dual Standard Approach
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  Support dual standard approach
                </div>
              </div>
            </div>
          </div>

          {/* 2.2 Building on the Public Survey */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              2.2 Building on the Public Survey
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                This technical engagement built on the public survey (May-July 2025), which showed 88% support for modernization and 73% finding current standards ineffective for bioaccumulation. Strong support for: expanding contaminant list (95%), incorporating bioavailability (91%), tiered framework (86%), and dual standard approach (83%).
              </p>
              <p>
                CEW polls provided technical refinement, focusing on specific methodologies, priorities, and scientific feasibility.
              </p>
            </div>
          </div>
        </section>

        {/* 3.0 Key Findings: Expert Poll Responses */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            3.0 Key Findings: Expert Poll Responses
          </h2>
          
          {/* 3.1 Holistic Protection */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.1 Holistic Protection
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
                <p>
                  This theme focused on defining the components of a &ldquo;Matrix Sediment Standards (SedS) Framework&rdquo; to provide holistic protection. Experts were polled on the importance and feasibility of developing standards for the four quadrants of this matrix.
                </p>
                <p>
                  Participants&apos; paired responses for importance and feasibility were plotted on 2x2 matrix graphs. <strong>Consensus Finding:</strong> All five topics were categorized by the expert consensus as &ldquo;High Priority Near-Term&rdquo; (&ldquo;Very important and feasible now&rdquo;). However, the distribution of individual responses (N=55 to 57) within the quadrants provides critical nuance about the degree of consensus.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Direct Toxicity to Ecological Receptors (SedS-contactECO)
                    </h4>
                    <p>
                      Seen as &ldquo;Very Important&rdquo; (37 votes) and highly &ldquo;Achievable&rdquo; (35 votes).
                    </p>
                    {/* Charts G-1 and G-2 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g1Data}
                          figureNumber="Figure G-1"
                          caption="Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs)."
                        />
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g2Data}
                          figureNumber="Figure G-2"
                          caption="Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs)."
                        />
                      </div>
                    </div>
                    {/* Matrix Chart G-20 */}
                    <div className="my-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Matrix Analysis:</strong> Matrix Standards (Ecosystem Health - Direct Toxicity) showed very strong consensus in the dominant quadrant.
                      </p>
                      <CEWMatrixChart
                        figureNumber="G-20"
                        titleMatch="Ecosystem Health - Direct Toxicity"
                        title="Matrix Standards (Ecosystem Health - Direct Toxicity)"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Direct Toxicity to Human Receptors (SedS-contactHH)
                    </h4>
                    <p>
                      Rated as &ldquo;Very Important&rdquo; or &ldquo;Important&rdquo; (42 votes total), with more varied views on feasibility, leaning toward &ldquo;Achievable&rdquo; (21 votes) or &ldquo;Moderately Achievable&rdquo; (17 votes).
                    </p>
                    {/* Charts G-3 and G-4 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g3Data}
                          figureNumber="Figure G-3"
                          caption="Rank the importance of developing CSR sediment standards for direct toxicity to human receptors (matrix standards)."
                        />
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g4Data}
                          figureNumber="Figure G-4"
                          caption="Rank the feasibility of developing CSR sediment standards for direct toxicity to human receptors (matrix standards)."
                        />
                      </div>
                    </div>
                    {/* Matrix Chart G-21 */}
                    <div className="my-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Matrix Analysis:</strong> Matrix Standards (Human Health - Direct Toxicity) showed a strong majority in the &ldquo;High Priority Near-Term&rdquo; quadrant. However, a notable number of responses also appeared in the &ldquo;High Priority Longer-Term&rdquo; (Top-Left) quadrant, suggesting disagreement on current feasibility.
                      </p>
                      <CEWMatrixChart
                        figureNumber="G-21"
                        titleMatch="Human Health - Direct Toxicity"
                        title="Matrix Standards (Human Health - Direct Toxicity)"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Food-Related Toxicity to Ecological Receptors (SedS-foodECO)
                    </h4>
                    <p>
                      Received strong support as &ldquo;Very Important&rdquo; (37 votes) and &ldquo;Achievable&rdquo; (28 votes).
                    </p>
                    {/* Charts G-5 and G-6 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g5Data}
                          figureNumber="Figure G-5"
                          caption="Rank the importance of developing new CSR sediment standards for food-related toxicity to ecological receptors."
                        />
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g6Data}
                          figureNumber="Figure G-6"
                          caption="Rank the feasibility of developing new CSR sediment standards for food-related toxicity to ecological receptors."
                        />
                      </div>
                    </div>
                    {/* Matrix Chart G-19 */}
                    <div className="my-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Matrix Analysis:</strong> Matrix Standards (Ecosystem Health - Food-Related) showed the tightest clustering, with the vast majority of experts agreeing on both high importance and high feasibility.
                      </p>
                      <CEWMatrixChart
                        figureNumber="G-19"
                        titleMatch="Ecosystem Health - Food-Related"
                        title="Matrix Standards (Ecosystem Health - Food-Related)"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Food-Related Toxicity to Human Receptors (SedS-foodHH)
                    </h4>
                    <p>
                      Rated as &ldquo;Very Important&rdquo; or &ldquo;Important&rdquo; (46 votes total) and &ldquo;Achievable&rdquo; (26 votes).
                    </p>
                    {/* Charts G-7 and G-8 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g7Data}
                          figureNumber="Figure G-7"
                          caption="Rank the importance of developing CSR sediment standards for food-related toxicity to human receptors."
                        />
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g8Data}
                          figureNumber="Figure G-8"
                          caption="Rank the feasibility of developing CSR sediment standards for food-related toxicity to human receptors."
                        />
                      </div>
                    </div>
                    {/* Matrix Chart G-22 */}
                    <div className="my-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Matrix Analysis:</strong> Matrix Standards (Human Health - Food-Related) showed consensus in top-right, with a notable cluster in top-left &ldquo;LONGER-TERM&rdquo; quadrant.
                      </p>
                      <CEWMatrixChart
                        figureNumber="G-22"
                        titleMatch="Human Health - Food-Related"
                        title="Matrix Standards (Human Health - Food-Related)"
                      />
                    </div>
                  </div>
                </div>
              </div>
          </div>

          {/* 3.2 Tiered Framework */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.2 Tiered Framework
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
                <p>
                  This theme explored expanding the &ldquo;Three-Tier Framework&rdquo; (Tier 1: Matrix, Tier 2: Site-Specific, Tier 3: Risk-Based) and the role of probabilistic (e.g., Bayesian) models.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Primary Advantage of a Probabilistic Framework
                    </h4>
                    <p>
                      The top-voted advantage (19 votes) was that &ldquo;It produces a full risk distribution rather than a single point value...&rdquo;
                    </p>
                    {/* Chart G-9 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportBarChart
                        data={g9Data}
                        figureNumber="Figure G-9"
                        caption="What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Most Critical Data Type
                    </h4>
                    <p>
                      When asked what data is most critical for narrowing uncertainty, the clear winner (29 votes) was &ldquo;Site-specific toxicity testing data to develop more relevant priors...&rdquo;
                    </p>
                    {/* Chart G-10 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportBarChart
                        data={g10Data}
                        figureNumber="Figure G-10"
                        caption="In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Biggest Practical Hurdle
                    </h4>
                    <p>
                      The most significant hurdle (26 votes) was identified as &ldquo;Defining appropriate priors, especially when site-specific information is sparse...&rdquo;
                    </p>
                    {/* Chart G-11 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportBarChart
                        data={g11Data}
                        figureNumber="Figure G-11"
                        caption="What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?"
                      />
                    </div>
                  </div>
                </div>
              </div>
          </div>

          {/* 3.3 Prioritization Framework */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.3 Prioritization Framework
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
                <p>
                  The final set of polls focused on prioritizing specific actions to guide the modernization effort.
                </p>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Incorporating Bioavailability
                    </h4>
                    <p>
                      This was seen as overwhelmingly important, with 57 of 63 participants rating it &ldquo;Very Important&rdquo; or &ldquo;Important&rdquo;. Feasibility was more divided, with &ldquo;Moderately Achievable&rdquo; (25 votes) being the most common response.
                    </p>
                    {/* Charts G-12 and G-13 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g12Data}
                          figureNumber="Figure G-12"
                          caption="Rank the importance of incorporating bioavailability adjustments into sediment standards."
                        />
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6">
                        <ReportBarChart
                          data={g13Data}
                          figureNumber="Figure G-13"
                          caption="Rank the feasibility of incorporating bioavailability adjustments into sediment standards."
                        />
                      </div>
                    </div>
                    {/* Matrix Chart G-23 */}
                    <div className="my-6">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Matrix Analysis:</strong> Site-Specific Standards (Bioavailability) showed the most division. While importance was universally high, responses were split almost evenly between the &ldquo;High Priority Near-Term&rdquo; (Top-Right) and &ldquo;High Priority Longer-Term&rdquo; (Top-Left) quadrants. This indicates significant expert debate on the current feasibility of implementing bioavailability adjustments.
                      </p>
                      <CEWMatrixChart
                        figureNumber="G-23"
                        titleMatch="Site-Specific Standards"
                        title="Site-Specific Standards (Bioavailability)"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Top Priority for Improving Matrix Standards (Ranking)
                    </h4>
                    <p>
                      The clear top priority (1.6 avg. rank) was to &ldquo;Distinguish &apos;direct toxicity&apos; and &apos;food pathway toxicity&apos; pathways explicitly.&rdquo;
                    </p>
                    {/* Chart G-14 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportBarChart
                        data={g14Data}
                        figureNumber="Figure G-14"
                        caption="To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority)."
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Top Focus for Holistic Management (Ranking)
                    </h4>
                    <p>
                      The top-ranked focus (2.0 avg. rank) was to &ldquo;Push guidance beyond generic numerical standards. Apply models and other technical tools to help develop Site-Specific Sediment Standards (Tier 2)...&rdquo;
                    </p>
                    {/* Chart G-15 */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportBarChart
                        data={g15Data}
                        figureNumber="Figure G-15"
                        caption="Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      Greatest Barrier to Advancing Protection
                    </h4>
                    <p>
                      A word cloud poll (45 responses) identified the greatest constraint to advancing holistic sediment protection. The most common response by a large margin was &ldquo;resourcing&rdquo; (26 responses), followed by &ldquo;agreement&rdquo; (8 responses) and &ldquo;prescription&rdquo; (4 responses).
                    </p>
                    {/* Informational Note: Word Cloud Poll Methodology */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4 my-6">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-gray-900 dark:text-blue-200">
                            <strong>Note:</strong> Participants were asked to identify the greatest constraint to advancing holistic sediment protection in BC through a word cloud poll. The word cloud visualization (where word size corresponds to frequency) showed &ldquo;resourcing&rdquo; as the most common response. See Figure G-18 below for exact word frequencies.
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Chart G-18: Word frequency bar chart */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6">
                      <ReportWordCloudChart
                        data={g18Data}
                        figureNumber="Figure G-18"
                        caption="Overall, what is the greatest constraint to advancing holistic sediment protection in BC? (Word frequency)"
                      />
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </section>

        {/* 5.0 Panel Discussion: Weaving Indigenous Knowledges */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            5.0 Panel Discussion: Weaving Indigenous Knowledges
          </h2>
          
          {/* Introduction/Context */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                This session explored the &ldquo;how&rdquo; and &ldquo;why&rdquo; of braiding Indigenous wisdom with Western science. The session was framed by two key presentations:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>A foundational vision (the &apos;why&apos;) from Dr. Shannon Waters (Indigenous person and Deputy Provincial Health Officer (PHO) in BC for water and planetary health), who spoke to the importance of &ldquo;Two-Eyed Seeing&rdquo; and recognizing waters and lands as kin.</li>
                <li>A tangible example (the &apos;how&apos;) from Anuradha Rao and Melany Sanchez Solano (Tsleil-Waututh Nation), who detailed the Nation-led, government-to-government process of developing the Burrard Inlet Water Quality Objectives to protect cultural practices.</li>
              </ul>
              <p>
                Following the presentations, the three speakers participated in a panel discussion. Key questions and themes from the discussion are summarized below.
              </p>
            </div>
          </div>

          {/* On the Legal Status of Water Quality Objectives */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              On the Legal Status of Water Quality Objectives
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                <strong>Audience Question:</strong> What are your concerns regarding the fact that the Burrard Inlet Water Quality Objectives are not legally binding?
              </p>
              <p>
                <strong>Panel Response:</strong> Dr. Shannon Waters clarified that the Water Quality Objectives are binding in Tsleil-Waututh Nation (TWN) law, which describes how to live and protect the environment as part of daily life. Anu Rao added that TWN is actively developing policy on how to &ldquo;mesh colonial and TWN law&rdquo; for work in the Inlet.
              </p>
            </div>
          </div>

          {/* On Reflecting Indigenous Values in Standards */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              On Reflecting Indigenous Values in Standards
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                <strong>Moderator Question:</strong> What&apos;s one key way sediment standards could better reflect Indigenous values, cultural uses, or community health needs?
              </p>
              <p>
                <strong>Panel Response:</strong> The panel emphasized treating the environment as a food source for future generations. This requires a shift in thinking toward &ldquo;net environmental gain&rdquo; and a goal of &ldquo;No new inputs of contamination into Mother Earth&rdquo;.
              </p>
            </div>
          </div>

          {/* On Challenges of Braiding Knowledge */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              On Challenges of Braiding Knowledge
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                <strong>Moderator Question:</strong> From your experience, what&apos;s a key lesson—or challenge—you&apos;ve faced when bringing Indigenous knowledge into Western scientific processes?
              </p>
              <p>
                <strong>Panel Response:</strong> Dr. Waters noted a key challenge is moving beyond component-based protection (e.g., pipes, source water) to a &ldquo;holistic watershed level&rdquo; perspective, which is inherent in Indigenous Knowledge systems.
              </p>
            </div>
          </div>

          {/* Final Thoughts */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Final Thoughts
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                The panel&apos;s final thoughts centered on the foundational concept that in many First Nations languages, &ldquo;Landscape = Kin&rdquo;. This perspective reframes environmental protection: &ldquo;How we care about the environment should be how we care about our family&rdquo;.
              </p>
            </div>
          </div>
        </section>

        {/* 6.0 Conclusion and Next Steps */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              6.0 Conclusion and Next Steps
            </h2>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                The CEW session validated the proposed direction with strong expert consensus: modernize standards to be holistic, protecting both human and ecological health, including direct and food-pathway toxicity.
              </p>
              <p>
                Polling and matrix analyses prioritized distinguishing toxicity pathways and advancing site-specific (Tier 2) tools. The primary barrier is resourcing, not lack of agreement.
              </p>
              <p>
                Nuanced feedback on feasibility (bioavailability and human health standards) highlights key scientific and practical challenges for the next phase. Combined with public survey results, this provides a robust foundation for the modernized framework.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

