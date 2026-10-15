export const metadata = { title: 'Private data access' };

export default function PrivateDataAccessPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Private data access
      </h1>
      <p className="mt-4 max-w-3xl text-slate-600 dark:text-slate-300">
        Some Database samples come from private data review assessments (DRAs)
        and are hidden from your account. If you need access to specific DRAs,
        contact a Database administrator.
      </p>
      <a
        href="/matrix-options?view=Database"
        className="mt-4 inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Back to Database
      </a>
    </div>
  );
}
