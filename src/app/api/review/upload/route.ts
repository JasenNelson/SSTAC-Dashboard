import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth'

/**
 * Task 2.3: File Upload Validation
 * Validates file type and size before processing
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'xlsx']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient()

    // Check authentication
    const user = await getAuthenticatedUser(supabase)
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

    // Task 2.3: Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
          allowedTypes: ALLOWED_EXTENSIONS,
        },
        { status: 400 }
      )
    }

    // Task 2.3: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
          maxSize: MAX_FILE_SIZE,
          actualSize: file.size,
        },
        { status: 413 }
      )
    }

    // Validate file extension matches content
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        {
          error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
        },
        { status: 400 }
      )
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
