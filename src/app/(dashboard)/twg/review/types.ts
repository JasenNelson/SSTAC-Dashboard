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
  form_data: Record<string, unknown>
  created_at: string
  updated_at: string
}

/** Generic Part component props - flexible data structures per Part */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PartData = Record<string, any>

export interface PartComponentProps {
  data: PartData
  onChange: (data: PartData) => void
}
