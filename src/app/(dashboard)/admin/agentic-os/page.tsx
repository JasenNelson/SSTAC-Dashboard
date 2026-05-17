// Agentic OS Projects view (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (codex 2026-05-16 P2 fix:
//      defense in depth against stale layout RSC cache on client-side
//      navigation between sibling routes). The layout.tsx ALSO performs
//      the same check; both must pass for the page to render. Restores
//      the pre-IA-refactor inline auth pattern this page had.
//   2. Read + parse Knowledge-Base/PROJECTS_MAP.md via the step-2 parser.
//   3. Fan out git activity + skill + agent discovery in parallel.
//   4. Pass the parsed data to the Projects-view client as a discriminated-
//      union prop so missing-file / parse-error states render an admin-
//      friendly message instead of an ErrorBoundary stacktrace.
//
// Feature-flag + PTY-enabled gates are handled by the parent `layout.tsx`.
//
// Architecture spec: .tmp_presentation/master/AGENTIC_OS_ARCHITECTURE.md §3-7
// Handoff doc: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §4, §11

import { requireAgenticOsPageAccess } from '@/lib/agentic-os/page-auth-guard';
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
import AgenticOsClient, { type AgenticOsResult } from './AgenticOsClient';

export const dynamic = 'force-dynamic';

export default async function AgenticOsPage() {
  // Page-level auth guard. Redirects to /login (unauth) or /dashboard
  // (auth but not admin) on failure. Defense in depth alongside the
  // layout's identical check.
  await requireAgenticOsPageAccess();

  // Read PROJECTS_MAP.md. If the file is missing or unparseable, surface a
  // discriminated-union to the client rather than throwing. Admins should
  // see "here is what's wrong and how to fix it", not a generic error page.
  let result: AgenticOsResult;
  let activity: Record<string, ProjectActivity> = {};
  let projectSkills: Record<string, ProjectSkills> = {};
  let projectAgents: Record<string, ProjectAgents> = {};
  try {
    const parsed = await readProjectsMap();
    // Fan-out git log + skill discovery + agent discovery across every
    // project in parallel. All three helpers isolate per-project failures
    // into their result's `error` field; the outer Promise.all always
    // resolves.
    const projectInputs = parsed.projects.map((p) => ({
      name: p.name,
      path: p.path,
    }));
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
    />
  );
}
