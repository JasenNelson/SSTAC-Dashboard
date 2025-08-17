'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type EditDocumentState = { error?: string | null; success?: string | null };

export async function editDocument(
  prevState: EditDocumentState,
  formData: FormData
): Promise<EditDocumentState> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const rawId = formData.get('id');
    const documentId = parseInt(rawId as string);
    const title = (formData.get('title') as string)?.trim();
    const file_url = (formData.get('file_url') as string)?.trim();
    const description = (formData.get('description') as string)?.trim();
    const tags = formData.getAll('tags').map(tag => parseInt(tag as string)).filter(id => !isNaN(id));

    console.log('🔍 Debug - Form data received:', {
      rawId,
      documentId,
      isNaN: isNaN(documentId),
      title,
      file_url,
      description,
      tags,
      userId: user.id
    });

    if (!documentId || isNaN(documentId) || !title || !file_url) {
      return { error: `Invalid document ID: ${rawId}. Document ID, title, and file URL are required.` };
    }

    // Check if user is admin or owns the document
    console.log('🔍 Debug - Looking for document with ID:', documentId);
    
    // First, let's see what columns actually exist by selecting all columns
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (documentError) {
      console.error('🔍 Debug - Document lookup error:', documentError);
      return { error: `Document lookup failed: ${documentError.message}` };
    }

    if (!document) {
      console.log('🔍 Debug - No document found with ID:', documentId);
      return { error: 'Document not found' };
    }

    console.log('🔍 Debug - Document found:', document);
    console.log('🔍 Debug - Document columns:', Object.keys(document));

    // For now, just check if user is admin since user_id column might not exist
    console.log('🔍 Debug - Checking if user is admin');
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    const isAdmin = !!roleData;
    if (!isAdmin) {
      return { error: 'Forbidden - Admin access required' };
    }

    console.log('🔍 Debug - User is admin, proceeding with update');

    // Update the document
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        title,
        file_url,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      return { error: 'Failed to update document' };
    }

    // Handle tags if provided
    if (Array.isArray(tags)) {
      // Remove existing tags
      await supabase
        .from('document_tags')
        .delete()
        .eq('document_id', documentId);

      // Add new tags if any
      if (tags.length > 0) {
        const tagEntries = tags.map(tagId => ({
          document_id: documentId,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('document_tags')
          .insert(tagEntries);

        if (tagError) {
          console.error('Error updating tags:', tagError);
          // Don't fail the whole operation if tags fail
        }
      }
    }

    revalidatePath('/twg/documents');
    revalidatePath(`/twg/documents/${documentId}`);
    
    return { success: 'Document updated successfully' };
  } catch (error) {
    console.error('Error in editDocument:', error);
    return { error: 'Internal server error' };
  }
}
