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
      <ul className="claim-list">
        {value.map((item) => <li key={item}>{item}</li>)}
      </ul>
    );
  }
  return <span>{String(value)}</span>;
}

export function AboutView({ claims }: AboutViewProps) {
  const groups = Array.from(new Set(claims.map((claim) => claim.group)));

  return (
    <div className="content-grid">
      <section className="content-card content-card--lead">
        <p className="eyebrow">About and limitations</p>
        <h2>Registered pack information</h2>
        <p>Only rows verified against the frozen asset hashes and claim register are displayed here.</p>
      </section>
      {groups.map((group) => (
        <section className="content-card" key={group}>
          <h3>{group}</h3>
          <dl className="claim-grid">
            {claims.filter((claim) => claim.group === group).map((claim) => (
              <div className="claim-row" key={claim.id}>
                <dt>{claim.label}</dt>
                <dd><ApprovedValue value={claim.approved_text} /></dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section className="content-card">
        <h3>Approved caveats</h3>
        <p>{JERMILOVA_EXPLORATORY_CAVEAT}</p>
        <p>{JERMILOVA_EXPOSURE_CAVEAT}</p>
        <p>{JERMILOVA_SOURCE_CONFLICT_CAVEAT}</p>
        <p>{JERMILOVA_C3_CAVEAT}</p>
      </section>
      <section className="content-card">
        <h3>Release placeholders</h3>
        <p className="placeholder-note">
          LOCAL PREVIEW PLACEHOLDER: exact licence and attribution text, and the relevant rights, have not been established and accepted.
        </p>
        <p className="placeholder-note">
          LOCAL PREVIEW PLACEHOLDER: map geometry and source rights have not been audited; provider terms and availability have not been checked.
        </p>
        <p className="placeholder-note">
          LOCAL PREVIEW PLACEHOLDER: dataset identifier and supplementary-material conflicts remain unreconciled for this release.
        </p>
      </section>
    </div>
  );
}
