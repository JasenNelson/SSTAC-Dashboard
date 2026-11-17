# Guided R2 authenticated E2E evidence contract

This is a candidate gate for a separately authorized environment. It has not
been run. Keep credentials in the approved private route and use the existing
Playwright `chromium-auth` setup. Do not store a full Playwright JSON or HTML
report from the credentialed setup. The spec writes only a minimal receipt with
no credentials to `MATRIX_R2_POLICY_E2E_EVIDENCE_DIR`.

Run the guided spec twice, with two separately provisioned fixture identities:

1. An admitted reviewer: set `MATRIX_R2_POLICY_E2E_AUTHORIZED=true`,
   `MATRIX_R2_POLICY_E2E_ROLE=invited`, a unique safe
   `MATRIX_R2_POLICY_E2E_RUN_ID`, and an absolute private
   `MATRIX_R2_POLICY_E2E_EVIDENCE_DIR`. With approved private authentication
   setup and Node 22, run this spec under `--project=chromium-auth --reporter=list`
   only. Retain its passing receipt.
2. A nonadmitted reviewer: use a different test identity, set role exactly
   `not-invited` and a different run ID, and retain its passing receipt.
3. Run `node scripts/verify/matrix-guided-r2-e2e-evidence.mjs` with the invited
   receipt path followed by the noninvited receipt path. This verifier refuses
   missing, skipped, wrong-project, wrong-role, or same-run evidence.

Missing or misspelled role values fail the authorized spec before navigation.
The unauthenticated Playwright projects exclude this spec. A normal skipped
candidate run creates no receipt and cannot satisfy the two-run verifier.
