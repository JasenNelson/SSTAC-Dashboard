// Compare two minimal, credential-free receipts from separately authorized
// chromium-auth runs of e2e/matrix-options-paper-guided-r2.spec.ts.
// Usage: node scripts/verify/matrix-guided-r2-e2e-evidence.mjs <invited.json> <not-invited.json>
import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length !== 2 || files[0] === files[1]) {
  throw new Error('Provide two different evidence files: invited then not-invited.');
}
const expected = [
  { role: 'invited', title: '[invited] shows the paper and account-data notice with read-only state' },
  { role: 'not-invited', title: '[not-invited] keeps the paper readable and withholds guided data' },
];
const receipts = files.map((file, index) => {
  const receipt = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (receipt.role !== expected[index].role || receipt.title !== expected[index].title
    || receipt.project !== 'chromium-auth' || receipt.status !== 'passed'
    || !/^[A-Za-z0-9_-]+$/.test(receipt.runId)
    || !Number.isFinite(Date.parse(receipt.completedAt))) {
    throw new Error(`Invalid ${expected[index].role} authenticated E2E receipt.`);
  }
  return receipt;
});
if (receipts[0].runId === receipts[1].runId) {
  throw new Error('Invited and not-invited evidence must come from separate run IDs.');
}
process.stdout.write('Two distinct authenticated guided R2 E2E passes verified.\n');
