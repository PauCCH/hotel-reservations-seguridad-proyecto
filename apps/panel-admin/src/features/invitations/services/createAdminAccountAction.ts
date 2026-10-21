"use server";

import { createAdminAccount } from "@hotel/core/auth";
import { ENV } from "@/config/env";
import { ROUTES } from "@/config/routes";
import type { CreateAdminActionState } from "@/features/invitations/domain/adminInvite";
import { requirePermission } from "@/shared/auth/requirePermission";
import { PERMISSIONS } from "@/shared/constants/permissions";

export async function createAdminAccountAction(
  _prevState: CreateAdminActionState,
  formData: FormData,
): Promise<CreateAdminActionState> {
  // Server Actions are public endpoints: without this guard anyone could invite
  // (and, via promote_invited_admin, create) an admin (AUTH-POC-1 chain, P3.1).
  try {
    await requirePermission(PERMISSIONS.ADMINS.INVITE);
  } catch {
    return { error: "UNKNOWN_ERROR" };
  }

  const email = ((formData.get("email") as string) ?? "").trim();
  const full_name = ((formData.get("name") as string) ?? "").trim();

  try {
    await createAdminAccount(
      email,
      `${ENV.NEXT_PUBLIC_BASE_URL}${ROUTES.AUTH.ACTIVATE}`,
      full_name,
    );
    return { success: true, email };
  } catch {
    return { error: "UNKNOWN_ERROR" };
  }
}
