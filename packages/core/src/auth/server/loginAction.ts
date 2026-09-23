"use server";

/**
 * @fileoverview Server-side login action with profile fetch.
 *
 * Reusable login flow that handles signInWithPassword,
 * profile verification, and redirects.
 * Used by both panel-admin and portal-reservas.
 *
 * @example
 * ```ts
 * // In login page
 * import { loginAction } from "@hotel/core/auth";
 *
 * const result = await loginAction(email, password, {
 *   requireAdmin: true,
 *   redirectTo: "/dashboard",
 * });
 * ```
 */

import { createSupabaseServerClient } from "@hotel/db";
import type { Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUDIT_ACTIONS, logAuditEvent } from "../../audit";
import { verifyAdminRole } from "../index";
import type { AdminProfile, ClientProfile, LoginResult } from "../shared/types";

/**
 * Options for loginAction.
 */
export interface LoginActionOptions {
  /** Whether to require admin role (default: false for portal, true for admin) */
  requireAdmin?: boolean;
  /** URL to redirect after successful login */
  redirectTo?: string;
  /** Custom cookie store (defaults to next/headers) */
  cookieStore?: Awaited<ReturnType<typeof cookies>>;
}

/**
 * Server action: sign in with password and fetch profile.
 *
 * After successful login, returns LoginResult with session/user/profile.
 * Automatically redirects if redirectTo is provided.
 *
 * @param email - User email
 * @param password - User password
 * @param options - Login options
 * @returns LoginResult with session/user/profile or error
 *
 * @example
 * ```ts
 * // For admin login
 * const result = await loginAction(email, password, {
 *   requireAdmin: true,
 *   redirectTo: "/admin/dashboard",
 * });
 *
 * if (result.error) {
 *   console.error(result.error.message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // For client login (no admin required)
 * const result = await loginAction(email, password, {
 *   requireAdmin: false,
 *   redirectTo: "/profile",
 * });
 * ```
 */
export async function loginAction(
  email: string,
  password: string,
  options: LoginActionOptions = {},
): Promise<LoginResult> {
  const { requireAdmin = false, redirectTo, cookieStore = await cookies() } = options;

  const supabase = createSupabaseServerClient(cookieStore);

  // Sign in with password
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    await logAuditEvent({
      actorEmail: email,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: { email, reason: error?.message ?? "Invalid credentials" },
    });

    return {
      session: null,
      user: null,
      profile: null,
      isAdmin: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: error?.message || "Invalid credentials",
      },
    };
  }

  const session = data.session as Session;
  const user = data.user;

  await logAuditEvent({
    actorId: user.id,
    actorEmail: user.email ?? email,
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    metadata: { requireAdmin },
  });

  // Verify admin role if required
  if (requireAdmin) {
    const admin = await verifyAdminRole(user.id);

    if (!admin) {
      // Sign out if not admin
      await supabase.auth.signOut();

      return {
        session: null,
        user: null,
        profile: null,
        isAdmin: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "Access denied: admin role required",
        },
      };
    }

    // Redirect after successful admin login
    if (redirectTo) {
      redirect(redirectTo);
    }

    return {
      session,
      user,
      profile: admin as unknown as AdminProfile,
      isAdmin: true,
      error: null,
    };
  }

  // For non-admin logins, return success without redirect
  // (client app handles their own profile fetch)
  if (redirectTo) {
    redirect(redirectTo);
  }

  return {
    session,
    user,
    profile: null, // Client apps fetch their own profile
    isAdmin: false,
    error: null,
  };
}

/**
 * Login form action for React Server Actions.
 *
 * Use this when needing Zod-form integration with formData.
 *
 * @example
 * ```ts
 * // In login form component
 * <form action={loginFormAction}>
 * ```
 */
export async function loginFormAction(formData: FormData): Promise<LoginResult> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  return loginAction(email, password);
}
