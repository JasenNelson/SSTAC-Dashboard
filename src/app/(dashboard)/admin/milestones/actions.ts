import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function createMilestone(formData: FormData, prevState: any) {
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
    const description = formData.get('description') as string;
    const targetDate = formData.get('target_date') as string;
    const status = formData.get('status') as 'pending' | 'in_progress' | 'completed' | 'delayed';
    const priority = formData.get('priority') as 'low' | 'medium' | 'high';

    // Validate input
    if (!title || !description || !targetDate) {
      return { error: 'Title, description, and target date are required' };
    }

    if (title.length > 200) {
      return { error: 'Title must be 200 characters or less' };
    }

    if (description.length > 1000) {
      return { error: 'Description must be 1000 characters or less' };
    }

    // Validate date
    const targetDateObj = new Date(targetDate);
    if (isNaN(targetDateObj.getTime())) {
      return { error: 'Invalid target date' };
    }

    // Create milestone
    const { error: insertError } = await supabase
      .from('milestones')
      .insert({
        title: title.trim(),
        description: description.trim(),
        target_date: targetDate,
        status,
        priority,
        created_by: user.email,
      });

    if (insertError) {
      console.error('Error creating milestone:', insertError);
      return { error: 'Failed to create milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error in createMilestone:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateMilestone(formData: FormData, prevState: any) {
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
    const description = formData.get('description') as string;
    const targetDate = formData.get('target_date') as string;
    const status = formData.get('status') as 'pending' | 'in_progress' | 'completed' | 'delayed';
    const priority = formData.get('priority') as 'low' | 'medium' | 'high';

    // Validate input
    if (!id || !title || !description || !targetDate) {
      return { error: 'ID, title, description, and target date are required' };
    }

    if (title.length > 200) {
      return { error: 'Title must be 200 characters or less' };
    }

    if (description.length > 1000) {
      return { error: 'Description must be 1000 characters or less' };
    }

    // Validate date
    const targetDateObj = new Date(targetDate);
    if (isNaN(targetDateObj.getTime())) {
      return { error: 'Invalid target date' };
    }

    // Check if milestone exists
    const { data: existingMilestone, error: fetchError } = await supabase
      .from('milestones')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingMilestone) {
      return { error: 'Milestone not found' };
    }

    // Update milestone
    const { error: updateError } = await supabase
      .from('milestones')
      .update({
        title: title.trim(),
        description: description.trim(),
        target_date: targetDate,
        status,
        priority,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating milestone:', updateError);
      return { error: 'Failed to update milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error in updateMilestone:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteMilestone(formData: FormData, prevState: any) {
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

    // Get milestone ID
    const id = formData.get('id') as string;
    if (!id) {
      return { error: 'Milestone ID is required' };
    }

    // Check if milestone exists
    const { data: existingMilestone, error: fetchError } = await supabase
      .from('milestones')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingMilestone) {
      return { error: 'Milestone not found' };
    }

    // Delete milestone
    const { error: deleteError } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting milestone:', deleteError);
      return { error: 'Failed to delete milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteMilestone:', error);
    return { error: 'An unexpected error occurred' };
  }
}
