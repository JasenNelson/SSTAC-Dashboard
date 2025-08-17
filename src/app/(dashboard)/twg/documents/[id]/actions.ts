'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

type UpdateState = { error?: string | null };

export async function updateDocument(prevState: UpdateState, formData: FormData): Promise<UpdateState> {
  try {
    if (!formData) {
      console.error('FormData is undefined');
      return { error: 'Form submission failed' };
    }

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }
    
    // Check if user has admin role in user_roles table
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    
    if (!roleData) {
      return { error: 'Unauthorized' };
    }

    const idRaw = formData.get('id');
    const title = (formData.get('title') as string)?.trim();
    const fileUrl = (formData.get('file_url') as string)?.trim();
    const description = (formData.get('description') as string | null)?.trim() || null;

    console.log('Form data received:', { idRaw, title, fileUrl, description });

    const id = typeof idRaw === 'string' ? parseInt(idRaw, 10) : Number(idRaw);
    if (!Number.isFinite(id)) {
      return { error: 'Invalid document id.' };
    }

    if (!title || !fileUrl) {
      return { error: 'Title and file URL are required.' };
    }

    let { error } = await supabase
      .from('documents')
      .update({ title, file_url: fileUrl, description })
      .eq('id', id);

    if (error?.message?.includes('column') && error?.message?.includes('description')) {
      const retry = await supabase
        .from('documents')
        .update({ title, file_url: fileUrl })
        .eq('id', id);
      error = retry.error;
    }

    if (error) {
      console.error('Error updating document:', error);
      return { error: 'Failed to update document.' };
    }

    revalidatePath('/twg/documents');
    revalidatePath(`/twg/documents/${id}`);
    redirect(`/twg/documents/${id}`);
  } catch (error) {
    console.error('Unexpected error in updateDocument:', error);
    return { error: 'An unexpected error occurred' };
  }
}