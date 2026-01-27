'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  partNumber?: number
}

interface State {
  hasError: boolean
  error?: Error
}

export class PartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Part component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Error Loading Form Section
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {this.props.partNumber ? `Part ${this.props.partNumber} failed to load.` : 'Failed to load form section.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
