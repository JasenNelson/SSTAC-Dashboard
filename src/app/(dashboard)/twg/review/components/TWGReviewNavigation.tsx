'use client'

import type { PhaseKey, ReviewSection } from '../types'

interface TWGReviewNavigationProps {
  phaseGroups: Record<PhaseKey, ReviewSection[]>
  phaseOrder: PhaseKey[]
  phaseMeta: Record<PhaseKey, { label: string; date: string }>
  currentSection: number
  completedSections: number[]
  isDarkMode: boolean
  isMobileMenuOpen: boolean
  isSaving: boolean
  saveMessage: string
  openPhases: Record<PhaseKey, boolean>
  onSelectSection: (sectionId: number) => void
  onTogglePhase: (phase: PhaseKey) => void
  onToggleMobileMenu: (open: boolean) => void
  onSaveProgress: () => void
}

export function TWGReviewNavigation({
  phaseGroups,
  phaseOrder,
  phaseMeta,
  currentSection,
  completedSections,
  isDarkMode,
  isMobileMenuOpen,
  isSaving,
  saveMessage,
  openPhases,
  onSelectSection,
  onTogglePhase,
  onToggleMobileMenu,
  onSaveProgress,
}: TWGReviewNavigationProps) {
  const lightSidebarBg = 'bg-[#e6f4ff]'
  const lightPanelBg = 'bg-white'

  return (
    <>
      {/* Desktop Navigation Sidebar */}
      <div className={`hidden lg:block w-80 ${isDarkMode ? 'bg-gray-800' : lightSidebarBg} shadow-lg border-r border-gray-200 dark:border-gray-700`}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            TWG Review
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Modernizing BC&apos;s Sediment Standards
          </p>

          <nav className="space-y-4">
            {phaseOrder.map((phase) => {
              const groupSections = phaseGroups[phase]
              if (!groupSections.length) return null
              const meta = phaseMeta[phase]
              const isOpen = openPhases[phase]
              return (
                <div key={phase} className={`rounded-lg ${isDarkMode ? 'bg-gray-900/20' : lightPanelBg} shadow-sm border border-blue-100`}>
                  <button
                    type="button"
                    onClick={() => onTogglePhase(phase)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold italic text-red-600 dark:text-red-400 tracking-wide"
                  >
                    <span>{`${meta.label} — ${meta.date}`}</span>
                    <span className="text-lg text-gray-700 dark:text-gray-200">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-1 pb-3 space-y-2">
                      {groupSections.map((section) => {
                        const isActive = currentSection === section.id
                        const textColor = isDarkMode
                          ? isActive
                            ? '#60A5FA'
                            : '#D1D5DB'
                          : '#000000'
                        return (
                          <button
                            key={section.id}
                            onClick={() => {
                              onSelectSection(section.id)
                              onToggleMobileMenu(false)
                            }}
                            className={`w-full text-left p-3 rounded-lg transition-colors ${
                              isActive
                                ? `${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`
                                : `${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium" style={{ color: textColor }}>
                                  Part {section.id}
                                </div>
                                <div
                                  className="text-sm"
                                  style={{
                                    color: textColor,
                                    opacity: isActive ? 1 : 0.75
                                  }}
                                >
                                  {section.title}
                                </div>
                              </div>
                              {completedSections.includes(section.id) && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </div>

        {/* Save Progress Button */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onSaveProgress}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Progress'}
          </button>

          {saveMessage && (
            <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMessage}
            </p>
          )}
        </div>
      </div>

      {/* Mobile Navigation Header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">TWG Review</h1>
          </div>
          <button
            onClick={() => onToggleMobileMenu(!isMobileMenuOpen)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => onToggleMobileMenu(false)}>
          <div className={`fixed inset-y-0 left-0 w-80 ${isDarkMode ? 'bg-gray-800' : lightSidebarBg} shadow-xl`} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Navigation</h2>
                <button
                  onClick={() => onToggleMobileMenu(false)}
                  className="text-gray-600 dark:text-gray-300"
                >
                  <span className="sr-only">Close menu</span>
                  ✕
                </button>
              </div>
              <nav className="space-y-4">
                {phaseOrder.map((phase) => {
                  const groupSections = phaseGroups[phase]
                  if (!groupSections.length) return null
                  const meta = phaseMeta[phase]
                  const isOpen = openPhases[phase]
                  return (
                    <div key={phase} className={`rounded-lg ${isDarkMode ? 'bg-gray-900/20' : lightPanelBg} shadow-sm border border-blue-100`}>
                      <button
                        type="button"
                        onClick={() => onTogglePhase(phase)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold italic text-red-600 dark:text-red-400 tracking-wide"
                      >
                        <span>{`${meta.label} — ${meta.date}`}</span>
                        <span className="text-lg text-gray-700 dark:text-gray-200">{isOpen ? '−' : '+'}</span>
                      </button>
                      {isOpen && (
                        <div className="px-1 pb-3 space-y-2">
                          {groupSections.map((section) => {
                            const isActive = currentSection === section.id
                            const textColor = isDarkMode
                              ? isActive
                                ? '#60A5FA'
                                : '#D1D5DB'
                              : '#000000'
                            return (
                              <button
                                key={section.id}
                                onClick={() => {
                                  onSelectSection(section.id)
                                  onToggleMobileMenu(false)
                                }}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${
                                  isActive
                                    ? `${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'}`
                                    : `${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-blue-50'}`
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium" style={{ color: textColor }}>
                                      Part {section.id}
                                    </div>
                                    <div
                                      className="text-sm"
                                      style={{
                                        color: textColor,
                                        opacity: isActive ? 1 : 0.75
                                      }}
                                    >
                                      {section.title}
                                    </div>
                                  </div>
                                  {completedSections.includes(section.id) && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>

              {/* Save Progress Button */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    onSaveProgress()
                    onToggleMobileMenu(false)
                  }}
                  disabled={isSaving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Progress'}
                </button>

                {saveMessage && (
                  <p className={`mt-2 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                    {saveMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
