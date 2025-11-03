'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAnnouncementSchema, updateAnnouncementSchema, parseFormData } from '@/lib/validation-schemas';
import { logger } from '@/lib/logger';

export async function createAnnouncement(formData: FormData) {
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

  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'Authentication required' };
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return { error: 'Admin access required' };
    }

    // Validate form data with Zod schema
    const validation = parseFormData(formData, createAnnouncementSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { title, content, priority, is_active: isActive } = validation.data!;

    // Create announcement
    const { error: insertError } = await supabase
      .from('announcements')
      .insert({
        title: title.trim(),
        content: content.trim(),
        priority,
        is_active: isActive,
        created_by: user.email,
      });

    if (insertError) {
      logger.error('Error creating announcement', insertError, { operation: 'createAnnouncement', title });
      return { error: 'Failed to create announcement' };
    }

    revalidatePath('/admin/announcements');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error creating announcement', error, { operation: 'createAnnouncement' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateAnnouncement(formData: FormData) {
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

  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'Authentication required' };
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return { error: 'Admin access required' };
    }

    // Validate form data with Zod schema
    const validation = parseFormData(formData, updateAnnouncementSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { id, title, content, priority, is_active: isActive } = validation.data!;

    // Check if announcement exists
    const { data: existingAnnouncement, error: fetchError } = await supabase
      .from('announcements')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAnnouncement) {
      return { error: 'Announcement not found' };
    }

    // Update announcement
    const { error: updateError } = await supabase
      .from('announcements')
      .update({
        title: title.trim(),
        content: content.trim(),
        priority,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating announcement:', updateError);
      return { error: 'Failed to update announcement' };
    }

    revalidatePath('/admin/announcements');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error updating announcement', error, { operation: 'updateAnnouncement' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteAnnouncement(formData: FormData) {
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

  try {
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: 'Authentication required' };
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return { error: 'Admin access required' };
    }

    // Get announcement ID
    const id = formData.get('id') as string;
    if (!id) {
      return { error: 'Announcement ID is required' };
    }

    // Check if announcement exists
    const { data: existingAnnouncement, error: fetchError } = await supabase
      .from('announcements')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingAnnouncement) {
      return { error: 'Announcement not found' };
    }

    // Delete announcement
    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting announcement:', deleteError);
      return { error: 'Failed to delete announcement' };
    }

    revalidatePath('/admin/announcements');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error deleting announcement', error, { operation: 'deleteAnnouncement' });
    return { error: 'An unexpected error occurred' };
  }
}
