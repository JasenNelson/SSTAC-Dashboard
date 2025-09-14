import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set(name, value, options)
          },
          remove(name: string, options: any) {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          },
        },
      }
    )

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
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
      .select('id')
      .eq('user_id', user.id)
      .single()

    let result
    if (existingSubmission) {
      // Update existing submission to submitted
      result = await supabase
        .from('review_submissions')
        .update({ 
          form_data: formData,
          status: 'SUBMITTED',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id)
        .select()
    } else {
      // Create new submission as submitted
      result = await supabase
        .from('review_submissions')
        .insert({
          user_id: user.id,
          form_data: formData,
          status: 'SUBMITTED'
        })
        .select()
    }

    if (result.error) {
      console.error('Error submitting review:', result.error)
      return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      submission: result.data[0],
      message: 'Review submitted successfully' 
    })

  } catch (error) {
    console.error('Error in review submit API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
