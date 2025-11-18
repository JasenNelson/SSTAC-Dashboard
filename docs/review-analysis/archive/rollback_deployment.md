07:43:15.071 Running build in Washington, D.C., USA (East) – iad1
07:43:15.071 Build machine configuration: 4 cores, 8 GB
07:43:15.183 Cloning github.com/JasenNelson/SSTAC-Dashboard (Branch: chore/next-15-5-6-staging, Commit: 1a972b4)
07:43:18.141 Cloning completed: 2.957s
07:43:18.255 Restored build cache from previous deployment (7PwvALzrw6bpA8atzp6Yo3Yo5mfY)
07:43:19.073 Running "vercel build"
07:43:19.950 Vercel CLI 48.9.2
07:43:20.319 Installing dependencies...
07:43:21.800 
07:43:21.800 up to date in 1s
07:43:21.800 
07:43:21.800 184 packages are looking for funding
07:43:21.800   run `npm fund` for details
07:43:21.835 Detected Next.js version: 15.4.6
07:43:21.840 Running "npm run build"
07:43:21.956 
07:43:21.956 > sstac-dashboard-temp@0.1.0 build
07:43:21.956 > next build
07:43:21.957 
07:43:23.518    ▲ Next.js 15.4.6
07:43:23.518    - Experiments (use with caution):
07:43:23.518      · clientTraceMetadata
07:43:23.519      · optimizePackageImports
07:43:23.519 
07:43:23.554    Creating an optimized production build ...
07:43:57.730 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (108kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
07:43:57.788 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (185kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
07:43:57.795 <w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (139kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
07:44:08.828  ⚠ Compiled with warnings in 44s
07:44:08.828 
07:44:08.828 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.828 Critical dependency: the request of a dependency is an expression
07:44:08.829 
07:44:08.829 Import trace for requested module:
07:44:08.829 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.829 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.829 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.829 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.829 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.829 ./src/app/(dashboard)/twg/documents/actions.ts
07:44:08.829 
07:44:08.829 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.829 A Node.js API is used (process.versions at line: 11) which is not supported in the Edge Runtime.
07:44:08.830 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.830 
07:44:08.830 Import trace for requested module:
07:44:08.830 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.830 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.830 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.830 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.830 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.830 
07:44:08.830 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.830 A Node.js API is used (process.versions at line: 12) which is not supported in the Edge Runtime.
07:44:08.830 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.832 
07:44:08.832 Import trace for requested module:
07:44:08.832 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.832 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.832 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.832 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.832 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.832 
07:44:08.832 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.832 A Node.js API is used (process.versions at line: 58) which is not supported in the Edge Runtime.
07:44:08.832 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.832 
07:44:08.833 Import trace for requested module:
07:44:08.833 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.833 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.833 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.833 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.833 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.833 
07:44:08.833 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.833 A Node.js API is used (process.versions at line: 59) which is not supported in the Edge Runtime.
07:44:08.833 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.833 
07:44:08.833 Import trace for requested module:
07:44:08.833 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.833 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.833 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.834 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.834 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.834 
07:44:08.834 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.834 A Node.js API is used (process.versions at line: 60) which is not supported in the Edge Runtime.
07:44:08.834 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.836 
07:44:08.836 Import trace for requested module:
07:44:08.836 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
07:44:08.836 ./node_modules/@supabase/realtime-js/dist/module/index.js
07:44:08.836 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.836 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.836 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.836 
07:44:08.836 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.836 A Node.js API is used (process.version at line: 24) which is not supported in the Edge Runtime.
07:44:08.836 Learn more: https://nextjs.org/docs/api-reference/edge-runtime
07:44:08.836 
07:44:08.836 Import trace for requested module:
07:44:08.836 ./node_modules/@supabase/supabase-js/dist/module/index.js
07:44:08.836 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
07:44:08.836 ./node_modules/@supabase/ssr/dist/module/index.js
07:44:08.836 
07:44:08.836    Linting and checking validity of types ...
07:44:16.435 
07:44:16.436 ./src/app/(dashboard)/admin/cew-stats/CEWStatsClient.tsx
07:44:16.436 29:6  Warning: React Hook useEffect has a missing dependency: 'fetchStats'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.436 57:28  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 58:37  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 
07:44:16.436 ./src/app/(dashboard)/admin/page.tsx
07:44:16.436 19:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 22:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 
07:44:16.436 ./src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx
07:44:16.436 17:3  Warning: 'getFilterModeDisplayName' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 28:35  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 109:10  Warning: 'currentQuestionIndex' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 125:6  Warning: React Hook useEffect has a missing dependency: 'fetchPollResults'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.436 222:22  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 223:19  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 464:44  Warning: 'pollId' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.436 559:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 560:28  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.436 561:25  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 588:55  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 593:52  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 601:147  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 602:130  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 627:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 632:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 632:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 634:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 639:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 639:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 668:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 668:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 671:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 676:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.437 676:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 680:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 685:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 685:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 700:47  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 711:44  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 738:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 742:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 742:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 744:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 748:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.438 748:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.439 767:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.439 767:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 770:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 774:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 774:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 778:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 782:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 782:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.440 1071:15  Warning: 'filteredResults' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 1310:9  Warning: 'scrollToSection' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 1928:29  Warning: 'pollKey' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 2081:29  Warning: 'pollKey' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 2139:57  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 2234:57  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 2236:37  Warning: 'isTopChoice' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.440 
07:44:16.441 ./src/app/(dashboard)/admin/poll-results/page.tsx
07:44:16.441 17:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.441 20:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.441 
07:44:16.441 ./src/app/(dashboard)/admin/tags/actions.ts
07:44:16.441 20:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 23:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 103:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 106:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 195:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 198:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 
07:44:16.442 ./src/app/(dashboard)/admin/tags/page.tsx
07:44:16.442 18:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 21:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 
07:44:16.442 ./src/app/(dashboard)/admin/twg-synthesis/TWGSynthesisClient.tsx
07:44:16.442 15:14  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.442 37:46  Warning: 'user' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 49:10  Warning: 'selectedSubmission' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 49:30  Warning: 'setSelectedSubmission' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 176:82  Warning: 'options' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 179:21  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 180:19  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 180:27  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 626:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 627:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.442 627:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 660:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 661:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 661:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 723:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 724:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 724:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 732:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 733:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 733:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 
07:44:16.443 ./src/app/(dashboard)/admin/users/__tests__/actions.test.ts
07:44:16.443 2:55  Warning: 'UserWithRole' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.443 15:15  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.443 
07:44:16.443 ./src/app/(dashboard)/cew-2025/page.tsx
07:44:16.444 34:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.444 37:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.444 
07:44:16.444 ./src/app/(dashboard)/dashboard/page.tsx
07:44:16.444 21:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.444 24:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.444 
07:44:16.444 ./src/app/(dashboard)/survey-results/detailed-findings/page.tsx
07:44:16.444 184:104  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.444 184:118  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.444 185:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.444 185:28  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.444 231:80  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.444 231:101  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.444 232:44  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.444 232:58  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.444 232:63  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.445 232:82  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.445 269:85  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.445 330:37  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 330:84  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 
07:44:16.445 ./src/app/(dashboard)/survey-results/effectiveness/page.tsx
07:44:16.445 18:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.445 21:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.445 48:69  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.445 68:74  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.445 69:61  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 69:82  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 85:55  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 85:76  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 126:41  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 126:55  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.445 126:60  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.447 126:79  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.447 142:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 144:84  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 147:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 148:94  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 
07:44:16.448 ./src/app/(dashboard)/survey-results/holistic-protection/HolisticProtectionClient.tsx
07:44:16.448 5:8  Warning: 'RankingPoll' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.448 16:17  Warning: 'setPolls' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.448 107:9  Warning: 'toggleAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.448 128:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
07:44:16.448 164:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 166:48  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 256:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
07:44:16.448 
07:44:16.448 ./src/app/(dashboard)/survey-results/page.tsx
07:44:16.448 21:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.448 24:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.448 42:29  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.448 45:53  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 45:67  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.448 48:99  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.448 
07:44:16.448 ./src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx
07:44:16.449 9:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.449 89:9  Warning: 'toggleAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.449 99:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
07:44:16.449 
07:44:16.449 ./src/app/(dashboard)/survey-results/tiered-framework/TieredFrameworkClient.tsx
07:44:16.449 6:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.449 59:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
07:44:16.449 98:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.449 99:101  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.449 
07:44:16.449 ./src/app/(dashboard)/twg/discussions/[id]/page.tsx
07:44:16.449 77:6  Warning: React Hook useEffect has missing dependencies: 'fetchDiscussion', 'fetchReplies', and 'getCurrentUser'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.449 
07:44:16.449 ./src/app/(dashboard)/twg/discussions/page.tsx
07:44:16.449 31:15  Warning: 'count' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.450 51:76  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.450 71:49  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.450 76:49  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.450 82:32  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.450 83:35  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.450 84:36  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 85:40  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 86:40  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 98:6  Warning: React Hook useCallback has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.451 108:59  Warning: 'sessionError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 154:6  Warning: React Hook useEffect has a missing dependency: 'supabase.auth'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.451 184:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 257:37  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 258:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 265:41  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 267:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 267:74  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 281:52  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 
07:44:16.451 ./src/app/(dashboard)/twg/documents/[id]/edit/page.tsx
07:44:16.451 19:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 22:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 
07:44:16.451 ./src/app/(dashboard)/twg/documents/[id]/page.tsx
07:44:16.451 22:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 25:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 
07:44:16.451 ./src/app/(dashboard)/twg/documents/page.tsx
07:44:16.451 8:6  Warning: 'Document' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 26:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 29:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 64:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 
07:44:16.451 ./src/app/(dashboard)/twg/review/TWGReviewClient.tsx
07:44:16.451 11:14  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 30:43  Warning: 'user' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.451 31:44  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.451 258:47  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.452 259:24  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.452 284:27  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.452 516:63  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.452 523:25  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.452 523:39  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.456 523:79  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.456 525:29  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.456 525:43  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.456 671:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 671:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 746:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 746:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 814:62  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 814:84  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 948:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 948:81  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 970:18  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.456 970:32  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.456 1065:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 1065:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 1233:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.456 1233:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1432:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1432:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1456:100  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.457 1572:64  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1572:86  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1624:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1624:83  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1822:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1822:78  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1848:120  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.457 1947:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 1947:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 2118:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 2118:78  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.457 2135:18  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.457 2135:32  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.457 2187:98  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.457 2187:112  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.457 2206:64  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.457 2206:78  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.461 
07:44:16.462 ./src/app/(dashboard)/twg/review/page.tsx
07:44:16.462 20:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.462 29:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.462 
07:44:16.462 ./src/app/(dashboard)/wiks/WIKSClient.tsx
07:44:16.462 13:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
07:44:16.462 30:53  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 36:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.462 38:36  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.462 56:61  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 56:65  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 58:27  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 58:43  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 69:61  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 69:65  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 71:44  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 148:55  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.462 
07:44:16.462 ./src/app/api/discussions/route.ts
07:44:16.462 3:10  Warning: 'createAuthenticatedClient' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.465 3:37  Warning: 'getAuthenticatedUser' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.465 
07:44:16.465 ./src/app/api/graphs/prioritization-matrix/route.ts
07:44:16.465 7:42  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.465 7:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 7:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 102:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 273:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 449:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 451:83  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 460:81  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 462:84  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 
07:44:16.466 ./src/app/api/polls/submit/route.ts
07:44:16.466 76:43  Warning: 'checkError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.466 117:7  Warning: 'voteData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.466 
07:44:16.466 ./src/app/api/ranking-polls/submit/route.ts
07:44:16.466 90:19  Warning: 'voteData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.466 
07:44:16.466 ./src/app/api/review/upload/route.ts
07:44:16.466 44:19  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.466 
07:44:16.466 ./src/app/api/wordcloud-polls/results/route.ts
07:44:16.466 90:23  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.466 103:31  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.467 178:22  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.467 179:19  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.467 
07:44:16.467 ./src/app/cew-polls/holistic-protection/page.tsx
07:44:16.467 6:8  Warning: 'RankingPoll' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 8:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 15:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 15:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 
07:44:16.467 ./src/app/cew-polls/prioritization/page.tsx
07:44:16.467 9:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 21:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 21:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 
07:44:16.467 ./src/app/cew-polls/tiered-framework/page.tsx
07:44:16.467 7:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 14:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 14:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.467 
07:44:16.467 ./src/app/cew-polls/wiks/page.tsx
07:44:16.468 7:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.468 7:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.468 
07:44:16.468 ./src/app/page.tsx
07:44:16.468 3:8  Warning: 'Image' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.468 28:79  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.468 128:67  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.468 
07:44:16.468 ./src/components/CEWCodeInput.tsx
07:44:16.468 7:40  Warning: 'onCodeEntered' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.468 
07:44:16.468 ./src/components/Header.tsx
07:44:16.468 42:61  Warning: 'retryCount' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.468 64:32  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 68:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 76:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 100:42  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 100:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 111:76  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 111:107  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.468 156:25  Warning: 'user' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.469 303:6  Warning: React Hook useEffect has a missing dependency: 'session.user'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.469 529:44  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.469 625:36  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.469 
07:44:16.469 ./src/components/PollWithResults.tsx
07:44:16.469 67:6  Warning: React Hook useEffect has missing dependencies: 'fetchResults' and 'pagePath'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.469 119:15  Warning: 'result' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.469 252:34  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.469 252:40  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.469 252:61  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.469 252:77  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.470 362:45  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.470 362:51  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.470 
07:44:16.471 ./src/components/dashboard/AdminUsersManager.tsx
07:44:16.471 5:37  Warning: 'addUserRole' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.471 43:6  Warning: React Hook useEffect has a missing dependency: 'fetchUsers'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.471 
07:44:16.472 ./src/components/dashboard/AnnouncementsManagement.tsx
07:44:16.472 41:6  Warning: React Hook useEffect has a missing dependency: 'fetchAnnouncements'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.472 
07:44:16.472 ./src/components/dashboard/CustomWordCloud.tsx
07:44:16.472 121:13  Warning: 'maxAttempts' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.473 157:32  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.473 
07:44:16.473 ./src/components/dashboard/DeleteButton.tsx
07:44:16.473 77:41  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.473 77:57  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.474 
07:44:16.474 ./src/components/dashboard/DiscussionThread.tsx
07:44:16.474 65:21  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.474 66:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.475 67:36  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.475 83:6  Warning: React Hook useEffect has missing dependencies: 'checkAdminStatus', 'fetchReplies', and 'supabase.auth'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.475 
07:44:16.475 ./src/components/dashboard/DocumentsList.tsx
07:44:16.475 24:9  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.476 
07:44:16.476 ./src/components/dashboard/InteractivePieChart.tsx
07:44:16.476 75:19  Warning: 'strokeWidth' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.476 
07:44:16.476 ./src/components/dashboard/LikeButton.tsx
07:44:16.476 42:10  Warning: 'popupPosition' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.476 42:25  Warning: 'setPopupPosition' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.476 
07:44:16.476 ./src/components/dashboard/MilestonesManagement.tsx
07:44:16.476 41:6  Warning: React Hook useEffect has a missing dependency: 'fetchMilestones'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.476 
07:44:16.476 ./src/components/dashboard/NewDiscussionForm.tsx
07:44:16.476 36:38  Warning: 'userError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.477 
07:44:16.477 ./src/components/dashboard/PollResultsChart.tsx
07:44:16.477 44:3  Warning: 'options' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.477 196:40  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.477 197:19  Warning: 'isHovered' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.477 
07:44:16.477 ./src/components/dashboard/ProjectPhases.tsx
07:44:16.477 28:46  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.477 28:65  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
07:44:16.477 
07:44:16.477 ./src/components/dashboard/ProjectTimeline.tsx
07:44:16.477 139:39  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.477 
07:44:16.477 ./src/components/dashboard/RankingPoll.tsx
07:44:16.477 97:6  Warning: React Hook useCallback has missing dependencies: 'authCode' and 'showChangeOption'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.477 115:6  Warning: React Hook useEffect has missing dependencies: 'options' and 'pagePath'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.477 168:20  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.477 
07:44:16.478 ./src/components/dashboard/SurveyResultsChart.tsx
07:44:16.478 5:47  Warning: 'Tooltip' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 70:9  Warning: 'tooltipBg' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 71:9  Warning: 'tooltipBorder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 72:9  Warning: 'tooltipText' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 
07:44:16.478 ./src/components/dashboard/TagManagement.tsx
07:44:16.478 30:10  Warning: 'isLoading' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 
07:44:16.478 ./src/components/dashboard/VoicesCarousel.tsx
07:44:16.478 93:11  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.478 93:31  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
07:44:16.478 
07:44:16.478 ./src/components/dashboard/WordCloudPoll.tsx
07:44:16.478 13:35  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.478 31:79  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.478 132:10  Warning: 'showResults' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 274:6  Warning: React Hook useCallback has a missing dependency: 'isFetching'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.479 291:6  Warning: React Hook useEffect has a missing dependency: 'fetchResults'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.479 298:9  Warning: 'handleWordChange' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 304:9  Warning: 'addWordField' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 310:9  Warning: 'removeWordField' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 
07:44:16.479 ./src/components/graphs/SurveyMatrixGraph.tsx
07:44:16.479 36:3  Warning: 'importanceIndex' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 37:3  Warning: 'feasibilityIndex' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 81:6  Warning: React Hook useEffect has a missing dependency: 'fetchMatrixData'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
07:44:16.479 
07:44:16.479 ./src/instrumentation-client.ts
07:44:16.479 37:21  Warning: 'hint' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 
07:44:16.479 ./src/lib/__tests__/auth-flow.test.ts
07:44:16.479 4:3  Warning: 'createAnonymousClient' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.479 70:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.479 104:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 122:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 148:15  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.480 218:25  Warning: 'cewClient' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.480 231:25  Warning: 'authClient' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.480 
07:44:16.480 ./src/lib/poll-export-utils.ts
07:44:16.480 95:27  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 112:33  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 
07:44:16.480 ./src/lib/supabase-auth.test.ts
07:44:16.480 198:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 214:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 229:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 247:73  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 263:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 359:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
07:44:16.480 
07:44:16.480 ./src/lib/supabase-auth.ts
07:44:16.481 47:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.481 55:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
07:44:16.481 
07:44:16.481 ./src/lib/vote-tracking.ts
07:44:16.481 40:11  Warning: 'tracker' is assigned a value but never used.  @typescript-eslint/no-unused-vars
07:44:16.481 
07:44:16.481 info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
07:44:24.473    Collecting page data ...
07:44:30.031    Generating static pages (0/50) ...
07:44:30.959    Generating static pages (12/50) 
07:44:31.251    Generating static pages (24/50) 
07:44:31.469    Generating static pages (37/50) 
07:44:31.523  ✓ Generating static pages (50/50)
07:44:32.736    Finalizing page optimization ...
07:44:32.736    Collecting build traces ...
07:44:41.565 
07:44:41.580 Route (app)                                 Size  First Load JS
07:44:41.580 ┌ ○ /                                    3.27 kB         216 kB
07:44:41.580 ├ ○ /_not-found                          1.16 kB         214 kB
07:44:41.580 ├ ƒ /admin                                4.3 kB         219 kB
07:44:41.580 ├ ƒ /admin/announcements                 3.35 kB         266 kB
07:44:41.580 ├ ƒ /admin/cew-stats                     1.93 kB         254 kB
07:44:41.580 ├ ƒ /admin/milestones                    3.41 kB         267 kB
07:44:41.580 ├ ƒ /admin/poll-results                  21.2 kB         281 kB
07:44:41.581 ├ ƒ /admin/reset-votes                   1.94 kB         259 kB
07:44:41.581 ├ ƒ /admin/tags                          5.57 kB         264 kB
07:44:41.581 ├ ƒ /admin/twg-synthesis                 11.1 kB         270 kB
07:44:41.581 ├ ƒ /admin/users                         7.93 kB         266 kB
07:44:41.581 ├ ƒ /api/announcements                     376 B         213 kB
07:44:41.581 ├ ƒ /api/auth/callback                     376 B         213 kB
07:44:41.581 ├ ƒ /api/discussions                       377 B         213 kB
07:44:41.581 ├ ƒ /api/discussions/[id]                  376 B         213 kB
07:44:41.581 ├ ƒ /api/discussions/[id]/replies          377 B         213 kB
07:44:41.581 ├ ƒ /api/documents/[id]                    376 B         213 kB
07:44:41.581 ├ ƒ /api/graphs/prioritization-matrix      377 B         213 kB
07:44:41.581 ├ ƒ /api/milestones                        377 B         213 kB
07:44:41.581 ├ ƒ /api/polls/results                     377 B         213 kB
07:44:41.581 ├ ƒ /api/polls/submit                      377 B         213 kB
07:44:41.581 ├ ƒ /api/ranking-polls/results             377 B         213 kB
07:44:41.581 ├ ƒ /api/ranking-polls/submit              374 B         213 kB
07:44:41.581 ├ ƒ /api/review/save                       377 B         213 kB
07:44:41.581 ├ ƒ /api/review/submit                     377 B         213 kB
07:44:41.581 ├ ƒ /api/review/upload                     378 B         213 kB
07:44:41.582 ├ ƒ /api/tags                              377 B         213 kB
07:44:41.582 ├ ƒ /api/wordcloud-polls/results           377 B         213 kB
07:44:41.582 ├ ƒ /api/wordcloud-polls/submit            377 B         213 kB
07:44:41.582 ├ ƒ /cew-2025                              375 B         213 kB
07:44:41.582 ├ ○ /cew-polls/holistic-protection       1.82 kB         219 kB
07:44:41.582 ├ ○ /cew-polls/prioritization            2.93 kB         227 kB
07:44:41.582 ├ ○ /cew-polls/tiered-framework           2.5 kB         220 kB
07:44:41.582 ├ ○ /cew-polls/wiks                      1.44 kB         214 kB
07:44:41.582 ├ ƒ /dashboard                           2.93 kB         218 kB
07:44:41.582 ├ ○ /demo-matrix-graph                   5.24 kB         221 kB
07:44:41.582 ├ ○ /login                               2.17 kB         261 kB
07:44:41.582 ├ ○ /signup                              2.44 kB         261 kB
07:44:41.582 ├ ƒ /survey-results                      93.2 kB         315 kB
07:44:41.582 ├ ○ /survey-results/detailed-findings    6.64 kB         221 kB
07:44:41.582 ├ ƒ /survey-results/effectiveness          349 B         215 kB
07:44:41.582 ├ ƒ /survey-results/holistic-protection  5.69 kB         226 kB
07:44:41.582 ├ ƒ /survey-results/prioritization       7.21 kB         234 kB
07:44:41.582 ├ ○ /survey-results/technical-standards    377 B         213 kB
07:44:41.582 ├ ƒ /survey-results/tiered-framework     3.67 kB         221 kB
07:44:41.582 ├ ○ /twg/discussions                     4.83 kB         263 kB
07:44:41.582 ├ ƒ /twg/discussions/[id]                8.07 kB         267 kB
07:44:41.589 ├ ƒ /twg/documents                       2.46 kB         261 kB
07:44:41.589 ├ ƒ /twg/documents/[id]                  2.41 kB         217 kB
07:44:41.589 ├ ƒ /twg/documents/[id]/edit              3.9 kB         262 kB
07:44:41.589 ├ ○ /twg/documents/new                   3.71 kB         262 kB
07:44:41.589 ├ ƒ /twg/review                          14.1 kB         271 kB
07:44:41.589 └ ƒ /wiks                                2.66 kB         216 kB
07:44:41.589 + First Load JS shared by all             213 kB
07:44:41.589   ├ chunks/4bd1b696-ee2bd4cbf232d0c7.js  54.3 kB
07:44:41.589   ├ chunks/52774a7f-13efbc8d454b195c.js    38 kB
07:44:41.589   ├ chunks/6749-d50fb38938ca9ff8.js       118 kB
07:44:41.589   └ other shared chunks (total)          3.15 kB
07:44:41.589 
07:44:41.589 
07:44:41.589 ƒ Middleware                             77.2 kB
07:44:41.589 
07:44:41.590 ○  (Static)   prerendered as static content
07:44:41.590 ƒ  (Dynamic)  server-rendered on demand
07:44:41.590 
07:44:41.890 Traced Next.js server files in: 111.597ms
07:44:42.624 Created all serverless functions in: 732.326ms
07:44:42.711 Collected static files (public/, static/, .next/static): 16.904ms
07:44:43.052 Build Completed in /vercel/output [1m]
07:44:43.261 Deploying outputs...
07:44:59.380 Deployment completed
07:45:00.041 Creating build cache...
07:45:26.457 Created build cache: 26.415s
07:45:26.457 Uploading build cache [484.02 MB]
07:45:31.529 Build cache uploaded: 5.072s