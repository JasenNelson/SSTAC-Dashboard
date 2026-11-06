import type { VerifiedClaim } from '../lib/loadJermilovaPack';
import {
  JERMILOVA_C3_CAVEAT,
  JERMILOVA_EXPLORATORY_CAVEAT,
  JERMILOVA_EXPOSURE_CAVEAT,
  JERMILOVA_SOURCE_CONFLICT_CAVEAT,
} from '../viewer-capabilities';

interface AboutViewProps {
  claims: VerifiedClaim[];
}

function ApprovedValue({ value }: { value: string | number | string[] }) {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
        {value.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }
  return <span>{String(value)}</span>;
}

export function AboutView({ claims }: AboutViewProps) {
  const groups = Array.from(new Set(claims.map((claim) => claim.group)));

  return (
    <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-900 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-5xl gap-5">
        <section className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-800 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">About and limitations</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Registered pack information</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Only rows verified against the frozen asset hashes and claim register are displayed here.</p>
        </section>
        {groups.map((group) => (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800" key={group}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{group}</h3>
            <dl className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
              {claims.filter((claim) => claim.group === group).map((claim) => (
                <div className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:gap-5" key={claim.id}>
                  <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">{claim.label}</dt>
                  <dd className="text-sm leading-6 text-slate-800 dark:text-slate-200"><ApprovedValue value={claim.approved_text} /></dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <h3 className="text-lg font-semibold text-amber-950 dark:text-amber-100">Approved caveats</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-amber-950/90 dark:text-amber-100/90">
            <p>{JERMILOVA_EXPLORATORY_CAVEAT}</p>
            <p>{JERMILOVA_EXPOSURE_CAVEAT}</p>
            <p>{JERMILOVA_SOURCE_CONFLICT_CAVEAT}</p>
            <p>{JERMILOVA_C3_CAVEAT}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
