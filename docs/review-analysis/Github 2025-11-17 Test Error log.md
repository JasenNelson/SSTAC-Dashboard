> sstac-dashboard-temp@0.1.0 test:coverage
> vitest run --coverage


 RUN  v4.0.6 /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard
      Coverage enabled with v8

stderr | src/app/api/wordcloud-polls/submit/__tests__/route.test.ts > POST /api/wordcloud-polls/submit > Error Handling > should handle poll creation errors
Error getting/creating wordcloud poll: { message: 'Database error' }

stderr | src/app/api/wordcloud-polls/submit/__tests__/route.test.ts > POST /api/wordcloud-polls/submit > Error Handling > should handle vote submission errors
Error submitting wordcloud vote: { message: 'Vote error' }

stderr | src/app/api/wordcloud-polls/submit/__tests__/route.test.ts > POST /api/wordcloud-polls/submit > Error Handling > should handle delete errors gracefully for authenticated users
Error deleting existing wordcloud votes: { message: 'Delete error' }

stderr | src/app/api/ranking-polls/submit/__tests__/route.test.ts > POST /api/ranking-polls/submit > Authenticated Ranking Poll Submission > should delete existing votes before inserting for authenticated users
Error in ranking poll submit API: TypeError: supabaseClient.from(...).insert(...).select is not a function
    at Module.POST (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/api/ranking-polls/submit/route.ts:93:8)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/api/ranking-polls/submit/__tests__/route.test.ts:331:7
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:20

stderr | src/app/api/ranking-polls/submit/__tests__/route.test.ts > POST /api/ranking-polls/submit > Error Handling > should handle poll creation errors
Error creating/getting ranking poll: { message: 'Database error' }

stderr | src/app/api/ranking-polls/submit/__tests__/route.test.ts > POST /api/ranking-polls/submit > Error Handling > should handle vote submission errors
Error submitting ranking votes: { message: 'Vote error' }
[Ranking Poll Submit] Vote error details: {
  "message": "Vote error"
}

stderr | src/app/api/ranking-polls/submit/__tests__/route.test.ts > POST /api/ranking-polls/submit > Error Handling > should handle delete errors gracefully for authenticated users
Error deleting existing ranking votes: { message: 'Delete error' }

 ✓ src/lib/__tests__/poll-export-utils.test.ts (22 tests) 20ms
 ✓ src/app/api/wordcloud-polls/submit/__tests__/route.test.ts (14 tests) 27ms
 ✓ src/app/api/ranking-polls/submit/__tests__/route.test.ts (9 tests) 48ms
stderr | src/app/(dashboard)/admin/users/__tests__/actions.test.ts > Admin User Actions > getUsers > should throw error when all fallback methods fail
Error fetching user roles: { message: 'Failed to fetch user roles' }
{"timestamp":"2025-11-18T00:45:27.829Z","level":"error","message":"Error in getUsersComprehensive","operation":"getUsersComprehensive","errorName":"Error","errorMessage":"Failed to fetch user roles","errorStack":"Error: Failed to fetch user roles\n    at getUsersComprehensive (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/actions.ts:173:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at Module.getUsers (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/actions.ts:128:12)\n    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/__tests__/actions.test.ts:278:7\n    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:20"}

stderr | src/app/(dashboard)/admin/users/__tests__/actions.test.ts > Admin User Actions > getUsers > should throw error when all fallback methods fail
{"timestamp":"2025-11-18T00:45:27.831Z","level":"error","message":"Error in getUsers","operation":"getUsers","errorName":"Error","errorMessage":"Failed to fetch users","errorStack":"Error: Failed to fetch users\n    at getUsersComprehensive (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/actions.ts:404:11)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at Module.getUsers (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/actions.ts:128:12)\n    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/(dashboard)/admin/users/__tests__/actions.test.ts:278:7\n    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:20"}

stderr | src/app/(dashboard)/admin/users/__tests__/actions.test.ts > Admin User Actions > toggleAdminRole > should throw error when operation fails
Error updating admin role: { message: 'Insert failed' }

stderr | src/app/(dashboard)/admin/users/__tests__/actions.test.ts > Admin User Actions > addUserRole > should throw error when insert fails
Error adding user role: { message: 'Insert failed' }

 ✓ src/lib/__tests__/matrix-graph-utils.test.ts (33 tests) 25ms
stderr | src/app/api/polls/submit/__tests__/route.test.ts > POST /api/polls/submit > Error Handling > should handle poll creation errors
Error creating/getting poll for pollIndex 0: { message: 'Database error' }

stderr | src/app/api/polls/submit/__tests__/route.test.ts > POST /api/polls/submit > Error Handling > should handle vote submission errors
Error submitting vote for pollIndex 0: { message: 'Vote error' }

stderr | src/app/api/polls/submit/__tests__/route.test.ts > POST /api/polls/submit > Error Handling > should handle invalid request body
Error in poll submit API: TypeError: Cannot read properties of undefined (reading 'startsWith')
    at createClientForPagePath (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/lib/supabase-auth.ts:188:30)
    at Module.POST (/home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/api/polls/submit/route.ts:9:43)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/app/api/polls/submit/__tests__/route.test.ts:416:24
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:20

 ✓ src/app/(dashboard)/admin/users/__tests__/actions.test.ts (13 tests) 33ms
 ✓ src/app/api/polls/submit/__tests__/route.test.ts (10 tests) 38ms
 ✓ src/lib/supabase-auth.test.ts (26 tests) 51ms
 ❯ src/lib/__tests__/logger.test.ts (19 tests | 19 failed) 18ms
       × should log info messages in development 7ms
       × should not log info messages in production 1ms
       × should format message as JSON in development 1ms
       × should use pretty formatting in development 1ms
       × should log warn messages in development 0ms
       × should not log warn messages in production 0ms
       × should always log error messages regardless of environment 0ms
       × should log error with Error object 0ms
       × should log error with string error 1ms
       × should log error without error object 0ms
       × should use compact JSON in production 0ms
       × should log debug messages in development 0ms
       × should not log debug messages in production 0ms
       × should include all context fields in log 0ms
       × should handle empty context 0ms
       × should handle undefined context 0ms
       × should include ISO timestamp in all logs 0ms
       × should use compact JSON in production for errors 0ms
       × should use pretty JSON in development 0ms
stderr | src/lib/admin-utils.test.ts > admin-utils > refreshGlobalAdminStatus > should use localStorage backup on database error
❌ Error checking admin role: { message: 'Database error' }

stderr | src/lib/admin-utils.test.ts > admin-utils > refreshGlobalAdminStatus > should handle errors gracefully and try localStorage fallback
❌ Error in refreshGlobalAdminStatus: Error: Network error
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/lib/admin-utils.test.ts:234:41
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:20

stderr | src/lib/admin-utils.test.ts > admin-utils > checkCurrentUserAdminStatus > should handle errors gracefully
❌ Error checking admin status: Error: Network error
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/lib/admin-utils.test.ts:336:37
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:157:11
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:26
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1636:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1602:10)
    at runTest (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1309:12)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)

stderr | src/lib/admin-utils.test.ts > admin-utils > checkCurrentUserAdminStatus > should handle errors gracefully
❌ Fallback error: Error: Network error
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/lib/admin-utils.test.ts:336:37
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:157:11
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:26
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1636:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1602:10)
    at runTest (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1309:12)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)

 ✓ src/lib/__tests__/auth-flow.test.ts (13 tests) 23ms
stderr | src/lib/admin-utils.test.ts > admin-utils > clearAdminStatusBackup > should handle errors gracefully
❌ Error clearing admin status backup: Error: Auth error
    at /home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/src/lib/admin-utils.test.ts:362:37
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:157:11
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:753:26
    at file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1636:20
    at new Promise (<anonymous>)
    at runWithTimeout (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1602:10)
    at runTest (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1309:12)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)
    at runSuite (file:///home/runner/work/SSTAC-Dashboard/SSTAC-Dashboard/node_modules/@vitest/runner/dist/index.js:1468:8)

 ✓ src/lib/admin-utils.test.ts (17 tests) 1377ms
 ❯ src/lib/__tests__/rate-limit.test.ts (23 tests | 3 failed) 181ms
       ✓ should allow first request 2ms
       × should track multiple requests within window 10ms
       ✓ should block requests when limit exceeded 0ms
       × should reset after window expires 151ms
       ✓ should handle different identifiers separately 0ms
       ✓ should use custom message when provided 0ms
       ✓ should handle admin config limits 0ms
       ✓ should handle discussion config limits 0ms
       ✓ should use user ID when provided 2ms
       ✓ should use IP address when user ID not provided 2ms
       ✓ should use x-real-ip when x-forwarded-for not available 0ms
       ✓ should use first IP from x-forwarded-for comma-separated list 0ms
       ✓ should fallback to "unknown" when no IP headers available 0ms
       ✓ should prefer user ID over IP address 0ms
       ✓ should return null when rate limit not exceeded 0ms
       × should return 429 response when rate limit exceeded 4ms
       ✓ should include rate limit headers in response when exceeded 1ms
       ✓ should use correct config key 0ms
       ✓ should handle null userId 0ms
       ✓ should have all required config keys 1ms
       ✓ should have correct admin config limits 0ms
       ✓ should have correct discussion config limits 0ms
       ✓ should have correct default config limits 0ms
 ✓ src/lib/device-fingerprint.test.ts (16 tests) 18ms
 ✓ src/lib/vote-tracking.test.ts (17 tests) 15ms
 ✓ src/components/__tests__/ErrorBoundary.test.tsx (7 tests) 251ms

⎯⎯⎯⎯⎯⎯ Failed Tests 22 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should log info messages in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:36:14
     34|   describe('info', () => {
     35|     it('should log info messages in development', () => {
     36|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     37|         value: 'development',
     38|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should log info messages in development
 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should not log info messages in production
 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should format message as JSON in development
 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should use pretty formatting in development
 FAIL  src/lib/__tests__/logger.test.ts > logger > warn > should log warn messages in development
 FAIL  src/lib/__tests__/logger.test.ts > logger > warn > should not log warn messages in production
 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should always log error messages regardless of environment
 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error with Error object
 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error with string error
 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error without error object
 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should use compact JSON in production
 FAIL  src/lib/__tests__/logger.test.ts > logger > debug > should log debug messages in development
 FAIL  src/lib/__tests__/logger.test.ts > logger > debug > should not log debug messages in production
 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should include all context fields in log
 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should handle empty context
 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should handle undefined context
 FAIL  src/lib/__tests__/logger.test.ts > logger > timestamp > should include ISO timestamp in all logs
 FAIL  src/lib/__tests__/logger.test.ts > logger > production vs development formatting > should use compact JSON in production for errors
 FAIL  src/lib/__tests__/logger.test.ts > logger > production vs development formatting > should use pretty JSON in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14
     23|   afterEach(() => {
     24|     if (originalEnv !== undefined) {
     25|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     26|         value: originalEnv,
     27|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should not log info messages in production
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:51:14
     49| 
     50|     it('should not log info messages in production', () => {
     51|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     52|         value: 'production',
     53|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should format message as JSON in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:62:14
     60| 
     61|     it('should format message as JSON in development', () => {
     62|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     63|         value: 'development',
     64|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > info > should use pretty formatting in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:79:14
     77| 
     78|     it('should use pretty formatting in development', () => {
     79|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     80|         value: 'development',
     81|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > warn > should log warn messages in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:94:14
     92|   describe('warn', () => {
     93|     it('should log warn messages in development', () => {
     94|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
     95|         value: 'development',
     96|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > warn > should not log warn messages in production
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:108:14
    106| 
    107|     it('should not log warn messages in production', () => {
    108|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    109|         value: 'production',
    110|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should always log error messages regardless of environment
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:121:14
    119|   describe('error', () => {
    120|     it('should always log error messages regardless of environment', (…
    121|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    122|         value: 'production',
    123|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error with Error object
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:132:14
    130| 
    131|     it('should log error with Error object', () => {
    132|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    133|         value: 'development',
    134|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error with string error
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:152:14
    150| 
    151|     it('should log error with string error', () => {
    152|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    153|         value: 'development',
    154|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should log error without error object
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:166:14
    164| 
    165|     it('should log error without error object', () => {
    166|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    167|         value: 'development',
    168|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > error > should use compact JSON in production
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:181:14
    179| 
    180|     it('should use compact JSON in production', () => {
    181|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    182|         value: 'production',
    183|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > debug > should log debug messages in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:199:14
    197|   describe('debug', () => {
    198|     it('should log debug messages in development', () => {
    199|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    200|         value: 'development',
    201|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[13/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > debug > should not log debug messages in production
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:213:14
    211| 
    212|     it('should not log debug messages in production', () => {
    213|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    214|         value: 'production',
    215|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[14/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should include all context fields in log
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:226:14
    224|   describe('context handling', () => {
    225|     it('should include all context fields in log', () => {
    226|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    227|         value: 'development',
    228|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[15/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should handle empty context
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:247:14
    245| 
    246|     it('should handle empty context', () => {
    247|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    248|         value: 'development',
    249|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[16/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > context handling > should handle undefined context
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:262:14
    260| 
    261|     it('should handle undefined context', () => {
    262|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    263|         value: 'development',
    264|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[17/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > timestamp > should include ISO timestamp in all logs
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:278:14
    276|   describe('timestamp', () => {
    277|     it('should include ISO timestamp in all logs', () => {
    278|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    279|         value: 'development',
    280|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[18/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > production vs development formatting > should use compact JSON in production for errors
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:297:14
    295|   describe('production vs development formatting', () => {
    296|     it('should use compact JSON in production for errors', () => {
    297|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    298|         value: 'production',
    299|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[19/41]⎯

 FAIL  src/lib/__tests__/logger.test.ts > logger > production vs development formatting > should use pretty JSON in development
TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:310:14
    308| 
    309|     it('should use pretty JSON in development', () => {
    310|       Object.defineProperty(process.env, 'NODE_ENV', {
       |              ^
    311|         value: 'development',
    312|         writable: true,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[20/41]⎯

 FAIL  src/lib/__tests__/rate-limit.test.ts > rate-limit > checkRateLimit > should track multiple requests within window
AssertionError: expected 198 to be 199 // Object.is equality

- Expected
+ Received

- 199
+ 198

 ❯ src/lib/__tests__/rate-limit.test.ts:32:34
     30|         const result = checkRateLimit(identifier, config);
     31|         expect(result.success).toBe(true);
     32|         expect(result.remaining).toBe(200 - (i + 1));
       |                                  ^
     33|       }
     34|     });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[21/41]⎯

 FAIL  src/lib/__tests__/rate-limit.test.ts > rate-limit > checkRateLimit > should reset after window expires
AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/lib/__tests__/rate-limit.test.ts:74:30
     72|       // Should allow new requests
     73|       const result = checkRateLimit(identifier, config);
     74|       expect(result.success).toBe(true);
       |                              ^
     75|       expect(result.remaining).toBe(1);
     76|     });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[22/41]⎯

 FAIL  src/lib/__tests__/rate-limit.test.ts > rate-limit > rateLimitMiddleware > should return 429 response when rate limit exceeded
SyntaxError: Unexpected token 'o', "[object Rea"... is not valid JSON
 ❯ src/lib/__tests__/rate-limit.test.ts:192:27
    190|       if (result) {
    191|         expect(result.status).toBe(429);
    192|         const json = JSON.parse(result.body as unknown as string);
       |                           ^
    193|         expect(json.error).toBeDefined();
    194|       }

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[23/41]⎯


 Test Files  2 failed | 12 passed (14)
      Tests  22 failed | 217 passed (239)
   Start at  00:45:24
   Duration  7.81s (transform 823ms, setup 3.79s, collect 1.57s, tests 2.13s, environment 10.27s, prepare 423ms)


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:36:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:51:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:62:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:79:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:94:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:108:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:121:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:132:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:152:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:166:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:181:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:199:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:213:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:226:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:247:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:262:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:278:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:297:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:310:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: TypeError: 'process.env' only accepts a configurable, writable, and enumerable data descriptor
 ❯ src/lib/__tests__/logger.test.ts:25:14

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_INVALID_OBJECT_DEFINE_PROPERTY' }


Error: AssertionError: expected 198 to be 199 // Object.is equality

- Expected
+ Received

- 199
+ 198

 ❯ src/lib/__tests__/rate-limit.test.ts:32:34



Error: AssertionError: expected false to be true // Object.is equality

- Expected
+ Received

- true
+ false

 ❯ src/lib/__tests__/rate-limit.test.ts:74:30



Error: SyntaxError: Unexpected token 'o', "[object Rea"... is not valid JSON
 ❯ src/lib/__tests__/rate-limit.test.ts:192:27


Error: Process completed with exit code 1.