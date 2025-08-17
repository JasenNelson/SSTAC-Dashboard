// src/app/(dashboard)/layout.tsx
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header that stays at the top */}
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      
      {/* Main content area with proper spacing */}
      <main className="pt-4">
        {children}
      </main>
      
      {/* Scroll to top button */}
      <ScrollToTop />
    </div>
  );
}