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
    // First, try to use the comprehensive admin view if it exists
    const { data: comprehensiveUsers, error: comprehensiveError } = await supabase
      .from('admin_users_comprehensive')
      .select('*')
      .order('auth_created_at', { ascending: false });

    if (!comprehensiveError && comprehensiveUsers) {
      console.log('✅ Using comprehensive admin view for user data');
      // Transform the comprehensive view data to match our interface
      const usersWithRoles: UserWithRole[] = comprehensiveUsers.map(userData => ({
        id: userData.id,
        email: userData.email,
        created_at: userData.auth_created_at,
        role: userData.role,
        isAdmin: userData.is_admin
      }));

      return usersWithRoles;
    }

    // Second, try to use the users_overview view if it exists
    const { data: usersData, error: usersError } = await supabase
      .from('users_overview')
      .select('*')
      .order('last_activity', { ascending: false });

    if (!usersError && usersData) {
      console.log('✅ Using users_overview view for user data');
      // Transform the view data to match our interface
      const usersWithRoles: UserWithRole[] = usersData.map(userData => ({
        id: userData.id,
        email: userData.email,
        created_at: userData.first_activity,
        role: userData.role,
        isAdmin: userData.is_admin
      }));

      // Add the current user if they're not in the list
      const currentUserExists = usersWithRoles.some(u => u.id === user.id);
      if (!currentUserExists) {
        usersWithRoles.unshift({
          id: user.id,
          email: user.email || 'Current User',
          created_at: user.created_at,
          role: 'admin',
          isAdmin: true
        });
      }

      return usersWithRoles;
    }

    // If neither view exists, fall back to comprehensive user discovery
    console.log('⚠️ No database views found, using comprehensive user discovery...');
    return await getUsersComprehensive(user);
  } catch (error) {
    console.error('Error in getUsers:', error);
    throw new Error('Failed to fetch users');
  }
}

// Comprehensive user discovery that searches multiple sources
async function getUsersComprehensive(currentUser: { id: string }): Promise<UserWithRole[]> {
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

  try {
    // First, get all user roles to understand the current role assignments
    const { data: userRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at');

    if (rolesError) {
      console.error('Error fetching user roles:', rolesError);
      throw new Error('Failed to fetch user roles');
    }

    // Create a map of user roles for quick lookup
    const roleMap = new Map<string, { role: string; created_at: string }>();
    if (userRoles) {
      for (const userRole of userRoles) {
        roleMap.set(userRole.user_id, {
          role: userRole.role,
          created_at: userRole.created_at
        });
      }
    }

    // Get all users from the documents table to find users who have created content
    const { data: documentUsers, error: docError } = await supabase
      .from('documents')
      .select('user_id, user_email, created_at')
      .not('user_id', 'is', null);

    if (docError) {
      console.error('Error fetching document users:', docError);
      // Continue without document users if there's an error
    }

    // Get all users from the discussions table
    const { data: discussionUsers, error: discError } = await supabase
      .from('discussions')
      .select('user_id, user_email, created_at')
      .not('user_id', 'is', null);

    if (discError) {
      console.error('Error fetching discussion users:', discError);
      // Continue without discussion users if there's an error
    }

    // Get all users from the likes table
    const { data: likeUsers, error: likeError } = await supabase
      .from('likes')
      .select('user_id, created_at')
      .not('user_id', 'is', null);

    if (likeError) {
      console.error('Error fetching like users:', likeError);
      // Continue without like users if there's an error
    }

    // Try to get user emails from auth.users through a database function
    // This requires creating a database function that can safely expose user emails
    let authUsers: { id: string; email: string }[] = [];
    try {
      // Try to call a database function that returns user emails
      const { data: authUsersData, error: authError } = await supabase
        .rpc('get_users_with_emails');

      if (!authError && authUsersData) {
        authUsers = authUsersData;
        console.log('✅ Retrieved user emails from database function');
      } else {
        console.log('⚠️ Database function not available, using fallback method');
      }
    } catch {
      console.log('⚠️ Database function call failed, using fallback method');
    }

    // Create a comprehensive map of all users
    const userMap = new Map<string, UserWithRole>();
    
    // Add users from auth.users if available (these have real emails)
    if (authUsers.length > 0) {
      for (const authUser of authUsers) {
        userMap.set(authUser.id, {
          id: authUser.id,
          email: authUser.email || `User ${authUser.id.slice(0, 8)}...`,
          created_at: authUser.created_at,
          role: roleMap.get(authUser.id)?.role || null,
          isAdmin: roleMap.get(authUser.id)?.role === 'admin' || false
        });
      }
    }

    // Add users from user_roles table (these are explicitly managed users)
    if (userRoles) {
      for (const userRole of userRoles) {
        if (!userMap.has(userRole.user_id)) {
          userMap.set(userRole.user_id, {
            id: userRole.user_id,
            email: `User ${userRole.user_id.slice(0, 8)}...`, // We'll try to get real email later
            created_at: userRole.created_at,
            role: userRole.role,
            isAdmin: userRole.role === 'admin'
          });
        }
      }
    }

    // Add users from documents table
    if (documentUsers) {
      for (const docUser of documentUsers) {
        if (!userMap.has(docUser.user_id)) {
          userMap.set(docUser.user_id, {
            id: docUser.user_id,
            email: docUser.user_email || `User ${docUser.user_id.slice(0, 8)}...`,
            created_at: docUser.created_at,
            role: roleMap.get(docUser.user_id)?.role || null,
            isAdmin: roleMap.get(docUser.user_id)?.role === 'admin' || false
          });
        } else {
          // Update existing user with email if available
          const existingUser = userMap.get(docUser.user_id)!;
          if (docUser.user_email && existingUser.email.startsWith('User ')) {
            existingUser.email = docUser.user_email;
          }
        }
      }
    }

    // Add users from discussions table
    if (discussionUsers) {
      for (const discUser of discussionUsers) {
        if (!userMap.has(discUser.user_id)) {
          userMap.set(discUser.user_id, {
            id: discUser.user_id,
            email: discUser.user_email || `User ${discUser.user_id.slice(0, 8)}...`,
            created_at: discUser.created_at,
            role: roleMap.get(discUser.user_id)?.role || null,
            isAdmin: roleMap.get(discUser.user_id)?.role === 'admin' || false
          });
        } else {
          // Update existing user with email if available
          const existingUser = userMap.get(discUser.user_id)!;
          if (discUser.user_email && existingUser.email.startsWith('User ')) {
            existingUser.email = discUser.user_email;
          }
        }
      }
    }

    // Add users from likes table
    if (likeUsers) {
      for (const likeUser of likeUsers) {
        if (!userMap.has(likeUser.user_id)) {
          userMap.set(likeUser.user_id, {
            id: likeUser.user_id,
            email: `User ${likeUser.user_id.slice(0, 8)}...`,
            created_at: likeUser.created_at,
            role: roleMap.get(likeUser.user_id)?.role || null,
            isAdmin: roleMap.get(likeUser.user_id)?.role === 'admin' || false
          });
        }
      }
    }

    // Add the current user if they're not in the list
    if (!userMap.has(currentUser.id)) {
      userMap.set(currentUser.id, {
        id: currentUser.id,
        email: currentUser.email || 'Current User',
        created_at: currentUser.created_at,
        role: 'admin',
        isAdmin: true
      });
    }

    // Convert map to array and sort by creation date
    const usersWithRoles = Array.from(userMap.values());
    usersWithRoles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return usersWithRoles;
  } catch (error) {
    console.error('Error in getUsersComprehensive:', error);
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




