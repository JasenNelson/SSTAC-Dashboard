import { findSubstance } from './substanceLibrary';
import { getPathwayApplicability, type RegulatoryFrameId } from './regulatoryFrames';
import { resolveEcoSeed } from './ecoSeed';

export type PathwayId4 =
  | 'human-health-direct'
  | 'human-health-food'
  | 'eco-direct-eqp'
  | 'eco-food-bsaf';

export const PATHWAY4_LABELS: Record<PathwayId4, string> = {
  'human-health-direct': 'Human Health (direct)',
  'human-health-food': 'Human Health (food web)',
  'eco-direct-eqp': 'Eco-Direct (EqP)',
  'eco-food-bsaf': 'Eco-Food (BSAF)',
};

export type ApplicabilityState =
  | 'computable'
  | 'missing-input'
  | 'not-applicable-for-class'
  | 'hidden-by-frame';

export interface PathwayApplicabilityResult {
  state: ApplicabilityState;
  reason: string;
}

export function getSubstanceApplicability(
  substanceKey: string,
  frameId: RegulatoryFrameId,
): Record<PathwayId4, PathwayApplicabilityResult> {
  const result: Partial<Record<PathwayId4, PathwayApplicabilityResult>> = {};
  const pathways: PathwayId4[] = [
    'human-health-direct',
    'human-health-food',
    'eco-direct-eqp',
    'eco-food-bsaf',
  ];

  const s = findSubstance(substanceKey);

  for (const pathway of pathways) {
    const fs = getPathwayApplicability(frameId, pathway).status;
    if (fs === 'unsupported') {
      result[pathway] = {
        state: 'hidden-by-frame',
        reason: 'Not applicable under the selected regulatory frame.',
      };
      continue;
    }
    if (fs === 'reference_only') {
      result[pathway] = {
        state: 'hidden-by-frame',
        reason: 'Reference-only under the selected frame; no calculated default.',
      };
      continue;
    }

    if (!s) {
      result[pathway] = {
        state: 'missing-input',
        reason: 'Unknown substance.',
      };
      continue;
    }

    if (pathway === 'human-health-direct' || pathway === 'human-health-food') {
      if (
        s.rfd_oral_mg_per_kg_bw_per_day != null ||
        s.sf_oral_per_mg_per_kg_bw_per_day != null
      ) {
        result[pathway] = {
          state: 'computable',
          reason: 'Oral RfD or slope factor available.',
        };
      } else {
        result[pathway] = {
          state: 'missing-input',
          reason: 'No oral RfD or slope factor wired for this substance.',
        };
      }
    } else if (pathway === 'eco-direct-eqp') {
      if (s.logKow === null) {
        if (
          s.contaminantClass === 'divalent-metal' ||
          s.contaminantClass === 'methyl-Hg' ||
          s.contaminantClass === 'metalloid' ||
          s.contaminantClass === 'inorganic'
        ) {
          result[pathway] = {
            state: 'not-applicable-for-class',
            reason:
              'Equilibrium partitioning (EqP) does not apply to metals/ionic substances (no log Kow).',
          };
        } else {
          result[pathway] = {
            state: 'missing-input',
            reason: 'No log Kow available for this organic substance.',
          };
        }
      } else {
        result[pathway] = {
          state: 'computable',
          reason: 'log Kow available; EqP is runnable (FCV is a user input).',
        };
      }
    } else if (pathway === 'eco-food-bsaf') {
      const hasMammalSeed = resolveEcoSeed(
        substanceKey,
        'eco-food-bsaf',
        'trv_eco_mg_per_kg_bw_day',
        frameId,
        'mammal',
      );
      const hasBirdSeed = resolveEcoSeed(
        substanceKey,
        'eco-food-bsaf',
        'trv_eco_mg_per_kg_bw_day',
        frameId,
        'bird',
      );
      if (
        hasMammalSeed != null ||
        hasBirdSeed != null ||
        s.trv_eco_mg_per_kg_bw_day != null ||
        s.bsaf_loc_freshwater != null
      ) {
        result[pathway] = {
          state: 'computable',
          reason: 'Wildlife dietary TRV or BSAF available.',
        };
      } else {
        result[pathway] = {
          state: 'missing-input',
          reason: 'No wildlife dietary TRV or BSAF available for this substance.',
        };
      }
    }
  }

  return result as Record<PathwayId4, PathwayApplicabilityResult>;
}

export function applicabilityBadgeClass(state: ApplicabilityState): string {
  switch (state) {
    case 'computable':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'missing-input':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    case 'not-applicable-for-class':
    case 'hidden-by-frame':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
}

export function applicabilityShortLabel(state: ApplicabilityState): string {
  switch (state) {
    case 'computable':
      return 'Ready';
    case 'missing-input':
      return 'Needs data';
    case 'not-applicable-for-class':
      return 'N/A (class)';
    case 'hidden-by-frame':
      return 'Off (frame)';
  }
}
