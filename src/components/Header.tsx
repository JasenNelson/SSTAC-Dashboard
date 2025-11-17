// src/components/Header.tsx
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from './supabase-client';
import type { Session } from '@supabase/supabase-js';
import { refreshGlobalAdminStatus, clearAdminStatusBackup } from '@/lib/admin-utils';
import { HeaderBrand } from './header/HeaderBrand';
import { DesktopNavigation } from './header/DesktopNavigation';
import { UserControls } from './header/UserControls';
import { MobileNavigation } from './header/MobileNavigation';
import { MENU_LINKS } from './header/menuConfig';



export default function Header() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Close desktop menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDesktopMenuOpen &&
        desktopMenuRef.current &&
        !desktopMenuRef.current.contains(event.target as Node)
      ) {
        setIsDesktopMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDesktopMenuOpen]);

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
        // Check if we're on a protected route
        const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025'];
        const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
        
        // Use getUser() instead of getSession() to properly validate and refresh tokens
        // getSession() can return stale sessions that fail on refresh
        const { error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('[Header] Auth error:', userError);
          
          // Check if it's a refresh token error
          const isRefreshTokenError = userError.message?.includes('Refresh Token') || 
                                      userError.message?.includes('Invalid refresh token') ||
                                      userError.message?.includes('JWT') ||
                                      userError.status === 401;
          
          setSession(null);
          setIsAdmin(false);
          
          // If we're on a protected route and there's an auth error, redirect to login
          if (isProtectedRoute && isRefreshTokenError) {
            console.warn('[Header] Invalid session on protected route, redirecting to login');
            // Clear any stale auth data
            await supabase.auth.signOut();
            // Redirect to login with current path as redirect param
            const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
            router.push(loginUrl);
            return;
          }
          
          setIsLoading(false);
          return;
        }
        
        // If getUser() succeeded, get the full session
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session?.user) {
          // Check if user has admin role (only log for admins to reduce noise)
          const restoredFromStorage = restoreAdminStatusFromStorage(session.user.id);
          if (restoredFromStorage) {
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Admin status restored from localStorage');
            }
          }
          
          const isUserAdmin = await refreshGlobalAdminStatus();
          setIsAdmin(isUserAdmin);
        } else {
          setIsAdmin(false);
          // If no session and we're on a protected route, redirect to login
          if (isProtectedRoute) {
            console.warn('[Header] No session on protected route, redirecting to login');
            const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
            router.push(loginUrl);
            return;
          }
        }
      } catch (error) {
        console.error('[Header] Session error exception:', error);
        setSession(null);
        setIsAdmin(false);
        
        // If we're on a protected route and there's an error, redirect to login
        const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025'];
        const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
        if (isProtectedRoute) {
          console.warn('[Header] Auth error on protected route, redirecting to login');
          const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
          router.push(loginUrl);
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
    }, 5000); // Increased timeout to 5 seconds

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Check if we're on a protected route
      const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025'];
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      
      // Handle sign out or token refresh errors
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        setSession(null);
        setIsAdmin(false);
        setIsLoading(false);
        
        // If we're on a protected route, redirect to login
        if (isProtectedRoute && event === 'SIGNED_OUT') {
          console.warn('[Header] Signed out on protected route, redirecting to login');
          const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
          router.push(loginUrl);
          return;
        }
        return;
      }
      
      setSession(session);
      setIsLoading(false);
      
      if (session?.user) {
        // Check admin role (only log for admins to reduce noise)
        const restoredFromStorage = restoreAdminStatusFromStorage(session.user.id);
        if (restoredFromStorage) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Admin status restored from localStorage during auth change');
          }
        }
        
        // Use .then() instead of await in useEffect
        refreshGlobalAdminStatus().then((isUserAdmin) => {
          setIsAdmin(isUserAdmin);
        });
      } else {
        setIsAdmin(false);
        // If no session and we're on a protected route, redirect to login
        if (isProtectedRoute) {
          console.warn('[Header] No session after auth state change on protected route, redirecting to login');
          const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
          router.push(loginUrl);
        }
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router, supabase, pathname, restoreAdminStatusFromStorage]);

  // Listen for route changes to refresh admin status
  useEffect(() => {
    if (session?.user) {
      // Always refresh admin status when navigating to admin pages
      if (pathname.startsWith('/admin')) {
        refreshGlobalAdminStatus(true).then((isStillAdmin) => {
          setIsAdmin(isStillAdmin);
        });
      }
    }
  }, [pathname, session?.user]);

  // Listen for navigation events to refresh admin status
  useEffect(() => {
    const handleRouteChange = () => {
      if (session?.user && pathname.startsWith('/admin')) {
        refreshGlobalAdminStatus(true).then((isStillAdmin) => {
          setIsAdmin(isStillAdmin);
        });
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
    if (session?.user) {
      const intervalId = setInterval(async () => {
        if (session?.user) {
          const isStillAdmin = await refreshGlobalAdminStatus();
          setIsAdmin(isStillAdmin);
        }
      }, 30000); // Check every 30 seconds (more frequent)

      return () => clearInterval(intervalId);
    }
  }, [session?.user]);

  const handleLogout = async () => {
    try {
      // Clear admin status backup using utility function
      await clearAdminStatusBackup();
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Logout error:', error);
        // Even if Supabase logout fails, clear local state and redirect
        setSession(null);
        setIsAdmin(false);
        router.push('/login');
      } else {
        setSession(null);
        setIsAdmin(false);
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

  // Memoize menu links to prevent unnecessary re-renders
  const menuLinks = useMemo(() => MENU_LINKS, []);

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
          <HeaderBrand />

          {session && (
            <DesktopNavigation
              menuLinks={menuLinks}
              isAdmin={isAdmin}
              isDesktopMenuOpen={isDesktopMenuOpen}
              onToggleMenu={() => setIsDesktopMenuOpen((prev) => !prev)}
              onSelectLink={() => setIsDesktopMenuOpen(false)}
              isActiveLink={isActiveLink}
              menuRef={desktopMenuRef}
            />
          )}

          <div className="flex items-center space-x-4">
            <UserControls
              session={session}
              isAdmin={isAdmin}
              onLogout={handleLogout}
              isMobileMenuOpen={isMobileMenuOpen}
              onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
            />
          </div>
        </div>

        {session && (
          <MobileNavigation
            isOpen={isMobileMenuOpen}
            menuLinks={menuLinks}
            isAdmin={isAdmin}
            onClose={() => setIsMobileMenuOpen(false)}
            onLogout={handleLogout}
            isActiveLink={isActiveLink}
          />
        )}
      </div>
    </header>
  );
}
