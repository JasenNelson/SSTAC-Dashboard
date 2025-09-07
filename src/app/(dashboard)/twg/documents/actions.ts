// src/app/(dashboard)/twg/documents/actions.ts
'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type AddDocumentState = { error?: string | null };

export async function addDocument(prevState: AddDocumentState, formData: FormData): Promise<AddDocumentState | void> {
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
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const title = (formData.get('title') as string)?.trim();
  const fileUrl = (formData.get('file_url') as string)?.trim();
  const description = (formData.get('description') as string | null)?.trim() || null;
  
  // Extract tags from form data
  const tags: number[] = [];
  let index = 0;
  while (formData.get(`tags[${index}]`)) {
    const tagId = parseInt(formData.get(`tags[${index}]`) as string);
    if (!isNaN(tagId)) {
      tags.push(tagId);
    }
    index++;
  }

  if (!title || !fileUrl) {
    return { error: 'Title and file URL are required.' };
  }

  // Get current user for user_id and user_email
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'User not authenticated.' };
  }

  const { data: document, error } = await supabase
    .from('documents')
    .insert([{ 
      title, 
      file_url: fileUrl, 
      description,
      user_id: user.id,
      user_email: user.email
    }])
    .select()
    .single();

  if (error) {
    console.error('Error inserting document:', error);
    return { error: 'Failed to create document.' };
  }

  // Add tags to the document if any were selected
  if (tags.length > 0 && document) {
    try {
      const tagEntries = tags.map(tagId => ({
        document_id: document.id,
        tag_id: tagId
      }));

      const { error: tagError } = await supabase
        .from('document_tags')
        .insert(tagEntries);

      if (tagError) {
        console.error('Error adding tags:', tagError);
        // Don't fail the whole operation if tags fail
      }
    } catch (error) {
      console.error('Error adding tags:', error);
      // Don't fail the whole operation if tags fail
    }
  }

  if (error) {
    console.error('Error inserting document:', error);
    return { error: 'Failed to create document.' };
  }

  revalidatePath('/twg/documents');
  redirect('/twg/documents');
}