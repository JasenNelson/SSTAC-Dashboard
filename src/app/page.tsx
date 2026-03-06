'use client';

import ThemeToggle from "@/components/ThemeToggle";
import ProjectPhases from "@/components/dashboard/ProjectPhases";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="text-xl font-bold text-slate-900 dark:text-white">SSTAC & TWG Dashboard</div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              Sediment Standards Project
            </h1>
            <p className="text-xl text-sky-200 max-w-4xl mx-auto leading-relaxed mb-8">
              Developing a modern, robust scientific framework for updating BC&apos;s Contaminated Sites Regulation sediment standards
            </p>
            <div className="inline-flex items-center px-6 py-3 bg-slate-200/90 dark:bg-slate-300/90 backdrop-blur-sm rounded-full border border-white/30 dark:border-slate-600/30 shadow-lg">
              <span className="text-slate-900 text-sm font-semibold phase-1-text">
                🎯 Phase 1: Scientific Framework Development
              </span>
            </div>
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
              <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
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
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
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
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">CEW 2025</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Canadian Ecotoxicity Workshop session details
            </p>
          </a>
        </div>


        {/* Authentication Section */}
        <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl shadow-sm p-8 text-center">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Get Involved
          </h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            Join the conversation and contribute to modernizing BC&apos;s sediment standards
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/signup"
              className="px-6 py-3 bg-sky-700 text-white rounded-lg hover:bg-sky-800 transition-colors font-medium"
            >
              Create Account
            </a>
            <a
              href="/login"
              className="px-6 py-3 bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-400 border border-sky-700 dark:border-sky-400 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Log In
            </a>
          </div>
        </div>
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
