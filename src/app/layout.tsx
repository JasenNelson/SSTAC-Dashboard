import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";
// Removed: next-themes NextThemesProvider — custom ThemeContext handles dark/light class toggling.
// Having two providers that both manage the 'dark' class on <html> caused conflicts.

export const metadata: Metadata = {
  title: "SSTAC & TWG Dashboard",
  description: "SSTAC & TWG Dashboard - Modernizing BC Sediment Quality Standards",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Audit B11: synchronous theme bootstrap. Runs before first paint so a stored
          'dark' preference does not flash white while React hydrates. See
          src/lib/themeBootstrap.ts for the contract with ThemeContext and the CSP note.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body
        className="antialiased"
      >
        <ThemeProvider>
          <AuthProvider>
            <AdminProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </AdminProvider>
          </AuthProvider>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
