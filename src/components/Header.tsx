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
  const { isAdmin } = useAdmin();
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
    if (authLoading) return; // Don't redirect while loading

    const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (isProtectedRoute && !session) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.push(loginUrl);
    }
  }, [session, authLoading, pathname, router]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, redirect to login
      router.push('/login');
    }
  }, [signOut, router]);

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
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              <div className="text-center">
                <div className="leading-tight">SSTAC & TWG</div>
                <div className="text-sm sm:text-lg leading-tight">Dashboard</div>
              </div>
            </div>
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
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
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              
              {/* Admin Link */}
              {isAdmin && (
                <div className="ml-4 pl-4 border-l border-gray-300">
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
                </div>
              )}

              {/* Desktop Menu Button */}
              <div className="relative ml-4" data-desktop-menu>
                <button
                  onClick={() => setIsDesktopMenuOpen(!isDesktopMenuOpen)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <span className="mr-2">☰</span>
                  Menu
                </button>

                {/* Desktop Dropdown Menu */}
                {isDesktopMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-600 z-50">
                    <div className="py-1 max-h-96 overflow-y-auto">
                      {MENU_CATEGORIES.map((category) => (
                        <div key={category}>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
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
                                  (link as any).parent 
                                    ? 'pl-8 text-gray-600 dark:text-gray-400' 
                                    : ''
                                } ${
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
                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                  >
                    Logout
                  </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
            ) : (
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
            )}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {session && isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4">
            <nav className="space-y-1">
              {MENU_CATEGORIES.map((category) => (
                <div key={category}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
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
                          (link as any).parent 
                            ? 'pl-8 text-gray-600 dark:text-gray-400' 
                            : ''
                        } ${
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
              
              {/* Admin Link */}
              {isAdmin && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
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
              
              {/* User Info & Logout for All Users */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
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
                    <span className="text-sm text-gray-700 dark:text-gray-300">Theme</span>
                    <ThemeToggle />
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
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
