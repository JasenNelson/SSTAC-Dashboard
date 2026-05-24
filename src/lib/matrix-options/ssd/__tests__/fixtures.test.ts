import { describe, expect, it } from 'vitest';
import {
  getSsdFixtureDataset,
  SSD_FIXTURE_DATASETS,
} from '../fixtures';

describe('SSD fixture datasets', () => {
  it('includes preview and validation datasets with source metadata', () => {
    expect(SSD_FIXTURE_DATASETS.map((dataset) => dataset.id)).toEqual([
      'copper_preview',
      'ccme_boron_validation',
      'ccme_endosulfan_validation',
    ]);

    const validationDatasets = SSD_FIXTURE_DATASETS.filter(
      (dataset) => dataset.role === 'validation',
    );

    expect(validationDatasets.map((dataset) => dataset.packageDataset)).toEqual([
      'ssddata::ccme_boron',
      'ssddata::ccme_endosulfan',
    ]);
    expect(
      validationDatasets.every((dataset) =>
        dataset.sourceUrl.startsWith('https://open-aims.github.io/ssddata/'),
      ),
    ).toBe(true);
  });

  it('maps the CCME benchmark rows with units and freshwater media', () => {
    const boron = getSsdFixtureDataset('ccme_boron_validation');
    const endosulfan = getSsdFixtureDataset('ccme_endosulfan_validation');

    expect(boron.rows).toHaveLength(28);
    expect(endosulfan.rows).toHaveLength(12);
    expect(boron.rows.every((row) => row.unit === 'mg/L')).toBe(true);
    expect(endosulfan.rows.every((row) => row.unit === 'ng/L')).toBe(true);
    expect(
      [...boron.rows, ...endosulfan.rows].every(
        (row) => row.media_type === 'FW' && row.endpoint === 'SSD validation',
      ),
    ).toBe(true);
  });
});
