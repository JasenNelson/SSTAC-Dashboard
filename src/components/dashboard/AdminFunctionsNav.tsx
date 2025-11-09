'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'User Management' },
  { href: '/admin/tags', label: 'Tag Management' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/milestones', label: 'Milestones' },
  { href: '/admin/twg-synthesis', label: 'TWG Review' },
]

export default function AdminFunctionsNav() {
  const pathname = usePathname()

  return (
    <div className="mb-6">
      <div className="rounded-2xl border border-indigo-100/60 dark:border-indigo-500/30 bg-white/85 backdrop-blur-sm dark:bg-slate-950/60 shadow-md">
        <div className="p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 mb-3">
            Admin Quick Links
          </h2>
          <div className="flex flex-wrap gap-3">
            {adminNavItems.map(({ href, label }) => {
              const isActive = pathname === href
              const baseClasses =
                'px-4 py-2 text-sm font-medium rounded-md transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
              const activeClasses =
                'text-white bg-indigo-600 hover:bg-indigo-700 border-indigo-600 focus-visible:ring-offset-indigo-700'
              const inactiveClasses =
                'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/80 dark:text-indigo-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/70 dark:border-indigo-500/30'

              return (
                <Link
                  key={href}
                  href={href}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

