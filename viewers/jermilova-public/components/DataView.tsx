'use client';

import { useState } from 'react';
import type { JermilovaTrainingData } from '../lib/loadJermilovaPack';

interface DataViewProps {
  trainingData: JermilovaTrainingData;
}

type DatasetKey = keyof JermilovaTrainingData['models'];
type EndpointKey = 'fish' | 'water';

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Not provided in the model pack';
  return String(value);
}

export function DataView({ trainingData }: DataViewProps) {
  const [datasetKey, setDatasetKey] = useState<DatasetKey>('GSL');
  const [endpoint, setEndpoint] = useState<EndpointKey>('fish');
  const dataset = trainingData.models[datasetKey];
  const columns = endpoint === 'fish' ? dataset.fish_columns : dataset.water_columns;
  const rows = endpoint === 'fish' ? dataset.fish_cases : dataset.water_cases;

  return (
    <div className="content-grid">
      <section className="content-card content-card--lead">
        <p className="eyebrow">Frozen training data</p>
        <h2>Inspect the packaged reference rows</h2>
        <p>
          The dataset selector changes which frozen training rows are displayed. It does not select or run an inference model.
        </p>
        <p className="placeholder-note">
          The GSL dataset is the runtime model training data. GBS is reference training data, not a second inference model.
        </p>
      </section>
      <section className="content-card">
        <div className="data-controls">
          <label className="field-label" htmlFor="training-dataset">Dataset</label>
          <select
            id="training-dataset"
            className="viewer-select"
            value={datasetKey}
            onChange={(event) => setDatasetKey(event.target.value as DatasetKey)}
          >
            <option value="GSL">GSL - Great Slave Lake (runtime model training data)</option>
            <option value="GBS">GBS - Great Bear Subbasin (reference training data)</option>
          </select>
          <label className="field-label" htmlFor="training-endpoint">Training table</label>
          <select
            id="training-endpoint"
            className="viewer-select"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value as EndpointKey)}
          >
            <option value="fish">Fish tissue Hg</option>
            <option value="water">Freshwater THg</option>
          </select>
        </div>
        <div className="data-summary">
          <strong>{dataset.display_name}</strong>
          <span>{rows.length.toLocaleString()} rows shown</span>
        </div>
        <div className="table-scroll data-table-scroll">
          <table className="cpt-table data-table">
            <caption>{endpoint === 'fish' ? 'Fish training data' : 'Water training data'}</caption>
            <thead>
              <tr>
                <th scope="col">Row</th>
                {columns.map((column) => <th scope="col" key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <th scope="row">{index + 1}</th>
                  {columns.map((column) => (
                    <td key={column}>{formatCell(row[column])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
