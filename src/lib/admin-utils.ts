/**
 * Admin Status Verification Utility
 * Task 2.1 Security Fix - Removed localStorage fallback
 *
 * SECURITY: Admin status is ALWAYS verified server-side through Supabase auth
 * No client-side caching or localStorage fallbacks allowed
 */

import { createClient } from '@/lib/supabase/client';

// Throttling mechanism to prevent excessive calls
let lastRefreshTime = 0;
const REFRESH_THROTTLE_MS = 50; // 50ms minimum between calls

/**
 * Refresh admin status - ALWAYS checks server, never falls back to localStorage
 * SECURITY: This function must ALWAYS verify against Supabase, not cache
 */
export async function refreshGlobalAdminStatus(force = false): Promise<boolean> {
  try {
    // Throttle calls to prevent excessive database queries (unless forced)
    const now = Date.now();
    if (!force && now - lastRefreshTime < REFRESH_THROTTLE_MS) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏰ Admin status refresh throttled - too soon since last call');
      }
      // During throttle period, return false (safer default)
      // Do not check localStorage
      return false;
    }
    lastRefreshTime = now;

    const supabase = createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ No user found during admin status refresh');
      }
      return false;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Verifying admin status for user:', user.email);
    }

    // Check if user has admin role in database
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('❌ Error checking admin role:', roleError);
      // SECURITY: On error, return false, never fall back to localStorage
      return false;
    }

    const isAdmin = !!roleData;

    if (isAdmin) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ User verified as admin');
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('ℹ️ User is not admin');
      }
    }

    return isAdmin;
  } catch (error) {
    console.error('❌ Error in refreshGlobalAdminStatus:', error);
    // SECURITY: Always return false on error, never attempt localStorage fallback
    return false;
  }
}

/**
 * Check if current user has admin role
 * SECURITY: ALWAYS verifies against server, no localStorage fallback
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
      .maybeSingle();

    if (roleError) {
      console.error('❌ Error checking admin role:', roleError);
      // SECURITY: Return false on error, do not check localStorage
      return false;
    }

    const isAdmin = !!roleData;

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Admin status check: ${isAdmin ? '✅ Admin' : '❌ Not admin'}`);
    }

    return isAdmin;
  } catch (error) {
    console.error('❌ Error checking admin status:', error);
    // SECURITY: Return false on any error
    return false;
  }
}

/**
 * Clear any cached admin data
 * Called during logout or role changes
 */
export async function clearAdminStatusBackup(): Promise<void> {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🧹 Admin verification requested for user:', user.email);
      }
    }
  } catch (error) {
    console.error('❌ Error during admin status clear:', error);
  }
}
