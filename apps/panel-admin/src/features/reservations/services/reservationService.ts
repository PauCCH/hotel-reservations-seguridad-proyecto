import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@hotel/core/audit";
import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit/server";
import { getVerifiedSession } from "@hotel/core/auth";
import { createSupabaseServerClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";
import { createSupabaseServiceClient } from "@hotel/db/client";
import { cookies } from "next/headers";
import { requirePermission } from "@/shared/auth/requirePermission";
import { PERMISSIONS } from "@/shared/constants/permissions";
import { RESERVATION_STATUS } from "../constants/reservation-statuses";
import type { Reservation, ReservationStatus } from "../domain/reservation";
import { RESERVATIONS_TEXTS } from "../i18n/reservations.texts";
import {
  type DbReservation,
  mapToReservation,
  type ReservationStatusUpdate,
} from "./reservation.mapper";

const ERRORS = RESERVATIONS_TEXTS.es.ERRORS;

export async function getAllReservations(): Promise<Reservation[]> {
  await requirePermission(PERMISSIONS.RESERVATIONS.VIEW);

  const supabase = createSupabaseServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .select(`*, ${DB_TABLES.ROOMS}(${DB_COLUMNS.rooms.name}, ${DB_COLUMNS.rooms.category})`) //"*, rooms(name, category)")
    .order(DB_COLUMNS.reservations.code, { ascending: false });

  if (error) throw new Error(`${ERRORS.FETCH_RESERVATIONS}: ${error.message}`);

  return (data as DbReservation[]).map(mapToReservation);
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
  cancellationReason?: string,
): Promise<void> {
  await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);

  const supabase = createSupabaseServiceClient();

  // A3.4: read the current status first so the audit event records from → to.
  const { data: previous } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .select(DB_COLUMNS.reservations.status)
    .eq(DB_COLUMNS.reservations.id, id)
    .maybeSingle();

  const updateData: ReservationStatusUpdate = {
    status,
    updated_at: new Date().toISOString(),
    ...(status === RESERVATION_STATUS.CANCELLED && cancellationReason
      ? { cancellation_reason: cancellationReason }
      : {}),
  };

  const { error } = await supabase
    .from(DB_TABLES.RESERVATIONS)
    .update(updateData)
    .eq(DB_COLUMNS.reservations.id, id);

  if (error) throw new Error(`${ERRORS.UPDATE_STATUS}: ${error.message}`);

  // A3.4 / OP-POC-6: audit the change with the verified admin as actor. Only
  // existing reservations are logged (an unknown id updates no row).
  if (!previous) return;

  const { user } = await getVerifiedSession(createSupabaseServerClient(await cookies()));
  const { ipAddress, userAgent } = await getAuditRequestContext();
  const isCancellation = status === RESERVATION_STATUS.CANCELLED;

  await logAuditEvent({
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? null,
    action: isCancellation
      ? AUDIT_ACTIONS.RESERVATION_CANCELLED
      : AUDIT_ACTIONS.RESERVATION_UPDATED,
    entity: AUDIT_ENTITIES.RESERVATION,
    entityId: id,
    metadata: {
      from: (previous as { status: string }).status,
      to: status,
      ...(isCancellation && cancellationReason ? { cancellation_reason: cancellationReason } : {}),
    },
    ipAddress,
    userAgent,
  });
}

export async function getReservationById(id: string): Promise<Reservation | null> {
  await requirePermission(PERMISSIONS.RESERVATIONS.VIEW);

  const supabase = createSupabaseServiceClient();

  const { data, error } = await (supabase as any)
    .from("reservations")
    .select("*, rooms(name, category)")
    .eq("id", id)
    .single();

  if (error) return null;

  return mapToReservation(data as DbReservation);
}

export async function getRoomNames(): Promise<string[]> {
  const supabase = createSupabaseServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase
    .from(DB_TABLES.ROOMS)
    .select(DB_COLUMNS.rooms.name)
    .order(DB_COLUMNS.rooms.name, { ascending: true });

  if (error) throw new Error(`${ERRORS.FETCH_ROOMS}: ${error.message}`);

  const names = (data as { name: string }[]).map((r) => r.name);
  return Array.from(new Set(names));
}
