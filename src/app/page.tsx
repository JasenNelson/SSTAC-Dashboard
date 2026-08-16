'use client';

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import ProjectPhases from "@/components/dashboard/ProjectPhases";

// Audit B2: single source of truth for the skip-link target. Both the anchor href and the
// <main> id derive from this, so they cannot drift apart.
const MAIN_CONTENT_ID = 'main-content';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Audit B2: skip link. First focusable element on the page, visually hidden until
          focused. Its href MUST stay in sync with the id on <main> below -- a skip link
          pointing at a missing target is worse than none, because it silently does nothing.
          A test resolves the href against the DOM and asserts it lands on the landmark. */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sky-700 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 h-16">
            {/* Audit #18: the title now shares a fixed h-16 row with two auth links and the
                theme toggle. `truncate` + `min-w-0` keep it from pushing them off a 375px
                viewport, and the type scale steps down below `sm` so the truncation is a
                fallback rather than the normal state. */}
            <div className="min-w-0 truncate text-base sm:text-xl font-bold text-slate-900 dark:text-white">
              SSTAC &amp; TWG Dashboard
            </div>
            <nav aria-label="Account" className="flex shrink-0 items-center gap-2">
              {/* Audit #18: sign-in was previously reachable only from a "Get Involved" box
                  at the very bottom of the page. Same sky-700 filled/outlined treatment as
                  that box, at header padding. */}
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-lg border border-sky-700 bg-white px-3 py-1.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50 dark:border-sky-400 dark:bg-slate-800 dark:text-sky-400 dark:hover:bg-slate-700"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex min-h-11 items-center rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-800"
              >
                Create Account
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none">
      {/* Hero Section */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-left max-w-4xl">
            <h1 className="text-5xl font-bold mb-4 text-slate-900 dark:text-white">
              Sediment Standards Project
            </h1>
            <p className="font-mono text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">
              Current Focus: Phase 2 -- Foundational Research and Framework Development (2026-2027)
            </p>
            <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
              Developing a modern, robust scientific framework for updating BC&apos;s Contaminated Sites Regulation sediment standards.
            </p>
            {/* Round-2 P1-1 restore: decision #10 authorised dropping the gradient and
                keeping the description short -- it did NOT authorise deleting the only
                public statement of the two active Phase 2 workstreams. Restored here in
                tightened form (one line, muted, below the lead) so both the Matrix
                Sediment Standards Derivation Options and BN-RRM stay identifiable. */}
            <p
              data-testid="landing-hero-workstreams"
              className="mt-3 text-base text-slate-500 dark:text-slate-400 leading-relaxed"
            >
              Active workstreams: Matrix Sediment Standards Derivation Options, and implementation of the
              BN-RRM (Bayesian Network Relative Risk Model).
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Project Context Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-8 mb-12 border border-slate-200 dark:border-slate-700">
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
                      The Science & Standards Technical Advisory Committee (SSTAC), working with the Technical
                      Working Group (TWG), is leading the Sediment Standards Project, which integrates
                      best-available science to protect aquatic ecosystems and the communities that depend on them.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Project Phases */}
              <ProjectPhases />
            </div>
          </div>
        </div>

        {/* Navigation Cards */}
        {/* Audit B3: the three card <h3>s had no owning <h2> anywhere above them, so the
            document outline jumped from the page <h1> straight to level 3. */}
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">
          Explore the Project
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Link
            href="/dashboard"
            prefetch={false}
            className="group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Access project overview, documents, and key metrics
            </p>
            {/* Audit B1: every one of these three destinations is behind the auth
                middleware (matcher lists /dashboard, /survey-results and /cew-2025), so a
                logged-out visitor clicking them was bounced to /login with no warning.
                Saying so up front is the whole fix. */}
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sign-in required
            </p>
          </Link>

          <Link
            href="/survey-results"
            prefetch={false}
            className="group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Survey Results</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Explore stakeholder feedback and survey findings
            </p>
            {/* Audit B1: every one of these three destinations is behind the auth
                middleware (matcher lists /dashboard, /survey-results and /cew-2025), so a
                logged-out visitor clicking them was bounced to /login with no warning.
                Saying so up front is the whole fix. */}
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sign-in required
            </p>
          </Link>

          <Link
            href="/cew-2025"
            prefetch={false}
            className="group bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">CEW 2025</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Canadian Ecotoxicity Workshop session details
            </p>
            {/* Audit B1: every one of these three destinations is behind the auth
                middleware (matcher lists /dashboard, /survey-results and /cew-2025), so a
                logged-out visitor clicking them was bounced to /login with no warning.
                Saying so up front is the whole fix. */}
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sign-in required
            </p>
          </Link>
        </div>


        {/* Audit #18: the "Get Involved" authentication box that used to sit here has moved
            into the header. Sign-in was the only way into the authenticated app and it was
            below the fold, after every content card. */}
      </div>

      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>
              {/* Audit B7a, owner decision D7 = option C: no year at all. The year was
                  hard-coded to 2025 and would have silently aged. Resolving it at render time
                  does not fix that on a statically prerendered page -- it bakes in the BUILD's
                  clock -- and resolving it after mount left no-JS readers and crawlers with no
                  year anyway. A copyright year carries no legal weight, so the honest and
                  simplest answer is to omit it for everyone. "All rights reserved" has had no
                  legal effect in any Berne Convention country for decades and went with it. */}
              &copy; SSTAC &amp; TWG Dashboard
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
