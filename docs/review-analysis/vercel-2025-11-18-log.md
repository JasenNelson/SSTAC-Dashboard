09:44:14.961 Running build in Washington, D.C., USA (East) – iad1
09:44:14.962 Build machine configuration: 4 cores, 8 GB
09:44:15.085 Cloning github.com/JasenNelson/SSTAC-Dashboard (Branch: chore/next-15-5-6-staging, Commit: 74aa226)
09:44:17.977 Cloning completed: 2.892s
09:44:18.109 Restored build cache from previous deployment (HSTniwgnvY9Lk9PvJpsFRjRwMtYt)
09:44:18.960 Running "vercel build"
09:44:19.368 Vercel CLI 48.10.3
09:44:19.723 Installing dependencies...
09:44:22.032 
09:44:22.032 > sstac-dashboard-temp@0.1.0 prepare
09:44:22.032 > husky
09:44:22.033 
09:44:22.103 
09:44:22.103 added 1 package, and changed 1 package in 2s
09:44:22.103 
09:44:22.103 185 packages are looking for funding
09:44:22.104   run `npm fund` for details
09:44:22.136 Detected Next.js version: 15.4.6
09:44:22.143 Running "npm run build"
09:44:22.257 
09:44:22.257 > sstac-dashboard-temp@0.1.0 build
09:44:22.257 > next build
09:44:22.257 
09:44:23.767    ▲ Next.js 15.4.6
09:44:23.767    - Experiments (use with caution):
09:44:23.767      · clientTraceMetadata
09:44:23.767      · optimizePackageImports
09:44:23.767 
09:44:23.802    Creating an optimized production build ...
09:44:57.659  ⚠ Compiled with warnings in 33.0s
09:44:57.659 
09:44:57.659 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
09:44:57.659 Critical dependency: the request of a dependency is an expression
09:44:57.659 
09:44:57.659 Import trace for requested module:
09:44:57.659 ./node_modules/@supabase/realtime-js/dist/module/lib/websocket-factory.js
09:44:57.660 ./node_modules/@supabase/realtime-js/dist/module/index.js
09:44:57.660 ./node_modules/@supabase/supabase-js/dist/module/index.js
09:44:57.660 ./node_modules/@supabase/ssr/dist/module/createBrowserClient.js
09:44:57.660 ./node_modules/@supabase/ssr/dist/module/index.js
09:44:57.660 ./src/app/(dashboard)/twg/documents/edit-actions.ts
09:44:57.660 
09:44:57.664    Linting and checking validity of types ...
09:45:06.008 
09:45:06.008 ./src/app/(dashboard)/admin/cew-stats/CEWStatsClient.tsx
09:45:06.009 43:6  Warning: React Hook useEffect has a missing dependency: 'fetchStats'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.009 
09:45:06.009 ./src/app/(dashboard)/admin/page.tsx
09:45:06.009 21:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.009 24:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.009 
09:45:06.009 ./src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx
09:45:06.010 17:3  Warning: 'getFilterModeDisplayName' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.010 28:35  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.010 109:10  Warning: 'currentQuestionIndex' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.010 125:6  Warning: React Hook useEffect has a missing dependency: 'fetchPollResults'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.010 222:22  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.010 223:19  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.010 464:44  Warning: 'pollId' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.011 559:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 560:28  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 561:25  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 588:55  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 593:52  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 601:147  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 602:130  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.011 627:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 632:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 632:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 634:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 639:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 639:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 668:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.012 668:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.013 671:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.014 676:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.014 676:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 680:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 685:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 685:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 700:47  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 711:44  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 738:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.017 742:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 742:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 744:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 748:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 748:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 767:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 767:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 770:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.018 774:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.024 774:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.025 778:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.025 782:26  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.025 782:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.025 1071:15  Warning: 'filteredResults' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 1310:9  Warning: 'scrollToSection' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 1928:29  Warning: 'pollKey' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 2081:29  Warning: 'pollKey' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 2139:57  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 2234:57  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 2236:37  Warning: 'isTopChoice' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 
09:45:06.025 ./src/app/(dashboard)/admin/poll-results/page.tsx
09:45:06.025 19:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 22:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 
09:45:06.025 ./src/app/(dashboard)/admin/tags/actions.ts
09:45:06.025 20:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 23:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 103:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 106:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.025 195:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 198:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 
09:45:06.026 ./src/app/(dashboard)/admin/tags/page.tsx
09:45:06.026 20:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 23:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 
09:45:06.026 ./src/app/(dashboard)/admin/twg-synthesis/TWGSynthesisClient.tsx
09:45:06.026 158:46  Warning: 'user' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 170:10  Warning: 'selectedSubmission' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 170:30  Warning: 'setSelectedSubmission' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 299:82  Warning: 'options' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 302:21  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 303:19  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 303:27  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 749:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 750:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 750:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 783:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 784:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 784:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 846:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 847:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.026 847:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 855:43  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 856:41  Warning: '_' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 856:49  Warning: '__' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 
09:45:06.027 ./src/app/(dashboard)/admin/users/__tests__/actions.test.ts
09:45:06.027 2:55  Warning: 'UserWithRole' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 15:15  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.027 
09:45:06.027 ./src/app/(dashboard)/cew-2025/page.tsx
09:45:06.027 34:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 37:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 
09:45:06.027 ./src/app/(dashboard)/cew-results/page.tsx
09:45:06.027 25:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 28:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 
09:45:06.027 ./src/app/(dashboard)/dashboard/page.tsx
09:45:06.027 21:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 24:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.027 
09:45:06.027 ./src/app/(dashboard)/survey-results/detailed-findings/page.tsx
09:45:06.027 184:104  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.027 184:118  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.027 185:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.027 185:28  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.027 231:80  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.027 231:101  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.027 232:44  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 232:58  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 232:63  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 232:82  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 269:85  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 330:37  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 330:84  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 
09:45:06.028 ./src/app/(dashboard)/survey-results/effectiveness/page.tsx
09:45:06.028 18:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.028 21:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.028 48:69  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 68:74  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.028 69:61  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 69:82  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 85:55  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 85:76  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 126:41  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 126:55  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 126:60  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 126:79  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 142:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 144:84  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 147:19  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 148:94  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.028 
09:45:06.028 ./src/app/(dashboard)/survey-results/holistic-protection/HolisticProtectionClient.tsx
09:45:06.028 5:8  Warning: 'RankingPoll' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 16:17  Warning: 'setPolls' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 107:9  Warning: 'toggleAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 128:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
09:45:06.029 164:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.029 166:48  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.029 256:15  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
09:45:06.029 
09:45:06.029 ./src/app/(dashboard)/survey-results/page.tsx
09:45:06.029 21:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 24:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 42:29  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.029 45:53  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.029 45:67  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.029 48:99  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.029 
09:45:06.029 ./src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx
09:45:06.029 9:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 89:9  Warning: 'toggleAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 99:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
09:45:06.029 
09:45:06.029 ./src/app/(dashboard)/survey-results/tiered-framework/TieredFrameworkClient.tsx
09:45:06.029 6:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.029 59:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
09:45:06.030 98:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.030 99:101  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.030 
09:45:06.030 ./src/app/(dashboard)/twg/discussions/[id]/page.tsx
09:45:06.030 77:6  Warning: React Hook useEffect has missing dependencies: 'fetchDiscussion', 'fetchReplies', and 'getCurrentUser'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.030 
09:45:06.030 ./src/app/(dashboard)/twg/discussions/page.tsx
09:45:06.030 31:15  Warning: 'count' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.030 51:76  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 71:49  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 76:49  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 82:32  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 83:35  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 84:36  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 85:40  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 86:40  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.030 98:6  Warning: React Hook useCallback has a missing dependency: 'supabase'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.030 108:59  Warning: 'sessionError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.030 154:6  Warning: React Hook useEffect has a missing dependency: 'supabase.auth'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.030 184:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 257:37  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 258:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 265:41  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 267:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 267:74  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 281:52  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.031 
09:45:06.031 ./src/app/(dashboard)/twg/documents/[id]/edit/page.tsx
09:45:06.031 19:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.031 22:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.031 
09:45:06.031 ./src/app/(dashboard)/twg/documents/[id]/page.tsx
09:45:06.031 22:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.031 25:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.031 
09:45:06.031 ./src/app/(dashboard)/twg/documents/page.tsx
09:45:06.031 8:6  Warning: 'Document' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.031 26:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.032 29:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.032 64:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.032 
09:45:06.033 ./src/app/(dashboard)/twg/review/TWGReviewClient.tsx
09:45:06.033 11:14  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.033 30:43  Warning: 'user' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.033 31:44  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.033 258:47  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.033 259:24  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.033 284:27  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.033 516:63  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.033 533:25  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.033 533:39  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.033 533:79  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.033 535:29  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.033 535:43  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.033 681:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.033 681:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 756:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 756:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 824:62  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 824:84  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 958:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 958:81  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.034 980:18  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.034 980:32  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.035 1075:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1075:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1243:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1243:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1442:58  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1442:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1466:100  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.035 1582:64  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1582:86  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1634:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1634:83  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1832:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1832:78  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1858:120  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.035 1957:63  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 1957:85  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 2128:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 2128:78  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.035 2145:18  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 2145:32  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 2197:98  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 2197:112  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 2216:64  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 2216:78  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.036 
09:45:06.036 ./src/app/(dashboard)/twg/review/page.tsx
09:45:06.036 20:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.036 29:20  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.036 
09:45:06.036 ./src/app/(dashboard)/twg-results/page.tsx
09:45:06.036 22:72  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.036 25:76  Warning: '_error' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.036 
09:45:06.036 ./src/app/(dashboard)/wiks/WIKSClient.tsx
09:45:06.042 13:11  Warning: Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
09:45:06.042 30:53  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 36:15  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.043 38:36  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.043 56:61  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 56:65  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 58:27  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 58:43  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 69:61  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 69:65  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 71:44  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 148:55  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.043 
09:45:06.043 ./src/app/api/discussions/route.ts
09:45:06.043 3:10  Warning: 'createAuthenticatedClient' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.043 3:37  Warning: 'getAuthenticatedUser' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.043 
09:45:06.044 ./src/app/api/graphs/prioritization-matrix/route.ts
09:45:06.044 7:42  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 7:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 7:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 102:61  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 273:39  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 449:80  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 451:83  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 460:81  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 462:84  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.044 
09:45:06.044 ./src/app/api/polls/submit/route.ts
09:45:06.044 76:43  Warning: 'checkError' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.044 117:7  Warning: 'voteData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.044 
09:45:06.044 ./src/app/api/ranking-polls/submit/route.ts
09:45:06.044 90:19  Warning: 'voteData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.044 
09:45:06.044 ./src/app/api/review/upload/route.ts
09:45:06.044 44:19  Warning: 'uploadData' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 
09:45:06.045 ./src/app/api/wordcloud-polls/results/route.ts
09:45:06.045 90:23  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.045 103:31  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.045 178:22  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.045 179:19  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.045 
09:45:06.045 ./src/app/cew-polls/holistic-protection/page.tsx
09:45:06.045 6:8  Warning: 'RankingPoll' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 8:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 15:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 15:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 
09:45:06.045 ./src/app/cew-polls/prioritization/page.tsx
09:45:06.045 9:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 21:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 21:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.045 
09:45:06.045 ./src/app/cew-polls/tiered-framework/page.tsx
09:45:06.045 7:11  Warning: 'PollData' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 14:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 14:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 
09:45:06.046 ./src/app/cew-polls/wiks/page.tsx
09:45:06.046 7:10  Warning: 'activeAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 7:27  Warning: 'setActiveAccordion' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 
09:45:06.046 ./src/app/page.tsx
09:45:06.046 3:8  Warning: 'Image' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 28:79  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.046 128:67  Warning: `'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.  react/no-unescaped-entities
09:45:06.046 
09:45:06.046 ./src/components/CEWCodeInput.tsx
09:45:06.046 7:40  Warning: 'onCodeEntered' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 
09:45:06.046 ./src/components/PollWithResults.tsx
09:45:06.046 67:6  Warning: React Hook useEffect has missing dependencies: 'fetchResults' and 'pagePath'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.046 119:15  Warning: 'result' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.046 252:34  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.046 252:40  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.047 252:61  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.047 252:77  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.047 362:45  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.047 362:51  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.047 
09:45:06.047 ./src/components/charts/ReportGroupedBarChart.tsx
09:45:06.047 95:9  Warning: 'secondaryTextColor' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.047 
09:45:06.047 ./src/components/dashboard/AdminUsersManager.tsx
09:45:06.047 5:37  Warning: 'addUserRole' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.047 43:6  Warning: React Hook useEffect has a missing dependency: 'fetchUsers'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.047 
09:45:06.047 ./src/components/dashboard/AnnouncementsManagement.tsx
09:45:06.047 41:6  Warning: React Hook useEffect has a missing dependency: 'fetchAnnouncements'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.047 
09:45:06.047 ./src/components/dashboard/CustomWordCloud.tsx
09:45:06.047 105:13  Warning: 'maxAttempts' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.047 141:32  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.047 
09:45:06.047 ./src/components/dashboard/DeleteButton.tsx
09:45:06.048 77:41  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.048 77:57  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.048 
09:45:06.048 ./src/components/dashboard/DiscussionThread.tsx
09:45:06.048 65:21  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.048 66:34  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.048 67:36  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.048 83:6  Warning: React Hook useEffect has missing dependencies: 'checkAdminStatus', 'fetchReplies', and 'supabase.auth'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.048 
09:45:06.048 ./src/components/dashboard/DocumentsList.tsx
09:45:06.048 5:10  Warning: 'createClient' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.048 
09:45:06.048 ./src/components/dashboard/PollResultsChart.tsx
09:45:06.048 44:12  Warning: '_options' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.048 
09:45:06.048 ./src/components/dashboard/ProjectTimeline.tsx
09:45:06.048 138:39  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.048 
09:45:06.048 ./src/components/dashboard/RankingPoll.tsx
09:45:06.048 97:6  Warning: React Hook useCallback has missing dependencies: 'authCode' and 'showChangeOption'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.049 115:6  Warning: React Hook useEffect has missing dependencies: 'options' and 'pagePath'. Either include them or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.049 168:20  Warning: 'index' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.049 
09:45:06.049 ./src/components/dashboard/SurveyResultsChart.tsx
09:45:06.049 5:47  Warning: 'Tooltip' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.049 50:9  Warning: 'tooltipBg' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.049 51:9  Warning: 'tooltipBorder' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 52:9  Warning: 'tooltipText' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 
09:45:06.050 ./src/components/dashboard/TagManagement.tsx
09:45:06.050 30:10  Warning: 'isLoading' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 
09:45:06.050 ./src/components/dashboard/VoicesCarousel.tsx
09:45:06.050 93:11  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.050 93:31  Warning: `"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.  react/no-unescaped-entities
09:45:06.050 
09:45:06.050 ./src/components/graphs/SurveyMatrixGraph.tsx
09:45:06.050 30:3  Warning: 'importanceIndex' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 31:3  Warning: 'feasibilityIndex' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 75:6  Warning: React Hook useEffect has a missing dependency: 'fetchMatrixData'. Either include it or remove the dependency array.  react-hooks/exhaustive-deps
09:45:06.050 
09:45:06.050 ./src/instrumentation-client.ts
09:45:06.050 37:21  Warning: 'hint' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 
09:45:06.050 ./src/lib/__tests__/auth-flow.test.ts
09:45:06.050 4:3  Warning: 'createAnonymousClient' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.050 70:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.050 104:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.050 122:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.050 148:15  Warning: 'supabase' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.051 218:25  Warning: 'cewClient' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.051 231:25  Warning: 'authClient' is assigned a value but never used.  @typescript-eslint/no-unused-vars
09:45:06.051 
09:45:06.051 ./src/lib/__tests__/rate-limit.test.ts
09:45:06.051 1:44  Warning: 'vi' is defined but never used.  @typescript-eslint/no-unused-vars
09:45:06.051 
09:45:06.051 ./src/lib/supabase-auth.test.ts
09:45:06.051 198:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 214:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 229:69  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 247:73  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 263:56  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 359:59  Warning: Unexpected any. Specify a different type.  @typescript-eslint/no-explicit-any
09:45:06.051 
09:45:06.051 info  - Need to disable some ESLint rules? Learn more here: https://nextjs.org/docs/app/api-reference/config/eslint#disabling-rules
09:45:16.144    Collecting page data ...
09:45:21.720    Generating static pages (0/43) ...
09:45:22.686    Generating static pages (10/43) 
09:45:23.122    Generating static pages (21/43) 
09:45:23.122    Generating static pages (32/43) 
09:45:23.268  ✓ Generating static pages (43/43)
09:45:24.444    Finalizing page optimization ...
09:45:24.445    Collecting build traces ...
09:45:32.719 
09:45:32.733 Route (app)                                 Size  First Load JS
09:45:32.733 ┌ ○ /                                    3.37 kB         216 kB
09:45:32.733 ├ ○ /_not-found                          1.16 kB         214 kB
09:45:32.733 ├ ƒ /admin                                4.3 kB         219 kB
09:45:32.733 ├ ƒ /admin/announcements                 3.35 kB         266 kB
09:45:32.733 ├ ƒ /admin/cew-stats                     1.94 kB         255 kB
09:45:32.733 ├ ƒ /admin/milestones                    3.41 kB         267 kB
09:45:32.733 ├ ƒ /admin/poll-results                  21.1 kB         281 kB
09:45:32.733 ├ ƒ /admin/reset-votes                   1.94 kB         259 kB
09:45:32.733 ├ ƒ /admin/tags                          5.57 kB         264 kB
09:45:32.733 ├ ƒ /admin/twg-synthesis                 11.1 kB         270 kB
09:45:32.733 ├ ƒ /admin/users                         7.93 kB         266 kB
09:45:32.733 ├ ƒ /api/announcements                     376 B         213 kB
09:45:32.733 ├ ƒ /api/auth/callback                     376 B         213 kB
09:45:32.733 ├ ƒ /api/discussions                       377 B         213 kB
09:45:32.733 ├ ƒ /api/discussions/[id]                  376 B         213 kB
09:45:32.734 ├ ƒ /api/discussions/[id]/replies          377 B         213 kB
09:45:32.734 ├ ƒ /api/documents/[id]                    376 B         213 kB
09:45:32.734 ├ ƒ /api/graphs/prioritization-matrix      377 B         213 kB
09:45:32.734 ├ ƒ /api/milestones                        377 B         213 kB
09:45:32.734 ├ ƒ /api/polls/results                     377 B         213 kB
09:45:32.734 ├ ƒ /api/polls/submit                      377 B         213 kB
09:45:32.734 ├ ƒ /api/ranking-polls/results             377 B         213 kB
09:45:32.734 ├ ƒ /api/ranking-polls/submit              374 B         213 kB
09:45:32.734 ├ ƒ /api/review/save                       377 B         213 kB
09:45:32.734 ├ ƒ /api/review/submit                     377 B         213 kB
09:45:32.734 ├ ƒ /api/review/upload                     378 B         213 kB
09:45:32.734 ├ ƒ /api/tags                              377 B         213 kB
09:45:32.734 ├ ƒ /api/wordcloud-polls/results           377 B         213 kB
09:45:32.734 ├ ƒ /api/wordcloud-polls/submit            377 B         213 kB
09:45:32.734 ├ ƒ /cew-2025                              375 B         213 kB
09:45:32.734 ├ ○ /cew-polls/holistic-protection       1.82 kB         219 kB
09:45:32.734 ├ ○ /cew-polls/prioritization            3.07 kB         228 kB
09:45:32.734 ├ ○ /cew-polls/tiered-framework           2.5 kB         220 kB
09:45:32.734 ├ ○ /cew-polls/wiks                      1.43 kB         214 kB
09:45:32.734 ├ ƒ /cew-results                         3.31 kB         327 kB
09:45:32.734 ├ ƒ /dashboard                           3.06 kB         218 kB
09:45:32.734 ├ ○ /demo-matrix-graph                   4.67 kB         221 kB
09:45:32.734 ├ ○ /login                               2.17 kB         261 kB
09:45:32.735 ├ ○ /signup                              2.44 kB         261 kB
09:45:32.735 ├ ƒ /survey-results                      6.28 kB         323 kB
09:45:32.735 ├ ○ /survey-results/detailed-findings    6.63 kB         221 kB
09:45:32.735 ├ ƒ /survey-results/effectiveness          349 B         215 kB
09:45:32.735 ├ ƒ /survey-results/holistic-protection  5.69 kB         226 kB
09:45:32.735 ├ ƒ /survey-results/prioritization       7.21 kB         236 kB
09:45:32.735 ├ ○ /survey-results/technical-standards    377 B         213 kB
09:45:32.735 ├ ƒ /survey-results/tiered-framework     3.67 kB         221 kB
09:45:32.735 ├ ƒ /twg-results                         4.29 kB         325 kB
09:45:32.735 ├ ○ /twg/discussions                     4.82 kB         263 kB
09:45:32.735 ├ ƒ /twg/discussions/[id]                8.05 kB         267 kB
09:45:32.735 ├ ƒ /twg/documents                       2.45 kB         261 kB
09:45:32.735 ├ ƒ /twg/documents/[id]                  2.41 kB         217 kB
09:45:32.735 ├ ƒ /twg/documents/[id]/edit             3.99 kB         263 kB
09:45:32.735 ├ ○ /twg/documents/new                    3.8 kB         262 kB
09:45:32.735 ├ ƒ /twg/review                          14.3 kB         271 kB
09:45:32.735 └ ƒ /wiks                                2.67 kB         216 kB
09:45:32.735 + First Load JS shared by all             213 kB
09:45:32.735   ├ chunks/4bd1b696-bde8a9ffe6da061c.js  54.3 kB
09:45:32.735   ├ chunks/52774a7f-13efbc8d454b195c.js    38 kB
09:45:32.735   ├ chunks/6749-4798ae477292146e.js       118 kB
09:45:32.735   └ other shared chunks (total)          3.15 kB
09:45:32.735 
09:45:32.735 
09:45:32.735 ƒ Middleware                             77.2 kB
09:45:32.735 
09:45:32.736 ○  (Static)   prerendered as static content
09:45:32.736 ƒ  (Dynamic)  server-rendered on demand
09:45:32.736 
09:45:33.003 Traced Next.js server files in: 89.016ms
09:45:33.642 Created all serverless functions in: 638.02ms
09:45:33.725 Collected static files (public/, static/, .next/static): 15.828ms
09:45:34.030 Build Completed in /vercel/output [1m]
09:45:34.235 Deploying outputs...
09:45:50.137 Deployment completed
09:45:50.767 Creating build cache...
09:46:15.591 Created build cache: 24.823s
09:46:15.592 Uploading build cache [467.93 MB]
09:46:21.146 Build cache uploaded: 5.554s