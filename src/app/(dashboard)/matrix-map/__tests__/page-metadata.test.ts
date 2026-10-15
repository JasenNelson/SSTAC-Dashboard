import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The standalone /matrix-map route is the Database view (route unchanged).
// Read the page source rather than importing it: the module pulls in server-only
// Supabase and cookie helpers that are irrelevant to its user-facing copy.
const PAGE_PATH = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'matrix-map', 'page.tsx');
const source = fs.readFileSync(PAGE_PATH, 'utf8');

describe('/matrix-map page copy', () => {
  it('titles the page Database', () => {
    expect(source).toContain("title: 'Database | SSTAC Dashboard'");
  });

  it('uses Database as the H1 and drops internal PR labels from the header', () => {
    expect(source).toMatch(/<h1[^>]*>\s*Database\s*<\/h1>/);
    expect(source).not.toContain('Interactive Map -- PR-MAP-3a');
    expect(source).not.toContain('PR-MAP-3a renders');
  });
});
