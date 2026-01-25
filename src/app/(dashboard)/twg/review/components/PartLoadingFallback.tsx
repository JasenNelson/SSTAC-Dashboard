'use client'

export function PartLoadingFallback() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-full mb-4 animate-pulse">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">Loading form section...</p>
      </div>
    </div>
  )
}
