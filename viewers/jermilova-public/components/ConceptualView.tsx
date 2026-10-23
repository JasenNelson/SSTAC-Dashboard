import {
  JERMILOVA_C3_CAVEAT,
  JERMILOVA_EXPLORATORY_CAVEAT,
  JERMILOVA_VIEWER_CAPABILITIES,
} from '../viewer-capabilities';

export function ConceptualView() {
  return (
    <div className="content-grid">
      <section className="content-card content-card--lead">
        <p className="eyebrow">Conceptual view</p>
        <h2>Current mode: inspect only</h2>
        <p>
          This preview presents the packaged reconstruction baseline. It does not change states or run evidence scenarios.
        </p>
        <span className="read-only-label">{JERMILOVA_VIEWER_CAPABILITIES.interactionMode}</span>
      </section>
      <section className="content-card">
        <h3>Forward view</h3>
        <p>
          The Forward section shows the packaged reconstruction baseline without evidence updates.
        </p>
        <p>
          Root-only evidence controls remain absent until C1 engine parity and C2 baseline consistency are established.
        </p>
      </section>
      <section className="content-card">
        <h3>Limits of interpretation</h3>
        <p>{JERMILOVA_EXPLORATORY_CAVEAT}</p>
        <p>{JERMILOVA_C3_CAVEAT}</p>
      </section>
    </div>
  );
}
