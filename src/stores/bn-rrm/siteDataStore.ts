/**
 * Site Data Store
 *
 * Zustand store for managing uploaded site data and assessments
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  SiteData,
  SiteLocation,
  SiteAssessment,
  SedimentChemistry,
  ValidationResult,
} from '@/types/bn-rrm/site-data';

interface SiteDataState {
  sites: Record<string, SiteData>;
  assessments: Record<string, SiteAssessment>;
  selectedSiteId: string | null;
  selectedSiteIds: string[];
  isUploading: boolean;
  uploadProgress: number;
  lastUploadResult: { success: boolean; message: string } | null;

  addSite: (site: SiteData) => void;
  addSites: (sites: SiteData[]) => void;
  removeSite: (siteId: string) => void;
  clearAllSites: () => void;
  selectSite: (siteId: string | null) => void;
  toggleSiteSelection: (siteId: string) => void;
  selectMultipleSites: (siteIds: string[]) => void;
  clearSiteSelection: () => void;
  getSelectedSites: () => SiteData[];
  addAssessment: (assessment: SiteAssessment) => void;
  getAssessment: (siteId: string) => SiteAssessment | undefined;
  validateChemistry: (chemistry: SedimentChemistry) => ValidationResult[];
  getSiteLocations: () => SiteLocation[];
  getSitesByRegion: (region: string) => SiteData[];
  getSelectedSite: () => SiteData | undefined;
  removeSelectedSites: () => void;
  selectAllSites: () => void;
  getSiteCount: () => number;
}

export const useSiteDataStore = create<SiteDataState>()(
  devtools(
    persist(
      (set, get) => ({
        sites: {},
        assessments: {},
        selectedSiteId: null,
        selectedSiteIds: [],
        isUploading: false,
        uploadProgress: 0,
        lastUploadResult: null,

        addSite: (site) => {
          set((state) => ({ sites: { ...state.sites, [site.location.id]: site } }));
        },

        addSites: (sitesArray) => {
          set((state) => {
            const newSites = { ...state.sites };
            sitesArray.forEach((site) => { newSites[site.location.id] = site; });
            return { sites: newSites };
          });
        },

        removeSite: (siteId) => {
          set((state) => {
            const { [siteId]: _removedSite, ...remainingSites } = state.sites;
            const { [siteId]: _removedAssessment, ...remainingAssessments } = state.assessments;
            return {
              sites: remainingSites,
              assessments: remainingAssessments,
              selectedSiteId: state.selectedSiteId === siteId ? null : state.selectedSiteId,
            };
          });
        },

        clearAllSites: () => {
          set({ sites: {}, assessments: {}, selectedSiteId: null });
        },

        selectSite: (siteId) => {
          set({ selectedSiteId: siteId });
          if (siteId) set({ selectedSiteIds: [siteId] });
        },

        toggleSiteSelection: (siteId) => {
          set((state) => {
            const ids = state.selectedSiteIds;
            const newIds = ids.includes(siteId)
              ? ids.filter(id => id !== siteId)
              : [...ids, siteId];
            return {
              selectedSiteIds: newIds,
              selectedSiteId: newIds.length === 1 ? newIds[0] : newIds.length === 0 ? null : state.selectedSiteId,
            };
          });
        },

        selectMultipleSites: (siteIds) => {
          set({
            selectedSiteIds: siteIds,
            selectedSiteId: siteIds.length === 1 ? siteIds[0] : siteIds[0] ?? null,
          });
        },

        clearSiteSelection: () => {
          set({ selectedSiteIds: [], selectedSiteId: null });
        },

        getSelectedSites: () => {
          const { sites, selectedSiteIds } = get();
          return selectedSiteIds.map(id => sites[id]).filter((s): s is SiteData => s !== undefined);
        },

        addAssessment: (assessment) => {
          set((state) => ({ assessments: { ...state.assessments, [assessment.siteId]: assessment } }));
        },

        getAssessment: (siteId) => {
          return get().assessments[siteId];
        },

        validateChemistry: (chemistry) => {
          const results: ValidationResult[] = [];
          const guidelines: Record<string, { isqg: number; pel: number; unit: string }> = {
            copper: { isqg: 35.7, pel: 197, unit: 'mg/kg' },
            zinc: { isqg: 123, pel: 315, unit: 'mg/kg' },
            lead: { isqg: 35, pel: 91.3, unit: 'mg/kg' },
            cadmium: { isqg: 0.6, pel: 3.5, unit: 'mg/kg' },
            mercury: { isqg: 0.17, pel: 0.486, unit: 'mg/kg' },
            arsenic: { isqg: 5.9, pel: 17, unit: 'mg/kg' },
            chromium: { isqg: 37.3, pel: 90, unit: 'mg/kg' },
            totalPAHs: { isqg: 1684, pel: 16770, unit: 'ug/kg' },
          };

          Object.entries(guidelines).forEach(([param, guideline]) => {
            const value = chemistry[param as keyof SedimentChemistry] as number | undefined;
            if (value !== undefined) {
              let status: 'valid' | 'warning' | 'error' = 'valid';
              let message: string | undefined;
              let guidelineInfo: ValidationResult['guideline'];

              if (value > guideline.pel) {
                status = 'error';
                message = `Exceeds PEL (${guideline.pel} ${guideline.unit})`;
                guidelineInfo = { name: 'PEL', value: guideline.pel, exceedance: value / guideline.pel };
              } else if (value > guideline.isqg) {
                status = 'warning';
                message = `Exceeds ISQG (${guideline.isqg} ${guideline.unit})`;
                guidelineInfo = { name: 'ISQG', value: guideline.isqg, exceedance: value / guideline.isqg };
              }

              results.push({ field: param, value, status, message, guideline: guidelineInfo });
            }
          });

          return results;
        },

        getSiteLocations: () => {
          return Object.values(get().sites).map((s) => s.location);
        },

        getSitesByRegion: (region) => {
          return Object.values(get().sites).filter((s) => s.location.region === region);
        },

        removeSelectedSites: () => {
          set((state) => {
            const remainingSites = { ...state.sites };
            const remainingAssessments = { ...state.assessments };
            state.selectedSiteIds.forEach((id) => {
              delete remainingSites[id];
              delete remainingAssessments[id];
            });
            return {
              sites: remainingSites,
              assessments: remainingAssessments,
              selectedSiteIds: [],
              selectedSiteId: null,
            };
          });
        },

        selectAllSites: () => {
          const allIds = Object.keys(get().sites);
          set({
            selectedSiteIds: allIds,
            selectedSiteId: allIds[0] ?? null,
          });
        },

        getSelectedSite: () => {
          const { sites, selectedSiteId } = get();
          return selectedSiteId ? sites[selectedSiteId] : undefined;
        },

        getSiteCount: () => {
          return Object.keys(get().sites).length;
        },
      }),
      { name: 'sstac-bn-rrm-site-data' }
    ),
    { name: 'bn-rrm-site-data-store' }
  )
);
