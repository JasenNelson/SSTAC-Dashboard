// Agentic OS admin page — Step 3 of the MVP (static read-only "pulse" view).
//
// Server component responsibilities:
//   1. Verify the caller is authenticated and has the admin role.
//   2. Read + parse Knowledge-Base/PROJECTS_MAP.md via the step-2 parser.
//   3. Pass the parsed data to the client as a discriminated-union prop so
//      missing-file / parse-error states render an admin-friendly message
//      instead of an ErrorBoundary stacktrace.
//
// Auth pattern note: we inline the createServerClient + admin-role check
// rather than calling requireAdminForServerComponent from @/lib/engine-v2/
// admin_guards. The engine-v2 helper hardcodes a post-login redirect to
// /dashboard/engine-v2, which would land Agentic OS visitors on the wrong
// page after a session-expired bounce. The matrix-review admin page made
// the same divergence earlier this session for the same reason. When/if
// the helper learns a `next` parameter, this can switch back.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md §3-7
// Handoff doc: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §4, §11

import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  readProjectsMap,
  resolveProjectsMapPath,
} from '@/lib/agentic-os/parse-projects-map';
import {
  getAllProjectsActivity,
  type ProjectActivity,
} from '@/lib/agentic-os/git-activity';
import {
  discoverAllProjectSkills,
  type ProjectSkills,
} from '@/lib/agentic-os/skill-discovery';
import {
  discoverAllProjectAgents,
  type ProjectAgents,
} from '@/lib/agentic-os/agent-discovery';
import { isAgenticOsEnabled } from '@/lib/agentic-os/feature-flag';
import { isAgenticOsPtyEnabled } from '@/lib/agentic-os/feature-flag-server';
import AgenticOsClient, { type AgenticOsResult } from './AgenticOsClient';

// ErrorBoundary intentionally NOT wrapped here: it only catches CLIENT-side
// render errors, and our try/catch below converts known server failures into
// the discriminated-union result. Server-component throws bubble to Next's
// error.tsx instead (add one if/when we want a styled fallback).

export const dynamic = 'force-dynamic';

export default async function AgenticOsPage() {
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
    }
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

  // Feature-flag gate (holistic review IMPORTANT-1). The page reads
  // PROJECTS_MAP.md from the local filesystem and spawns git per project --
  // neither works on a serverless deployment, so we render a clear
  // "local-only" message rather than silently producing a page where every
  // sparkline is idle and every Recent-Commits panel reads "Git unavailable".
  if (!isAgenticOsEnabled()) {
    const result: AgenticOsResult = {
      ok: false,
      error: 'Agentic OS is a local-only feature',
      hint:
        'This admin page reads Knowledge-Base/PROJECTS_MAP.md from the ' +
        'local filesystem and spawns git per project, so it only works ' +
        'when you run the dashboard with `npm run dev` on the same ' +
        'machine that hosts your Projects directory. To enable it ' +
        'outside development mode, set NEXT_PUBLIC_AGENTIC_OS_ENABLED=true ' +
        'in your runtime environment (and ensure the filesystem + git are ' +
        'actually available there).',
    };
    return (
      <AgenticOsClient
        result={result}
        activity={{}}
        projectSkills={{}}
        projectAgents={{}}
        ptyEnabled={false}
      />
    );
  }

  // Step 9 / Pattern E: probe the PTY gate server-side. node-pty's
  // require-time probe is server-only; we pass a plain boolean to the
  // client so the bundle never imports node-pty. The boolean controls
  // whether the "Open in embedded terminal" button is clickable + which
  // tooltip it shows.
  const ptyEnabled = isAgenticOsPtyEnabled();

  // Read PROJECTS_MAP.md. If the file is missing or unparseable, surface a
  // discriminated-union to the client rather than throwing. Admins should see
  // "here is what's wrong and how to fix it", not a generic error page.
  let result: AgenticOsResult;
  let activity: Record<string, ProjectActivity> = {};
  let projectSkills: Record<string, ProjectSkills> = {};
  let projectAgents: Record<string, ProjectAgents> = {};
  try {
    const parsed = await readProjectsMap();
    // Fan-out git log + skill discovery + agent discovery across every project
    // in parallel. All three helpers isolate per-project failures into their
    // result's `error` field; the outer Promise.all always resolves.
    const projectInputs = parsed.projects.map((p) => ({ name: p.name, path: p.path }));
    [activity, projectSkills, projectAgents] = await Promise.all([
      getAllProjectsActivity(projectInputs),
      discoverAllProjectSkills(projectInputs),
      discoverAllProjectAgents(projectInputs),
    ]);
    result = { ok: true, projects: parsed.projects, edges: parsed.edges };
  } catch (err) {
    const expectedPath = resolveProjectsMapPath();
    const message = err instanceof Error ? err.message : String(err);
    result = {
      ok: false,
      error: 'Could not read PROJECTS_MAP.md',
      detail: message,
      expectedPath,
      hint:
        'Ensure Knowledge-Base/PROJECTS_MAP.md exists at the expected path ' +
        'or set the KNOWLEDGE_BASE_PATH environment variable to point at the ' +
        'Knowledge-Base directory before restarting `next dev`.',
    };
  }

  return (
    <AgenticOsClient
      result={result}
      activity={activity}
      projectSkills={projectSkills}
      projectAgents={projectAgents}
      ptyEnabled={ptyEnabled}
    />
  );
}
