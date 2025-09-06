'use client';

import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import ProjectPhases from "@/components/dashboard/ProjectPhases";
import ThemeTest from "@/components/ThemeTest";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="text-xl font-bold text-gray-900 dark:text-white">SSTAC & TWG Dashboard</div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
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
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
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
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <a
            href="/dashboard"
            className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Dashboard</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Access project overview, documents, and key metrics
            </p>
          </a>

          <a
            href="/survey-results"
            className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Survey Results</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Explore stakeholder feedback and survey findings
            </p>
          </a>

          <a
            href="/cew-2025"
            className="group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:-translate-y-2"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">CEW 2025</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Canadian Ecotoxicity Workshop session details
            </p>
          </a>
        </div>

        {/* Theme Test Section */}
        <ThemeTest />

        {/* Authentication Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Get Involved
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Join the conversation and contribute to modernizing BC's sediment standards
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/signup"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Account
            </a>
            <a
              href="/login"
              className="px-6 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Log In
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p>&copy; 2025 SSTAC & TWG Dashboard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
