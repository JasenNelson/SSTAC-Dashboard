import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/themeBootstrap";
import { resolveThemeFromCookieHeader } from "@/lib/theme";
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
  // THE COST, stated where the code is rather than only in the PR: reading request headers in
  // the ROOT layout opts the entire app out of static prerendering. Measured against the
  // 2026-08-07 build (Next 15.5.9): 15 routes were Static, and all 15 become Dynamic --
  // including /, /login, /signup, /_not-found and the four public /cew-polls/* pages, i.e.
  // the unauthenticated CDN-cacheable surface. The other 7 already paid a middleware
  // getUser() round trip. The owner approved this cost explicitly on 2026-08-16 after being
  // shown those numbers. There is no other marker in the tree that this happened: it is one
  // request-header read with app-wide reach, so do not "tidy it away" without re-reading
  // docs/THEME_COOKIE_SCOPE_2026_08_16.md section 3.
  //
  // WHY headers().get('cookie') AND NOT cookies(). This must not be "simplified" back: Next's
  // cookies() parser percent-decodes values, does not trim, lets the LAST duplicate entry win,
  // and reports a valueless `theme` as the string "true". The pre-paint bootstrap and
  // ThemeProvider do none of those things, so each one is a served class that the client then
  // contradicts -- a repaint plus a genuine ThemeToggle hydration mismatch that
  // suppressHydrationWarning on <html> does not cover. Reading the RAW header and passing it
  // through the SAME readThemeCookie the client uses removes the whole divergence class.
  // The header value is verbatim as sent, so no re-encoding or normalisation happens first.
  //
  // The cookie is client-writable (it must be readable by the pre-paint bootstrap, so it
  // cannot be HttpOnly). The resolver validates; the raw value never reaches className.
  const requestHeaders = await headers();
  const theme = resolveThemeFromCookieHeader(requestHeaders.get('cookie'));

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
