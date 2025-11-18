// src/app/(dashboard)/twg-results/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ReportBarChart from '@/components/charts/ReportBarChart';
import ReportGroupedBarChart from '@/components/charts/ReportGroupedBarChart';
import {
  j1Data, j2Data, j3Data, j4Data, j5Data, j6Data, j7Data, j8Data, j9Data, j10Data
} from '@/lib/chart_data';

export default async function TwgResultsPage() {
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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              TWG White Paper Review: What We Heard
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 1.0 Executive Summary */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              1.0 Executive Summary
            </h2>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                A review of the Modernizing BC Sediment Quality Standards v2.5 draft report (the &ldquo;White Paper&rdquo;) was completed by a 29-member Technical Working Group (TWG) drawn from industry, consulting, government, academia, and Indigenous organizations. Overall, the TWG&apos;s feedback was highly positive. The report was rated &ldquo;Excellent&rdquo; or &ldquo;Good&rdquo; for Clarity, Completeness, and Defensibility by a strong majority of reviewers.
              </p>
              
              <p className="font-semibold">Key recommendations:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Strengthen Indigenous Integration:</strong> Add policy rationale, clarify policy implications, correct structural errors</li>
                <li><strong>Address Implementation Feasibility:</strong> Address lab capacity limitations and method standardization needs</li>
                <li><strong>Improve Clarity:</strong> Reduce repetition, professional edit needed</li>
                <li><strong>Soften Language:</strong> Change definitive language to recommendations</li>
                <li><strong>Refine Technical Details:</strong> Strengthen citations, clarify EQG vs RA distinction, refine terminology</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 2.0 Methodology & Reviewer Profile */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              2.0 Methodology & Reviewer Profile
            </h2>
            
            {/* 2.1 Methodology */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                2.1 Methodology
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  Online review form circulated to 29 TWG members in two phases (Oct 8 - Nov 7, 2025; Nov 13 - Dec 1, 2025). Mix of quantitative and qualitative questions. This report summarizes all 29 submissions.
                </p>
              </div>
            </div>

            {/* 2.2 Reviewer Area of Expertise */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                2.2 Reviewer Area of Expertise
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
                <p>
                  The review was conducted by a diverse group of 29 experts, with many identifying multiple areas of expertise. The primary areas were Ecotoxicology, Ecological Risk Assessment (ERA), and Environmental Chemistry, ensuring a robust technical review.
                </p>
              </div>
              {/* Chart J-1 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j1Data}
                  figureNumber="Figure J-1"
                  caption="Reviewer Area of Expertise"
                />
              </div>
            </div>

            {/* 2.3 Overall Report Ratings */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                2.3 Overall Report Ratings
              </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
              <p>
                The report was rated highly: 83% rated Clarity as &ldquo;Excellent&rdquo; or &ldquo;Good,&rdquo; 83% for Completeness, and 78% for Defensibility.
              </p>
            </div>
              {/* Chart J-2 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportGroupedBarChart
                  data={j2Data}
                  figureNumber="Figure J-2"
                  caption="Overall Report Ratings"
                  title="Report ratings for Clarity, Completeness, and Defensibility"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3.0 Quantitative Findings: Strategic Priorities */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              3.0 Quantitative Findings: Strategic Priorities
            </h2>
            
            {/* 3.1 Top Priority for Modernization */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.1 Top Priority for Modernization
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  TWG members ranked their #1 priority for modernization. Matrix Sediment Standards Framework (Ecological Protection) is the top priority, followed by site-specific sediment standards and Human Health Protection standards.
                </p>
              </div>
              {/* Chart J-3 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j3Data}
                  figureNumber="Figure J-3"
                  caption="Top Priority for Framework Modernization"
                />
              </div>
            </div>

            {/* 3.2 Top Priority for Future Research */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.2 Top Priority for Future Research
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  Top research priority: building a comprehensive, open-access database for BC, followed by climate change impacts on toxicity. This supports the &ldquo;Phase 1: Desktop Data Compilation&rdquo; proposed in Section VII.
                </p>
              </div>
              {/* Chart J-4 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j4Data}
                  figureNumber="Figure J-4"
                  caption="Top Priority for Future Research"
                />
              </div>
            </div>

            {/* 3.3 Priority Contaminants */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.3 Priority Contaminants
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For matrix standards protecting the food pathway, Mercury and its compounds and PFAS were the clear top priorities.
                </p>
              </div>
              {/* Chart J-5 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j5Data}
                  figureNumber="Figure J-5"
                  caption="Top Priority Contaminant for Standardization"
                />
              </div>
            </div>

            {/* 3.4 Priority Lines of Evidence */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.4 Priority Lines of Evidence
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For Tier 2 guidance, Bioavailability / Geochemical Adjustments (TOC, AVS/SEM) was ranked as the top priority line of evidence.
                </p>
              </div>
              {/* Chart J-6 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j6Data}
                  figureNumber="Figure J-6"
                  caption="Top Priority Line of Evidence (Tier 2)"
                />
              </div>
            </div>

            {/* 3.5 Preferred Bioavailability Methods */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.5 Preferred Bioavailability Methods
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For bioavailability methods, Normalization using Total Organic Carbon (TOC) was selected most frequently.
                </p>
              </div>
              {/* Chart J-7 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j7Data}
                  figureNumber="Figure J-7"
                  caption="Preferred Bioavailability Method"
                />
              </div>
            </div>

            {/* 3.6 Selected "Tier 0" Approaches */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.6 Selected &ldquo;Tier 0&rdquo; Approaches
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For &ldquo;Tier 0&rdquo; (Background/Anti-Degradation) screening, the most selected approach was establishing baseline sediment quality conditions for reference.
                </p>
              </div>
              {/* Chart J-8 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j8Data}
                  figureNumber="Figure J-8"
                  caption="Selected 'Tier 0' Anti-Degradation Approaches"
                />
              </div>
            </div>

            {/* 3.7 Selected Framework Elements */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.7 Selected Framework Elements
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For new framework elements, developing a risk-based scientific framework for numerical sediment standards was the top-selected option.
                </p>
              </div>
              {/* Chart J-9 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j9Data}
                  figureNumber="Figure J-9"
                  caption="Selected Framework Elements"
                />
              </div>
            </div>

            {/* 3.8 Selected Desktop Study Components */}
            <div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
                3.8 Selected Desktop Study Components
              </h3>
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                <p>
                  For the desktop data study, top-selected components were: desktop review of regional/watershed-specific sediment data, compiling reports on sediment contamination in Indigenous territories, and identifying data gaps and priority areas.
                </p>
              </div>
              {/* Chart J-10 */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
                <ReportBarChart
                  data={j10Data}
                  figureNumber="Figure J-10"
                  caption="Selected Desktop Study Components"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4.0 Detailed Qualitative Feedback & Synthesis */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            4.0 Detailed Qualitative Feedback & Synthesis
          </h2>
          
          {/* Introduction */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-6">
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
              <p>
                The qualitative feedback was extensive and highly constructive. The following is a synthesis of key themes from all open-ended comments.
              </p>
            </div>
          </div>
          
          {/* 4.1 Overall Report Structure and Clarity */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              4.1 Overall Report Structure and Clarity
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">The Good:</h4>
              <p>
                The report is &ldquo;excellent and covers all the main points,&rdquo; &ldquo;well thought out,&rdquo; and a &ldquo;long-overdue&rdquo; effort.
              </p>
              
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">The Bad:</h4>
              <p>
                Several reviewers noted significant repetition in the Introduction (Sections I.A, I.B, I.C). The language was also described as having a &ldquo;ChatGPT feel&rdquo; and would benefit from a &ldquo;strong edit&rdquo; to be more concise.
              </p>
            </div>
          </div>

          {/* 4.2 Integration of Indigenous Knowledge (IK) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              4.2 Integration of Indigenous Knowledge (IK)
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                This was a major theme across multiple reviews.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Gap in Rationale:</strong> Reviewers noted that the report states what it will do (integrate IK) but not why. It&apos;s missing the critical policy and legal rationale (e.g., BC&apos;s DRIPA, UNDRIP, and the creation of Dr. Shannon Waters&apos; PHO position).
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Overstated Claims:</strong> One reviewer felt the Executive Summary overstates the integration of IK, noting the rest of the document doesn&apos;t yet support this strong claim.
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Policy & Jurisdictional Questions:</strong> A key policy question was raised about how the proposal to include Indigenous traditional food consumption in provincial standards will align or conflict with Health Canada&apos;s guidance, which typically requires a separate, detailed quantitative risk assessment (DQRA).
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Structural Error:</strong> A critical error was identified: &ldquo;First Nations are not &apos;Canadian Jurisdictions&apos;&rdquo; and must be moved out of Section III.B.
                </p>
              </div>
            </div>
          </div>

          {/* 4.3 Implementation, Feasibility, and Lab Capacity */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              4.3 Implementation, Feasibility, and Lab Capacity
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <p>
                This was the most prominent technical concern, led by feedback from laboratory experts.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Laboratory Capacity:</strong> The report is too optimistic about current lab capabilities. A reviewer explicitly stated that &ldquo;Current laboratory capacity for chronic toxicity testing is limited, especially in BC.&rdquo;
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Method Standardization:</strong> The report must more strongly emphasize the need for standardization. The same reviewer noted that &ldquo;Passive sampling... [is] not a widely used analytical technique for regulatory purposes&rdquo; and that &ldquo;eDNA... results tended to vary widely&rdquo; between labs. This poses a &ldquo;lab shopping&rdquo; risk.
                </p>
              </div>
            </div>
          </div>

          {/* 4.4 Scientific Framework & Risk Assessment */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-600">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
              4.4 Scientific Framework & Risk Assessment
            </h3>
            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>EQG vs. RA:</strong> A key clarification is needed to define when the report is discussing Environmental Quality Guidelines (EQGs) (i.e., Tier 1 numbers) versus a Risk Assessment (RA) framework (i.e., Tiers 2/3).
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Strengthen Rationale:</strong> The report&apos;s rationale for food-web transfer is good but can be much stronger. One reviewer provided a list of specific peer-reviewed papers (e.g., Alava et al., McTavish et al.) to add to Section I.B to better support the risks to apex predators in BC.
                </p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 my-4">
                <p>
                  <strong>Acknowledge Uncertainty:</strong> A reviewer noted that the report should acknowledge the limitations of SSDs, which can lose the uncertainty data from the original NOEC/LOEC studies.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

