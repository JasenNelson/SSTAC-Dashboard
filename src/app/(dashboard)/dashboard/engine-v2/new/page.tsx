// engine_v2 frontend Lane 1 / Module L1-4: new-project wizard shell.
// Server Component that gates admin and renders the client wizard.

import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import { WizardClient } from "@/components/engine-v2/wizard/WizardClient";

export default async function NewProjectPage() {
  // Redirects on failure (never returns); ensures only admins can reach the
  // wizard UI. The companion POST /api/engine-v2/projects route also enforces
  // admin gating - this is defense in depth.
  await requireAdminForServerComponent();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          New project
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Set up a new submission project. You can upload documents and trigger
          extraction after the project is created.
        </p>
      </div>
      <WizardClient />
    </div>
  );
}
