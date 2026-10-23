"use server";

import { createSupabaseServerClient } from "@hotel/db";
import { cookies } from "next/headers";
import type { RoomSchedule } from "../domain/schedule.interface";
import { scheduleService } from "./scheduleService";

/**
 * Server Action to load a room's check-in/check-out schedules.
 * Runs with the session cookie (HttpOnly since P3.3), same pattern as amenityActions.
 */
export async function getRoomSchedulesAction(
  roomId: string,
): Promise<{ data: RoomSchedule[]; error: string | null }> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    const data = await scheduleService.getRoomSchedules(roomId, supabase);
    return { data, error: null };
  } catch (error) {
    return { data: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action to replace a room's schedules.
 * Validates admin/owner role via RLS on the server side using the session cookie.
 */
export async function saveRoomSchedulesAction(
  roomId: string,
  schedules: { checkIn: string[]; checkOut: string[] },
): Promise<{ error: string | null }> {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    await scheduleService.saveRoomSchedules(roomId, schedules, supabase);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}
