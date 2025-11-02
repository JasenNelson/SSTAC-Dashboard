'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

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
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
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
    const name = formData.get('name') as string;
    const color = formData.get('color') as string;

    if (!name || !color) {
      return { error: 'Name and color are required' };
    }

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
      console.error('Error creating tag:', error);
      return { error: 'Failed to create tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${name}" created successfully` };
  } catch (error) {
    console.error('Error creating tag:', error);
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
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
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
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const color = formData.get('color') as string;

    if (!id || !name || !color) {
      return { error: 'ID, name, and color are required' };
    }

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
      console.error('Error updating tag:', error);
      return { error: 'Failed to update tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${name}" updated successfully` };
  } catch (error) {
    console.error('Error updating tag:', error);
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
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
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
    const id = formData.get('id') as string;

    if (!id) {
      return { error: 'Tag ID is required' };
    }

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
      console.error('Error checking tag usage:', checkError);
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
      console.error('Error deleting tag:', error);
      return { error: 'Failed to delete tag' };
    }

    revalidatePath('/admin/tags');
    return { success: `Tag "${existingTag.name}" deleted successfully` };
  } catch (error) {
    console.error('Error deleting tag:', error);
    return { error: 'An unexpected error occurred' };
  }
}
