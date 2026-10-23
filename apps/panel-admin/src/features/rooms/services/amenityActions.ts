"use server";

import { createSupabaseServerClient } from "@hotel/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ROUTES } from "@/config/routes";
import { amenityService } from "./amenityService";

/**
 * Server Action to load the amenity catalog and the room's current selection.
 * Server-side like the writes, since session cookies are HttpOnly (P3.3).
 */
export async function getRoomAmenitiesFormDataAction(roomId: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    const [predefined, roomSelected] = await Promise.all([
      amenityService.getPredefinedAmenities(supabase),
      amenityService.getRoomAmenities(roomId, supabase),
    ]);
    return { data: { predefined, roomSelected }, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action to save room amenities selection.
 */
export async function saveRoomAmenitiesAction(roomId: string, amenityIds: string[]) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    await amenityService.saveRoomAmenities(roomId, amenityIds, supabase);
    revalidatePath(ROUTES.ADMIN.DASHBOARD);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action to add a custom amenity.
 */
export async function addCustomAmenityAction(name: string, icon?: string, description?: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    const newAmenity = await amenityService.addCustomAmenity(name, icon, description, supabase);
    return { data: newAmenity, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action to update a custom amenity.
 */
export async function updateCustomAmenityAction(
  id: string,
  name: string,
  icon: string,
  description?: string,
) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    const updatedAmenity = await amenityService.updateCustomAmenity(
      id,
      name,
      icon,
      description,
      supabase,
    );
    return { data: updatedAmenity, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action to delete a custom amenity.
 */
export async function deleteCustomAmenityAction(id: string) {
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  try {
    await amenityService.deleteCustomAmenity(id, supabase);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}
