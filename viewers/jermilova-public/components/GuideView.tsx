'use client';

import { useState } from 'react';
import type { VerifiedClaim } from '../lib/loadJermilovaPack';
import {
  JERMILOVA_C3_CAVEAT,
  JERMILOVA_EXPLORATORY_CAVEAT,
  JERMILOVA_EXPOSURE_CAVEAT,
  JERMILOVA_SOURCE_CONFLICT_CAVEAT,
} from '../viewer-capabilities';

type Audience = 'decision-maker' | 'technical' | null;

interface GuideViewProps {
  claims: VerifiedClaim[];
}

export function GuideView({ claims }: GuideViewProps) {
  const [audience, setAudience] = useState<Audience>(null);
  const identity = claims.find((claim) => claim.id === 'pack-display-name');
  const citation = claims.find((claim) => claim.id === 'article-citation');
  const nodeCount = claims.find((claim) => claim.id === 'model-node-count');
  const edgeCount = claims.find((claim) => claim.id === 'model-edge-count');

  return (
    <div className="guide-layout">
      <section className="guide-intro">
        <p className="eyebrow">Getting started</p>
        <h2>BN-RRM</h2>
        <p className="subtitle">Benthic Risk Assessment</p>
        <p className="guide-model-identity">{identity?.approved_text ?? 'Jermilova public viewer'}</p>
        <p className="approved-reference">{citation?.approved_text ?? 'Article reference unavailable'}</p>
        <p className="guide-audience-prompt">Select your role to see the most relevant information:</p>
        <div className="audience-cards">
          <AudienceCard
            title="Decision Maker"
            subtitle="Managers, directors, and stakeholders"
            description="Understand what the model produces, what its outputs mean, and what decisions it can and cannot support."
            active={audience === 'decision-maker'}
            onClick={() => setAudience(audience === 'decision-maker' ? null : 'decision-maker')}
          />
          <AudienceCard
            title="Technical Reviewer"
            subtitle="QPs, scientists, and technical staff"
            description="Understand the causal DAG structure, inference mechanics, CPT learning tiers, and how to evaluate model outputs."
            active={audience === 'technical'}
            onClick={() => setAudience(audience === 'technical' ? null : 'technical')}
          />
        </div>
      </section>

      {audience === 'decision-maker' && (
        <section className="guide-track" aria-labelledby="guide-decision-title">
          <TrackHeader id="guide-decision-title" title="For Decision Makers" color="blue" />
          <details className="guide-disclosure" open>
            <summary>What does this model do?</summary>
            <p>BN-RRM is a complementary tool that uses causal reasoning rather than scenario classification.</p>
            <p>The displayed values are packaged reconstruction baseline probabilities. This preview is not a regulatory decision tool.</p>
          </details>
          <details className="guide-disclosure">
            <summary>How to read the outputs</summary>
            <p>The Forward baseline panel displays the packaged probability distribution for the impact node without evidence updates.</p>
            <p>The Detailed BN view lets you inspect the directed network, select a node, and read its packaged baseline values.</p>
          </details>
          <details className="guide-disclosure">
            <summary>How this relates to other assessment methods</summary>
            <p>Weight of Evidence (WOE), Sediment Quality Triads (SQT), and guideline-based screening (SQG) use different methodologies. BN-RRM is a complementary tool that uses causal reasoning rather than scenario classification.</p>
            <p>Risk conclusions from consultant reports are external reference labels and are not directly comparable to BN-RRM posterior estimates without explicit mapping rules.</p>
          </details>
          <details className="guide-disclosure">
            <summary>Model status and limitations</summary>
            <Caveats />
          </details>
        </section>
      )}

      {audience === 'technical' && (
        <section className="guide-track" aria-labelledby="guide-technical-title">
          <TrackHeader id="guide-technical-title" title="For Technical Reviewers" color="violet" />
          <details className="guide-disclosure" open>
            <summary>Packaged model identity</summary>
            <p>{identity?.approved_text ?? 'Jermilova public viewer'}</p>
            <p>{nodeCount?.approved_text ?? 'Node count unavailable'} nodes and {edgeCount?.approved_text ?? 'edge count unavailable'} directed links are provided by the verified pack claims.</p>
          </details>
          <details className="guide-disclosure">
            <summary>Network and conditional probability tables</summary>
            <p>The Detailed BN view presents the packaged network and baseline. The CPT view presents packaged conditional probability table values without editing controls.</p>
            <p>This inspect-only preview does not set evidence or run scenario updates.</p>
          </details>
          <details className="guide-disclosure">
            <summary>Inference and interpretation boundary</summary>
            <p>Root-only evidence controls remain absent until C1 engine parity and C2 baseline consistency are established.</p>
            <p>Paper agreement (C3) is unavailable for this package. The regions have no mapping to evidence or priors.</p>
          </details>
          <details className="guide-disclosure">
            <summary>Model status and limitations</summary>
            <Caveats />
          </details>
        </section>
      )}
    </div>
  );
}

function AudienceCard({ title, subtitle, description, active, onClick }: {
  title: string;
  subtitle: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={active ? 'audience-card audience-card--active' : 'audience-card'}
      aria-expanded={active} onClick={onClick}>
      <span className="audience-card__title">{title}</span>
      <span className="audience-card__subtitle">{subtitle}</span>
      <span className="audience-card__description">{description}</span>
    </button>
  );
}

function TrackHeader({ id, title, color }: { id: string; title: string; color: 'blue' | 'violet' }) {
  return (
    <div className={'track-header track-header--' + color}>
      <span aria-hidden="true" />
      <h3 id={id}>{title}</h3>
    </div>
  );
}

function Caveats() {
  return (
    <div className="guide-caveats">
      <p>{JERMILOVA_EXPLORATORY_CAVEAT}</p>
      <p>{JERMILOVA_EXPOSURE_CAVEAT}</p>
      <p>{JERMILOVA_SOURCE_CONFLICT_CAVEAT}</p>
      <p>{JERMILOVA_C3_CAVEAT}</p>
    </div>
  );
}
