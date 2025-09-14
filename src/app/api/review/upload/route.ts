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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const submissionId = formData.get('submissionId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!submissionId) {
      return NextResponse.json({ error: 'Submission ID is required' }, { status: 400 })
    }

    // Verify the submission belongs to the user
    const { data: submission } = await supabase
      .from('review_submissions')
      .select('id, user_id')
      .eq('id', submissionId)
      .eq('user_id', user.id)
      .single()

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found or access denied' }, { status: 404 })
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `review-files/${user.id}/${fileName}`

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Save file metadata to database
    const { data: fileRecord, error: dbError } = await supabase
      .from('review_files')
      .insert({
        submission_id: submissionId,
        filename: file.name,
        file_path: filePath,
        mimetype: file.type,
        file_size: file.size
      })
      .select()

    if (dbError) {
      console.error('Error saving file metadata:', dbError)
      return NextResponse.json({ error: 'Failed to save file metadata' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      file: fileRecord[0],
      message: 'File uploaded successfully' 
    })

  } catch (error) {
    console.error('Error in review upload API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
