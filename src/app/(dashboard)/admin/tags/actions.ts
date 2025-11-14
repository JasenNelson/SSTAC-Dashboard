'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createTagSchema, updateTagSchema, deleteTagSchema, parseFormData } from '@/lib/validation-schemas';
import { logger } from '@/lib/logger';

export async function createTag(formData: FormData) {
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
          try { cookieStore.set({ name, value, ...options }); } catch { /* noop */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch { /* noop */ }
        },
      },
    }
  );

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Authentication required' };
  }

  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  if (!roleData || roleData.role !== 'admin') {
    return { error: 'Admin access required' };
  }

  try {
    // Validate form data with Zod schema
    const validation = parseFormData(formData, createTagSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { name, color } = validation.data!;

    // Check if tag already exists
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .single();

    if (existingTag) {
      return { error: 'A tag with this name already exists' };
    }

    // Create the tag
    const { error } = await supabase
      .from('tags')
      .insert([
        {
          name,
          color,
          created_by: user.id
        }
      ])
      .select()
      .single();

    if (error) {
      logger.error('Error creating tag', error, { operation: 'createTag', tagName: name });
      return { error: 'Failed to create tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${name}" created successfully` };
  } catch (error) {
    logger.error('Unexpected error creating tag', error, { operation: 'createTag' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function updateTag(formData: FormData) {
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
          try { cookieStore.set({ name, value, ...options }); } catch { /* noop */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch { /* noop */ }
        },
      },
    }
  );

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Authentication required' };
  }

  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  if (!roleData || roleData.role !== 'admin') {
    return { error: 'Admin access required' };
  }

  try {
    // Validate form data with Zod schema
    const validation = parseFormData(formData, updateTagSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { id, name, color } = validation.data!;

    // Check if tag exists
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existingTag) {
      return { error: 'Tag not found' };
    }

    // Check if new name conflicts with existing tag (excluding current tag)
    const { data: conflictingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('name', name)
      .neq('id', id)
      .single();

    if (conflictingTag) {
      return { error: 'A tag with this name already exists' };
    }

    // Update the tag
    const { error } = await supabase
      .from('tags')
      .update({
        name,
        color,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      logger.error('Error updating tag', error, { operation: 'updateTag', tagId: id, tagName: name });
      return { error: 'Failed to update tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${name}" updated successfully` };
  } catch (error) {
    logger.error('Unexpected error updating tag', error, { operation: 'updateTag' });
    return { error: 'An unexpected error occurred' };
  }
}

export async function deleteTag(formData: FormData) {
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
          try { cookieStore.set({ name, value, ...options }); } catch { /* noop */ }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch { /* noop */ }
        },
      },
    }
  );

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Authentication required' };
  }

  // Check admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  if (!roleData || roleData.role !== 'admin') {
    return { error: 'Admin access required' };
  }

  try {
    // Validate form data with Zod schema
    const validation = parseFormData(formData, deleteTagSchema);
    if (validation.error) {
      return { error: validation.error };
    }
    const { id } = validation.data!;

    // Check if tag exists
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!existingTag) {
      return { error: 'Tag not found' };
    }

    // Check if tag is being used by any documents
    const { data: documentsWithTag, error: checkError } = await supabase
      .from('document_tags')
      .select('document_id')
      .eq('tag_id', id)
      .limit(1);

    if (checkError) {
      logger.error('Error checking tag usage', checkError, { operation: 'deleteTag', tagId: id });
      return { error: 'Failed to check tag usage' };
    }

    if (documentsWithTag && documentsWithTag.length > 0) {
      return { 
        error: `Cannot delete tag "${existingTag.name}" because it is currently assigned to ${documentsWithTag.length} document(s). Please remove the tag from all documents first.` 
      };
    }

    // Delete the tag
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Error deleting tag', error, { operation: 'deleteTag', tagId: id });
      return { error: 'Failed to delete tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${existingTag.name}" deleted successfully` };
  } catch (error) {
    logger.error('Unexpected error deleting tag', error, { operation: 'deleteTag' });
    return { error: 'An unexpected error occurred' };
  }
}
