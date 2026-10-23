import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@xyflow/react/dist/style.css';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mackenzie Mercury Bayesian Network | Jermilova et al. 2025',
  description: 'Read-only prototype viewer for the packaged Jermilova Mackenzie mercury Bayesian network reconstruction.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
