import type { SupabaseServerClient } from "@hotel/db";
import type { RoomSchedule } from "@/features/rooms/domain/schedule.interface";

// Called only from Server Actions (scheduleActions.ts) with the cookie-bound server
// client: session cookies are HttpOnly since P3.3, so the browser client is anonymous
// and RLS would reject the writes.

export const scheduleService = {
  getRoomSchedules: async (
    roomId: string,
    client: SupabaseServerClient,
  ): Promise<RoomSchedule[]> => {
    const supabase = client as any;
    const { data, error } = await supabase.from("room_schedules").select("*").eq("room_id", roomId);

    if (error) throw new Error(error.message);
    return data as RoomSchedule[];
  },

  saveRoomSchedules: async (
    roomId: string,
    schedules: { checkIn: string[]; checkOut: string[] },
    client: SupabaseServerClient,
  ): Promise<void> => {
    const supabase = client as any;

    // 1. Delete existing schedules for this room to avoid duplicates
    const { error: deleteError } = await supabase
      .from("room_schedules")
      .delete()
      .eq("room_id", roomId);

    if (deleteError) throw new Error(deleteError.message);

    // 2. Insert the new schedules
    const checkInRecords = schedules.checkIn.map((time) => ({
      room_id: roomId,
      schedule_type: "check_in",
      // the DB expects "time without time zone", which accepts "HH:MM" or "HH:MM:SS"
      time_slot: time.length === 5 ? `${time}:00` : time,
    }));

    const checkOutRecords = schedules.checkOut.map((time) => ({
      room_id: roomId,
      schedule_type: "check_out",
      time_slot: time.length === 5 ? `${time}:00` : time,
    }));

    const allRecords = [...checkInRecords, ...checkOutRecords];

    if (allRecords.length > 0) {
      const { error: insertError } = await supabase.from("room_schedules").insert(allRecords);

      if (insertError) throw new Error(insertError.message);
    }
  },
};
