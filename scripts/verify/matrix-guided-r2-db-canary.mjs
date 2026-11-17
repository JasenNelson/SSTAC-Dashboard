// Isolated database canary scaffold. This file deliberately makes no provider call.
// The authority, disposable project, reviewer roster and exact SQL must be
// separately reviewed before an executable canary is added.
const scenarios = [
  'inactive: both direct RPCs return release_read_only with zero row effects',
  'activated disposable branch: admitted save and complete succeed',
  'activated disposable branch: nonadmitted and foreign-release calls are denied',
  'activated disposable branch: soft-deleted user retains rows but loses admission',
  'activated disposable branch: permanent deletion cascades entries, completion, events and allowlist only',
  'production after activation: approved nonadmitted direct-RPC canary is denied',
];

if (process.argv.slice(2).join(' ') !== '--plan-only') {
  throw new Error('Canary execution is unavailable in this candidate. Use --plan-only; separate exact authority and implementation are required.');
}
for (const scenario of scenarios) process.stdout.write(`${scenario}\n`);
