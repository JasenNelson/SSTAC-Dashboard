/**
 * CSR Schedule 2 & 3 Services organized by lifecycle stage.
 *
 * Based on BC Contaminated Sites Regulation (CSR 375/96) Schedule 2 (Director services)
 * and Schedule 3 (Approved Professional services).
 */

// =============================================================================
// Types
// =============================================================================

export type LifecycleStage =
  | 'site-determination'
  | 'investigation'
  | 'remediation'
  | 'risk-assessment'
  | 'confirmation'
  | 'certification'
  | 'agreements'
  | 'specialized';

export interface Schedule3Service {
  id: string;
  name: string;
  description: string;
  scheduleTable: 2 | 3;
  feeTierSimple: string;
  feeTierComplex: string;
  lifecycleStage: LifecycleStage;
  isApprovedProfessional: boolean;
}

export interface LifecycleStageInfo {
  id: LifecycleStage;
  name: string;
  description: string;
  icon: string;
}

// =============================================================================
// Lifecycle Stages
// =============================================================================

export const LIFECYCLE_STAGES: LifecycleStageInfo[] = [
  {
    id: 'site-determination',
    name: 'Site Determination',
    description: 'Determining whether a site is contaminated under the Environmental Management Act',
    icon: 'Search',
  },
  {
    id: 'investigation',
    name: 'Investigation',
    description: 'Preliminary and detailed site investigations to characterize contamination',
    icon: 'Microscope',
  },
  {
    id: 'remediation',
    name: 'Remediation',
    description: 'Remediation planning and implementation for contaminated sites',
    icon: 'Wrench',
  },
  {
    id: 'risk-assessment',
    name: 'Risk Assessment',
    description: 'Human health, ecological, and vapour intrusion risk assessments',
    icon: 'AlertTriangle',
  },
  {
    id: 'confirmation',
    name: 'Confirmation',
    description: 'Confirmation that remediation meets applicable standards',
    icon: 'CheckCircle',
  },
  {
    id: 'certification',
    name: 'Certification',
    description: 'Certificate of compliance applications and issuance',
    icon: 'Award',
  },
  {
    id: 'agreements',
    name: 'Agreements',
    description: 'Voluntary remediation, contaminated soil relocation, and independent remediation agreements',
    icon: 'FileText',
  },
  {
    id: 'specialized',
    name: 'Specialized',
    description: 'Background concentrations, site-specific standards, and wide area designations',
    icon: 'Settings',
  },
];

// =============================================================================
// Services
// =============================================================================

export const SERVICES: Schedule3Service[] = [
  // --- Site Determination ---
  {
    id: 'site-determination-s44',
    name: 'Contaminated Site Determination (CSR s.44)',
    description: 'Director determination of whether a site is a contaminated site under s.44 of the CSR',
    scheduleTable: 3,
    feeTierSimple: '$2,500',
    feeTierComplex: '$5,000',
    lifecycleStage: 'site-determination',
    isApprovedProfessional: false,
  },
  {
    id: 'independent-remediation-s49',
    name: 'Independent Remediation (CSR s.49)',
    description: 'Application for independent remediation of a contaminated site under s.49 of the CSR',
    scheduleTable: 3,
    feeTierSimple: '$2,500',
    feeTierComplex: '$5,000',
    lifecycleStage: 'site-determination',
    isApprovedProfessional: false,
  },
  {
    id: 'ap-s44-determination',
    name: 'Section 44 Determination (Approved Professional)',
    description: 'Approved Professional determination of whether a site is a contaminated site under s.44',
    scheduleTable: 3,
    feeTierSimple: '$1,500',
    feeTierComplex: '$3,000',
    lifecycleStage: 'site-determination',
    isApprovedProfessional: true,
  },

  // --- Investigation ---
  {
    id: 'psi-review',
    name: 'Preliminary Site Investigation (PSI) Review',
    description: 'Director review of a preliminary site investigation report',
    scheduleTable: 3,
    feeTierSimple: '$3,000',
    feeTierComplex: '$6,000',
    lifecycleStage: 'investigation',
    isApprovedProfessional: false,
  },
  {
    id: 'dsi-review',
    name: 'Detailed Site Investigation (DSI) Review',
    description: 'Director review of a detailed site investigation report',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'investigation',
    isApprovedProfessional: false,
  },
  {
    id: 'supplemental-investigation',
    name: 'Supplemental Investigation Review',
    description: 'Director review of a supplemental site investigation report',
    scheduleTable: 3,
    feeTierSimple: '$2,500',
    feeTierComplex: '$5,000',
    lifecycleStage: 'investigation',
    isApprovedProfessional: false,
  },

  // --- Remediation ---
  {
    id: 'remediation-plan',
    name: 'Remediation Plan Review',
    description: 'Director review of a remediation plan for a contaminated site',
    scheduleTable: 3,
    feeTierSimple: '$3,500',
    feeTierComplex: '$7,000',
    lifecycleStage: 'remediation',
    isApprovedProfessional: false,
  },
  {
    id: 'remediation-plan-risk',
    name: 'Remediation Plan with Risk Assessment',
    description: 'Director review of a remediation plan that includes a risk-based approach',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'remediation',
    isApprovedProfessional: false,
  },

  // --- Risk Assessment ---
  {
    id: 'hhra-review',
    name: 'Human Health Risk Assessment Review',
    description: 'Director review of a human health risk assessment for a contaminated site',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'risk-assessment',
    isApprovedProfessional: false,
  },
  {
    id: 'era-review',
    name: 'Ecological Risk Assessment Review',
    description: 'Director review of an ecological risk assessment for a contaminated site',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'risk-assessment',
    isApprovedProfessional: false,
  },
  {
    id: 'via-review',
    name: 'Vapour Intrusion Assessment Review',
    description: 'Director review of a vapour intrusion assessment for a contaminated site',
    scheduleTable: 3,
    feeTierSimple: '$3,500',
    feeTierComplex: '$7,000',
    lifecycleStage: 'risk-assessment',
    isApprovedProfessional: false,
  },

  // --- Confirmation ---
  {
    id: 'cor-review',
    name: 'Confirmation of Remediation (CoR) Review',
    description: 'Director review of a confirmation of remediation report',
    scheduleTable: 3,
    feeTierSimple: '$3,000',
    feeTierComplex: '$6,000',
    lifecycleStage: 'confirmation',
    isApprovedProfessional: false,
  },

  // --- Certification ---
  {
    id: 'aip-application',
    name: 'Approval in Principle',
    description: 'Application for an approval in principle for a proposed remediation approach',
    scheduleTable: 3,
    feeTierSimple: '$3,500',
    feeTierComplex: '$7,000',
    lifecycleStage: 'certification',
    isApprovedProfessional: false,
  },
  {
    id: 'coc-application',
    name: 'Certificate of Compliance Application',
    description: 'Application for a certificate of compliance for a remediated contaminated site',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'certification',
    isApprovedProfessional: false,
  },
  {
    id: 'determination',
    name: 'Determination',
    description: 'Application for a determination regarding contaminated site status or regulatory requirements',
    scheduleTable: 3,
    feeTierSimple: '$2,500',
    feeTierComplex: '$5,000',
    lifecycleStage: 'certification',
    isApprovedProfessional: false,
  },
  {
    id: 'ap-coc',
    name: 'Certificate of Compliance (Approved Professional)',
    description: 'Approved Professional issuance of a certificate of compliance',
    scheduleTable: 3,
    feeTierSimple: '$3,000',
    feeTierComplex: '$6,000',
    lifecycleStage: 'certification',
    isApprovedProfessional: true,
  },

  // --- Agreements ---
  {
    id: 'vra',
    name: 'Voluntary Remediation Agreement',
    description: 'Application for a voluntary remediation agreement under the Environmental Management Act',
    scheduleTable: 3,
    feeTierSimple: '$2,000',
    feeTierComplex: '$4,000',
    lifecycleStage: 'agreements',
    isApprovedProfessional: false,
  },
  {
    id: 'csra',
    name: 'Contaminated Soil Relocation Agreement',
    description: 'Application for a contaminated soil relocation agreement',
    scheduleTable: 3,
    feeTierSimple: '$2,000',
    feeTierComplex: '$4,000',
    lifecycleStage: 'agreements',
    isApprovedProfessional: false,
  },
  {
    id: 'ira',
    name: 'Independent Remediation Agreement',
    description: 'Application for an independent remediation agreement',
    scheduleTable: 3,
    feeTierSimple: '$2,000',
    feeTierComplex: '$4,000',
    lifecycleStage: 'agreements',
    isApprovedProfessional: false,
  },

  // --- Specialized ---
  {
    id: 'background-concentration',
    name: 'Background Concentration Application',
    description: 'Application to establish background concentrations for a site',
    scheduleTable: 3,
    feeTierSimple: '$3,000',
    feeTierComplex: '$6,000',
    lifecycleStage: 'specialized',
    isApprovedProfessional: false,
  },
  {
    id: 'site-specific-standards',
    name: 'Site-Specific Numerical Standards',
    description: 'Application for site-specific numerical standards under the CSR',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'specialized',
    isApprovedProfessional: false,
  },
  {
    id: 'wide-area-designation',
    name: 'Wide Area Site Designation',
    description: 'Application for designation of a wide area site under the CSR',
    scheduleTable: 3,
    feeTierSimple: '$5,000',
    feeTierComplex: '$10,000',
    lifecycleStage: 'specialized',
    isApprovedProfessional: false,
  },
];

// =============================================================================
// Helpers
// =============================================================================

export function getServicesByStage(stage: LifecycleStage): Schedule3Service[] {
  return SERVICES.filter((s) => s.lifecycleStage === stage);
}

export function getServiceById(id: string): Schedule3Service | undefined {
  return SERVICES.find((s) => s.id === id);
}
