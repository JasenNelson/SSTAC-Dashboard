// src/lib/admin-utils.ts
// Utility functions for admin status management across components

import { createClient } from '@/lib/supabase/client';

/**
 * Global function to refresh admin status
 * This can be called from any component to ensure admin badge persistence
 */
export async function refreshGlobalAdminStatus(): Promise<boolean> {
  try {

    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('⚠️ No user found during admin status refresh');
      return false;
    }

    console.log('🔄 Refreshing admin status for user:', user.email);

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError) {
      console.error('❌ Error checking admin role:', roleError);
      
      // Check localStorage backup
      const backupAdminStatus = localStorage.getItem(`admin_status_${user.id}`);
      if (backupAdminStatus === 'true') {
        console.log('✅ Admin status restored from localStorage backup');
        return true;
      }
      
      return false;
    }

    const isAdmin = !!roleData;
    
    if (isAdmin) {
      // Update localStorage backup
      localStorage.setItem(`admin_status_${user.id}`, 'true');
      console.log('✅ Admin status confirmed and backed up');
    } else {
      // Remove localStorage backup if not admin
      localStorage.removeItem(`admin_status_${user.id}`);
      console.log('ℹ️ User is not admin - backup cleared');
    }

    return isAdmin;
  } catch (error) {
    console.error('❌ Error in refreshGlobalAdminStatus:', error);
    
    // Try to restore from localStorage as fallback
    try {
      const fallbackSupabase = createClient();
      const { data: { user } } = await fallbackSupabase.auth.getUser();
      if (user) {
        const backupAdminStatus = localStorage.getItem(`admin_status_${user.id}`);
        if (backupAdminStatus === 'true') {
          console.log('✅ Admin status restored from localStorage fallback');
          return true;
        }
      }
    } catch (fallbackError) {
      console.error('❌ Fallback error:', fallbackError);
    }
    
    return false;
  }
}

/**
 * Check if current user has admin role
 * Returns boolean indicating admin status
 */
export async function checkCurrentUserAdminStatus(): Promise<boolean> {
  try {
    const supabase = createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return false;
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError) {
      // Check localStorage backup
      const backupAdminStatus = localStorage.getItem(`admin_status_${user.id}`);
      return backupAdminStatus === 'true';
    }

    const isAdmin = !!roleData;
    
    // Update localStorage backup
    if (isAdmin) {
      localStorage.setItem(`admin_status_${user.id}`, 'true');
    } else {
      localStorage.removeItem(`admin_status_${user.id}`);
    }

    return isAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    
    // Try localStorage fallback
    try {
      const fallbackSupabase = createClient();
      const { data: { user } } = await fallbackSupabase.auth.getUser();
      if (user) {
        const backupAdminStatus = localStorage.getItem(`admin_status_${user.id}`);
        return backupAdminStatus === 'true';
      }
    } catch (fallbackError) {
      console.error('❌ Fallback error:', fallbackError);
    }
    
    return false;
  }
}

/**
 * Clear admin status backup for current user
 * Useful during logout or role changes
 */
export async function clearAdminStatusBackup(): Promise<void> {
  try {
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      localStorage.removeItem(`admin_status_${user.id}`);
      console.log('🧹 Admin status backup cleared for user:', user.email);
    }
  } catch (error) {
    console.error('❌ Error clearing admin status backup:', error);
  }
}
