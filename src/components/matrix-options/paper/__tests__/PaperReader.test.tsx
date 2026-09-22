import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { PAPER_STATUS_PRESENTATIONS, PaperSectionReader, PaperStatusAnnotationCard, PaperVersionLanding, paperStatusLabel } from '../PaperReader';
import type { PaperStatusAnnotation } from '@/lib/matrix-options/paper/contracts';
import { createSyntheticPaperProvider } from '@/lib/matrix-options/paper/provider';
import { SYNTHETIC_PAPER_VERSION } from '@/lib/matrix-options/paper/synthetic-fixture';

describe('PaperReader server output', () => {
  it('renders version, authority, review focus, and stable section links', async () => {
    const element = await PaperVersionLanding({ documentVersion: SYNTHETIC_PAPER_VERSION, provider: createSyntheticPaperProvider() });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Synthetic rough draft');
    expect(html).toContain('Not promotable');
    expect(html).toContain('Review focus for Slice 1A');
    expect(html).toContain('/matrix-options/paper/v/slice-1a-fixture-v1/synthetic.orientation');
  });

  it('server-renders one selected fragment with context, breadcrumbs, TOCs, and adjacent links', async () => {
    const element = await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.framework.example',
      provider: createSyntheticPaperProvider(),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('Invented worked example');
    expect(html).toContain('Illustrative only');
    expect(html).toContain('Project-plan direction');
    expect(html.match(/data-status-code="ILLUSTRATIVE_VALUE_OR_CALCULATION"/g)).toHaveLength(4);
    expect(html).toContain('data-annotation-id="synthetic.annotation.illustrative-value"');
    expect(html).toContain('data-annotation-id="synthetic.annotation.illustrative-value-context"');
    expect(html).toContain('A second validated annotation on the same target proves that distinct review context is preserved.');
    expect(html).toContain('Target:</span> Block synthetic.framework.example.value');
    expect(html).toContain('Validation date:</span> <time dateTime="2026-09-02T00:00:00.000Z">2026-09-02</time>');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('aria-label="Adjacent sections"');
    expect(html).toContain('Document contents');
    expect(html).toContain('data-testid="paper-equation-overflow"');
    expect(html).toContain('data-testid="paper-table-overflow"');
    expect(html).not.toContain('The example framework has three invented stages');
    expect(html).not.toContain('Use this workspace to test stable routes');
    expect(html).not.toContain('The example framework has three invented stages');
    expect(html).not.toContain('This appendix records that search, comments, guided review');
  });

  it.each([
    ['synthetic.orientation', 'In force - Statute'],
    ['synthetic.framework', 'In force - ENV policy'],
    ['synthetic.appendix', 'Review question'],
  ])('renders exhaustive status and authority labels for %s', async (stableSectionId, expectedLabel) => {
    const element = await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId,
      provider: createSyntheticPaperProvider(),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain(expectedLabel);
    if (stableSectionId !== 'synthetic.framework.example') {
      expect(html).not.toContain('Illustrative only');
    }
  });

  it('provides exhaustive, non-collapsed status presentation semantics', () => {
    const expectedLabels = {
      IN_FORCE_LEGAL_OR_POLICY: 'In force - Statute',
      PROJECT_PLAN_DIRECTION: 'Project-plan direction',
      OPEN_OPTION: 'Open option',
      EMERGING_DRAFT_DIRECTION: 'Emerging draft direction',
      ILLUSTRATIVE_VALUE_OR_CALCULATION: 'Illustrative only',
      KNOWN_GAP_OR_UNVERIFIED: 'Gap / unverified',
      FUTURE_TASK: 'Future task',
      OUT_OF_PHASE2_SCOPE: 'Outside Phase 2',
      REVIEW_QUESTION: 'Review question',
    } as const;
    const expectedTemplates = {
      ...expectedLabels,
      IN_FORCE_LEGAL_OR_POLICY: 'In force - <authority-kind label>',
    } as const;
    const requiredClassTokens = {
      IN_FORCE_LEGAL_OR_POLICY: ['border-solid', 'bg-blue-950'],
      PROJECT_PLAN_DIRECTION: ['border-solid', 'border-indigo-700', 'bg-transparent'],
      OPEN_OPTION: ['border-solid', 'border-amber-600', 'bg-transparent'],
      EMERGING_DRAFT_DIRECTION: ['border-dotted', 'border-violet-700'],
      ILLUSTRATIVE_VALUE_OR_CALCULATION: ['border-solid', 'border-cyan-700'],
      KNOWN_GAP_OR_UNVERIFIED: ['border-solid', 'border-rose-700'],
      FUTURE_TASK: ['border-dashed', 'border-gray-600'],
      OUT_OF_PHASE2_SCOPE: ['border-solid', 'border-zinc-800', 'bg-transparent'],
      REVIEW_QUESTION: ['border-solid', 'border-yellow-600'],
    } as const;
    const entries = Object.entries(PAPER_STATUS_PRESENTATIONS);
    expect(entries).toHaveLength(9);
    expect(new Set(entries.map(([, presentation]) => presentation.signal)).size).toBe(9);
    expect(new Set(entries.map(([, presentation]) => presentation.iconName)).size).toBe(9);
    entries.forEach(([statusCode, presentation]) => {
      const annotation: PaperStatusAnnotation = {
        annotationId: 'synthetic.annotation.presentation',
        documentId: 'synthetic.document',
        documentVersion: 'synthetic-version',
        bundleGenerationId: 'synthetic-generation',
        stableSectionId: 'synthetic.section',
        target: { kind: 'BLOCK', blockId: 'synthetic.block' },
        statusCode: statusCode as keyof typeof expectedLabels,
        authorityKind: statusCode === 'IN_FORCE_LEGAL_OR_POLICY' ? 'STATUTE' : 'NOT_APPLICABLE',
        decisionAuthority: statusCode === 'REVIEW_QUESTION' ? 'PHASE2_PROJECT_GOVERNANCE' : 'NOT_APPLICABLE',
        reviewerRole: statusCode === 'REVIEW_QUESTION' ? 'ADVISORY_ERROR_GAP_SOURCE_INPUT' : 'NOT_APPLICABLE',
        rationale: 'Synthetic presentation test.',
        ...(statusCode === 'IN_FORCE_LEGAL_OR_POLICY' ? { sourceLocator: 'fixture://sources/synthetic-source.json' as const } : {}),
        validatedBy: 'SYNTHETIC_FIXTURE_VALIDATOR',
        validatedAt: '2026-01-01T00:00:00.000Z',
        validationState: 'VALIDATED',
      };
      const label = paperStatusLabel(annotation);
      const typedStatus = statusCode as keyof typeof expectedLabels;
      expect(label).toBe(expectedLabels[typedStatus]);
      expect(presentation.label).toBe(expectedTemplates[typedStatus]);
      expect(presentation.signal.length).toBeGreaterThan(0);
      expect(presentation.explanation.length).toBeGreaterThan(0);
      expect(presentation.className).toContain('dark:');
      requiredClassTokens[typedStatus].forEach((token) => expect(presentation.className).toContain(token));
      const rendered = renderToStaticMarkup(<PaperStatusAnnotationCard annotation={annotation} />);
      expect(rendered).toContain(`data-status-code="${statusCode}"`);
      expect(rendered).toContain(`data-status-icon="${presentation.iconName}"`);
      expect(rendered).toContain('data-annotation-id="synthetic.annotation.presentation"');
      expect(rendered).toContain(`aria-label="${presentation.signal}"`);
      expect(rendered).toContain('<time dateTime="2026-01-01T00:00:00.000Z">2026-01-01</time>');
    });
    expect(PAPER_STATUS_PRESENTATIONS.ILLUSTRATIVE_VALUE_OR_CALCULATION.className).toContain('cyan');
    expect(PAPER_STATUS_PRESENTATIONS.KNOWN_GAP_OR_UNVERIFIED.className).toContain('rose');
    entries.filter(([status]) => status !== 'ILLUSTRATIVE_VALUE_OR_CALCULATION').forEach(([, value]) => expect(value.className).not.toContain('cyan'));
    entries.filter(([status]) => status !== 'KNOWN_GAP_OR_UNVERIFIED').forEach(([, value]) => expect(value.className).not.toContain('rose'));
    entries.forEach(([, value]) => {
      expect(value.className).not.toMatch(/green|emerald/);
      expect(value.iconName).not.toContain('check');
    });
    expect(PAPER_STATUS_PRESENTATIONS.EMERGING_DRAFT_DIRECTION.explanation).toContain('Not adopted');
    expect(entries.map(([, value]) => value.label)).not.toEqual(expect.arrayContaining([
      'In-force legal or policy source',
      'Project plan direction',
      'Illustrative value or calculation',
      'Known gap or unverified',
      'Outside Phase 2 scope',
    ]));
  });

  it('renders advisory review-question wording and distinct in-force authority meaning', async () => {
    const appendix = renderToStaticMarkup(await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.appendix',
      provider: createSyntheticPaperProvider(),
    }));
    expect(appendix).toContain('Advisory error, gap, and source input only; not a decision or approval and does not grant authority');
    expect(appendix).toContain('Advisory review input is requested; this is not a decision, approval, endorsement, or authority grant.');
    expect(appendix).toContain('aria-label="Advisory comment question"');

    const orientation = renderToStaticMarkup(await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.orientation',
      provider: createSyntheticPaperProvider(),
    }));
    expect(orientation).toContain('Authority meaning:');
    expect(orientation).toContain('In force - Statute');
    expect(orientation).toContain('Authority:</span> Statute');
    expect(orientation).toContain('Source record:</span> fixture://sources/synthetic-statute.json');
    expect(orientation).toContain('aria-label="In-force authority source"');

    const policy = renderToStaticMarkup(await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.framework',
      provider: createSyntheticPaperProvider(),
    }));
    expect(policy).toContain('In force - ENV policy');
    expect(policy).toContain('Authority:</span> ENV policy');
  });

  it('renders verified figure data with an accessible title, description, and caption', async () => {
    const element = await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.framework',
      provider: createSyntheticPaperProvider(),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('<svg');
    expect(html).toContain('<title');
    expect(html).toContain('<desc');
    expect(html).toContain('<figcaption');
  });

  it('relies on React escaping for all fixture text', async () => {
    const provider = createSyntheticPaperProvider();
    const original = provider.getFragment.bind(provider);
    provider.getFragment = async (...args) => {
      const fragment = await original(...args);
      const mutated = structuredClone(fragment);
      const first = mutated.blocks[0];
      if (first.kind === 'callout') first.text = '<script>alert(1)</script>';
      return mutated;
    };
    const element = await PaperSectionReader({
      documentVersion: SYNTHETIC_PAPER_VERSION,
      stableSectionId: 'synthetic.orientation',
      provider,
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
