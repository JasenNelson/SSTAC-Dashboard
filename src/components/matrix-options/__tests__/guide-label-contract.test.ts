import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MATRIX_OPTIONS_VIEWS,
  MATRIX_OPTIONS_VIEW_IDS,
} from '@/lib/matrix-options/navigation';

const GUIDE_PATH = path.join(
  process.cwd(),
  'matrix_research',
  'content_drafts',
  'The_Guide.md',
);
const guide = fs.readFileSync(GUIDE_PATH, 'utf8');

function howToUseSection(text: string): string {
  const start = text.indexOf('## 1. How to Use This Workspace');
  expect(start).toBeGreaterThanOrEqual(0);
  const end = text.indexOf('<!-- SECTION_BOUNDARY -->', start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

// Bullet lines of the form `*   **<Label>:**`. Phase group headers
// ("Phase 2 Scope (...)") are not view labels and are skipped.
function bulletLabels(section: string): { label: string; line: string }[] {
  const out: { label: string; line: string }[] = [];
  for (const line of section.split(/\r?\n/)) {
    const match = /^\s*\*\s+\*\*(.+?):\*\*/.exec(line);
    if (match && !/^Phase \d/.test(match[1])) out.push({ label: match[1], line });
  }
  return out;
}

const LEGACY_IDS = ['TWG Review', 'Interactive Map', 'References & Values'];

describe('The Guide label contract', () => {
  const section = howToUseSection(guide);
  const bullets = bulletLabels(section);

  it('lists the workspace views in dashboard label order', () => {
    expect(bullets.map((b) => b.label)).toEqual(
      MATRIX_OPTIONS_VIEWS.map((v) => v.dashboardLabel),
    );
  });

  it('uses no legacy view ids anywhere in the Guide text', () => {
    for (const legacy of LEGACY_IDS) {
      expect(guide).not.toContain(legacy);
    }
  });

  it('describes the Database bullet as both tables and map', () => {
    const database = bullets.find((b) => b.label === 'Database');
    expect(database).toBeDefined();
    const text = database!.line.toLowerCase();
    expect(text).toContain('tables');
    expect(text).toContain('map');
  });

  it.each(LEGACY_IDS)('keeps %s as a legacy id but not as a visible label', (legacy) => {
    expect((MATRIX_OPTIONS_VIEW_IDS as readonly string[]).includes(legacy)).toBe(true);
    for (const view of MATRIX_OPTIONS_VIEWS) {
      expect(view.dashboardLabel).not.toBe(legacy);
      expect(view.paperLabel).not.toBe(legacy);
    }
  });
});
