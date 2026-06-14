import { describe, expect, it } from 'vitest';
import { parseSsdUpload } from '../upload';

describe('SSD upload parsing', () => {
  it('parses CSV rows with water and sediment media labels', () => {
    const rows = parseSsdUpload(
      [
        'chemical,species,value,unit,media,endpoint,group',
        'Copper,Daphnia magna,0.01,mg/L,FW,Mortality,Crustacean',
        'Copper,Hyalella azteca,12.4,mg/kg,sediment,Growth,Invertebrate',
      ].join('\n'),
      'ssd-upload.csv',
    );

    expect(rows).toEqual([
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Daphnia magna',
        conc1_mean: '0.01',
        unit: 'mg/L',
        species_group: 'Crustacean',
        media_type: 'FW',
        endpoint: 'Mortality',
        reference_number: null,
        test_id: null,
      },
      {
        chemical_name: 'Copper',
        species_scientific_name: 'Hyalella azteca',
        conc1_mean: '12.4',
        unit: 'mg/kg',
        species_group: 'Invertebrate',
        media_type: 'sediment',
        endpoint: 'Growth',
        reference_number: null,
        test_id: null,
      },
    ]);
  });

  it('parses JSON rows with ECOTOX-style fields', () => {
    const rows = parseSsdUpload(
      JSON.stringify({
        rows: [
          {
            chemical_name: 'Copper',
            species_scientific_name: 'Pimephales promelas',
            conc1_mean: 0.02,
            media_type: 'freshwater',
          },
        ],
      }),
      'ssd-upload.json',
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      chemical_name: 'Copper',
      species_scientific_name: 'Pimephales promelas',
      conc1_mean: 0.02,
      media_type: 'freshwater',
    });
  });

  it('throws on CSV with an unterminated quoted field', () => {
    // A quote opened in a data row that is never closed leaves the parser
    // in quoted=true at EOF, which must be rejected fail-closed.
    const bad = [
      'chemical,species,value,unit',
      'Copper,"Daphnia magna,0.01,mg/L',
    ].join('\n');
    expect(() => parseSsdUpload(bad, 'bad.csv')).toThrow(
      'unterminated quoted field',
    );
  });

  it('parses CSV with a properly balanced quoted field without throwing', () => {
    // Confirm that a correctly quoted cell containing a comma does not
    // trigger the guard.
    const good = [
      'chemical,species,value,unit',
      '"Copper, ionic","Daphnia magna",0.01,mg/L',
    ].join('\n');
    const rows = parseSsdUpload(good, 'good.csv');
    expect(rows).toHaveLength(1);
    expect(rows[0].chemical_name).toBe('Copper, ionic');
  });
});
