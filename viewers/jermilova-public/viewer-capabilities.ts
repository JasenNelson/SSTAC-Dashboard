export const JERMILOVA_VIEWER_CAPABILITIES = {
  packId: 'bnrrm-casestudy-jermilova2025-mackenzie-hg',
  modelId: 'bnrrm-mackenzie-hg-gsl',
  tabs: ['guide', 'conceptual', 'network', 'cpt', 'map', 'data'] as const,
  tabLabels: {
    guide: 'Guide',
    conceptual: 'Conceptual',
    network: 'Detailed BN',
    cpt: 'CPT',
    map: 'Map',
    data: 'Data',
  },
  assetKeys: [
    'pack',
    'runtime_model',
    'model_overview',
    'decisions',
    'provenance',
    'training_data',
    'basins_gsl',
    'basins_gbs',
    'advisory_lakes',
    'commercial_fisheries',
    'historic_mines',
    'large_mines',
    'hydro_facilities',
    'climate_stations',
    'thaw_slumps',
    'site_reports',
    'mineral_claims',
    'oil_gas_claims',
    'communities',
  ] as const,
  mapKeys: [
    'basins_gsl',
    'basins_gbs',
    'advisory_lakes',
    'commercial_fisheries',
    'historic_mines',
    'large_mines',
    'hydro_facilities',
    'climate_stations',
    'thaw_slumps',
  ] as const,
  evidenceNodeIds: [
    'atmospheric_hg_deposition',
    'permafrost_hg_release',
    'soil_erosion_hg_release',
    'fish_species',
    'fish_length',
    'proximity_mine_gsl',
    'proximity_historic_mine',
  ] as const,
  resultModes: ['forward'] as const,
  interactionMode: 'inspect-only' as const,
  evidenceControlsEnabled: false,
  exportEnabled: false,
  mapEnabled: true,
} as const;

export type JermilovaViewerTab = (typeof JERMILOVA_VIEWER_CAPABILITIES.tabs)[number];

export const JERMILOVA_EXPLORATORY_CAVEAT =
  'Independent reconstruction. Exploratory results reproduce the packaged model; agreement with the paper\'s regional predictions has not been established.';

export const JERMILOVA_EXPOSURE_CAVEAT =
  'These outputs use fixed scenario assumptions. The construction record states 100 g fish/day, 60 kg body weight and 95% methylmercury, with a 0.7 ug/kg body weight/week comparison threshold. The frozen runtime does not expose these as user inputs or independently record their parameter provenance.';

export const JERMILOVA_SOURCE_CONFLICT_CAVEAT =
  'The pack and construction record contain different dataset identifiers and supplementary-material status. These differences have not been reconciled for this release.';

export const JERMILOVA_C3_CAVEAT =
  'Paper agreement (C3): UNAVAILABLE for this package. The regions have no mapping to evidence or priors. This is not counted as a pass.';
