import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";
import { THEME_COOKIE_NAME, resolveTheme } from "@/lib/theme";
// Removed: next-themes NextThemesProvider -- custom ThemeContext handles dark/light class toggling.
// Having two providers that both manage the 'dark' class on <html> caused conflicts.

export const metadata: Metadata = {
  title: "SSTAC & TWG Dashboard",
  description: "SSTAC & TWG Dashboard - Modernizing BC Sediment Quality Standards",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Owner decision D2, option C: resolve the theme on the SERVER so the served HTML is
  // already correct -- for crawlers, no-JS readers, and the first client render alike.
  //
  // THE COST, stated where the code is rather than only in the PR: reading cookies() in the
  // ROOT layout opts the entire app out of static prerendering. Measured against the
  // 2026-08-07 build (Next 15.5.9): 15 routes were Static, and all 15 become Dynamic --
  // including /, /login, /signup, /_not-found and the four public /cew-polls/* pages, i.e.
  // the unauthenticated CDN-cacheable surface. The other 7 already paid a middleware
  // getUser() round trip. The owner approved this cost explicitly on 2026-08-16 after being
  // shown those numbers. There is no other marker in the tree that this happened: it is one
  // cookies() call with app-wide reach, so do not "tidy it away" without re-reading
  // docs/THEME_COOKIE_SCOPE_2026_08_16.md section 3.
  //
  // The cookie is client-writable (it must be readable by the pre-paint bootstrap, so it
  // cannot be HttpOnly). resolveTheme validates; the raw value never reaches className.
  const cookieStore = await cookies();
  const theme = resolveTheme(cookieStore.get(THEME_COOKIE_NAME)?.value);

  return (
    // suppressHydrationWarning stays. The bootstrap still rewrites this class for users with
    // no cookie yet, so a deliberate mismatch on <html> remains possible for exactly one
    // request per browser. Removing it belongs in a later change, once the bootstrap is
    // guaranteed to agree -- see the scope doc's section 7.
    <html lang="en" className={theme} suppressHydrationWarning>
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
        <ThemeProvider initialTheme={theme}>
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
