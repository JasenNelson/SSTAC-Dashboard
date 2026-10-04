import {
  diagramDescription,
  diagramStructure,
  modelForBinding,
  notationRuns,
  treeFit,
  type DiagramDescriptionOptions,
  type DiagramModel,
  type DiagramNode,
  type DiagramTreeNode,
  type FigureBinding,
} from '@/lib/matrix-options/paper/figures';

/*
 * One paper figure, drawn from a parsed "Diagram summary" block (see
 * lib/matrix-options/paper/figures.ts). No directive: rendered by PaperText on
 * the server document and in the client section window alike.
 *
 * Every box is real text in real lists, so the figure reads in order without
 * the drawing: a tree is nested lists (parent, then its branches), a chain is an
 * ordered list. The connector strokes are decorative (CSS pseudo-elements) and
 * the relationships they draw are also stated in the figure's description.
 * Layout rules live in globals.css (.paper-figure); they switch between a
 * branching drawing and an indented outline by container width.
 */

type NotationMode = 'plain' | 'math';

function Notation({ text, notation = 'plain' }: { readonly text: string; readonly notation?: NotationMode }) {
  return (
    <>
      {notationRuns(text, notation).map((run, index) => (run.sub ? <sub key={index}>{run.text}</sub> : run.sup ? <sup key={index}>{run.text}</sup> : <span key={index}>{run.text}</span>))}
    </>
  );
}

function FigureNode({ node, incomingLabel, notation }: { readonly node: DiagramNode; readonly incomingLabel: string | null; readonly notation: NotationMode }) {
  return (
    <>
      {incomingLabel ? <p className="paper-figure__edge-label"><Notation text={incomingLabel} notation={notation} /></p> : null}
      <div className="paper-figure__node" data-figure-node={node.id}>
        <p className="paper-figure__node-label"><Notation text={node.label} notation={notation} /></p>
        {node.heads.map((head, index) => (
          <p key={index} className="paper-figure__node-head"><Notation text={head} notation={notation} /></p>
        ))}
        {node.bullets.length > 0 ? (
          <ul className="paper-figure__bullets" role="list">
            {node.bullets.map((bullet, index) => (
              <li key={index}><Notation text={bullet} notation={notation} /></li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function TreeBranch({ branch, notation }: { readonly branch: DiagramTreeNode; readonly notation: NotationMode }) {
  const count = branch.children.length;
  return (
    <li className="paper-figure__branch" data-labelled={branch.incomingLabel ? 'true' : undefined}>
      <FigureNode node={branch.node} incomingLabel={branch.incomingLabel} notation={notation} />
      {count > 0 ? (
        <ul className="paper-figure__children" data-count={Math.min(count, 5)} role="list">
          {branch.children.map((child) => (
            <TreeBranch key={child.node.id} branch={child} notation={notation} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PaperFigure({ model: source, binding }: { readonly model: DiagramModel; readonly binding: FigureBinding | null }) {
  const model = modelForBinding(source, binding);
  const notation: NotationMode = binding?.notation ?? 'plain';
  const structure = diagramStructure(model);
  // Whether a tree structure's branching drawing fits the container (globals.css
  // .paper-figure__tree data-fit); null for chain/graph, which never draw as branches. The layout
  // is passed through so treeFit can tell a grid multi-root board (auto-fit columns, narrower per
  // root than the single-root assumption) from a stack multi-root layer (still full width) -- P3-1.
  const fit = structure.kind === 'tree' ? treeFit(structure.roots, model.layout) : null;
  // Text-equivalent options are scoped to candidate bindings only (P3-1); every other binding keeps
  // diagramDescription's default, byte-identical output, and the relations list keeps saying "leads to".
  const isCandidate = binding?.status === 'candidate-nonfinal';
  const descriptionOptions: DiagramDescriptionOptions | undefined = isCandidate ? { relation: binding?.edgeRelation } : undefined;
  const relationWord = descriptionOptions?.relation ?? 'leads to';
  // A candidate placement's binding.id deliberately repeats its register number (e.g. '6-1' for both the paper
  // prototype and the content candidate), so the suffix goes into the key: the figure, caption and description
  // ids (and the aria references to them) must all stay unique on a page that shows both.
  const key = `${binding?.id ?? `summary-${model.summaryNumber}`}${binding?.status === 'candidate-nonfinal' ? '-candidate' : ''}`.toLowerCase();
  const captionId = `paper-figure-caption-${key}`;
  const descriptionId = `paper-figure-description-${key}`;
  const labelOf = new Map(model.nodes.map((node) => [node.id, node.label]));
  return (
    <figure
      id={binding ? `figure-${key}` : undefined}
      className="paper-figure"
      data-paper-figure={binding?.kind === 'restored' ? binding.id : undefined}
      data-derived-figure={binding?.kind === 'derived' ? binding.id : undefined}
      data-diagram-summary={model.summaryNumber > 0 ? model.summaryNumber : undefined}
      data-source-sha256={binding?.sourceSha256}
      data-binding={binding ? binding.kind : 'unbound'}
      data-status={binding?.status}
      data-disposition={binding?.disposition}
      data-label-authority={binding?.overrideAuthority ?? undefined}
      data-content-authority={binding?.contentAuthority ?? undefined}
      data-semantic-asset={binding?.assetId}
      data-notation={notation}
      data-layout={model.layout}
      data-structure={structure.kind}
      aria-labelledby={captionId}
      aria-describedby={descriptionId}
    >
      <div className="paper-figure__canvas">
        {binding?.statusNote ? <p className="paper-figure__status" data-status={binding.status}>{binding.statusNote}</p> : null}
        {model.title ? <p className="paper-figure__title"><Notation text={model.title} notation={notation} /></p> : null}
        {structure.kind === 'chain' ? (
          <ol className="paper-figure__chain" role="list">
            {structure.steps.map((step) => (
              <li key={step.node.id} className="paper-figure__step" data-labelled={step.incomingLabel ? 'true' : undefined}>
                <FigureNode node={step.node} incomingLabel={step.incomingLabel} notation={notation} />
              </li>
            ))}
          </ol>
        ) : structure.kind === 'tree' ? (
          <ul
            className="paper-figure__tree"
            data-roots={structure.roots.length > 1 ? 'many' : 'one'}
            data-fit={fit ?? undefined}
            role="list"
          >
            {structure.roots.map((root) => (
              <TreeBranch key={root.node.id} branch={root} notation={notation} />
            ))}
          </ul>
        ) : (
          <>
            <ul className="paper-figure__grid" role="list">
              {model.nodes.map((node) => (
                <li key={node.id} className="paper-figure__branch"><FigureNode node={node} incomingLabel={null} notation={notation} /></li>
              ))}
            </ul>
            <ul className="paper-figure__relations" role="list">
              {model.edges.map((edge, index) => (
                <li key={index}>
                  <Notation text={`${labelOf.get(edge.from)} ${relationWord} ${labelOf.get(edge.to)}${edge.label ? ` (${edge.label})` : ''}`} notation={notation} />
                </li>
              ))}
            </ul>
          </>
        )}
        {model.notes.map((note, index) => (
          <p key={index} className="paper-figure__note"><Notation text={note} notation={notation} /></p>
        ))}
      </div>
      {/* hidden, not sr-only: aria-describedby still reads it, and browse mode does not read it a second time */}
      <p id={descriptionId} hidden>{diagramDescription(model, notation, descriptionOptions)}</p>
      <figcaption id={captionId} className="paper-figure__caption">
        {binding?.label ? (
          <><span className="paper-figure__number">{binding.label}.</span> {binding.caption}</>
        ) : binding?.kind === 'derived' ? (
          <><span className="paper-figure__number">Proposed visual summary.</span> {binding.caption}</>
        ) : (
          <span className="paper-figure__number">{model.title ? <Notation text={model.title} /> : 'Diagram'}</span>
        )}
      </figcaption>
    </figure>
  );
}