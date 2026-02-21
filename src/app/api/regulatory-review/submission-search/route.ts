/**
 * Submission Content Search API
 *
 * Searches through the evidence excerpts from the ingested submission
 * to help reviewers find relevant content in the application.
 *
 * NOTE: This API only works in local development where SQLite is available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guards';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available
}

// Path to the regulatory review database
const DB_PATH = path.join(process.cwd(), 'src', 'data', 'regulatory-review.db');

// Evidence item type (from the JSON)
interface EvidenceItem {
  spec_id: string;
  spec_description: string;
  evidence_type: string;
  location: string;
  page_reference?: string;
  excerpt: string;
  confidence: string;
  match_reasons?: string[];
}

// Search result type
interface SearchResult {
  assessmentId: number;
  csapId: string;
  location: string;
  pageReference: string | null;
  excerpt: string;
  evidenceType: string;
  confidence: string;
  specDescription: string;
  matchReasons: string[];
}

export async function GET(request: NextRequest) {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!Database) {
    return NextResponse.json(
      { error: 'Submission search is only available in local development' },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const submissionId = searchParams.get('submissionId');
  const location = searchParams.get('location');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get all assessments with evidence
    let sql = `
      SELECT id, csap_id, evidence_found
      FROM assessments
      WHERE evidence_found IS NOT NULL
    `;
    const params: string[] = [];

    if (submissionId) {
      sql += ` AND submission_id = ?`;
      params.push(submissionId);
    }

    const assessments = db.prepare(sql).all(...params) as {
      id: number;
      csap_id: string;
      evidence_found: string;
    }[];

    // Search through evidence
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 1);

    for (const assessment of assessments) {
      try {
        const evidence: EvidenceItem[] = JSON.parse(assessment.evidence_found);

        for (const item of evidence) {
          // Check if location filter matches
          if (location && location !== 'all' && item.location !== location) {
            continue;
          }

          // Search in excerpt, location, and spec_description
          const searchableText = [
            item.excerpt || '',
            item.location || '',
            item.spec_description || '',
          ].join(' ').toLowerCase();

          // Check if any query term matches
          const matches = queryTerms.some(term => searchableText.includes(term));

          if (matches) {
            results.push({
              assessmentId: assessment.id,
              csapId: assessment.csap_id,
              location: item.location || 'Unknown',
              pageReference: item.page_reference || null,
              excerpt: item.excerpt || '',
              evidenceType: item.evidence_type || 'UNKNOWN',
              confidence: item.confidence || 'MEDIUM',
              specDescription: item.spec_description || '',
              matchReasons: item.match_reasons || [],
            });

            if (results.length >= limit) break;
          }
        }
      } catch {
        // Skip malformed JSON
        continue;
      }

      if (results.length >= limit) break;
    }

    // Get unique locations for filtering
    const locationsSet = new Set<string>();
    for (const assessment of assessments) {
      try {
        const evidence: EvidenceItem[] = JSON.parse(assessment.evidence_found);
        for (const item of evidence) {
          if (item.location) {
            locationsSet.add(item.location);
          }
        }
      } catch {
        continue;
      }
    }

    db.close();

    return NextResponse.json({
      query,
      count: results.length,
      results,
      filters: {
        locations: Array.from(locationsSet).sort(),
      },
    });
  } catch (error) {
    console.error('Submission search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}
