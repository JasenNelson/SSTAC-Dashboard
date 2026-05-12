// engine_v2 frontend Lane 1 / Module L1-2: landing page.
// Server Component. Admin-gated entry point at /dashboard/engine-v2/.
// Lists the current admin user's v2_projects rows (RLS filters by auth.uid()).

import Link from "next/link";
import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import type { V2Project } from "@/lib/engine-v2/types";

// Subset of V2Project shape we actually render in the landing list.
type V2ProjectListRow = Pick<V2Project, "id" | "name" | "created_at">;

export default async function EngineV2LandingPage() {
  const { client } = await requireAdminForServerComponent();

  // RLS on v2_projects filters to auth.uid() = user_id; no explicit user_id
  // filter needed in the query. Order newest-first for owner workflow.
  const { data, error } = await client
    .from("v2_projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  const projects: V2ProjectListRow[] = data ?? [];
  const hasProjects = !error && projects.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Projects
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Submission projects you own. Create a new project to upload
            documents and run extraction.
          </p>
        </div>
        <Link
          href="/dashboard/engine-v2/new"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
        >
          New project
        </Link>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-red-900 dark:text-red-100">
            Could not load projects
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            Please refresh the page. If the problem persists, contact an
            administrator.
          </p>
        </div>
      ) : !hasProjects ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No projects yet
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
            Get started by creating your first project. You will be able to
            upload submission documents and trigger extraction once it is
            created.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/engine-v2/new"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
            >
              New project
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/dashboard/engine-v2/${project.id}`}
                className="block bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-500 transition-all"
              >
                <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {project.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Created {formatCreatedAt(project.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatCreatedAt(iso: string): string {
  // Defensive: created_at is a NOT NULL timestamptz column in v2_projects,
  // but a malformed value would otherwise throw at toLocaleDateString.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  // Lock locale to en-US to avoid SSR/client hydration mismatch when the
  // server (Node, en-US default) renders one string and the browser renders
  // another (e.g., en-CA "a.m." vs en-US "AM").
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
