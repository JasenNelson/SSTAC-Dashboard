'use client';

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import ProjectPhases from "@/components/dashboard/ProjectPhases";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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
              Active workstreams: Matrix Sediment Standards Derivation Options and BN-RRM implementation.
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
                      The Science & Standards Technical Advisory Committee (SSTAC) is leading the Sediment Standards Project, which integrates best-available science to protect aquatic ecosystems and the communities that depend on them.
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <a
            href="/dashboard"
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
          </a>

          <a
            href="/survey-results"
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
          </a>

          <a
            href="/cew-2025"
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
          </a>
        </div>


        {/* Audit #18: the "Get Involved" authentication box that used to sit here has moved
            into the header. Sign-in was the only way into the authenticated app and it was
            below the fold, after every content card. */}
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>&copy; 2025 SSTAC & TWG Dashboard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
