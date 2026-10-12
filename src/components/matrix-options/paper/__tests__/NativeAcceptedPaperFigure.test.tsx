import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AcceptedFigureBinding, AcceptedFiguresContract } from '@/lib/matrix-options/paper/accepted-figures';
import { nativeFigureForBinding, validateNativeFigureSet } from '@/lib/matrix-options/paper/native-figures';

import { NativeAcceptedPaperFigure } from '../NativeAcceptedPaperFigure';

const HASH = 'a'.repeat(64);
const PAPER = 'b'.repeat(64);
const asset = { id: 'SYNTHETIC', file: 'SYNTHETIC.png', sha256: HASH, bytes: 100,
  width: 600, height: 400, placementIds: ['1-1', 'A-1'] };
const placements = [
  { figureId: '1-1', assetId: asset.id, textSha256: HASH, sectionAnchor: 'sec-one',
    anchorSource: 'registry' as const, role: 'primary' as const, markerLine: 1 },
  { figureId: 'A-1', assetId: asset.id, textSha256: HASH, sectionAnchor: 'app-a',
    anchorSource: 'registry' as const, role: 'secondary' as const, markerLine: 2 },
];
const contract: AcceptedFiguresContract = {
  schemaVersion: 'matrix-paper-accepted-figures-v1', releaseIdentity: 'synthetic-release',
  paperSha256: PAPER,
  sources: { candidateManifestSha256: HASH, placementRegistrySha256: HASH, interfaceOverlaySha256: HASH },
  assets: [asset], placements,
};
const model = {
  id: asset.id, source: { file: asset.file, sha256: HASH, width: asset.width, height: asset.height },
  title: 'Synthetic direction', layout: 'tree',
  nodes: [
    { id: 'start', label: 'Start node', heads: [], bullets: [] },
    { id: 'left', label: 'Left outcome', heads: [], bullets: [] },
    { id: 'right', label: 'Right outcome', heads: [], bullets: [] },
  ],
  edges: [{ from: 'start', to: 'left', label: 'first route' },
    { from: 'start', to: 'right', label: 'second route' }],
  groups: [{ id: 'internal-outcomes', members: ['left', 'right'] }],
};
const raw = {
  schemaVersion: 'matrix-private-native-figures-v1', releaseIdentity: contract.releaseIdentity,
  paperSha256: PAPER, models: [model],
  placements: [
    { figureId: '1-1', modelId: asset.id, caption: 'Figure 1-1. Synthetic caption.', sectionAnchor: 'sec-one' },
    { figureId: 'A-1', modelId: asset.id, caption: 'Figure A-1. Reused synthetic caption.', sectionAnchor: 'app-a' },
  ],
};
const clone = () => JSON.parse(JSON.stringify(raw)) as typeof raw;
const binding = (index: number): AcceptedFigureBinding => ({
  releaseIdentity: contract.releaseIdentity, placement: placements[index], asset,
  caption: raw.placements[index].caption, status: 'SYNTHETIC_STATUS', alt: 'Synthetic alternative text.',
});

describe('private native figure candidate', () => {
  it('validates a rooted directed model and reuses one model at both placements', () => {
    const set = validateNativeFigureSet(clone(), contract);
    expect(set.models).toHaveLength(1);
    expect(set.placements).toHaveLength(2);
    expect(nativeFigureForBinding(set, binding(0)).model).toEqual(nativeFigureForBinding(set, binding(1)).model);
  });

  it.each([
    ['missing model', (input: typeof raw) => { input.models = []; }],
    ['extra source image', (input: typeof raw) => { input.models[0].source.file = 'image1.png'; }],
    ['reverse edge', (input: typeof raw) => { input.models[0].edges[0].from = 'left'; }],
    ['duplicate placement', (input: typeof raw) => { input.placements[1].figureId = '1-1'; }],
    ['missing group member', (input: typeof raw) => { input.models[0].groups[0].members[1] = 'absent'; }],
    ['non-ASCII text', (input: typeof raw) => { input.models[0].title = '\u00e9'; }],
  ])('rejects %s', (_name, change) => {
    const input = clone();
    change(input);
    expect(() => validateNativeFigureSet(input, contract)).toThrow('unavailable');
  });

  it('renders real text, directed relationships, caption and an accessible description', () => {
    const set = validateNativeFigureSet(clone(), contract);
    const { container } = render(<NativeAcceptedPaperFigure figure={binding(0)} nativeFigures={set} />);
    const figure = container.querySelector('figure[data-native-figure="1-1"]');
    expect(figure).not.toBeNull();
    expect(figure).toHaveAttribute('id', 'fig-1-1');
    expect(figure).toHaveAttribute('aria-labelledby');
    expect(figure).toHaveAttribute('aria-describedby');
    expect(screen.getByText('Start node')).toBeInTheDocument();
    expect(screen.getByText('first route')).toBeInTheDocument();
    expect(figure?.textContent).toContain('Figure 1-1.');
    expect(figure?.querySelectorAll('[data-figure-node]')).toHaveLength(3);
  });

  it('preserves authenticated group data internally without exposing raw identifiers at either placement', () => {
    const set = validateNativeFigureSet(clone(), contract);
    for (const index of [0, 1]) {
      const mapped = nativeFigureForBinding(set, binding(index));
      expect(mapped.model.groups).toEqual(model.groups);
      const { container, unmount } = render(<NativeAcceptedPaperFigure figure={binding(index)} nativeFigures={set} />);
      const figure = container.querySelector(`figure[data-native-figure="${placements[index].figureId}"]`)!;
      expect(figure.querySelector('[data-figure-group]')).toBeNull();
      expect(figure.querySelector('[data-group-member]')).toBeNull();
      expect(figure.textContent).not.toContain('internal-outcomes');
      const description = figure.querySelector(figure.getAttribute('aria-describedby')!.split(' ').map((id) => `#${id}`).join(','))!;
      expect(description.textContent).not.toContain('internal-outcomes');
      expect(description.textContent).toContain('Left outcome');
      expect(description.textContent).toContain('Right outcome');
      unmount();
    }
  });

  it('does not create group markup when the authenticated model has no groups', () => {
    const input = clone();
    input.models[0].groups = [];
    const set = validateNativeFigureSet(input, contract);
    const { container } = render(<NativeAcceptedPaperFigure figure={binding(0)} nativeFigures={set} />);
    expect(container.querySelector('[data-figure-group]')).toBeNull();
    expect(container.querySelector('[data-group-member]')).toBeNull();
  });

  it('throws on post-validation caption drift instead of hiding one figure', () => {
    const set = validateNativeFigureSet(clone(), contract);
    const changed = { ...binding(0), caption: 'Figure 1-1. Different caption.' };
    expect(() => render(<NativeAcceptedPaperFigure figure={changed} nativeFigures={set} />)).toThrow('unavailable');
  });
});
