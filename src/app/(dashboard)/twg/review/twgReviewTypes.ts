export interface Part1Data {
  name?: string
  expertise?: string[]
  otherExpertise?: string
}

export interface Part2Data {
  clarity?: string
  completeness?: string
  defensibility?: string
  comments?: string
}

export interface Part3Data {
  sectionI?: string
  sectionII?: string
  sectionIII?: string
  sectionIV?: string
  sectionV?: string
  appendicesCD?: string
}

export interface Part4Data {
  ranking?: Record<string, string>
  otherContaminant?: string
  challenges?: string
  additionalComments?: string
}

export interface Part5Data {
  bioavailability?: string
  otherBioavailability?: string
  evidence?: Record<string, string>
  evidenceOtherText?: string
  guidance?: string
  additionalComments?: string
}

export interface Part6Data {
  tier0Approaches?: string[]
  tier0OtherText?: string
  frameworkElements?: string[]
  frameworkOtherText?: string
  studyComponents?: string[]
  studyOtherText?: string
  challenges?: string
  additionalComments?: string
}

export interface Part7Data {
  modernization?: Record<string, string>
  research?: Record<string, string>
  strategicPlanning?: string
  additionalComments?: string
}

export interface Part8Data {
  gaps?: string
  suggestions?: string
}

export interface Part9Data {
  option1Edits?: string
  option2Edits?: string
  option3Edits?: string
  otherPathwayIdeas?: string
  supportingFactors?: string[]
  supportingFactorsOther?: string
  pathwayRationale?: string
  recommendationUpdates?: string
  implementationRisks?: string
  lineByLine?: string
}

export interface Part10Data {
  recommendationConfidence?: string
  priorityAreas?: string[]
  priorityAreasOther?: string
  implementationSupport?: string
  lineByLine?: string
}

export interface Part11Data {
  prioritizedEngagements?: string[]
  prioritizedEngagementsOther?: string
  engagementSummaryQuality?: string
  evidenceSummary?: string
  engagementInterests?: string[]
  engagementInterestsOther?: string
  lineByLine?: string
}

export interface Part12Data {
  appendixStatus?: Partial<Record<'appendixD' | 'appendixG' | 'appendixJ', string>>
  alignmentSummary?: string
  followUpNeeds?: string
  lineByLine?: string
}

export interface TWGReviewFormData {
  part1?: Part1Data
  part2?: Part2Data
  part3?: Part3Data
  part4?: Part4Data
  part5?: Part5Data
  part6?: Part6Data
  part7?: Part7Data
  part8?: Part8Data
  part9?: Part9Data
  part10?: Part10Data
  part11?: Part11Data
  part12?: Part12Data
}

export type FormSectionKey = keyof TWGReviewFormData

export type SectionProps<T> = {
  data: T
  onChange: (data: T) => void
}

