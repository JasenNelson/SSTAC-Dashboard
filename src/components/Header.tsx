// src/components/Header.tsx
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { HeaderBrand } from './header/HeaderBrand';
import { DesktopNavigation } from './header/DesktopNavigation';
import { UserControls } from './header/UserControls';
import { MobileNavigation } from './header/MobileNavigation';
import { MENU_LINKS } from './header/menuConfig';



export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoading, signOut } = useAuth();
  const {
    isAdmin,
    refreshAdminStatus,
    clearAdminStatus,
  } = useAdmin();

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

  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/twg', '/survey-results', '/cew-2025'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (!isLoading && !session && isProtectedRoute) {
      const loginUrl = `/login?redirect=${encodeURIComponent(pathname)}`;
      router.push(loginUrl);
    }
  }, [isLoading, session, pathname, router]);

  useEffect(() => {
    if (session?.user && pathname.startsWith('/admin')) {
      void refreshAdminStatus(true);
    }
  }, [pathname, session?.user, refreshAdminStatus]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshAdminStatus();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [session?.user, refreshAdminStatus]);

  const handleLogout = async () => {
    try {
      await clearAdminStatus();
    } finally {
      await signOut();
      router.push('/login');
    }
  };

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
