# Matrix Options Security Fix Packet

## Item 1 -- `/api/hitl-packets/*` missing reviewer/admin role gate

**Problem Restated:**
The API routes under `src/app/api/hitl-packets/` are currently gating access only on the presence of a valid session (i.e., `getAuthenticatedUser`), lacking a specific role gate. This allows any authenticated user to access these administrative endpoints.

Vulnerable lines (`src/app/api/hitl-packets/route.ts:17-19` and similar in sibling route):
```typescript
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
```

**Recommended Option & Alternatives:**
- **Option A (Recommended):** Gate these routes to the existing `admin` / `matrix_admin` roles by inlining the canonical `user_roles` query pattern found in `src/app/api/matrix-map/admin/audit-history/route.ts` and other admin API routes.
- **Option B (Alternative):** Introduce a dedicated `reviewer` role. This is a larger effort requiring database migrations to update the `user_roles` enum/constraints, migrating existing users, updating middleware, and touching multiple frontend gating models.

**Exact Proposed Diff (Option A):**
`src/app/api/hitl-packets/route.ts` (apply same pattern to `[sessionId]/route.ts`)
```diff
@@ -17,6 +17,17 @@ export async function GET() {
     if (!user) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
+
+    const { data: role, error: roleError } = await supabase
+      .from('user_roles')
+      .select('role')
+      .eq('user_id', user.id)
+      .in('role', ['admin', 'matrix_admin'])
+      .limit(1)
+      .maybeSingle();
+
+    if (roleError || !role) {
+      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
+    }
 
     const sessions = discoverPacketSessions();
```

**Blast Radius:** Legitimate non-admin consumers (if any exist) would be blocked and return `403 Forbidden`. Currently, only admins process HITL packets.
**Tests to Add:** Add an API integration test verifying that a non-admin session receives a 403 status code.

---

## Item 2 -- `/api/graphs/prioritization-matrix` leaks authenticated non-CEW voter `user_id`

**Problem Restated:**
The endpoint leaks the raw `user_id` for authenticated voters to any other authenticated user because the caching tier logic distinguishes only between anonymous and authenticated callers, instead of restricting raw PII strictly to admins.

Vulnerable lines (`src/app/api/graphs/prioritization-matrix/route.ts:574-578`):
```typescript
    const responseData: EnhancedMatrixData[] = isAuthenticated
      ? matrixData
      : matrixData.map(entry => ({
          ...entry,
          individualPairs: entry.individualPairs.filter(pair => pair.userType !== 'authenticated'),
        }));
```

**Options:**
- **Option A:** Drop `user_id` (return a generic placeholder) for authenticated non-admin callers.
- **Option B (Recommended):** Pseudonymize via a stable hash, maintaining distinct points for the UI scatterplot without exposing the underlying UUID.

**Exact Proposed Diff (Option A - Omit/Null):**
```diff
@@ -118,6 +118,17 @@ export async function GET(request: Request) {
   const authClient = await createAuthenticatedClient();
   const requester = await getAuthenticatedUser(authClient);
   const isAuthenticated = !!requester;
+  
+  let isAdmin = false;
+  if (requester) {
+    const { data: role } = await authClient
+      .from('user_roles')
+      .select('role')
+      .eq('user_id', requester.id)
+      .in('role', ['admin', 'matrix_admin'])
+      .limit(1)
+      .maybeSingle();
+    isAdmin = !!role;
+  }
 
-  const cacheTier = isAuthenticated ? 'auth' : 'public';
+  const cacheTier = isAdmin ? 'admin' : (isAuthenticated ? 'auth' : 'public');
@@ -574,8 +585,13 @@ export async function GET(request: Request) {
-    const responseData: EnhancedMatrixData[] = isAuthenticated
-      ? matrixData
-      : matrixData.map(entry => ({
+    const responseData: EnhancedMatrixData[] = matrixData.map(entry => ({
           ...entry,
-          individualPairs: entry.individualPairs.filter(pair => pair.userType !== 'authenticated'),
+          individualPairs: entry.individualPairs.map(pair => {
+            if (pair.userType === 'authenticated' && !isAdmin) {
+              return { ...pair, userId: 'redacted-id' };
+            }
+            return pair;
+          }).filter(pair => isAuthenticated || pair.userType !== 'authenticated'),
         }));
```
*Note on UI Tooltip Effect (Option A):* Providing `null` would crash `PrioritizationMatrixGraph.tsx` since it calls `userId.substring(0, 8)`. Using a placeholder string like `'redacted-id'` prevents crashes but groups all users under the same visual tooltip string.

**Exact Proposed Diff (Option B - Pseudonymize):**
```diff
@@ -4,6 +4,7 @@ import { createAnonymousClient, createAuthenticatedClient, getAuthenticatedUser }
+import { createHash } from 'crypto';
@@ -118,6 +119,17 @@ export async function GET(request: Request) {
   const authClient = await createAuthenticatedClient();
   const requester = await getAuthenticatedUser(authClient);
   const isAuthenticated = !!requester;
+  
+  let isAdmin = false;
+  if (requester) {
+    const { data: role } = await authClient
+      .from('user_roles')
+      .select('role')
+      .eq('user_id', requester.id)
+      .in('role', ['admin', 'matrix_admin'])
+      .limit(1)
+      .maybeSingle();
+    isAdmin = !!role;
+  }
 
-  const cacheTier = isAuthenticated ? 'auth' : 'public';
+  const cacheTier = isAdmin ? 'admin' : (isAuthenticated ? 'auth' : 'public');
@@ -574,8 +585,14 @@ export async function GET(request: Request) {
-    const responseData: EnhancedMatrixData[] = isAuthenticated
-      ? matrixData
-      : matrixData.map(entry => ({
+    const responseData: EnhancedMatrixData[] = matrixData.map(entry => ({
           ...entry,
-          individualPairs: entry.individualPairs.filter(pair => pair.userType !== 'authenticated'),
+          individualPairs: entry.individualPairs.map(pair => {
+            if (pair.userType === 'authenticated' && !isAdmin) {
+              const pseudoId = createHash('sha256').update(pair.userId + process.env.NEXT_PUBLIC_SUPABASE_URL).digest('hex');
+              return { ...pair, userId: pseudoId };
+            }
+            return pair;
+          }).filter(pair => isAuthenticated || pair.userType !== 'authenticated'),
         }));
```
*Note on Blast Radius (Option B):* Unauthenticated users remain blocked from viewing authenticated data. Non-admin users see stable hashed IDs, preserving scatter chart groupings and tooltip substring compatibility.
**Tests to Add:** Verify the `userId` field contains a sha256 hex string when requested by a non-admin authenticated user.

---

## Item 3 -- `escapeCSV` does not neutralize CSV-injection prefixes

**Problem Restated:**
The current `escapeCSV` implementation prevents delimiter collisions but does not protect against Formula Injection (CSV Injection), where cell values beginning with `=, +, -, @` could execute arbitrary code when opened in Excel or similar applications.

Vulnerable lines (`src/lib/regulatory-review/memo-generator.ts:654-659`):
```typescript
  // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
```

**Exact Proposed Diff:**
`src/lib/regulatory-review/memo-generator.ts`
```diff
@@ -653,9 +653,13 @@ function escapeCSV(text: string): string {
 function escapeCSV(text: string): string {
   if (!text) return '';
+  let safeText = text;
+  // Mitigate CSV injection (OWASP)
+  if (/^[=+\-@\t\r]/.test(safeText)) {
+    safeText = "'" + safeText;
+  }
   // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
-  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
-    return `"${text.replace(/"/g, '""')}"`;
+  if (safeText.includes(',') || safeText.includes('"') || safeText.includes('\n')) {
+    return `"${safeText.replace(/"/g, '""')}"`;
   }
-  return text;
+  return safeText;
 }
```

**Blast Radius:** Legitimate values that naturally start with `=, +, -, @` will have a single leading quote `'` appended, which prevents evaluation in spreadsheet software but keeps data visible. 
**Tests to Add:** Add a unit test asserting `escapeCSV("=1+1") === "'=1+1"` and `escapeCSV("@SUM(A1:A2)") === "'@SUM(A1:A2)"`.

**Other Locations Needing Same Guard:**
- `src/lib/poll-export-utils.ts` (`escapeCSV`)
- `src/lib/engine-v2/export_formats.ts` (`escapeCSV`)
