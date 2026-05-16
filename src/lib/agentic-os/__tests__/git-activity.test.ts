import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import path from 'path';

// Engine-v2 spawn-mock pattern (see src/lib/engine-v2/__tests__/spawn_extraction.test.ts).
// A module-scope mock fn is referenced inside the vi.mock factory so it survives
// hoisting; the factory builds an overlay that includes BOTH the spread of the
// actual module AND a `default: overlay` key so CJS interop callers (including
// vitest's own type-checker) see the default export they expect.
const spawnMock = vi.fn();
vi.mock('child_process', async (importActual) => {
  const actual = await importActual<typeof import('child_process')>();
  const overlay = {
    ...actual,
    spawn: (...args: unknown[]) => spawnMock(...args),
  };
  return {
    ...overlay,
    default: overlay,
  };
});

import {
  getProjectActivity,
  getAllProjectsActivity,
} from '../git-activity';

// Build a fake ChildProcess that emits whatever stdout / stderr / close /
// error timing each test needs.
function makeFakeChild(opts: {
  stdout?: string;
  stderr?: string;
  exitCode?: number | null;
  emitError?: Error;
  /** If set, never emit close (simulates a hung git -- triggers the timeout path). */
  hang?: boolean;
}) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: (signal?: string) => void;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();

  // Defer event emission to the next tick so listeners attach first.
  queueMicrotask(() => {
    if (opts.emitError) {
      proc.emit('error', opts.emitError);
      return;
    }
    if (opts.stdout) proc.stdout.emit('data', Buffer.from(opts.stdout, 'utf-8'));
    if (opts.stderr) proc.stderr.emit('data', Buffer.from(opts.stderr, 'utf-8'));
    if (!opts.hang) {
      proc.emit('close', opts.exitCode ?? 0);
    }
  });

  return proc as unknown as ChildProcess;
}

// Absolute paths so isPlausibleProjectPath accepts them. Use a platform-aware
// constant so tests run on both Windows CI and Linux CI.
const FAKE_REPO = path.isAbsolute('C:\\fake')
  ? 'C:\\Projects\\FakeRepo'
  : '/fake/projects/FakeRepo';

beforeEach(() => {
  spawnMock.mockReset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getProjectActivity', () => {
  it('parses a happy-path git log output into daily counts + recent commits', async () => {
    // Two commits on today's date, one on yesterday, one outside the rendered
    // window but inside `--since` (parser does not filter by window; only the
    // daily aggregation uses recent dates).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    const isoYest = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;

    const stdout = [
      `abc1234\t${isoToday}\t${isoToday}T14:30:00-08:00\tfix(x): tweak`,
      `def5678\t${isoToday}\t${isoToday}T09:15:00-08:00\tfeat(y): new`,
      `aaa9999\t${isoYest}\t${isoYest}T18:00:00-08:00\tchore: refactor`,
    ].join('\n');

    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout }));

    const result = await getProjectActivity('R', FAKE_REPO, { days: 14, recentCount: 5 });

    expect(result.error).toBeUndefined();
    expect(result.projectName).toBe('R');
    expect(result.totalCommits).toBe(3);
    expect(result.daily).toHaveLength(14);
    // last entry is today
    expect(result.daily.at(-1)).toEqual({ date: isoToday, count: 2 });
    // second-to-last is yesterday
    expect(result.daily.at(-2)).toEqual({ date: isoYest, count: 1 });
    // recent is in input order; first three commits captured
    expect(result.recent).toHaveLength(3);
    expect(result.recent[0]).toEqual({
      sha: 'abc1234',
      authoredAt: `${isoToday}T14:30:00-08:00`,
      subject: 'fix(x): tweak',
    });
    expect(result.lastCommitAt).toBe(`${isoToday}T14:30:00-08:00`);
  });

  it('returns all-zero daily window + null lastCommitAt when stdout is empty', async () => {
    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout: '' }));
    const result = await getProjectActivity('Empty', FAKE_REPO, { days: 7 });
    expect(result.error).toBeUndefined();
    expect(result.totalCommits).toBe(0);
    expect(result.daily).toHaveLength(7);
    expect(result.daily.every((d) => d.count === 0)).toBe(true);
    expect(result.recent).toEqual([]);
    expect(result.lastCommitAt).toBeNull();
  });

  it('returns an error ProjectActivity when spawn emits "error" (git not on PATH)', async () => {
    const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    spawnMock.mockReturnValueOnce(makeFakeChild({ emitError: enoent }));
    const result = await getProjectActivity('R', FAKE_REPO);
    expect(result.error).toBe('ENOENT');
    expect(result.totalCommits).toBe(0);
    // Daily window still rendered for sparkline fallback rendering.
    expect(result.daily).toHaveLength(14);
  });

  it('returns an error ProjectActivity on non-zero exit (e.g., not a git repo, exit 128)', async () => {
    spawnMock.mockReturnValueOnce(
      makeFakeChild({
        exitCode: 128,
        stderr: 'fatal: not a git repository',
      })
    );
    const result = await getProjectActivity('NoRepo', FAKE_REPO);
    expect(result.error).toMatch(/git exited 128/);
    expect(result.error).toMatch(/not a git repository/);
    expect(result.totalCommits).toBe(0);
  });

  it('times out when git hangs and reports git_log_timeout', async () => {
    vi.useFakeTimers();
    spawnMock.mockReturnValueOnce(makeFakeChild({ hang: true }));
    const promise = getProjectActivity('Hung', FAKE_REPO);
    // Advance past the 8s timeout window.
    await vi.advanceTimersByTimeAsync(8_500);
    const result = await promise;
    expect(result.error).toBe('git_log_timeout');
  });

  it('rejects an empty or non-absolute project path before spawning', async () => {
    const result = await getProjectActivity('R', '');
    expect(result.error).toBe('invalid_or_missing_path');
    expect(spawnMock).not.toHaveBeenCalled();

    const relative = await getProjectActivity('R', 'relative/path');
    expect(relative.error).toBe('invalid_or_missing_path');
  });

  it('rejects a project path that starts with "-" (would be parsed as a git flag)', async () => {
    const result = await getProjectActivity(
      'R',
      // Even if it were absolute on POSIX, the leading `-` makes it
      // dangerous as a CLI arg.
      '-upload-pack=/tmp/evil'
    );
    expect(result.error).toBe('invalid_or_missing_path');
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('silently skips malformed lines (fewer than three tabs)', async () => {
    const stdout = [
      'not-a-real-line',
      'abc\tonly-two-tabs\there',
      'abc1234\t2026-05-15\t2026-05-15T10:00:00-08:00\tvalid subject',
    ].join('\n');
    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout }));
    const result = await getProjectActivity('R', FAKE_REPO);
    expect(result.totalCommits).toBe(1);
    expect(result.recent).toHaveLength(1);
    expect(result.recent[0].sha).toBe('abc1234');
  });

  it('preserves tabs inside the commit subject (parser uses indexOf on first three tabs only)', async () => {
    const stdout = 'abc1234\t2026-05-15\t2026-05-15T10:00:00-08:00\tcol1\tcol2\tcol3';
    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout }));
    const result = await getProjectActivity('R', FAKE_REPO);
    expect(result.recent[0].sha).toBe('abc1234');
    expect(result.recent[0].subject).toBe('col1\tcol2\tcol3');
  });

  it('caps the recent array at recentCount even when stdout has more commits', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => {
      const sha = String(i).padStart(7, '0');
      return `${sha}\t2026-05-15\t2026-05-15T10:00:00-08:00\tcommit ${i}`;
    });
    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout: rows.join('\n') }));
    const result = await getProjectActivity('R', FAKE_REPO, { recentCount: 5 });
    expect(result.totalCommits).toBe(20);
    expect(result.recent).toHaveLength(5);
    expect(result.recent[0].subject).toBe('commit 0');
    expect(result.recent[4].subject).toBe('commit 4');
  });

  it('lastCommitAt is the maximum (most-recent) ci timestamp across all parsed lines', async () => {
    const stdout = [
      'a1\t2026-05-15\t2026-05-15T10:00:00-08:00\tearliest',
      'a2\t2026-05-15\t2026-05-15T18:30:00-08:00\tlatest',
      'a3\t2026-05-15\t2026-05-15T14:00:00-08:00\tmiddle',
    ].join('\n');
    spawnMock.mockReturnValueOnce(makeFakeChild({ stdout }));
    const result = await getProjectActivity('R', FAKE_REPO);
    expect(result.lastCommitAt).toBe('2026-05-15T18:30:00-08:00');
  });
});

describe('getAllProjectsActivity', () => {
  it('fans out in parallel and indexes results by project name', async () => {
    const stdout1 = 'a1\t2026-05-15\t2026-05-15T10:00:00-08:00\tone';
    const stdout2 = 'b1\t2026-05-15\t2026-05-15T11:00:00-08:00\ttwo';
    spawnMock
      .mockReturnValueOnce(makeFakeChild({ stdout: stdout1 }))
      .mockReturnValueOnce(makeFakeChild({ stdout: stdout2 }));

    const result = await getAllProjectsActivity([
      { name: 'Proj1', path: FAKE_REPO },
      { name: 'Proj2', path: FAKE_REPO },
    ]);

    expect(Object.keys(result).sort()).toEqual(['Proj1', 'Proj2']);
    expect(result.Proj1.recent[0].subject).toBe('one');
    expect(result.Proj2.recent[0].subject).toBe('two');
  });

  it('isolates per-project failures: one bad project does not poison the others', async () => {
    spawnMock
      .mockReturnValueOnce(
        makeFakeChild({ exitCode: 128, stderr: 'not a git repo' })
      )
      .mockReturnValueOnce(
        makeFakeChild({ stdout: 'a1\t2026-05-15\t2026-05-15T10:00:00-08:00\tworked' })
      );

    const result = await getAllProjectsActivity([
      { name: 'Bad', path: FAKE_REPO },
      { name: 'Good', path: FAKE_REPO },
    ]);

    expect(result.Bad.error).toMatch(/git exited 128/);
    expect(result.Good.error).toBeUndefined();
    expect(result.Good.totalCommits).toBe(1);
  });
});
