import type { ReactNode } from 'react';

interface PackLoadStateProps {
  error: string | null;
  loading: boolean;
  children: ReactNode;
}

export function PackLoadState({ error, loading, children }: PackLoadStateProps) {
  if (error) {
    return (
      <section className="error-card" role="alert">
        <h2>Approved pack unavailable</h2>
        <p>{error}</p>
        <p>No fallback model was loaded.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="loading-card" aria-live="polite">
        Loading and verifying the approved model pack...
      </section>
    );
  }

  return children;
}
