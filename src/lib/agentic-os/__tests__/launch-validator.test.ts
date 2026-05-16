import { describe, it, expect } from 'vitest';
import path from 'path';

import {
  validateLaunchRequest,
  __ALLOWED_PROJECTS_FOR_TEST,
  __ALLOWED_ACTIONS_FOR_TEST,
} from '../launch-validator';
import type { LaunchRequest } from '../launch-schemas';

const ALL_PROJECTS = Array.from(__ALLOWED_PROJECTS_FOR_TEST);
const ALL_ACTIONS = Array.from(__ALLOWED_ACTIONS_FOR_TEST);

describe('validateLaunchRequest', () => {
  it('produces a ValidatedLaunch for every (project, action) combination in the allowlist', () => {
    for (const project of ALL_PROJECTS) {
      for (const action of ALL_ACTIONS) {
        const req: LaunchRequest = { project, action };
        const result = validateLaunchRequest(req);
        expect(result.ok, `expected ok for ${project}/${action}`).toBe(true);
        if (result.ok) {
          expect(result.value.exe).toBe('claude');
          expect(result.value.args.length).toBeGreaterThanOrEqual(2);
          expect(result.value.args[0]).toBe('-p');
          // cwd must use path.join semantics for the running platform.
          expect(result.value.cwd).toBe(path.join('C:\\Projects', project));
        }
      }
    }
  });

  it('returns the right slash command for each step-6a action', () => {
    const expected: Record<string, string> = {
      run_safe_exit: '/safe-exit',
      run_update_docs: '/update-docs',
      run_doc_navigator: '/doc-navigator',
    };
    for (const action of ALL_ACTIONS) {
      const result = validateLaunchRequest({ project: 'SSTAC-Dashboard', action });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.args[1]).toBe(expected[action]);
      }
    }
  });

  it('ships exactly the three step-6a actions and no Pattern-B/C templates yet', () => {
    expect(new Set(ALL_ACTIONS)).toEqual(
      new Set(['run_safe_exit', 'run_update_docs', 'run_doc_navigator']),
    );
    // Pattern B (wt.exe) is step 7; must not be in the step-6a registry.
    expect(ALL_ACTIONS).not.toContain('open_session');
  });

  it('ships exactly the 8 PROJECTS_MAP.md projects', () => {
    expect(new Set(ALL_PROJECTS)).toEqual(
      new Set([
        'Regulatory-Review',
        'Regulatory-Review-worktrees/engine-v2',
        'SSTAC-Dashboard',
        'Site3250-KB',
        'TechMemo-KB',
        'Sediment-DRA-Pipeline',
        'Knowledge-Base',
        'EnquiryMgt',
      ]),
    );
  });

  it('rejects an unknown project', () => {
    const result = validateLaunchRequest({
      project: 'NotAProject',
      action: 'run_safe_exit',
    });
    expect(result).toEqual({ ok: false, reason: 'unknown_project' });
  });

  it('rejects an unknown action even if the project is allowlisted', () => {
    const result = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'rm_rf_slash',
    });
    expect(result).toEqual({ ok: false, reason: 'unknown_action' });
  });

  it('rejects shell-metachar project names via the allowlist', () => {
    const hostile = [
      'SSTAC-Dashboard; rm -rf /',
      'SSTAC-Dashboard && echo pwned',
      'SSTAC-Dashboard | curl evil',
      '`echo pwned`',
      '$(echo pwned)',
    ];
    for (const project of hostile) {
      const result = validateLaunchRequest({
        project,
        action: 'run_safe_exit',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    }
  });

  it('rejects path-traversal attempts in project names', () => {
    const hostile = [
      '../etc/passwd',
      '..\\Windows\\System32',
      'SSTAC-Dashboard/../../../etc',
      'SSTAC-Dashboard\\..\\..',
      './SSTAC-Dashboard',
    ];
    for (const project of hostile) {
      const result = validateLaunchRequest({
        project,
        action: 'run_safe_exit',
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_project' });
    }
  });

  it('rejects empty project / empty action', () => {
    expect(
      validateLaunchRequest({ project: '', action: 'run_safe_exit' }),
    ).toEqual({ ok: false, reason: 'unknown_project' });
    expect(
      validateLaunchRequest({ project: 'SSTAC-Dashboard', action: '' }),
    ).toEqual({ ok: false, reason: 'unknown_action' });
  });

  it('rejects prototype-pollution keys masquerading as action names', () => {
    // hasOwnProperty guard prevents __proto__ / constructor / toString from
    // resolving to inherited Object members.
    const hostile = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
    for (const action of hostile) {
      const result = validateLaunchRequest({
        project: 'SSTAC-Dashboard',
        action,
      });
      expect(result).toEqual({ ok: false, reason: 'unknown_action' });
    }
  });

  it('cwd uses path.join (Windows separators on win32, POSIX elsewhere)', () => {
    const result = validateLaunchRequest({
      project: 'Site3250-KB',
      action: 'run_safe_exit',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.cwd).toBe(path.join('C:\\Projects', 'Site3250-KB'));
    }
  });

  it('cwd correctly handles the worktree project that contains a forward slash', () => {
    const result = validateLaunchRequest({
      project: 'Regulatory-Review-worktrees/engine-v2',
      action: 'run_safe_exit',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // path.join normalizes the forward slash in the project name with the
      // platform's separator after joining to C:\Projects.
      expect(result.value.cwd).toBe(
        path.join('C:\\Projects', 'Regulatory-Review-worktrees/engine-v2'),
      );
    }
  });

  it('args is a defensive copy (caller cannot mutate the registry)', () => {
    const r1 = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    const r2 = validateLaunchRequest({
      project: 'SSTAC-Dashboard',
      action: 'run_safe_exit',
    });
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      // Each call returns a fresh array.
      expect(r1.value.args).not.toBe(r2.value.args);
      expect(r1.value.args).toEqual(r2.value.args);
    }
  });
});
