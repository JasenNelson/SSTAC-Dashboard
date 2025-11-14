import Link from 'next/link';
import { MutableRefObject } from 'react';
import { MENU_CATEGORIES, type MenuLink } from './menuConfig';

interface DesktopNavigationProps {
  menuLinks: MenuLink[];
  isAdmin: boolean;
  isDesktopMenuOpen: boolean;
  onToggleMenu: () => void;
  onSelectLink: () => void;
  isActiveLink: (href: string) => boolean;
  menuRef: MutableRefObject<HTMLDivElement | null>;
}

export function DesktopNavigation({
  menuLinks,
  isAdmin,
  isDesktopMenuOpen,
  onToggleMenu,
  onSelectLink,
  isActiveLink,
  menuRef
}: DesktopNavigationProps) {
  return (
    <nav className="hidden md:flex items-center space-x-1">
      {isAdmin && (
        <Link
          href="/admin"
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActiveLink('/admin')
              ? 'bg-green-100 text-green-700'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
          }`}
        >
          Admin
        </Link>
      )}

      <div className="relative ml-4" ref={menuRef}>
        <button
          type="button"
          onClick={onToggleMenu}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-haspopup="true"
          aria-expanded={isDesktopMenuOpen}
        >
          <span className="mr-2">☰</span>
          Menu
        </button>

        {isDesktopMenuOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 z-50">
            <div className="py-1 max-h-96 overflow-y-auto">
              {MENU_CATEGORIES.map((category) => (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                    {category}
                  </div>
                  {menuLinks
                    .filter((link) => link.category === category)
                    .map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={onSelectLink}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          isActiveLink(link.href)
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="mr-3">{link.icon}</span>
                        {link.label}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

