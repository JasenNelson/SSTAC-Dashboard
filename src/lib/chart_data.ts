// src/lib/chart_data.ts

export interface ChartDataItem {
  name: string;
  value: number;
}

export interface WordCloudItem {
  text: string;
  value: number;
}

// --- Appendix G Data ---

export const g1Data: ChartDataItem[] = [
  { name: 'Very Important', value: 42.0 },
  { name: 'Important', value: 21.0 },
  { name: 'Moderately Important', value: 7.0 },
  { name: 'Less Important', value: 1.0 },
];

export const g2Data: ChartDataItem[] = [
  { name: 'Achievable', value: 36.0 },
  { name: 'Moderately Achievable', value: 15.0 },
  { name: 'Easily Achievable', value: 9.0 },
  { name: 'Difficult', value: 7.0 },
];

export const g3Data: ChartDataItem[] = [
  { name: 'Very Important', value: 24.0 },
  { name: 'Important', value: 22.0 },
  { name: 'Less Important', value: 11.0 },
  { name: 'Moderately Important', value: 10.0 },
];

export const g4Data: ChartDataItem[] = [
  { name: 'Achievable', value: 23.0 },
  { name: 'Moderately Achievable', value: 18.0 },
  { name: 'Difficult', value: 16.0 },
  { name: 'Easily Achievable', value: 7.0 },
];

export const g5Data: ChartDataItem[] = [
  { name: 'Very Important', value: 39.0 },
  { name: 'Important', value: 18.0 },
  { name: 'Moderately Important', value: 7.0 },
  { name: 'Less Important', value: 1.0 },
];

export const g6Data: ChartDataItem[] = [
  { name: 'Achievable', value: 29.0 },
  { name: 'Moderately Achievable', value: 23.0 },
  { name: 'Difficult', value: 11.0 },
];

export const g7Data: ChartDataItem[] = [
  { name: 'Very Important', value: 27.0 },
  { name: 'Important', value: 23.0 },
  { name: 'Moderately Important', value: 9.0 },
  { name: 'Less Important', value: 5.0 },
];

export const g8Data: ChartDataItem[] = [
  { name: 'Achievable', value: 28.0 },
  { name: 'Moderately Achievable', value: 21.0 },
  { name: 'Difficult', value: 14.0 },
  { name: 'Easily Achievable', value: 6.0 },
];

export const g9Data: ChartDataItem[] = [
  { name: 'Full risk distribution', value: 20.0 },
  { name: 'Systematic integration', value: 15.0 },
  { name: 'Formal structure for uncertainty', value: 9.0 },
  { name: 'Improves technical defensibility', value: 9.0 },
  { name: 'Other', value: 2.0 },
];

export const g10Data: ChartDataItem[] = [
  { name: 'Site-specific toxicity testing', value: 31.0 },
  { name: 'Large number of chemistry samples', value: 11.0 },
  { name: 'High-quality passive sampling', value: 11.0 },
  { name: 'Other', value: 3.0 },
  { name: 'Detailed geochemical parameters', value: 3.0 },
];

export const g11Data: ChartDataItem[] = [
  { name: 'Defining appropriate priors', value: 27.0 },
  { name: 'Communicating probabilistic outputs', value: 13.0 },
  { name: 'Lack of standardized software', value: 7.0 },
  { name: 'High level of statistical expertise', value: 6.0 },
  { name: 'Other', value: 1.0 },
];

export const g12Data: ChartDataItem[] = [
  { name: 'Very Important', value: 30.0 },
  { name: 'Important', value: 30.0 },
  { name: 'Moderately Important', value: 5.0 },
  { name: 'Less Important', value: 1.0 },
];

export const g13Data: ChartDataItem[] = [
  { name: 'Moderately Achievable', value: 26.0 },
  { name: 'Achievable', value: 19.0 },
  { name: 'Difficult', value: 10.0 },
  { name: 'Easily Achievable', value: 7.0 },
];

export const g14Data: ChartDataItem[] = [
  { name: 'Distinguish pathways', value: 1.53 },
  { name: 'Clarify protection levels', value: 2.55 },
  { name: 'Clarify human health endpoints', value: 2.96 },
  { name: 'Clarify spatial scale', value: 2.96 },
];

export const g15Data: ChartDataItem[] = [
  { name: 'Push guidance (Tier 2)', value: 1.95 },
  { name: 'Increase guidance (effects-based)', value: 2.29 },
  { name: 'Incorporate mixture models', value: 2.4 },
  { name: 'Fill gaps (surrogates)', value: 3.36 },
];

export const g18Data: WordCloudItem[] = [
  { text: 'resourcing', value: 26 },
  { text: 'agreement', value: 8 },
  { text: 'prescription', value: 4 },
  { text: 'tools', value: 3 },
  { text: 'data', value: 3 },
  { text: 'engagement', value: 1 },
  { text: 'regulator', value: 1 },
  { text: 'applicability', value: 1 },
  { text: 'collaboration', value: 1 },
];

// --- Appendix J Data ---

export const j1Data: ChartDataItem[] = [
  { name: 'Ecotoxicology', value: 21 },
  { name: 'HHRA', value: 20 },
  { name: 'Food Web Modeling', value: 14 },
  { name: 'Site Remediation', value: 13 },
  { name: 'Bioavailability', value: 11 },
  { name: 'Env. Chemistry', value: 11 },
  { name: 'Regulatory Policy', value: 6 },
  { name: 'Benthic Ecology', value: 5 },
  { name: 'Other', value: 4 },
  { name: 'Indigenous Knowledge', value: 1 },
];

export const j2Data: {
  clarity: ChartDataItem[];
  completeness: ChartDataItem[];
  defensibility: ChartDataItem[];
} = {
  clarity: [
    { name: 'Excellent', value: 10 },
    { name: 'Good', value: 10 },
    { name: 'Fair', value: 2 },
    { name: 'Poor', value: 1 },
  ],
  completeness: [
    { name: 'Excellent', value: 10 },
    { name: 'Good', value: 12 },
    { name: 'Fair', value: 1 },
    { name: 'Poor', value: 0 },
  ],
  defensibility: [
    { name: 'Excellent', value: 8 },
    { name: 'Good', value: 15 },
    { name: 'Fair', value: 0 },
    { name: 'Poor', value: 0 },
  ],
};

export const j3Data: ChartDataItem[] = [
  { name: 'Matrix Framework (Eco)', value: 10 },
  { name: 'Site-Specific Framework (Bio)', value: 7 },
  { name: 'Matrix Framework (Human)', value: 3 },
  { name: 'Non-scheduled Contaminants', value: 1 },
];

export const j4Data: ChartDataItem[] = [
  { name: 'Build open-access database', value: 10 },
  { name: 'Research ecosystem-level impacts', value: 6 },
  { name: 'Development of in-vitro screening', value: 3 },
  { name: 'Investigate climate change impacts', value: 1 },
];

export const j5Data: ChartDataItem[] = [
  { name: 'Mercury', value: 9 },
  { name: 'PFAS', value: 6 },
  { name: 'Other', value: 3 },
  { name: 'PCBs', value: 3 },
  { name: 'Pesticides', value: 1 },
  { name: 'Dioxins/Furans', value: 1 },
];

export const j6Data: ChartDataItem[] = [
  { name: 'Site-specific bioavailability data', value: 15 },
  { name: 'Bioaccumulation data in tissues', value: 5 },
  { name: 'Benthic community analysis', value: 1 },
];

export const j7Data: ChartDataItem[] = [
  { name: 'Equilibrium partitioning (TOC)', value: 10 },
  { name: 'Other', value: 6 },
  { name: 'AVS/SEM', value: 5 },
];

export const j8Data: ChartDataItem[] = [
  { name: 'Establish baseline conditions', value: 15 },
  { name: 'Create protocols for high-quality areas', value: 12 },
  { name: 'Implement Tier 0 provisions', value: 7 },
  { name: 'Develop criteria for pristine conditions', value: 5 },
  { name: 'Other', value: 1 },
];

export const j9Data: ChartDataItem[] = [
  { name: 'Develop risk-based framework', value: 14 },
  { name: 'Establish culturally appropriate endpoints', value: 11 },
  { name: 'Integrate TEK', value: 9 },
  { name: 'Include Indigenous Uses', value: 9 },
  { name: 'Develop community-specific scenarios', value: 5 },
  { name: 'Other', value: 1 },
];

export const j10Data: ChartDataItem[] = [
  { name: 'Desktop review of regional data', value: 13 },
  { name: 'Compile reports from Indigenous territories', value: 13 },
  { name: 'Identify data gaps', value: 12 },
  { name: 'Develop engagement methodology', value: 11 },
  { name: 'Create protocols for engagement', value: 7 },
];

