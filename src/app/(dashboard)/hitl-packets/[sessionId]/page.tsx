/**
 * HITL Packet Detail — single session view
 *
 * Server component that loads a packet and renders the
 * detail client component with metadata, validation, and
 * decision table.
 *
 * Resilient to malformed packets: validates first, then
 * safely extracts metadata and records with fallbacks.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import ErrorBoundary from '@/components/ErrorBoundary';
import { isValidSessionId, loadPacketBySessionId } from '@/lib/hitl-packets/discovery';
import { validatePacket } from '@/lib/hitl-packets/validator';
import { flattenRecord } from '@/lib/hitl-packets/flatten';
import type { PacketMetadata, PacketRecord, FlatRecord, ValidationResult } from '@/lib/hitl-packets/types';
import HitlPacketDetailClient from './HitlPacketDetailClient';

export const dynamic = 'force-dynamic';

/** Safely extract metadata from a raw packet, returning a fallback if shape is wrong. */
function safeExtractMetadata(raw: unknown, sessionId: string): PacketMetadata {
  const fallback: PacketMetadata = {
    session_id: sessionId,
    generated_at: '(unknown)',
    schema_version: '(unknown)',
    record_count: 0,
    policies_evaluated: null,
    policies_in_kb: null,
    policies_filtered: null,
  };

  if (!raw || typeof raw !== 'object') return fallback;
  const p = raw as Record<string, unknown>;
  const meta = p.metadata;
  if (!meta || typeof meta !== 'object') return fallback;

  const m = meta as Record<string, unknown>;
  return {
    session_id: typeof m.session_id === 'string' ? m.session_id : sessionId,
    generated_at: typeof m.generated_at === 'string' ? m.generated_at : '(unknown)',
    schema_version: typeof m.schema_version === 'string' ? m.schema_version : '(unknown)',
    record_count: typeof m.record_count === 'number' ? m.record_count : 0,
    policies_evaluated: typeof m.policies_evaluated === 'number' ? m.policies_evaluated : null,
    policies_in_kb: typeof m.policies_in_kb === 'number' ? m.policies_in_kb : null,
    policies_filtered: typeof m.policies_filtered === 'number' ? m.policies_filtered : null,
  };
}

/** Safely extract and flatten records, returning empty array on any failure. */
function safeExtractFlatRecords(raw: unknown): FlatRecord[] {
  try {
    if (!raw || typeof raw !== 'object') return [];
    const p = raw as Record<string, unknown>;
    if (!Array.isArray(p.records)) return [];
    return (p.records as PacketRecord[]).map((rec) => flattenRecord(rec));
  } catch {
    return [];
  }
}

export default async function HitlPacketDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect(`/login?redirect=/hitl-packets/${sessionId}`);
  }

  // Validate session ID
  if (!isValidSessionId(sessionId)) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-red-700">Invalid Session ID</h1>
        <p className="mt-2 text-gray-500">The session ID contains invalid characters.</p>
      </div>
    );
  }

  // Load packet
  const rawPacket = loadPacketBySessionId(sessionId);
  if (!rawPacket) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <h1 className="text-xl font-bold text-gray-900">Packet Not Found</h1>
        <p className="mt-2 text-gray-500">
          No packet found for session <code className="bg-gray-100 px-1 rounded">{sessionId}</code>.
        </p>
      </div>
    );
  }

  // Validate first, then safely extract — never assume shape
  const validation: ValidationResult = validatePacket(rawPacket);
  const metadata = safeExtractMetadata(rawPacket, sessionId);
  const flatRecords = safeExtractFlatRecords(rawPacket);

  return (
    <ErrorBoundary>
      <HitlPacketDetailClient
        sessionId={sessionId}
        metadata={metadata}
        validation={validation}
        flatRecords={flatRecords}
      />
    </ErrorBoundary>
  );
}
