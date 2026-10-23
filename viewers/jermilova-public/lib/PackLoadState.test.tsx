import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PackLoadState } from '../components/PackLoadState';

describe('PackLoadState', () => {
  it('shows the load error without rendering a canvas or fallback content', () => {
    const markup = renderToStaticMarkup(
      <PackLoadState error="Runtime asset is missing." loading={false}>
        <div data-testid="network-canvas">Unverified model canvas</div>
      </PackLoadState>,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Approved pack unavailable');
    expect(markup).toContain('Runtime asset is missing.');
    expect(markup).toContain('No fallback model was loaded.');
    expect(markup).not.toContain('Loading and verifying');
    expect(markup).not.toContain('data-testid="network-canvas"');
    expect(markup).not.toContain('Unverified model canvas');
  });
});
