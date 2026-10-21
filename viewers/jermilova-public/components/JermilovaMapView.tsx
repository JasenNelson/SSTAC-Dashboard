'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { loadJermilovaMapLayer } from '../lib/loadJermilovaPack';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';

const MapCanvas = dynamic(() => import('./JermilovaMapCanvas'), {
  ssr: false,
  loading: () => <div className="map-loading" role="status">Loading local map layers...</div>,
});

type MapKey = (typeof JERMILOVA_VIEWER_CAPABILITIES.mapKeys)[number];
type MapFeatureCollection = FeatureCollection<Geometry, Record<string, unknown> | null>;

interface LoadedLayer {
  key: MapKey;
  data: MapFeatureCollection;
}

const MAP_LAYER_LABELS: Record<MapKey, string> = {
  basins_gsl: 'GSL basin boundaries',
  basins_gbs: 'GBS basin boundaries (reference context)',
  advisory_lakes: 'Advisory lakes',
  commercial_fisheries: 'Commercial fisheries',
  historic_mines: 'Historic mines',
  large_mines: 'Large mines',
  hydro_facilities: 'Hydro facilities',
  climate_stations: 'Climate stations',
  thaw_slumps: 'Thaw slumps',
};

function asFeatureCollection(value: unknown): MapFeatureCollection {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as { type?: unknown }).type !== 'FeatureCollection' ||
    !Array.isArray((value as { features?: unknown }).features)
  ) {
    throw new Error('Approved map layer is not a GeoJSON FeatureCollection.');
  }
  return value as MapFeatureCollection;
}

export function JermilovaMapView() {
  const [selectedKeys, setSelectedKeys] = useState<MapKey[]>(['basins_gsl']);
  const [layers, setLayers] = useState<Partial<Record<MapKey, LoadedLayer>>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<MapKey>>(() => new Set());
  const [errors, setErrors] = useState<Partial<Record<MapKey, string>>>({});
  const [identified, setIdentified] = useState<{ label: string; properties: Record<string, unknown> } | null>(null);

  useEffect(() => {
    const missing = selectedKeys.filter((key) => !layers[key] && !loadingKeys.has(key) && !errors[key]);
    if (missing.length === 0) return;
    setLoadingKeys((current) => new Set([...current, ...missing]));

    for (const key of missing) {
      loadJermilovaMapLayer(key)
        .then((value) => {
          const data = asFeatureCollection(value);
          setLayers((current) => ({ ...current, [key]: { key, data } }));
        })
        .catch((reason: unknown) => {
          const message = reason instanceof Error ? reason.message : 'The approved map layer could not be loaded.';
          setErrors((current) => ({ ...current, [key]: message }));
        })
        .finally(() => {
          setLoadingKeys((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
        });
    }
  }, [selectedKeys, layers, loadingKeys, errors]);

  const visibleLayers = useMemo(
    () => selectedKeys.map((key) => layers[key]).filter((layer): layer is LoadedLayer => Boolean(layer)),
    [selectedKeys, layers],
  );

  const toggleLayer = (key: MapKey) => {
    setSelectedKeys((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
    setIdentified(null);
  };

  return (
    <div className="content-grid">
      <section className="content-card content-card--lead">
        <p className="eyebrow">Approved map asset allowlist</p>
        <h2>Inspect reference layers</h2>
        <p>Layer data is fetched from this viewer's local frozen pack. Feature selection reads GeoJSON properties locally.</p>
        <p className="placeholder-note">
          LOCAL PREVIEW PLACEHOLDER: map geometry and rights have not been audited. OSM terms and availability have not been checked for publication.
        </p>
      </section>
      <section className="content-card">
        <fieldset className="map-layer-list">
          <legend>Map layers</legend>
          {JERMILOVA_VIEWER_CAPABILITIES.mapKeys.map((key) => (
            <label className="map-layer-option" key={key}>
              <input
                type="checkbox"
                checked={selectedKeys.includes(key)}
                onChange={() => toggleLayer(key)}
              />
              <span>{MAP_LAYER_LABELS[key]}</span>
              {loadingKeys.has(key) && <span className="map-layer-status">Loading</span>}
              {layers[key] && <span className="map-layer-status">{layers[key]?.data.features.length.toLocaleString()} features</span>}
            </label>
          ))}
        </fieldset>
        {Object.entries(errors).map(([key, message]) => (
          <p className="error-card map-error" role="alert" key={key}>{MAP_LAYER_LABELS[key as MapKey]}: {message}</p>
        ))}
        <div className="map-canvas-wrap">
          <MapCanvas
            layers={visibleLayers.map((layer) => ({ ...layer, label: MAP_LAYER_LABELS[layer.key] }))}
            onIdentify={(label, properties) => setIdentified({ label, properties })}
          />
        </div>
        <aside className="map-attribution">
          <span>Basemap: LOCAL PREVIEW PLACEHOLDER</span>
          <span>Provider terms and availability have not been checked for publication.</span>
        </aside>
        {identified && (
          <section className="identified-feature" aria-live="polite">
            <h3>Local feature identify: {identified.label}</h3>
            <pre>{JSON.stringify(identified.properties, null, 2)}</pre>
          </section>
        )}
      </section>
    </div>
  );
}
