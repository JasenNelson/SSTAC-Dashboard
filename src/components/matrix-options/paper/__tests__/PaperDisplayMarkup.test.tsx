import { renderToStaticMarkup } from 'react-dom/server';
import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MathRenderer from '@/components/MathRenderer';

const caption = 'Table: Table 4-1. Proposed categories. {#tbl-4-1}';
const underline = 'Period: [January - March 2027]{.underline}.';
const table = '| Field | Value |\n| --- | --- |\n| One | Two |';

describe('accepted paper display markup', () => {
  it('renders the exact Pandoc caption and underline forms semantically', () => {
    const html = renderToStaticMarkup(<MathRenderer content={`${caption}\n\n${table}\n\n${underline}`} paperDisplayMarkup />);
    expect(html).toMatch(/<table id="tbl-4-1"><caption class="sr-only">Table 4-1\. Proposed categories\.<\/caption>/);
    expect(html).toContain('<tr class="paper-table-caption-row" role="presentation" aria-hidden="true"><td colSpan="2" role="presentation">Table 4-1. Proposed categories.</td></tr>');
    document.body.innerHTML = html;
    const accessibleTable = within(document.body).getByRole('table', { name: 'Table 4-1. Proposed categories.' });
    expect(within(accessibleTable).getAllByRole('columnheader')).toHaveLength(2);
    expect(within(accessibleTable).queryByRole('columnheader', { name: 'Table 4-1. Proposed categories.' })).toBeNull();
    expect(within(accessibleTable).queryByRole('rowheader', { name: 'Table 4-1. Proposed categories.' })).toBeNull();
    expect(html).toContain('<u>January - March 2027</u>');
    expect(html).not.toContain('Table: Table');
    expect(html).not.toContain('{#tbl-');
    expect(html).not.toContain('{.underline}');
  });

  it('leaves unrecognized braces and ordinary bracketed content intact', () => {
    const text = 'Table: Other caption {#tbl-4-1}\n\nKeep [text]{.other} and {scientific notation}.';
    const html = renderToStaticMarkup(<MathRenderer content={text} paperDisplayMarkup />);
    expect(html).toContain('Table: Other caption {#tbl-4-1}');
    expect(html).toContain('[text]{.other}');
    expect(html).toContain('{scientific notation}');
  });

  it('shows the R7 failure without the paper-only display plugin', () => {
    const html = renderToStaticMarkup(<MathRenderer content={`${caption}\n\n${table}\n\n${underline}`} />);
    expect(html).toContain('Table: Table');
    expect(html).toContain('{#tbl-4-1}');
    expect(html).toContain('{.underline}');
  });
});
