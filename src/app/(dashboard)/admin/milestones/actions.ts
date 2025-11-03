'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createMilestoneSchema, updateMilestoneSchema, parseFormData } from '@/lib/validation-schemas';
import { logger } from '@/lib/logger';

export async function createMilestone(formData: FormData) {
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
    const validation = parseFormData(formData, createMilestoneSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { title, description, target_date: targetDate, status, priority } = validation.data!;

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
      logger.error('Error creating milestone', insertError, { operation: 'createMilestone', title });
      return { error: 'Failed to create milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error creating milestone', error, { operation: 'createMilestone' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateMilestone(formData: FormData) {
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
    const validation = parseFormData(formData, updateMilestoneSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { id, title, description, target_date: targetDate, status, priority } = validation.data!;

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
      logger.error('Error updating milestone', updateError, { operation: 'updateMilestone', milestoneId: id, title });
      return { error: 'Failed to update milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error updating milestone', error, { operation: 'updateMilestone' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteMilestone(formData: FormData) {
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
      logger.error('Error deleting milestone', deleteError, { operation: 'deleteMilestone', milestoneId: id });
      return { error: 'Failed to delete milestone' };
    }

    revalidatePath('/admin/milestones');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    logger.error('Unexpected error deleting milestone', error, { operation: 'deleteMilestone' });
    return { error: 'An unexpected error occurred' };
  }
}
