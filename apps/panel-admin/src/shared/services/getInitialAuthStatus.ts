"use server";

import { getVerifiedSession, verifyAdminRole } from "@hotel/core/auth";
import type { AdminUser } from "@hotel/db";
import { createSupabaseServerClient } from "@hotel/db";
import { cookies } from "next/headers";

export const getInitialAuthStatus = async () => {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  // getUser() verifies the JWT against Supabase Auth; getSession() alone does not (AUTH-POC-2).
  const { session: initialSession, user: initialUser } = await getVerifiedSession(supabase);
  const initialProfile: AdminUser | null = initialUser
    ? await verifyAdminRole(initialUser.id)
    : null;

  return { initialSession, initialUser, initialProfile };
};
