import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient()
    const user = await getAuthenticatedUser(supabase)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { formData } = await request.json()

    if (!formData) {
      return NextResponse.json({ error: 'Form data is required' }, { status: 400 })
    }

    // Check if user already has a review submission
    const { data: existingSubmission } = await supabase
      .from('review_submissions')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let result
    if (existingSubmission) {
      // Update existing submission
      result = await supabase
        .from('review_submissions')
        .update({ 
          form_data: formData,
          status: existingSubmission.status === 'SUBMITTED' ? 'IN_PROGRESS' : existingSubmission.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)
        .select()
    } else {
      // Create new submission
      result = await supabase
        .from('review_submissions')
        .insert({
          user_id: user.id,
          form_data: formData,
          status: 'IN_PROGRESS'
        })
        .select()
    }

    if (result.error) {
      console.error('Error saving review submission:', result.error)
      return NextResponse.json({ error: 'Failed to save review submission' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      submission: result.data[0] 
    })

  } catch (error) {
    console.error('Error in review save API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
