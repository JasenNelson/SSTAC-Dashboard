import Link from 'next/link';
import ThemeToggle from '../ThemeToggle';
import { MENU_CATEGORIES, type MenuLink } from './menuConfig';

interface MobileNavigationProps {
  isOpen: boolean;
  menuLinks: MenuLink[];
  isAdmin: boolean;
  onClose: () => void;
  onLogout: () => void;
  isActiveLink: (href: string) => boolean;
}

export function MobileNavigation({
  isOpen,
  menuLinks,
  isAdmin,
  onClose,
  onLogout,
  isActiveLink
}: MobileNavigationProps) {
  if (!isOpen) {
    return null;
  }

  const handleLinkClick = () => {
    onClose();
  };

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <div
      id="mobile-navigation-menu"
      className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4"
    >
      <nav className="space-y-1">
        {MENU_CATEGORIES.map((category) => (
          <div key={category}>
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
              {category}
            </div>
            {menuLinks
              .filter((link) => link.category === category)
              .map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActiveLink(link.href)
                      ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="mr-3">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
          </div>
        ))}

        {isAdmin && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/admin"
              onClick={handleLinkClick}
              className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                isActiveLink('/admin')
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Admin
            </Link>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          {isAdmin && (
            <div className="px-3 py-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                Admin
              </span>
            </div>
          )}

          <div className="px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
              <ThemeToggle />
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            Logout
          </button>
        </div>
      </nav>
    </div>
  );
}

