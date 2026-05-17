// Agentic OS shared layout (server component).
//
// Wraps every sibling route under /admin/agentic-os with:
//   - Auth + admin-role gate (server-side, redirect-on-fail)
//   - Feature-flag gate (renders local-only error state when disabled)
//   - The shared chrome: admin pills bar + page sub-header + left sidebar +
//     bottom tabbed terminal panel. All lifted from the prior monolithic
//     AgenticOsClient.tsx and re-rendered ONCE per page navigation.
//
// Data flow:
//   - This layout does NOT fetch PROJECTS_MAP.md / git activity / skills /
//     agents. Those reads happen in the projects route (page.tsx) where
//     they're actually consumed. The layout only needs:
//       1. Authentication state (server-side)
//       2. Feature-flag state (env)
//       3. PTY-enabled state (server-side node-pty probe)
//       4. Total-agent-count for the header chip (computed once in the
//          projects route's server fetch and passed via cookie or recomputed
//          here; for PR-1 we accept stale 0 in the header chip when on
//          subscriptions/future routes -- the chip is informational and the
//          projects route refreshes it on navigation back).
//
// Auth pattern note: inlined createServerClient + admin-role check rather
// than calling requireAdminForServerComponent from @/lib/engine-v2/
// admin_guards. The engine-v2 helper hardcodes a post-login redirect to
// /dashboard/engine-v2, which would land Agentic OS visitors on the wrong
// page after a session-expired bounce. The matrix-review admin page made
// the same divergence earlier in this branch. When/if the helper learns a
// `next` parameter, this can switch back.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAgenticOsEnabled } from '@/lib/agentic-os/feature-flag';
import { isAgenticOsPtyEnabled } from '@/lib/agentic-os/feature-flag-server';
import { readProjectsMap } from '@/lib/agentic-os/parse-projects-map';
import { discoverAllProjectAgents } from '@/lib/agentic-os/agent-discovery';
import AgenticOsLayoutClient from './AgenticOsLayoutClient';

export const dynamic = 'force-dynamic';

interface LayoutProps {
  children: React.ReactNode;
}

export default async function AgenticOsLayout({ children }: LayoutProps) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    redirect('/dashboard');
  }

  // Feature-flag gate (holistic-review IMPORTANT-1). The page reads
  // PROJECTS_MAP.md from the local filesystem and spawns git per project --
  // neither works on a serverless deployment, so we render a clear
  // "local-only" message rather than silently producing a page where
  // everything is idle / unavailable. Identical behavior to the
  // pre-refactor page.tsx flag check; surfaced here so the gate fires
  // before ANY sibling route renders.
  if (!isAgenticOsEnabled()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 p-8">
        <div className="max-w-2xl mx-auto mt-12 border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-amber-700 dark:text-amber-300 mb-2">
            Agentic OS is a local-only feature
          </h1>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            This admin page reads Knowledge-Base/PROJECTS_MAP.md from the
            local filesystem and spawns git per project, so it only works
            when you run the dashboard with <code>npm run dev</code> on the
            same machine that hosts your Projects directory. To enable it
            outside development mode, set{' '}
            <code>NEXT_PUBLIC_AGENTIC_OS_ENABLED=true</code> in your runtime
            environment (and ensure the filesystem + git are actually
            available there).
          </p>
        </div>
      </div>
    );
  }

  // Step 9 / Pattern E: probe the PTY gate server-side. node-pty's
  // require-time probe is server-only; we pass a plain boolean to the
  // client so the bundle never imports node-pty.
  const ptyEnabled = isAgenticOsPtyEnabled();

  // Total-agent count for the header chip. Computed once per layout
  // render so the chip stays accurate on EVERY sibling route (otherwise
  // navigating to /subscriptions would show "0 agents" until the user
  // navigates back to projects). The cost is one PROJECTS_MAP.md read +
  // a fan-out of agent-discovery calls per render -- acceptable for an
  // admin page that's only ever opened by a single owner-developer.
  //
  // Failures are isolated: if PROJECTS_MAP.md is missing/unparseable we
  // fall back to 0 rather than blocking the entire layout (the projects
  // route's own page.tsx will surface the parse error with hint copy).
  let agentCountTotal = 0;
  try {
    const parsed = await readProjectsMap();
    const projectInputs = parsed.projects.map((p) => ({
      name: p.name,
      path: p.path,
    }));
    const projectAgents = await discoverAllProjectAgents(projectInputs);
    let projTotal = 0;
    let globalCount = 0;
    let sawGlobal = false;
    for (const p of parsed.projects) {
      const pa = projectAgents[p.name];
      if (!pa) continue;
      projTotal += pa.projectAgents.length;
      if (!sawGlobal) {
        globalCount = pa.globalAgents.length;
        sawGlobal = true;
      }
    }
    agentCountTotal = projTotal + globalCount;
  } catch {
    // Parse / discovery failure -- chip falls back to 0. The projects
    // route's page.tsx renders the rich error state when it hits the
    // same failure on its own server-side fetch.
  }

  return (
    <AgenticOsLayoutClient
      ptyEnabled={ptyEnabled}
      agentCountTotal={agentCountTotal}
    >
      {children}
    </AgenticOsLayoutClient>
  );
}
