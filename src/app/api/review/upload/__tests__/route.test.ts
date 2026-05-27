import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock handles -- available to vi.mock factories before imports
// ---------------------------------------------------------------------------
const { mockCreateAuthenticatedClient, mockGetAuthenticatedUser } =
  vi.hoisted(() => {
    return {
      mockCreateAuthenticatedClient: vi.fn(),
      mockGetAuthenticatedUser: vi.fn(),
    };
  });

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: mockCreateAuthenticatedClient,
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

// crypto is a Node built-in used for randomBytes(8).toString('hex').
// The real implementation works fine in vitest's jsdom environment.
// Tests that inspect the filename verify the hex format via regex.

// ---------------------------------------------------------------------------
// Import handler under test AFTER mocks are wired
// ---------------------------------------------------------------------------
import { POST } from '../route';

// ---------------------------------------------------------------------------
// Supabase client factory
// ---------------------------------------------------------------------------
interface SupabaseClientCfg {
  submission?: { id: string; user_id: string } | null;
  submissionError?: Error;
  uploadError?: Error;
  uploadPathCapture?: (path: string) => void;
  insertData?: Record<string, unknown>;
  insertError?: Error;
}

function makeSupabaseClient(cfg: SupabaseClientCfg = {}) {
  return {
    from(table: string) {
      if (table === 'review_submissions') {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async single() {
            if (cfg.submissionError) {
              return { data: null, error: cfg.submissionError };
            }
            return { data: cfg.submission ?? null, error: null };
          },
        };
      }
      if (table === 'review_files') {
        return {
          insert() {
            return {
              async select() {
                if (cfg.insertError) {
                  return { data: null, error: cfg.insertError };
                }
                return { data: [cfg.insertData ?? { id: 'file-1' }], error: null };
              },
            };
          },
        };
      }
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async single() {
          return { data: null, error: null };
        },
      };
    },
    storage: {
      from() {
        return {
          async upload(path: string) {
            if (cfg.uploadPathCapture) {
              cfg.uploadPathCapture(path);
            }
            if (cfg.uploadError) {
              return { error: cfg.uploadError };
            }
            return { error: null };
          },
        };
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Request builder
//
// Next.js's NextRequest.formData() loses File MIME type, name, and size when
// constructed from a browser FormData in the jsdom/undici environment because
// jsdom's FormData.get() does not return a proper File object (type/name/size
// all come back undefined). Instead we mock request.formData() to return a
// plain object with a get() method that hands back a controlled file-like
// object. This is the only approach that survives the jsdom/undici boundary.
// ---------------------------------------------------------------------------
interface FileLike {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface RequestOpts {
  /** Pass null to omit the file field entirely (triggers "No file provided"). */
  file?: Partial<FileLike> | null;
  /** Pass null to omit submissionId (triggers "Submission ID is required"). */
  submissionId?: string | null;
}

function makeRequest(opts: RequestOpts = {}): NextRequest {
  const req = new NextRequest('http://localhost/api/review/upload', {
    method: 'POST',
  });

  const fileLike: FileLike | null =
    opts.file === null
      ? null
      : {
          name: opts.file?.name ?? 'test.pdf',
          type: opts.file?.type ?? 'application/pdf',
          size: opts.file?.size ?? 1024,
          arrayBuffer: async () => new ArrayBuffer(opts.file?.size ?? 1024),
        };

  const formDataMap: Record<string, FileLike | string | null> = {};
  if (fileLike !== null) {
    formDataMap['file'] = fileLike;
  }
  if (opts.submissionId !== null) {
    formDataMap['submissionId'] = opts.submissionId ?? 'sub-1';
  }

  req.formData = vi.fn().mockResolvedValue({
    get(key: string) {
      return formDataMap[key] ?? null;
    },
  });

  return req;
}

// ---------------------------------------------------------------------------
// Default authenticated user
// ---------------------------------------------------------------------------
const DEFAULT_USER = { id: 'user-abc', email: 'test@example.com' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/review/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated as DEFAULT_USER with a valid owning submission
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue(DEFAULT_USER);
  });

  // -------------------------------------------------------------------------
  // 1. 401 when not authenticated
  // -------------------------------------------------------------------------
  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const req = makeRequest();
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  // -------------------------------------------------------------------------
  // 2. 400 when no file is provided
  // -------------------------------------------------------------------------
  it('returns 400 when no file is provided', async () => {
    const req = makeRequest({ file: null });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No file provided');
  });

  // -------------------------------------------------------------------------
  // 3. 400 when submissionId is missing
  // -------------------------------------------------------------------------
  it('returns 400 when submissionId is missing', async () => {
    const req = makeRequest({ submissionId: null });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Submission ID is required');
  });

  // -------------------------------------------------------------------------
  // 4. 400 for invalid MIME type
  // -------------------------------------------------------------------------
  it('returns 400 for invalid MIME type (application/javascript)', async () => {
    const req = makeRequest({
      file: { name: 'script.js', type: 'application/javascript' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid file type/i);
    expect(body.allowedTypes).toEqual(['pdf', 'docx', 'doc', 'txt', 'xlsx']);
  });

  // -------------------------------------------------------------------------
  // 5. 413 for file exceeding 10MB
  // -------------------------------------------------------------------------
  it('returns 413 for file exceeding 10MB size limit', async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    const req = makeRequest({ file: { size: tenMbPlusOne } });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.maxSize).toBe(10 * 1024 * 1024);
    expect(body.actualSize).toBe(tenMbPlusOne);
  });

  // -------------------------------------------------------------------------
  // 6. 400 for invalid file extension
  // -------------------------------------------------------------------------
  it('returns 400 for invalid file extension (.exe)', async () => {
    // application/pdf MIME passes the MIME gate; .exe extension fails the
    // extension gate that runs after the MIME gate.
    const req = makeRequest({
      file: { name: 'payload.exe', type: 'application/pdf' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid file extension/i);
  });

  // -------------------------------------------------------------------------
  // 7. 404 when submission does not belong to user
  // -------------------------------------------------------------------------
  it('returns 404 when submission does not belong to user', async () => {
    const client = makeSupabaseClient({ submission: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest({ submissionId: 'sub-other' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Submission not found or access denied');
  });

  // -------------------------------------------------------------------------
  // 8. 500 when storage upload fails
  // -------------------------------------------------------------------------
  it('returns 500 when storage upload fails', async () => {
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
      uploadError: new Error('Bucket quota exceeded'),
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest();
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to upload file');
  });

  // -------------------------------------------------------------------------
  // 9. 500 when database insert fails
  // -------------------------------------------------------------------------
  it('returns 500 when database insert fails', async () => {
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
      insertError: new Error('unique_violation'),
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest();
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to save file metadata');
  });

  // -------------------------------------------------------------------------
  // 10. 200 with file record on successful upload
  // -------------------------------------------------------------------------
  it('returns 200 with file record on successful upload', async () => {
    const insertData = {
      id: 'file-1',
      submission_id: 'sub-1',
      filename: 'test.pdf',
      mimetype: 'application/pdf',
      file_size: 1024,
    };
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
      insertData,
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest();
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('File uploaded successfully');
    expect(body.file).toEqual(insertData);
  });

  // -------------------------------------------------------------------------
  // 11. Filename is cryptographically random hex
  // -------------------------------------------------------------------------
  it('generates a cryptographically random filename in hex format', async () => {
    const captured: { path: string | null } = { path: null };
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
      uploadPathCapture: (p) => { captured.path = p; },
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest();
    await POST(req);

    expect(captured.path).not.toBeNull();
    const filename = captured.path!.split('/').pop()!;
    const hexPart = filename.replace(/^\d+-/, '').replace(/\.[^.]+$/, '');
    expect(hexPart).toMatch(/^[0-9a-f]{16}$/);
  });

  // -------------------------------------------------------------------------
  // 12. Storage path includes user ID
  // -------------------------------------------------------------------------
  it('constructs correct storage path with user ID', async () => {
    const captured: { path: string | null } = { path: null };
    const client = makeSupabaseClient({
      submission: { id: 'sub-1', user_id: DEFAULT_USER.id },
      uploadPathCapture: (p) => { captured.path = p; },
    });
    mockCreateAuthenticatedClient.mockResolvedValue(client);

    const req = makeRequest();
    await POST(req);

    expect(captured.path).not.toBeNull();
    expect(captured.path!).toMatch(
      new RegExp(`^review-files/${DEFAULT_USER.id}/`)
    );
    expect(captured.path!).toMatch(/\.pdf$/);
  });
});
