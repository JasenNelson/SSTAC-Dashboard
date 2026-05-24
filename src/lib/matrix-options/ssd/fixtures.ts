import type { RawEcotoxRecord, SsdAnalysisMode } from './types';

export type SsdFixtureDatasetRole = 'preview' | 'validation';

export type SsdFixtureDatasetId =
  | 'copper_preview'
  | 'ccme_boron_validation'
  | 'ccme_endosulfan_validation';

export interface SsdFixtureValidationReference {
  label: string;
  analysisMode: SsdAnalysisMode;
  pValue: number;
  expectedHcp: number;
  unit: string;
  tolerance: number;
  sourceLabel: string;
  sourceUrl: string;
}

interface ReferenceRow {
  species: string;
  concentration: number;
  group: string;
}

export interface SsdFixtureDataset {
  id: SsdFixtureDatasetId;
  label: string;
  chemicalName: string;
  role: SsdFixtureDatasetRole;
  packageDataset?: string;
  sourceLabel: string;
  sourceUrl: string;
  sourceDetailUrl: string;
  sourceAccessedAt: string;
  validationNote: string;
  validationReferences?: SsdFixtureValidationReference[];
  rows: RawEcotoxRecord[];
}

export const DEFAULT_SSD_FIXTURE_DATASET_ID: SsdFixtureDatasetId =
  'copper_preview';

function buildCcmeValidationRows(options: {
  chemicalName: string;
  unit: string;
  sourceKey: string;
  rows: ReferenceRow[];
}): RawEcotoxRecord[] {
  return options.rows.map((row, index) => {
    const rowNumber = String(index + 1).padStart(3, '0');
    return {
      chemical_name: options.chemicalName,
      species_scientific_name: row.species,
      conc1_mean: row.concentration,
      unit: options.unit,
      species_group: row.group,
      media_type: 'FW',
      endpoint: 'SSD validation',
      reference_number: `${options.sourceKey}-row-${rowNumber}`,
      test_id: `${options.sourceKey}-ssddata-${rowNumber}`,
    };
  });
}

const COPPER_PREVIEW_ROWS: RawEcotoxRecord[] = [
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Daphnia magna',
    conc1_mean: 0.006,
    unit: 'mg/L',
    species_group: 'Crustacean',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-001',
    test_id: 'fixture-test-001',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Daphnia magna',
    conc1_mean: 0.009,
    unit: 'mg/L',
    species_group: 'Crustacean',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-002',
    test_id: 'fixture-test-002',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Ceriodaphnia dubia',
    conc1_mean: 0.011,
    unit: 'mg/L',
    species_group: 'Aquatic Invertebrates',
    media_type: 'FW',
    endpoint: 'Reproduction',
    reference_number: 'fixture-ref-003',
    test_id: 'fixture-test-003',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Pimephales promelas',
    conc1_mean: 0.018,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Growth',
    reference_number: 'fixture-ref-004',
    test_id: 'fixture-test-004',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Oncorhynchus mykiss',
    conc1_mean: 0.022,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-005',
    test_id: 'fixture-test-005',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Lemna minor',
    conc1_mean: 0.03,
    unit: 'mg/L',
    species_group: 'Aquatic Plants',
    media_type: 'FW',
    endpoint: 'Growth',
    reference_number: 'fixture-ref-006',
    test_id: 'fixture-test-006',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Pseudokirchneriella subcapitata',
    conc1_mean: 0.037,
    unit: 'mg/L',
    species_group: 'Algae',
    media_type: 'FW',
    endpoint: 'Growth',
    reference_number: 'fixture-ref-007',
    test_id: 'fixture-test-007',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Hyalella azteca',
    conc1_mean: 0.045,
    unit: 'mg/L',
    species_group: 'Invertebrate',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-008',
    test_id: 'fixture-test-008',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Chironomus dilutus',
    conc1_mean: 0.052,
    unit: 'mg/L',
    species_group: 'Insects',
    media_type: 'FW',
    endpoint: 'Growth',
    reference_number: 'fixture-ref-009',
    test_id: 'fixture-test-009',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Xenopus laevis',
    conc1_mean: 0.07,
    unit: 'mg/L',
    species_group: 'Amphibian',
    media_type: 'FW',
    endpoint: 'Development',
    reference_number: 'fixture-ref-010',
    test_id: 'fixture-test-010',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Salvelinus fontinalis',
    conc1_mean: 0.085,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-015',
    test_id: 'fixture-test-015',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Americamysis bahia',
    conc1_mean: 0.019,
    unit: 'mg/L',
    species_group: 'Crustacean',
    media_type: 'MW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-011',
    test_id: 'fixture-test-011',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Cyprinodon variegatus',
    conc1_mean: 0.033,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'MW',
    endpoint: 'Growth',
    reference_number: 'fixture-ref-012',
    test_id: 'fixture-test-012',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Invalid endpoint species',
    conc1_mean: 'NR',
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-013',
    test_id: 'fixture-test-013',
  },
  {
    chemical_name: 'Copper',
    species_scientific_name: 'Nonpositive species',
    conc1_mean: 0,
    unit: 'mg/L',
    species_group: 'Fish',
    media_type: 'FW',
    endpoint: 'Mortality',
    reference_number: 'fixture-ref-014',
    test_id: 'fixture-test-014',
  },
];

const CCME_BORON_ROWS = buildCcmeValidationRows({
  chemicalName: 'Boron',
  unit: 'mg/L',
  sourceKey: 'ssddata-ccme-boron',
  rows: [
    { species: 'Oncorhynchus mykiss', concentration: 2.1, group: 'Fish' },
    { species: 'Ictalurus punctatus', concentration: 2.4, group: 'Fish' },
    { species: 'Micropterus salmoides', concentration: 4.1, group: 'Fish' },
    { species: 'Brachydanio rerio', concentration: 10, group: 'Fish' },
    { species: 'Carassius auratus', concentration: 15.6, group: 'Fish' },
    { species: 'Pimephales promelas', concentration: 18.3, group: 'Fish' },
    { species: 'Daphnia magna', concentration: 6, group: 'Invertebrate' },
    { species: 'Opercularia bimarginata', concentration: 10, group: 'Invertebrate' },
    { species: 'Ceriodaphnia dubia', concentration: 13.4, group: 'Invertebrate' },
    { species: 'Entosiphon sulcatum', concentration: 15, group: 'Invertebrate' },
    { species: 'Chironomus decorus', concentration: 20, group: 'Invertebrate' },
    { species: 'Paramecium caudatum', concentration: 20, group: 'Invertebrate' },
    { species: 'Rana pipiens', concentration: 20.4, group: 'Amphibian' },
    { species: 'Bufo fowleri', concentration: 48.6, group: 'Amphibian' },
    { species: 'Bufo americanus', concentration: 50, group: 'Amphibian' },
    { species: 'Ambystoma jeffersonianum', concentration: 70.7, group: 'Amphibian' },
    { species: 'Ambystoma maculatum', concentration: 70.7, group: 'Amphibian' },
    { species: 'Rana sylvatica', concentration: 70.7, group: 'Amphibian' },
    { species: 'Elodea canadensis', concentration: 1, group: 'Plant' },
    { species: 'Spirodella polyrrhiza', concentration: 1.8, group: 'Plant' },
    { species: 'Chlorella pyrenoidosa', concentration: 2, group: 'Plant' },
    { species: 'Phragmites australis', concentration: 4, group: 'Plant' },
    { species: 'Chlorella vulgaris', concentration: 5.2, group: 'Plant' },
    { species: 'Selenastrum capricornutum', concentration: 12.3, group: 'Plant' },
    { species: 'Scenedesmus subspicatus', concentration: 30, group: 'Plant' },
    { species: 'Myriophyllum spicatum', concentration: 34.2, group: 'Plant' },
    { species: 'Anacystis nidulans', concentration: 50, group: 'Plant' },
    { species: 'Lemna minor', concentration: 60, group: 'Plant' },
  ],
});

const CCME_ENDOSULFAN_ROWS = buildCcmeValidationRows({
  chemicalName: 'Endosulfan',
  unit: 'ng/L',
  sourceKey: 'ssddata-ccme-endosulfan',
  rows: [
    { species: 'Oncorhynchus mykiss', concentration: 0.05, group: 'Fish' },
    { species: 'Channa punctata', concentration: 0.24, group: 'Fish' },
    { species: 'Pimephales promelas', concentration: 0.28, group: 'Fish' },
    { species: 'Hydra vulgaris', concentration: 0.06, group: 'Invertebrate' },
    { species: 'Hydra viridissima', concentration: 0.07, group: 'Invertebrate' },
    { species: 'Daphnia magna', concentration: 14.1, group: 'Invertebrate' },
    { species: 'Ceriodaphnia dubia', concentration: 14.1, group: 'Invertebrate' },
    { species: 'Moinodaphnia macleayi', concentration: 28.3, group: 'Invertebrate' },
    { species: 'Daphnia cephalata', concentration: 113.14, group: 'Invertebrate' },
    { species: 'Brachionus calyciflorus', concentration: 1000, group: 'Invertebrate' },
    { species: 'Pseudokirchneriella subcapitata', concentration: 427.8, group: 'Plant' },
    { species: 'Scenedesmus subspicatus', concentration: 560, group: 'Plant' },
  ],
});

export const SSD_FIXTURE_DATASETS: SsdFixtureDataset[] = [
  {
    id: 'copper_preview',
    label: 'Copper preview fixture',
    chemicalName: 'Copper',
    role: 'preview',
    sourceLabel: 'SSTAC preview fixture',
    sourceUrl: 'repo-local fixture',
    sourceDetailUrl: 'repo-local fixture',
    sourceAccessedAt: '2026-05-24',
    validationNote:
      'Synthetic ECOTOX-style preview rows for UI and filter smoke testing. Use the CCME validation fixtures for ssdtools parity review.',
    rows: COPPER_PREVIEW_ROWS,
  },
  {
    id: 'ccme_boron_validation',
    label: 'CCME boron validation',
    chemicalName: 'Boron',
    role: 'validation',
    packageDataset: 'ssddata::ccme_boron',
    sourceLabel: 'ssddata CCME boron benchmark dataset',
    sourceUrl: 'https://open-aims.github.io/ssddata/reference/ccme_boron.html',
    sourceDetailUrl: 'https://ccme.ca/en/chemical/16',
    sourceAccessedAt: '2026-05-24',
    validationNote:
      'Official ssdtools examples and tests use ssddata::ccme_boron for BCANZ distribution and model-averaging checks. Use this fixture as the primary R parity target.',
    validationReferences: [
      {
        label: 'BCANZ model-average HC5',
        analysisMode: 'model_averaging',
        pValue: 0.05,
        expectedHcp: 1.25678,
        unit: 'mg/L',
        tolerance: 0.0002,
        sourceLabel: 'bcgov/ssdtools testthat snapshot for ssddata::ccme_boron',
        sourceUrl:
          'https://github.com/bcgov/ssdtools/blob/main/tests/testthat/_snaps/bcanz/hc_chloride.csv',
      },
    ],
    rows: CCME_BORON_ROWS,
  },
  {
    id: 'ccme_endosulfan_validation',
    label: 'CCME endosulfan validation',
    chemicalName: 'Endosulfan',
    role: 'validation',
    packageDataset: 'ssddata::ccme_endosulfan',
    sourceLabel: 'ssddata CCME endosulfan benchmark dataset',
    sourceUrl: 'https://open-aims.github.io/ssddata/reference/ccme_endosulfan.html',
    sourceDetailUrl: 'https://ccme.ca/en/chemical/93',
    sourceAccessedAt: '2026-05-24',
    validationNote:
      'Included in ssddata as a CCME benchmark dataset. It is useful for validation UX and regression coverage even though the local ssdtools test suite primarily snapshots boron.',
    rows: CCME_ENDOSULFAN_ROWS,
  },
];

export function getSsdFixtureDataset(
  id: SsdFixtureDatasetId,
): SsdFixtureDataset {
  return (
    SSD_FIXTURE_DATASETS.find((dataset) => dataset.id === id) ??
    SSD_FIXTURE_DATASETS[0]
  );
}

export const SSD_FIXTURE_ROWS: RawEcotoxRecord[] = getSsdFixtureDataset(
  DEFAULT_SSD_FIXTURE_DATASET_ID,
).rows;
