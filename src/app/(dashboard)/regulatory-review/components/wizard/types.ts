/**
 * Wizard types and constants for the submission workflow.
 */

import type { LifecycleStage } from '@/lib/regulatory-review/schedule3';

// =============================================================================
// Types
// =============================================================================

export interface WizardFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface SiteInfo {
  siteId: string;
  siteName: string;
  applicantName: string;
  applicantCompany: string;
  submissionDate: string;
  siteAddress: string;
  siteRegion: string;
  notes: string;
}

export interface WizardState {
  currentStep: number;
  completedSteps: number[];
  applicationTypes: string[];
  selectedServices: string[];
  siteInfo: SiteInfo;
  files: WizardFile[];
}

export type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'COMPLETE_STEP'; step: number }
  | { type: 'TOGGLE_APPLICATION_TYPE'; serviceId: string }
  | { type: 'TOGGLE_SERVICE'; serviceId: string }
  | { type: 'SET_SERVICES'; serviceIds: string[] }
  | { type: 'UPDATE_SITE_INFO'; field: keyof SiteInfo; value: string }
  | { type: 'ADD_FILES'; files: WizardFile[] }
  | { type: 'REMOVE_FILE'; fileId: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'RESET' };

// =============================================================================
// Constants
// =============================================================================

export const INITIAL_SITE_INFO: SiteInfo = {
  siteId: '',
  siteName: '',
  applicantName: '',
  applicantCompany: '',
  submissionDate: new Date().toISOString().split('T')[0],
  siteAddress: '',
  siteRegion: '',
  notes: '',
};

export const INITIAL_WIZARD_STATE: WizardState = {
  currentStep: 0,
  completedSteps: [],
  applicationTypes: [],
  selectedServices: [],
  siteInfo: { ...INITIAL_SITE_INFO },
  files: [],
};

export const BC_REGIONS = [
  'Vancouver Island / Coast',
  'Mainland / Southwest',
  'Thompson / Okanagan',
  'Kootenay',
  'Cariboo',
  'North Coast',
  'Nechako',
  'Northeast',
] as const;

export const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/tiff': ['.tiff', '.tif'],
} as const;

export const STEPS = [
  { label: 'Application Type', shortLabel: 'Type' },
  { label: 'Services', shortLabel: 'Services' },
  { label: 'Site Information', shortLabel: 'Site Info' },
  { label: 'Upload Files', shortLabel: 'Upload' },
  { label: 'Process', shortLabel: 'Process' },
] as const;
