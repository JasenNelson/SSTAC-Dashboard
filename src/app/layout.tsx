import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap',
  preload: false, // Disable preload - fonts load when actually used
  // Fonts are defined as CSS variables but may not be used on initial render
  // Disabling preload prevents browser warnings about unused preloaded resources
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
  preload: false, // Disable preload - mono font only used in code/monospace contexts
  // This font is typically only used for code blocks, not body text
  // Disabling preload prevents browser warnings
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
          <ThemeProvider>
            <AuthProvider>
              <AdminProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </AdminProvider>
            </AuthProvider>
          </ThemeProvider>
        </NextThemesProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
