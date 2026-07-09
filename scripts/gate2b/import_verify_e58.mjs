import * as fs from 'fs';
import { buildSubmissionChunkRows, buildCitationRows } from '../../src/lib/engine-v2/submission_chunks_indexing.ts';
import { extractEvidenceSlices } from '../../src/lib/engine-v2/evidence_slices.ts';
import { importEvalResult } from '../../src/lib/engine-v2/eval_result_import.ts';

// TEST_EVALUATION_ID is a placeholder only -- no v2_evaluations row with this id exists.
const TEST_EVALUATION_ID = "22222222-2222-2222-2222-222222222222";
// NOTE (2026-07-09): the "33333333-3333-3333-3333-333333333333" directory name below started
// as a placeholder-looking fixture id, but a v2_evaluations row with this EXACT id (under
// project_id 11111111-1111-1111-1111-111111111111, "M6 Dress Rehearsal") is now REAL, live
// production data -- the actual imported E-58 result. Do not delete or overwrite this local
// staging directory, and do not assume this id is safe-to-reuse test data in any future script.
const DEFAULT_FIXTURE_PATH = "C:\\Projects\\Regulatory-Review\\engine_v2_dashboard_staging\\data\\v2_dashboard_eval_runs\\33333333-3333-3333-3333-333333333333\\636249a3-3302-4048-bca8-167fa6e90060\\eval_result.json";

function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = true;
  let writeMode = false;
  let fixturePath = DEFAULT_FIXTURE_PATH;
  let evaluationId = TEST_EVALUATION_ID;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--write') {
      writeMode = true;
      dryRun = false;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--fixture' && i + 1 < args.length) {
      fixturePath = args[i + 1];
      i++;
    } else if (args[i] === '--evaluation-id' && i + 1 < args.length) {
      evaluationId = args[i + 1];
      i++;
    }
  }

  if (writeMode) {
    dryRun = false;
  }

  return { dryRun, writeMode, fixturePath, evaluationId };
}

async function main() {
  // NOTE: No part of this script -- dry-run or write -- is authorization to run against production
  // or any Supabase branch; that authorization is a separate, explicit owner decision made outside this file.

  const { dryRun, writeMode, fixturePath, evaluationId } = parseArgs();

  if (writeMode) {
    // FAIL-CLOSED guard: only reads a Supabase env var when write mode has been
    // explicitly requested via --write. Dry-run (the default mode) never reads
    // GATE2B_SUPABASE_URL or any other Supabase/credential env var.
    const envUrl = process.env.GATE2B_SUPABASE_URL || '';
    if (envUrl.includes('qyrhsieynzfgyuqzznap')) {
      console.error('ERROR: Production Supabase URL detected in GATE2B_SUPABASE_URL. Aborting.');
      process.exit(1);
    }

    console.error(
      "ERROR: --write mode is intentionally disabled. " +
      "Items 1-5 (importEvalResult usage, row existence checks, RPC auth warning, dynamic evaluation_id, and fail exit code) " +
      "are now fixed in the code design. However, this script still uses a service-role Supabase client, " +
      "which cannot call the replace_submission_chunks RPC (grants are authenticated-only; see " +
      "supabase/migrations/20260513_v2_submission_chunks_rpc.sql), and no live run has ever been attempted or " +
      "reviewed. Do not remove this guard without getting a fresh codex review + explicit owner approval. " +
      "Use --dry-run instead (default mode, zero network calls)."
    );
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(fixturePath, 'utf8');
  } catch (err) {
    console.error(`ERROR: Could not read fixture file at ${fixturePath}: ${err.message}`);
    process.exit(1);
  }

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Could not parse fixture JSON: ${err.message}`);
    process.exit(1);
  }

  const perPolicyResults = Array.isArray(envelope.per_policy_results) ? envelope.per_policy_results : [];
  const slicesMap = envelope.evidence_slices || {};
  const normalizedSlices = extractEvidenceSlices(envelope) || {};

  if (dryRun) {
    const chunkRows = buildSubmissionChunkRows(evaluationId, normalizedSlices);
    const citationRows = buildCitationRows(evaluationId, perPolicyResults, normalizedSlices);

    const strippedChunks = chunkRows.map(({ evaluation_id, ...row }) => row);
    const strippedCitations = citationRows.map(({ evaluation_id, ...row }) => row);

    const perPolicyCount = perPolicyResults.length;
    const slicesCount = Object.keys(normalizedSlices).length;
    const pChunksLength = strippedChunks.length;

    let leakedKeys = 0;
    for (const r of strippedChunks) {
      if ('evaluation_id' in r) leakedKeys++;
    }
    for (const r of strippedCitations) {
      if ('evaluation_id' in r) leakedKeys++;
    }

    const envelopeStatus = envelope.status || 'undefined';

    console.log(`per_policy_results count: ${perPolicyCount}`);
    console.log(`evidence_slices count: ${slicesCount}`);
    console.log(`p_chunks.length: ${pChunksLength}`);
    console.log(`leaked evaluation_id keys: ${leakedKeys}`);
    console.log(`envelope status: ${envelopeStatus}`);

    let failed = false;
    if (perPolicyCount !== 42) {
      console.error(`Check failed: expected 42 per_policy_results, got ${perPolicyCount}`);
      failed = true;
    }
    if (slicesCount !== 420) {
      console.error(`Check failed: expected 420 evidence_slices, got ${slicesCount}`);
      failed = true;
    }
    if (pChunksLength !== 420) {
      console.error(`Check failed: expected 420 p_chunks, got ${pChunksLength}`);
      failed = true;
    }
    if (leakedKeys !== 0) {
      console.error(`Check failed: expected 0 leaked evaluation_id keys, got ${leakedKeys}`);
      failed = true;
    }

    if (failed) {
      process.exit(1);
    }

    process.exit(0);
  }

  if (writeMode) {
    let hadError = false;
    const supabaseUrl = process.env.GATE2B_SUPABASE_URL;
    const supabaseKey = process.env.GATE2B_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('ERROR: GATE2B_SUPABASE_URL is not set.');
      process.exit(1);
    }
    if (!supabaseKey) {
      console.error('ERROR: GATE2B_SUPABASE_SERVICE_ROLE_KEY is not set.');
      process.exit(1);
    }

    const { createClient } = await import('@supabase/supabase-js');

    // A service-role key CANNOT call replace_submission_chunks (grants are authenticated-only;
    // see supabase/migrations/20260513_v2_submission_chunks_rpc.sql). A real write run needs an
    // authenticated-role session/JWT (e.g. the same admin client shape requireAdminForApi() produces
    // in the API routes), not a bare service-role key.
    const client = createClient(supabaseUrl, supabaseKey);
    let parsedUrl;
    try {
      parsedUrl = new URL(supabaseUrl);
    } catch (e) {
      console.error('ERROR: Invalid Supabase URL');
      process.exit(1);
    }
    console.log(`Connected to Supabase at hostname: ${parsedUrl.hostname}`);

    console.log(`Checking if evaluation row ${evaluationId} exists...`);
    let evalRow = null;
    try {
      const { data, error } = await client.from("v2_evaluations").select("id").eq("id", evaluationId).maybeSingle();
      if (error) throw error;
      evalRow = data;
    } catch (err) {
      console.error("ERROR: Failed to query v2_evaluations:", err);
      hadError = true;
    }

    if (!hadError) {
      if (!evalRow) {
        console.error(`ERROR: v2_evaluations row with id ${evaluationId} not found. A real v2_evaluations row must already exist (created via the normal project/evaluate flow). This script deliberately does NOT create one.`);
        process.exit(1);
      } else {
        console.log(`Row found. Calling importEvalResult...`);
        try {
          await importEvalResult(client, evaluationId, envelope);
          console.log("Import completed.");
        } catch (err) {
          console.error("importEvalResult failed:", err);
          hadError = true;
        }
      }
    }

    // CLAUDE.md "What AI Must Never Do" item 11: the AI must never write a real verdict value into
    // v2_judgments, including in a throwaway test/validation script against a disposable branch --
    // there is no "it's just a test" or owner-sign-off exception. This script therefore does NOT
    // perform the judgment-upsert check itself. If that mechanism needs validating, the OWNER must
    // supply or personally run that one write (per CLAUDE.md item 11, path (b)) -- do not re-add an
    // AI-authored verdict upsert here.
    console.log(
      "SKIPPED: judgment-upsert check (CLAUDE.md item 11 -- AI never writes a real verdict value " +
      "into v2_judgments, even for test validation). Owner must supply/run this check manually if needed."
    );

    if (hadError) {
      process.exit(1);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
