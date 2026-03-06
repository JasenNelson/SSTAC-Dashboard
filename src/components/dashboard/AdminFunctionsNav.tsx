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
      <div className="rounded-2xl border border-sky-100/60 dark:border-sky-500/30 bg-white/85 backdrop-blur-sm dark:bg-slate-950/60 shadow-md">
        <div className="p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-sky-900 dark:text-sky-100 mb-3">
            Admin Quick Links
          </h2>
          <div className="flex flex-wrap gap-3">
            {adminNavItems.map(({ href, label }) => {
              const isActive = pathname === href
              const baseClasses =
                'px-4 py-2 text-sm font-medium rounded-md transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
              const activeClasses =
                'text-white bg-sky-700 hover:bg-sky-800 border-sky-700 focus-visible:ring-offset-sky-800'
              const inactiveClasses =
                'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200/80 dark:text-sky-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/70 dark:border-sky-500/30'

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

