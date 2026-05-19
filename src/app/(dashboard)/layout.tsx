// src/app/(dashboard)/layout.tsx
import Header from '@/components/Header';
import ScrollToTop from '@/components/ScrollToTop';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 print:bg-white">
      {/* Sticky header that stays at the top. Hidden in print so
          window.print() from any dashboard page produces a chrome-free PDF. */}
      <div className="sticky top-0 z-50 print:hidden">
        <Header />
      </div>

      {/* Main content area with proper spacing */}
      <main className="pt-4 print:pt-0">
        {children}
      </main>

      {/* Scroll to top button. Hidden in print. */}
      <div className="print:hidden">
        <ScrollToTop />
      </div>
    </div>
  );
}