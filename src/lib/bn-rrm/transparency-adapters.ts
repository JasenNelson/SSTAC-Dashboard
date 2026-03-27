/**
 * Transparency Data Adapters
 *
 * Transforms site_reports.json and risk_comparison.json into SiteData[]
 * for import into the siteDataStore, enabling map display and assessment.
 *
 * Chemistry values are site-level means (not station-specific measurements).
 * Only stations with coordinates appear as individual map points; sites with
 * no georeferenced stations appear as a single site centroid.
 */

import type { SiteData, SedimentChemistry, SiteLocation } from '@/types/bn-rrm/site-data';

// ---------------------------------------------------------------------------
// Types for the transparency JSON structures
// ---------------------------------------------------------------------------

export interface SiteReportStation {
  station_id: number;
  station_name: string;
  station_type: string;
  latitude: number | null;
  longitude: number | null;
  date_earliest: string;
  date_latest: string;
  chemistry_records: number;
  toxicity_records: number;
  community_records: number;
  spatial_class: string | null;
  [key: string]: unknown;
}

export interface ChemistrySummaryEntry {
  parameter: string;
  group: string | null;
  unit: string;
  min: number;
  max: number;
  mean: number;
  n: number;
  isqg: number | null;
  pel: number | null;
  exceed_isqg: number;
  exceed_pel: number;
}

export interface SiteReport {
  site_id: number;
  name: string;
  registry_id: string;
  waterbody_type: string;
  region: string;
  station_count: number;
  campaign_dates: {
    earliest: string;
    latest: string;
    [key: string]: unknown;
  };
  station_details: SiteReportStation[];
  chemistry_summary: ChemistrySummaryEntry[];
  [key: string]: unknown;
}

export interface SiteReportsJSON {
  _meta: Record<string, unknown>;
  sites: SiteReport[];
}

export interface ComparisonStation {
  stationId: number;
  stationName: string;
  reportEstimate: {
    originalLabel: string;
    mappedBNClass: string;
    [key: string]: unknown;
  };
  bnrrmPredicted: string;
  [key: string]: unknown;
}

export interface SiteComparison {
  siteId: number;
  siteName: string;
  registryId: string;
  stationComparisons: ComparisonStation[];
  [key: string]: unknown;
}

export interface RiskComparisonJSON {
  _meta: Record<string, unknown>;
  summary: Record<string, unknown>;
  siteComparisons: SiteComparison[];
  [key: string]: unknown;
}

export interface ImportResult {
  sites: SiteData[];
  imported: number;
  centroidCount: number;
  stationCount: number;
  skippedNoCoords: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Approximate centroids for sites with no georeferenced stations */
export const SITE_CENTROIDS: Record<number, { lat: number; lon: number }> = {
  1: { lat: 49.38, lon: -123.25 },   // Woodfibre — Howe Sound
  3: { lat: 50.60, lon: -127.49 },   // Island Copper — Port Hardy
  4: { lat: 49.29, lon: -122.95 },   // Blue Water — Burrard Inlet
  7: { lat: 54.00, lon: -128.67 },   // ALCAN — Kitimat Arm
};

/** Map source station_type values to SiteLocation.siteType */
const STATION_TYPE_MAP: Record<string, SiteLocation['siteType']> = {
  reference: 'reference',
  exposure: 'exposure',
  sampling: 'exposure',
  near_field: 'exposure',
  far_field: 'reference',
};

/** Map chemistry_summary parameter names to SedimentChemistry fields */
const CHEMISTRY_PARAM_MAP: Record<string, keyof SedimentChemistry> = {
  'Arsenic': 'arsenic',
  'Cadmium': 'cadmium',
  'Chromium': 'chromium',
  'Copper': 'copper',
  'Lead': 'lead',
  'Mercury': 'mercury',
  'Zinc': 'zinc',
  'Nickel': 'nickel',
};

/** Additional parameter name patterns for organics */
const ORGANIC_PATTERNS: { pattern: RegExp; field: keyof SedimentChemistry }[] = [
  { pattern: /^total\s*pahs?$/i, field: 'totalPAHs' },
  { pattern: /^total\s*pcbs?$/i, field: 'totalPCBs' },
  { pattern: /^toc$/i, field: 'toc' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeSiteType(stationType: string): SiteLocation['siteType'] {
  return STATION_TYPE_MAP[stationType] ?? 'exposure';
}

function buildChemistryRecord(
  siteId: string,
  siteName: string,
  dateCollected: string,
  chemistrySummary: ChemistrySummaryEntry[],
): SedimentChemistry {
  const record: SedimentChemistry = {
    siteId,
    sampleId: `${siteName}-site-mean`,
    dateCollected,
  };

  for (const entry of chemistrySummary) {
    // Try direct parameter name mapping
    const directField = CHEMISTRY_PARAM_MAP[entry.parameter];
    if (directField) {
      (record as unknown as Record<string, unknown>)[directField] = entry.mean;
      continue;
    }
    // Try organic patterns
    for (const { pattern, field } of ORGANIC_PATTERNS) {
      if (pattern.test(entry.parameter)) {
        (record as unknown as Record<string, unknown>)[field] = entry.mean;
        break;
      }
    }
  }

  return record;
}

// ---------------------------------------------------------------------------
// Adapter: Training Sites
// ---------------------------------------------------------------------------

export function adaptTrainingSites(siteReports: SiteReportsJSON): ImportResult {
  const sites: SiteData[] = [];
  let stationCount = 0;
  let centroidCount = 0;
  let skippedNoCoords = 0;

  for (const site of siteReports.sites) {
    const dateCollected = site.campaign_dates.earliest;
    const chemRecord = buildChemistryRecord(
      `training-s${site.site_id}`,
      site.name,
      dateCollected,
      site.chemistry_summary,
    );

    const georefStations = site.station_details.filter(
      stn => stn.latitude != null && stn.longitude != null,
    );
    const nonGeorefCount = site.station_details.length - georefStations.length;
    skippedNoCoords += nonGeorefCount;

    if (georefStations.length > 0) {
      // Individual station entries
      for (const stn of georefStations) {
        const locationId = `training-s${site.site_id}-stn${stn.station_id}`;
        sites.push({
          location: {
            id: locationId,
            name: `${site.name} \u2014 ${stn.station_name}`,
            latitude: stn.latitude!,
            longitude: stn.longitude!,
            siteType: normalizeSiteType(stn.station_type),
            region: site.region,
            waterbody: site.waterbody_type,
            dateCollected: stn.date_earliest || dateCollected,
            sourceTag: 'training',
            spatialClass: (stn.spatial_class as SiteLocation['spatialClass']) ?? 'APPROXIMATE',
          },
          sedimentChemistry: [{ ...chemRecord, siteId: locationId }],
        });
        stationCount++;
      }
    } else {
      // Site centroid
      const centroid = SITE_CENTROIDS[site.site_id];
      if (!centroid) continue; // Should not happen for known sites
      const locationId = `training-s${site.site_id}-centroid`;
      sites.push({
        location: {
          id: locationId,
          name: `${site.name} (${site.station_count} stations, site centroid)`,
          latitude: centroid.lat,
          longitude: centroid.lon,
          siteType: 'exposure',
          region: site.region,
          waterbody: site.waterbody_type,
          dateCollected,
          sourceTag: 'training',
          spatialClass: 'SITE_CENTROID',
        },
        sedimentChemistry: [{ ...chemRecord, siteId: locationId }],
      });
      centroidCount++;
    }
  }

  return { sites, imported: sites.length, centroidCount, stationCount, skippedNoCoords };
}

// ---------------------------------------------------------------------------
// Adapter: Comparison Sites
// ---------------------------------------------------------------------------

export function adaptComparisonSites(
  riskComparison: RiskComparisonJSON,
  siteReports: SiteReportsJSON,
): ImportResult {
  const sites: SiteData[] = [];
  let stationCount = 0;
  let centroidCount = 0;
  let skippedNoCoords = 0;

  // Build lookup: siteId → station coords + site report
  const siteReportMap = new Map<number, SiteReport>();
  const stationCoordsMap = new Map<string, { lat: number; lon: number; spatial_class: string | null; station_type: string }>();

  for (const sr of siteReports.sites) {
    siteReportMap.set(sr.site_id, sr);
    for (const stn of sr.station_details) {
      if (stn.latitude != null && stn.longitude != null) {
        stationCoordsMap.set(`${sr.site_id}-${stn.station_id}`, {
          lat: stn.latitude,
          lon: stn.longitude,
          spatial_class: stn.spatial_class,
          station_type: stn.station_type,
        });
      }
    }
  }

  for (const sc of riskComparison.siteComparisons) {
    const siteReport = siteReportMap.get(sc.siteId);
    if (!siteReport) continue;

    const dateCollected = siteReport.campaign_dates.earliest;
    const chemRecord = buildChemistryRecord(
      `comparison-s${sc.siteId}`,
      sc.siteName,
      dateCollected,
      siteReport.chemistry_summary,
    );

    const georefStations: { stn: ComparisonStation; coords: { lat: number; lon: number; spatial_class: string | null; station_type: string } }[] = [];
    let siteNonGeoref = 0;

    for (const stn of sc.stationComparisons) {
      const coords = stationCoordsMap.get(`${sc.siteId}-${stn.stationId}`);
      if (coords) {
        georefStations.push({ stn, coords });
      } else {
        siteNonGeoref++;
      }
    }

    if (georefStations.length > 0) {
      // Individual station entries
      for (const { stn, coords } of georefStations) {
        const locationId = `comparison-s${sc.siteId}-stn${stn.stationId}`;
        sites.push({
          location: {
            id: locationId,
            name: `${sc.siteName} \u2014 ${stn.stationName}`,
            latitude: coords.lat,
            longitude: coords.lon,
            siteType: normalizeSiteType(coords.station_type),
            region: siteReport.region,
            waterbody: siteReport.waterbody_type,
            dateCollected: dateCollected,
            sourceTag: 'comparison',
            spatialClass: (coords.spatial_class as SiteLocation['spatialClass']) ?? 'APPROXIMATE',
          },
          sedimentChemistry: [{ ...chemRecord, siteId: locationId }],
        });
        stationCount++;
      }
    }

    // If there are non-georeferenced comparison stations, create a centroid
    if (siteNonGeoref > 0) {
      const centroid = SITE_CENTROIDS[sc.siteId];
      if (centroid) {
        const locationId = `comparison-s${sc.siteId}-centroid`;
        sites.push({
          location: {
            id: locationId,
            name: `${sc.siteName} (${siteNonGeoref} comparison stations, site centroid)`,
            latitude: centroid.lat,
            longitude: centroid.lon,
            siteType: 'exposure',
            region: siteReport.region,
            waterbody: siteReport.waterbody_type,
            dateCollected,
            sourceTag: 'comparison',
            spatialClass: 'SITE_CENTROID',
          },
          sedimentChemistry: [{ ...chemRecord, siteId: locationId }],
        });
        centroidCount++;
      } else {
        skippedNoCoords += siteNonGeoref;
      }
    }
  }

  return { sites, imported: sites.length, centroidCount, stationCount, skippedNoCoords };
}
