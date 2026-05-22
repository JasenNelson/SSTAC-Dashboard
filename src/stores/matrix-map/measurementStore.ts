import { create } from 'zustand';
import type {
  Classification,
  CoordinateQualityTier,
} from '@/app/(dashboard)/matrix-map/types';

export interface MatrixMapMeasurementRow {
  sample_id: string;
  sample_display_name: string;
  sample_station_id: string;
  event_date: string;
  medium: string;
  substance_display_name: string;
  value: number | string | null;
  unit: string | null;
  detection_limit: number | string | null;
  qualifier: string | null;
  censored: boolean | null;
  coordinate_quality_tier: CoordinateQualityTier;
  classification: Classification;
  source_dra_id: string | null;
  source_dra_title: string | null;
}

interface MatrixMapMeasurementState {
  selectedIdKey: string;
  rows: MatrixMapMeasurementRow[];
  isLoading: boolean;
  errorMessage: string | null;
  setLoading: (selectedIdKey: string) => void;
  setRows: (selectedIdKey: string, rows: MatrixMapMeasurementRow[]) => void;
  setError: (selectedIdKey: string, errorMessage: string) => void;
  clear: () => void;
}

export const useMatrixMapMeasurementStore = create<MatrixMapMeasurementState>()((set) => ({
  selectedIdKey: '',
  rows: [],
  isLoading: false,
  errorMessage: null,
  setLoading: (selectedIdKey) => {
    set({ selectedIdKey, rows: [], isLoading: true, errorMessage: null });
  },
  setRows: (selectedIdKey, rows) => {
    set({ selectedIdKey, rows, isLoading: false, errorMessage: null });
  },
  setError: (selectedIdKey, errorMessage) => {
    set({ selectedIdKey, rows: [], isLoading: false, errorMessage });
  },
  clear: () => {
    set({ selectedIdKey: '', rows: [], isLoading: false, errorMessage: null });
  },
}));
