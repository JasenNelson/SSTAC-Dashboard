// src/app/(dashboard)/regulatory-review/layout.tsx
import Link from 'next/link';

interface RegulatoryReviewLayoutProps {
  children: React.ReactNode;
}

export default function RegulatoryReviewLayout({
  children,
}: RegulatoryReviewLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
