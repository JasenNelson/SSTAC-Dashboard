// engine_v2 frontend Lane 1: admin-gating helpers (Findings 8, 45).
// Wraps v1's requireAdmin pattern with engine_v2-specific return shapes:
//   - requireAdminForApi returns { client, user } on success OR a NextResponse on failure.
//   - requireAdminForServerComponent redirects on failure; returns { client, user } on success.
// Mirrors v1's src/lib/api-guards.ts conventions (createServerClient + cookies + user_roles).

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

async function getServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
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
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

async function checkAdminRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return Boolean(data);
}

export type RequireAdminApiSuccess = { client: SupabaseClient; user: User };
export type RequireAdminApiResult = RequireAdminApiSuccess | NextResponse;

// Use at the top of every v2 API route. Returns NextResponse on failure (caller MUST return it).
// Returns { client, user } on success.
export async function requireAdminForApi(): Promise<RequireAdminApiResult> {
  const client = await getServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = await checkAdminRole(client, user.id);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { client, user };
}

// Use at the top of every v2 Server Component. Redirects on failure (never returns).
// Returns { client, user } on success.
export async function requireAdminForServerComponent(): Promise<RequireAdminApiSuccess> {
  const client = await getServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    redirect("/login?next=/dashboard/engine-v2");
  }

  const isAdmin = await checkAdminRole(client, user.id);
  if (!isAdmin) {
    redirect("/dashboard?error=admin_required");
  }

  return { client, user };
}
