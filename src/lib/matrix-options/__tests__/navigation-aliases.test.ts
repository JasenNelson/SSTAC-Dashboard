import { describe, expect, it } from 'vitest';
import {
  MATRIX_OPTIONS_VIEW_ALIASES,
  parseMatrixOptionsViewParam,
} from '../navigation';

describe('matrix options view aliases', () => {
  it('maps the dashboard label Options Paper to TWG Review', () => {
    expect(parseMatrixOptionsViewParam('Options Paper')).toBe('TWG Review');
  });

  it('maps the dashboard label Database to Interactive Map', () => {
    expect(parseMatrixOptionsViewParam('Database')).toBe('Interactive Map');
  });

  it('maps the dashboard label Catalogue to References & Values', () => {
    expect(parseMatrixOptionsViewParam('Catalogue')).toBe('References & Values');
  });

  it('resolves aliases in array form using the first element', () => {
    expect(parseMatrixOptionsViewParam(['Database'])).toBe('Interactive Map');
  });

  it.each(['TWG Review', 'Interactive Map', 'References & Values', 'Calculator'])(
    'still resolves legacy id %s',
    (id) => {
      expect(parseMatrixOptionsViewParam(id)).toBe(id);
    },
  );

  it.each(['Methodology', '', undefined])('falls back to The Guide for %j', (value) => {
    expect(parseMatrixOptionsViewParam(value as string | undefined)).toBe('The Guide');
  });

  it('exports exactly the three dashboard-label aliases', () => {
    expect(MATRIX_OPTIONS_VIEW_ALIASES).toEqual({
      'Options Paper': 'TWG Review',
      Database: 'Interactive Map',
      Catalogue: 'References & Values',
    });
  });
});
