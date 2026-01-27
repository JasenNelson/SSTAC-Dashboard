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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form_data: any
  created_at: string
  updated_at: string
}

/** Generic Part component props - use any to allow flexible data structures per Part */

export interface PartComponentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (data: any) => void
}
