// Matrix R2 disposable local full-stack preview: the local-only identities of one run.
//
// Every preview run seeds three FRESH accounts that exist only in that run's disposable local
// database: reviewer A, reviewer B and an administrator. Their emails are run-scoped on the
// reserved local domain and each gets a fresh random password. They are kept only in the run's
// gitignored sign-in state file (.tmp/r2-fullstack/runs/<run id>/sign-ins.json), used by the
// local launcher and journey. No .env.local, test-account variable or production credential is
// ever read or used.
import { randomBytes } from 'node:crypto';

export const PREVIEW_ACCOUNTS = Object.freeze([
  { key: 'reviewerA', admin: false, role: 'reviewer A' },
  { key: 'reviewerB', admin: false, role: 'reviewer B' },
  { key: 'admin', admin: true, role: 'administrator' },
]);
export const SIGN_IN_MODE = 'disposable-local';
const RUN_ID_PATTERN = /^r2pv-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function disposableEmail(runId, key) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('invalid run id');
  return `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-${runId.slice(-8)}@r2-preview.local`;
}

/** Fresh sign-ins for one run (passwords are random and new for every run). */
export function newDisposableSignIns(runId, random = () => randomBytes(18).toString('base64url')) {
  return PREVIEW_ACCOUNTS.map((account) => ({ key: account.key, admin: account.admin, email: disposableEmail(runId, account.key), password: random() }));
}

/**
 * Validates a run's sign-in state exactly: the disposable mode, this run, all three accounts with
 * a local id, the run-scoped local email and a password. Anything else throws; there is no other mode.
 */
export function readDisposableSignIns(record, runId) {
  if (!record || typeof record !== 'object' || record.mode !== SIGN_IN_MODE || record.run_id !== runId) throw new Error('the run sign-in state is missing, malformed or belongs to another run');
  const users = Array.isArray(record.users) ? record.users : [];
  if (users.length !== PREVIEW_ACCOUNTS.length) throw new Error('the run sign-in state is incomplete');
  for (const account of PREVIEW_ACCOUNTS) {
    const user = users.find((entry) => entry?.key === account.key);
    if (!user || user.admin !== account.admin || !UUID_PATTERN.test(user.id ?? '') || user.email !== disposableEmail(runId, account.key)
      || typeof user.password !== 'string' || user.password.length < 16) throw new Error(`the run sign-in for ${account.key} is incomplete`);
  }
  return users;
}
