export type PhaseKey = 'Phase 1 Review' | 'Phase 2 Review'

export type ReviewSection = {
  id: number
  title: string
  description: string
  phase: PhaseKey
}

export interface ReviewSubmission {
  id: string
  user_id: string
  status: 'IN_PROGRESS' | 'SUBMITTED'
  form_data: any
  created_at: string
  updated_at: string
}
