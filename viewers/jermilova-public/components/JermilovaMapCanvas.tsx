'use client';

import { GeoJSON, MapContainer } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Layer } from 'leaflet';

interface MapLayer {
  key: string;
  label: string;
  data: FeatureCollection<Geometry, Record<string, unknown> | null>;
}

interface JermilovaMapCanvasProps {
  layers: MapLayer[];
  onIdentify: (label: string, properties: Record<string, unknown>) => void;
}

const COLORS: Record<string, string> = {
  basins_gsl: '#176a69',
  basins_gbs: '#4967a8',
  advisory_lakes: '#2f8b9a',
  commercial_fisheries: '#3d7d56',
  historic_mines: '#a56828',
  large_mines: '#7f4f24',
  hydro_facilities: '#416c9b',
  climate_stations: '#7659a8',
  thaw_slumps: '#9b5968',
};

export default function JermilovaMapCanvas({ layers, onIdentify }: JermilovaMapCanvasProps) {
  const renderFeature = (label: string) => (feature: Feature, layer: Layer) => {
    layer.on('click', () => {
      const properties = feature.properties ?? {};
      onIdentify(label, properties as Record<string, unknown>);
    });
  };

  return (
    <div className="map-canvas" aria-label="Interactive map with allowlisted reference layers">
      <MapContainer center={[64.5, -122.5]} zoom={5} scrollWheelZoom className="leaflet-viewer-map">
        {layers.map((layer) => (
          <GeoJSON
            key={layer.key}
            data={layer.data}
            style={() => ({
              color: COLORS[layer.key] ?? '#176a69',
              weight: 2,
              fillOpacity: 0.12,
            })}
            onEachFeature={renderFeature(layer.label)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
