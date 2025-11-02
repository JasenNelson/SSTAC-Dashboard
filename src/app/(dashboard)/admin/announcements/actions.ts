import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

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

    // Get form data
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const priority = formData.get('priority') as 'low' | 'medium' | 'high';
    const isActive = formData.get('is_active') === 'true';

    // Validate input
    if (!title || !content) {
      return { error: 'Title and content are required' };
    }

    if (title.length > 200) {
      return { error: 'Title must be 200 characters or less' };
    }

    if (content.length > 2000) {
      return { error: 'Content must be 2000 characters or less' };
    }

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
      console.error('Error creating announcement:', insertError);
      return { error: 'Failed to create announcement' };
    }

    revalidatePath('/admin/announcements');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error in createAnnouncement:', error);
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

    // Get form data
    const id = formData.get('id') as string;
    const title = formData.get('title') as string;
    const content = formData.get('content') as string;
    const priority = formData.get('priority') as 'low' | 'medium' | 'high';
    const isActive = formData.get('is_active') === 'true';

    // Validate input
    if (!id || !title || !content) {
      return { error: 'ID, title, and content are required' };
    }

    if (title.length > 200) {
      return { error: 'Title must be 200 characters or less' };
    }

    if (content.length > 2000) {
      return { error: 'Content must be 2000 characters or less' };
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
    console.error('Error in updateAnnouncement:', error);
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
    console.error('Error in deleteAnnouncement:', error);
    return { error: 'An unexpected error occurred' };
  }
}
