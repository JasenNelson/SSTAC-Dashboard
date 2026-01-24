/**
 * Policy Database Search API
 *
 * Searches the RRAA knowledge base (rraa_v3_2.db) for policies
 * matching the user's query using full-text search.
 *
 * NOTE: This API only works in local development. It requires access to
 * external database files that are not available in Vercel.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available
}

// Path to the main RRAA knowledge base
const RRAA_DB_PATH = path.join(process.cwd(), '..', 'Regulatory-Review', 'engine', 'data', 'rraa_v3_2.db');

// Policy result type
interface PolicyResult {
  id: string;
  originalText: string;
  plainLanguage: string | null;
  discretionTier: string;
  topicCategory: string | null;
  subCategory: string | null;
  sourceDocument: string | null;
  sourceSection: string | null;
  sourcePage: string | null;
  keywords: string | null;
  reviewQuestion: string | null;
}

export async function GET(request: NextRequest) {
  if (!Database) {
    return NextResponse.json(
      { error: 'Policy search is only available in local development' },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const tier = searchParams.get('tier');
  const topic = searchParams.get('topic');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const db = new Database(RRAA_DB_PATH, { readonly: true });

    // Build search query
    // First try FTS, fall back to LIKE if FTS fails
    let results: PolicyResult[] = [];

    try {
      // Prepare FTS query - escape special characters and add wildcards
      const ftsQuery = query
        .replace(/['"]/g, '')
        .split(/\s+/)
        .filter(term => term.length > 1)
        .map(term => `"${term}"*`)
        .join(' OR ');

      if (ftsQuery) {
        // Use FTS5 search
        let sql = `
          SELECT
            p.id,
            p.original_text as originalText,
            p.plain_language_summary as plainLanguage,
            p.discretion_tier as discretionTier,
            p.topic_category as topicCategory,
            p.sub_category as subCategory,
            p.source_document_name as sourceDocument,
            p.source_section_reference as sourceSection,
            p.source_page_reference as sourcePage,
            p.keywords,
            p.review_question as reviewQuestion
          FROM policy_statements p
          INNER JOIN policy_statements_fts fts ON p.id = fts.id
          WHERE policy_statements_fts MATCH ?
            AND p.is_active = 1
        `;

        const params: (string | number)[] = [ftsQuery];

        if (tier && tier !== 'all') {
          sql += ` AND p.discretion_tier = ?`;
          params.push(tier);
        }

        if (topic && topic !== 'all') {
          sql += ` AND p.topic_category = ?`;
          params.push(topic);
        }

        sql += ` ORDER BY rank LIMIT ?`;
        params.push(limit);

        results = db.prepare(sql).all(...params) as PolicyResult[];
      }
    } catch (ftsError) {
      // FTS failed, fall back to LIKE search
      console.warn('FTS search failed, using LIKE:', ftsError);

      let sql = `
        SELECT
          id,
          original_text as originalText,
          plain_language_summary as plainLanguage,
          discretion_tier as discretionTier,
          topic_category as topicCategory,
          sub_category as subCategory,
          source_document_name as sourceDocument,
          source_section_reference as sourceSection,
          source_page_reference as sourcePage,
          keywords,
          review_question as reviewQuestion
        FROM policy_statements
        WHERE is_active = 1
          AND (
            original_text LIKE ?
            OR plain_language_summary LIKE ?
            OR keywords LIKE ?
            OR review_question LIKE ?
          )
      `;

      const likeQuery = `%${query}%`;
      const params: (string | number)[] = [likeQuery, likeQuery, likeQuery, likeQuery];

      if (tier && tier !== 'all') {
        sql += ` AND discretion_tier = ?`;
        params.push(tier);
      }

      if (topic && topic !== 'all') {
        sql += ` AND topic_category = ?`;
        params.push(topic);
      }

      sql += ` LIMIT ?`;
      params.push(limit);

      results = db.prepare(sql).all(...params) as PolicyResult[];
    }

    // Get available topics for filtering
    const topics = db.prepare(`
      SELECT DISTINCT topic_category
      FROM policy_statements
      WHERE topic_category IS NOT NULL AND is_active = 1
      ORDER BY topic_category
    `).all() as { topic_category: string }[];

    db.close();

    return NextResponse.json({
      query,
      count: results.length,
      results,
      filters: {
        topics: topics.map(t => t.topic_category),
        tiers: ['TIER_1_BINARY', 'TIER_2_PROFESSIONAL', 'TIER_3_STATUTORY'],
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}
