"use server";

/**
 * @file loginAction.ts — Server Action for email/password login.
 *
 * Called by LoginForm via React 19's useActionState. Handles:
 * 1. Standard email/password authentication via Supabase.
 * 2. Email-not-confirmed flow: auto-resends verification email and redirects.
 * 3. Rate limit handling for verification email resends.
 *
 * On success, redirects to the callback URL or home.
 * On failure, returns an i18n error key for the form to display.
 * Every attempt is recorded in the audit trail (P3.4, AUTH-POC-6 rules).
 */

import { AUDIT_ACTIONS } from "@hotel/core/audit";
import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit/server";
import {
  buildFailedLoginMetadata,
  loginFailureReasonFromAuthError,
  resolveSafeRedirectPath,
} from "@hotel/core/auth";
import { createSupabaseServerClient } from "@hotel/db";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ENV } from "@/config/env";
import { ROUTES } from "@/config/routes";
import { AUTH_ERRORS, ERROR_KEYS } from "../constants/errors";
import { LOGIN_FORM_FIELDS } from "../constants/loginFormFields";
import { SUPABASE_ERROR_CODES } from "../constants/supabaseErrors";
import type { LoginActionState } from "../domain/credentials";

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  // Extract form fields using constant names (zero magic strings).
  const email = formData.get(LOGIN_FORM_FIELDS.EMAIL) as string;
  const password = formData.get(LOGIN_FORM_FIELDS.PASSWORD) as string;
  const callbackUrl = formData.get(LOGIN_FORM_FIELDS.CALLBACK_URL) as string;

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { ipAddress, userAgent } = await getAuditRequestContext();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // No actor for a failed attempt; typed email only in metadata (if well formed).
    await logAuditEvent({
      actorEmail: null,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
      metadata: buildFailedLoginMetadata(email, loginFailureReasonFromAuthError(error)),
      ipAddress,
      userAgent,
    });
  }

  if (error) {
    // Special handling: email not confirmed — try to resend verification email.
    if (error.code === SUPABASE_ERROR_CODES.EMAIL_NOT_CONFIRMED) {
      const origin = (await headers()).get("origin") ?? ENV.APP_URL;
      const redirectUrl = `${origin}${ROUTES.AUTH.CALLBACK}`;
      const response = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: { emailRedirectTo: redirectUrl },
      });
      // If resend succeeded, redirect to verify-email page.
      if (!response.error) redirect(ROUTES.AUTH.VERIFY_EMAIL);

      // Rate limit error (HTTP 429): tell the user to wait.
      if (response.error.code === "over_email_send_rate_limit") {
        return { error: ERROR_KEYS[AUTH_ERRORS.VERIFY_EMAIL_RATE_LIMIT] };
      }

      return { error: ERROR_KEYS[AUTH_ERRORS.UNKNOWN_ERROR] };
    }
    // All other login errors: invalid credentials.
    return { error: ERROR_KEYS[AUTH_ERRORS.INVALID_CREDENTIALS] };
  }

  if (!data.user) {
    return { error: ERROR_KEYS[AUTH_ERRORS.UNKNOWN_ERROR] };
  }

  await logAuditEvent({
    actorId: data.user.id,
    actorEmail: data.user.email ?? null,
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    metadata: { app: "portal-reservas" },
    ipAddress,
    userAgent,
  });

  // Success: redirect to the callback URL (from "redirect after login" flow) or home.
  // AUTH-POC-5 (P3.3): only same-origin paths; absolute or `//host` values fall back to home.
  redirect(resolveSafeRedirectPath(callbackUrl, ROUTES.HOME));
}
