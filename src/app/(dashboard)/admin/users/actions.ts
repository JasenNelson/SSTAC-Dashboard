'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
  isAdmin: boolean;
}

export async function getUsers(): Promise<UserWithRole[]> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check if user has admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;
  
  if (!isAdmin) {
    redirect('/dashboard');
  }

  try {
    // Get all users from auth.users (this requires a different approach)
    // Since we can't directly query auth.users from the client, we'll use a different strategy
    
              // First, get all user roles
     const { data: userRoles, error: rolesError } = await supabase
       .from('user_roles')
       .select('user_id, role, status, created_at');

     if (rolesError) {
       console.error('Error fetching user roles:', rolesError);
       throw new Error('Failed to fetch user roles');
     }

     // Create a map to track unique users and their roles
     const userMap = new Map<string, UserWithRole>();
     
     // Add users from user_roles table
     if (userRoles) {
       for (const userRole of userRoles) {
         if (!userMap.has(userRole.user_id)) {
           userMap.set(userRole.user_id, {
             id: userRole.user_id,
             email: userRole.user_id === user.id ? (user.email || 'Current User') : `User ${userRole.user_id.slice(0, 8)}...`,
             created_at: userRole.created_at,
             role: userRole.role,
             isAdmin: userRole.role === 'admin'
           });
         }
       }
     }

         // Add the current user if they're not in the list
     if (!userMap.has(user.id)) {
       userMap.set(user.id, {
         id: user.id,
         email: user.email || 'Current User',
         created_at: user.created_at,
         role: 'admin',
         isAdmin: true
       });
     }

    // Convert map to array and sort by creation date
    const usersWithRoles = Array.from(userMap.values());
    usersWithRoles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return usersWithRoles;
  } catch (error) {
    console.error('Error in getUsers:', error);
    throw new Error('Failed to fetch users');
  }
}

export async function toggleAdminRole(userId: string, currentIsAdmin: boolean): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check if user has admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;
  
  if (!isAdmin) {
    redirect('/dashboard');
  }

  try {
    if (currentIsAdmin) {
      // Remove admin role
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'admin');
      
      if (error) {
        throw error;
      }
    } else {
      // Add admin role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin'
        });
      
      if (error) {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error updating admin role:', error);
    throw new Error(
      currentIsAdmin 
        ? 'Failed to remove admin role' 
        : 'Failed to grant admin role'
    );
  }
}

export async function addUserRole(userId: string, role: string): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check if user has admin role
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;
  
  if (!isAdmin) {
    redirect('/dashboard');
  }

  try {
    // Add user role
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: role
      });
    
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error adding user role:', error);
    throw new Error('Failed to add user role');
  }
}




