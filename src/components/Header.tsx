// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';



export default function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Memoize the admin role check to prevent unnecessary re-runs
  const checkAdminRole = useCallback(async (userId: string, retryCount = 0) => {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Role check timeout')), 10000)
      );
      
      // Check if user has any role in user_roles table first
      const roleCheckPromise = supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const result = await Promise.race([
        roleCheckPromise,
        timeoutPromise
      ]) as { data: any; error: any };
      
      const { data: userRoles, error: userRolesError } = result;
      
      if (userRolesError) {
        // Handle specific error cases
        if (userRolesError.code === 'PGRST116') {
          console.log('⚠️ user_roles table does not exist (PGRST116)');
        } else if (userRolesError.code === '42P17') {
          console.error('❌ Infinite recursion detected in RLS policies');
          // Try localStorage backup for infinite recursion
          const backupAdminStatus = localStorage.getItem(`admin_status_${userId}`);
          if (backupAdminStatus === 'true') {
            setIsAdmin(true);
            return true;
          }
        } else if (userRolesError.code === '406') {
          // 406 error means RLS policies are blocking access - user is likely not admin
          console.log('ℹ️ User access blocked by RLS - likely not admin');
          setIsAdmin(false);
          localStorage.removeItem(`admin_status_${userId}`);
          return false;
        } else {
          console.error('❌ Role check error:', userRolesError);
        }
        
        // Check localStorage backup for other errors
        const backupAdminStatus = localStorage.getItem(`admin_status_${userId}`);
        if (backupAdminStatus === 'true') {
          setIsAdmin(true);
          return true;
        }
        
        setIsAdmin(false);
        return false;
      }
      
      // Check if user has admin role
      const hasAdminRole = userRoles.some((role: any) => role.role === 'admin');
      
      if (hasAdminRole) {
        console.log('✅ User is admin via user_roles table');
        setIsAdmin(true);
        localStorage.setItem(`admin_status_${userId}`, 'true');
        return true;
      } else {
        console.log('ℹ️ User is not admin - roles found:', userRoles.map((r: any) => r.role));
        setIsAdmin(false);
        localStorage.removeItem(`admin_status_${userId}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Role check exception:', error);
      
      // Check localStorage backup before clearing admin status
      const backupAdminStatus = localStorage.getItem(`admin_status_${userId}`);
      if (backupAdminStatus === 'true') {
        setIsAdmin(true);
        return true;
      }
      
      setIsAdmin(false);
      return false;
    }
  }, [supabase]);



  // Function to restore admin status from localStorage
  const restoreAdminStatusFromStorage = useCallback((userId: string) => {
    const backupAdminStatus = localStorage.getItem(`admin_status_${userId}`);
    if (backupAdminStatus === 'true') {
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);



  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setSession(null);
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }
        
        setSession(session);
        
        if (session?.user) {
          // Check if user has admin role (only log for admins to reduce noise)
          const restoredFromStorage = restoreAdminStatusFromStorage(session.user.id);
          if (restoredFromStorage) {
            console.log('✅ Admin status restored from localStorage');
          }
          
          await checkAdminRole(session.user.id);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Session error:', error);
        setSession(null);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      console.log('⏰ Loading timeout reached - forcing loading to false');
      setIsLoading(false);
    }, 5000); // Increased timeout to 5 seconds

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change event:', event, 'Session:', session?.user?.email);
      setSession(session);
      setIsLoading(false);
      
      if (session?.user) {
        // Check admin role (only log for admins to reduce noise)
        const restoredFromStorage = restoreAdminStatusFromStorage(session.user.id);
        if (restoredFromStorage) {
          console.log('✅ Admin status restored from localStorage during auth change');
        }
        
        await checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    // Also check admin role on initial load if we have a session
    if (session?.user) {
      console.log('🔄 Initial load - Checking admin role for user:', session.user.id);
      
      // First try to restore from localStorage
      const restoredFromStorage = restoreAdminStatusFromStorage(session.user.id);
      if (restoredFromStorage) {
        console.log('✅ Admin status restored from localStorage during initial load');
      }
      
      checkAdminRole(session.user.id);
    }

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router, supabase, checkAdminRole]);

  // Listen for route changes to refresh admin status
  useEffect(() => {
    if (session?.user && isAdmin) {
      // Refresh admin status when navigating to admin pages
      if (pathname.startsWith('/admin')) {
        // Route change to admin page detected
      }
    }
  }, [pathname, session?.user, isAdmin]);

  // Listen for navigation events to refresh admin status
  useEffect(() => {
    const handleRouteChange = () => {
      if (session?.user && isAdmin && pathname.startsWith('/admin')) {
        // Navigation event detected
      }
    };

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);
    
    // Listen for pushstate/replacestate events
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      handleRouteChange();
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      handleRouteChange();
    };

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [session?.user, isAdmin, pathname]);

  // Periodic admin status check to ensure badge persists
  useEffect(() => {
    if (session?.user && isAdmin) {
      const intervalId = setInterval(async () => {
        if (session?.user) {
          await checkAdminRole(session.user.id);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(intervalId);
    }
  }, [session?.user, isAdmin, checkAdminRole]);

  const handleLogout = async () => {
    console.log('🔄 Logout initiated for user:', session?.user?.email);
    
    try {
      // Clear admin status backup from localStorage
      if (session?.user) {
        localStorage.removeItem(`admin_status_${session.user.id}`);
        console.log('🧹 Cleared admin status backup from localStorage');
      }
      
      console.log('🔄 Calling Supabase signOut...');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Logout error:', error);
        // Even if Supabase logout fails, clear local state and redirect
        setSession(null);
        setIsAdmin(false);
        router.push('/login');
      } else {
        console.log('✅ Supabase signOut successful');
        setSession(null);
        setIsAdmin(false);
        console.log('🔄 Redirecting to login page...');
        router.push('/login');
      }
    } catch (error) {
      console.error('❌ Logout exception:', error);
      // Even if there's an exception, clear local state and redirect
      setSession(null);
      setIsAdmin(false);
      router.push('/login');
    }
  };

  // Navigation links for authenticated users
  const navigationLinks = [
    { href: '/survey-results', label: 'Survey', icon: '📊' },
    { href: '/cew-2025', label: 'CEW', icon: '📋' },
    { href: '/twg/documents', label: 'Documents', icon: '📄' },
    { href: '/twg/discussions', label: 'Forum', icon: '💬' },
  ];

  // Admin-only navigation links
  const adminLinks = [
    { href: '/admin', label: 'Admin', icon: '⚙️' },
  ];

  // Helper function to check if a link is active
  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Don't block the entire UI during loading - always show logout option
  if (isLoading && !session) {
    return (
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="text-xl font-bold text-gray-900">SSTAC & TWG Dashboard</div>
            <div className="text-gray-500">Loading...</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">
              SSTAC & TWG Dashboard
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
              
              {/* Admin Links */}
              {isAdmin && (
                <div className="ml-4 pl-4 border-l border-gray-300">
                  {adminLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActiveLink(link.href)
                          ? 'bg-green-100 text-green-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <span className="mr-2">{link.icon}</span>
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </nav>
          )}

          {/* User Menu & Mobile Menu Button */}
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                {/* User Info */}
                <div className="hidden sm:flex items-center space-x-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{session.user.email}</span>
                    {isAdmin && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    Logout
                  </button>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
          <div className="md:hidden border-t border-gray-200 py-4">
            <nav className="space-y-1">
              {navigationLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActiveLink(link.href)
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span className="mr-3">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
              
              {/* Admin Links */}
              {isAdmin && (
                <>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Admin
                    </div>
                    {adminLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                          isActiveLink(link.href)
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <span className="mr-3">{link.icon}</span>
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
              
              {/* User Info & Logout for All Users */}
              <div className="pt-2 border-t border-gray-200">
                <div className="px-3 py-2 text-sm text-gray-700">
                  <span className="font-medium">{session.user.email}</span>
                  {isAdmin && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Admin
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
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