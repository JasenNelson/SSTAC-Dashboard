import Link from 'next/link';
import ThemeToggle from '../ThemeToggle';
import type { Session } from '@supabase/supabase-js';

interface UserControlsProps {
  session: Session | null;
  isAdmin: boolean;
  onLogout: () => void;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
}

export function UserControls({
  session,
  isAdmin,
  onLogout,
  isMobileMenuOpen,
  onToggleMobileMenu
}: UserControlsProps) {
  if (!session) {
    return (
      <div className="flex items-center space-x-3">
        <Link
          href="/signup"
          className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-600 rounded-md hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Sign Up
        </Link>
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:flex items-center space-x-3">
        {isAdmin && (
          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
            Admin
          </div>
        )}
        <ThemeToggle />
        <button
          onClick={onLogout}
          className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          Logout
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleMobileMenu}
        className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-navigation-menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {isMobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>
    </>
  );
}

