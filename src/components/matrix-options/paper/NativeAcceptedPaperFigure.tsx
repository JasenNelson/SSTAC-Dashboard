import { acceptedFigureDomId, type AcceptedFigureBinding } from '@/lib/matrix-options/paper/accepted-figures';
import { nativeFigureForBinding, type NativeFigureSet } from '@/lib/matrix-options/paper/native-figures';

import { PaperFigure } from './PaperFigure';

/** Authenticated native drawing. The only scientific words come from the private model. */
export function NativeAcceptedPaperFigure({ figure, nativeFigures }: {
  readonly figure: AcceptedFigureBinding;
  readonly nativeFigures: NativeFigureSet;
}) {
  const { model, binding } = nativeFigureForBinding(nativeFigures, figure);
  return <PaperFigure model={model} binding={binding} domId={acceptedFigureDomId(figure.placement.figureId)} nativeFigureId={figure.placement.figureId} />;
}
