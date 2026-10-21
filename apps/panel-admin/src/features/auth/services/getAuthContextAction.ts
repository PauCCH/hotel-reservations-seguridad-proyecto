"use server";

import { getVerifiedSession, verifyAdminRole } from "@hotel/core/auth";
import { type AdminUser, createSupabaseServerClient } from "@hotel/db";
import type { Session, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type AuthContextData = {
  session: Session | null;
  user: User | null;
  profile: AdminUser | null;
};

export async function getAuthContextAction(): Promise<AuthContextData> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // getUser() verifies the JWT against Supabase Auth; getSession() alone does not (AUTH-POC-2).
  const { session, user } = await getVerifiedSession(supabase);
  const profile: AdminUser | null = user ? await verifyAdminRole(user.id) : null;

  return { session, user, profile };
}
