// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import ThemeToggle from './ThemeToggle';
import { MENU_LINKS, MENU_CATEGORIES } from './header/menuConfig';

export default function Header() {
  const { session, isLoading: authLoading, signOut } = useAuth();
  const { isAdmin, clearAdminStatus } = useAdmin();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Close desktop menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDesktopMenuOpen) {
        const target = event.target as Element;
        if (!target.closest('[data-desktop-menu]')) {
          setIsDesktopMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDesktopMenuOpen]);

  // Handle protected route redirects when session is lost
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025', '/bn-rrm'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (!isProtectedRoute) return; // Not a protected route, no action needed

    let timeoutId: NodeJS.Timeout | null = null;

    // If auth is still loading, set a timeout fallback to prevent indefinite waiting
    // This ensures we don't wait forever if auth loading gets stuck
    if (authLoading) {
      // Set a 5-second timeout fallback
      timeoutId = setTimeout(() => {
        // After 5 seconds, if still loading and no session, redirect to login
        // This handles edge cases where auth loading might hang
        if (!session) {
          const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
          router.push(loginUrl);
        }
      }, 5000);

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }

    // Auth loading is complete - add a small delay to ensure session state is stable
    // This prevents race conditions where authLoading becomes false before session is set
    const checkDelay = setTimeout(() => {
      if (!session) {
        const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
        router.push(loginUrl);
      }
    }, 100); // Small delay to allow session state to stabilize

    return () => {
      clearTimeout(checkDelay);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [session, authLoading, pathname, router]);

  const handleLogout = useCallback(async () => {
    try {
      // Clear admin status backup before signing out
      await clearAdminStatus();
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, try to clear admin status and redirect to login
      try {
        await clearAdminStatus();
      } catch (clearError) {
        console.error('❌ Error clearing admin status:', clearError);
      }
      router.push('/login');
    }
  }, [signOut, clearAdminStatus, router]);

  // Navigation links for authenticated users - removed direct links, now handled by menu
  // This array is kept for potential future use but is currently unused
  interface NavigationLink {
    href: string;
    label: string;
    icon: React.ReactNode;
  }
  const navigationLinks: NavigationLink[] = [];

  // Use menu links from menuConfig.ts
  const allMenuLinks = MENU_LINKS;

  // Admin-only navigation links - simplified to single dashboard link
  // Individual admin pages are accessed through the main admin dashboard

  // Helper function to check if a link is active
  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Don't block the entire UI during loading - always show logout option
  if (authLoading && !session) {
    return (
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              <div className="text-center">
                <div className="leading-tight">SSTAC & TWG</div>
                <div className="text-sm sm:text-lg leading-tight">Dashboard</div>
              </div>
            </div>
            <div className="text-slate-500">Loading...</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white hover:text-sky-700 dark:hover:text-sky-400 transition-colors">
              <div className="text-center">
                <div className="leading-tight">SSTAC & TWG</div>
                <div className="text-sm sm:text-lg leading-tight">Dashboard</div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          {session && (
            <nav className="hidden md:flex items-center space-x-1">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActiveLink(link.href)
                      ? 'bg-sky-100 text-sky-700'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              
              {/* Admin Link */}
              {isAdmin && (
                <div className="ml-4 pl-4 border-l border-slate-300">
                  <Link
                    href="/admin"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActiveLink('/admin')
                        ? 'bg-green-100 text-green-700'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Admin
                  </Link>
                </div>
              )}

              {/* Desktop Menu Button */}
              <div className="relative ml-4" data-desktop-menu>
                <button
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  aria-expanded={isDesktopMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                >
                  <span className="mr-2" aria-hidden="true">☰</span>
                  Menu
                </button>

                {/* Desktop Dropdown Menu */}
                {isDesktopMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-slate-600 z-50">
                    <div className="py-1 max-h-96 overflow-y-auto">
                      {MENU_CATEGORIES.map((category) => (
                        <div key={category}>
                          <div className="px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">
                            {category}
                          </div>
                          {allMenuLinks
                            .filter(link => link.category === category)
                            .map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsDesktopMenuOpen(false)}
                                className={`block px-4 py-2 text-sm transition-colors ${
                                  (link as { parent?: boolean }).parent
                                    ? 'pl-8 text-slate-500 dark:text-slate-400'
                                    : ''
                                } ${
                                  isActiveLink(link.href)
                                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
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
          )}

          {/* User Menu & Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                {/* User Info */}
                <div className="hidden md:flex items-center space-x-3">
                  {isAdmin && (
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                      Admin
                    </div>
                  )}
                  
                  {/* Theme Toggle */}
                  <ThemeToggle />
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  >
                    Logout
                  </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-expanded={isMobileMenuOpen}
                  aria-label="Toggle navigation menu"
                  className="md:hidden p-2 rounded-md text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    {isMobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/signup"
                  className="px-4 py-2 text-sm font-medium text-sky-700 bg-white border border-sky-700 rounded-md hover:bg-sky-50 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-sky-700 rounded-md hover:bg-sky-800 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {session && isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-700 py-4">
            <nav className="space-y-1">
              {MENU_CATEGORIES.map((category) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-700">
                    {category}
                  </div>
                  {allMenuLinks
                    .filter(link => link.category === category)
                    .map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                          (link as { parent?: boolean }).parent
                            ? 'pl-8 text-slate-500 dark:text-slate-400'
                            : ''
                        } ${
                          isActiveLink(link.href)
                            ? 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300'
                            : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className="mr-3">{link.icon}</span>
                        {link.label}
                      </Link>
                    ))}
                </div>
              ))}
              
              {/* Admin Link */}
              {isAdmin && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActiveLink('/admin')
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                        : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Admin
                  </Link>
                </div>
              )}
              
              {/* User Info & Logout for All Users */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                {isAdmin && (
                  <div className="px-3 py-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                      Admin
                    </span>
                  </div>
                )}
                
                {/* Theme Toggle for Mobile */}
                <div className="px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
