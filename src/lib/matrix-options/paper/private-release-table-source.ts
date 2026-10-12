import 'server-only';

import {
  PrivateReleaseUnavailableError,
  type PaperSessionClient,
  type PrivateAssetSource,
  type PrivateReleaseObject,
} from './private-release-assets';

const TABLE = 'matrix_paper_private_assets_v0991';
const VERSION = 'v0.9.91';
const MAX_OBJECT_BYTES = 1_048_576;
const HEX = /^[0-9a-fA-F]+$/;

type QueryResult = { readonly data: unknown; readonly error: unknown };
interface LimitedQuery extends PromiseLike<QueryResult> {
  abortSignal(signal: AbortSignal): PromiseLike<QueryResult>;
}
interface FilteredQuery {
  limit(count: number): LimitedQuery;
}
interface SelectedQuery {
  eq(column: string, value: string): FilteredQuery;
}
interface TableQuery {
  select(columns: string): SelectedQuery;
}
interface TableClient {
  from(table: string): TableQuery;
}

function unavailable(code: 'CONFIGURATION' | 'STATUS' | 'STRUCTURE' | 'LENGTH' | 'DEADLINE' | 'TRANSPORT'): never {
  throw new PrivateReleaseUnavailableError(code);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactRow(data: unknown): Record<string, unknown> {
  if (!Array.isArray(data) || data.length !== 1 || !record(data[0])) unavailable('STATUS');
  return data[0];
}

async function query(client: PaperSessionClient, columns: string, path: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!path.startsWith(`${VERSION}/`) || signal.aborted) unavailable(signal.aborted ? 'DEADLINE' : 'CONFIGURATION');
  const tableClient = client as unknown as TableClient;
  if (typeof tableClient.from !== 'function') unavailable('CONFIGURATION');
  let response: QueryResult;
  try {
    response = await tableClient.from(TABLE).select(columns).eq('asset_path', path).limit(2).abortSignal(signal);
  } catch {
    unavailable(signal.aborted ? 'DEADLINE' : 'TRANSPORT');
  }
  if (signal.aborted) unavailable('DEADLINE');
  if (response.error) unavailable('STATUS');
  return exactRow(response.data);
}

/** One request-bound, signed-in client. Every admission is a fresh RLS query. */
export function privateReleaseTableSource(client: PaperSessionClient): PrivateAssetSource {
  return {
    async admits(object, signal) {
      const row = await query(client, 'asset_path', object.path, signal);
      if (row.asset_path !== object.path) unavailable('STRUCTURE');
    },
    async read(object: PrivateReleaseObject, signal) {
      const row = await query(client, 'asset_path,document_version,byte_length,sha256,mime_type,payload', object.path, signal);
      if (row.asset_path !== object.path ||
          row.document_version !== VERSION ||
          row.byte_length !== object.bytes ||
          row.sha256 !== object.sha256 ||
          row.mime_type !== object.mediaType) unavailable('STRUCTURE');
      const raw = row.payload;
      if (typeof raw !== 'string' || !raw.startsWith('\\x')) unavailable('STRUCTURE');
      const hex = raw.slice(2);
      if (object.bytes <= 0 || object.bytes > MAX_OBJECT_BYTES || hex.length !== 2 * object.bytes) unavailable('LENGTH');
      if (!HEX.test(hex)) unavailable('STRUCTURE');
      return { bytes: Buffer.from(hex, 'hex'), mediaType: object.mediaType };
    },
  };
}
