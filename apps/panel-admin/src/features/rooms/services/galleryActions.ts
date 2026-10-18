"use server";

import { createSupabaseServiceClient, DB_COLUMNS, DB_TABLES } from "@hotel/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/shared/auth/requirePermission";
import { PERMISSIONS } from "@/shared/constants/permissions";
import { GALLERY_CONFIG } from "../constants/gallery.constants";
import type { RoomImage } from "../domain/roomImage.interface";

// Cast required until `pnpm db:types` is run after applying the migration.
type AnyClient = SupabaseClient<any>;

export async function uploadImage(
  roomId: string,
  file: File,
): Promise<{ id: string; url: string; storagePath: string } | null> {
  // FIXED (A3.1 / OP-POC-2): enforce authorization server-side. These actions
  // use the service-role client (bypasses RLS), so without this guard any
  // authenticated session could write the public room gallery.
  await requirePermission(PERMISSIONS.ROOMS.MANAGE);

  try {
    const supabase = createSupabaseServiceClient() as unknown as AnyClient;

    const ext = file.name.split(".").pop();
    const storagePath = `${roomId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(GALLERY_CONFIG.BUCKET)
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("[galleryActions] Upload error:", uploadError);
      return null;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(GALLERY_CONFIG.BUCKET).getPublicUrl(storagePath);

    const { data: existingImages } = await supabase
      .from(DB_TABLES.ROOM_IMAGES)
      .select(DB_COLUMNS.room_images.position)
      .eq(DB_COLUMNS.room_images.room_id, roomId)
      .order(DB_COLUMNS.room_images.position, { ascending: false })
      .limit(1);

    const position = existingImages?.[0]?.position != null ? existingImages[0].position + 1 : 0;

    const { data: insertedRecord, error: insertError } = await supabase
      .from(DB_TABLES.ROOM_IMAGES)
      .insert({
        [DB_COLUMNS.room_images.room_id]: roomId,
        [DB_COLUMNS.room_images.storage_path]: storagePath,
        [DB_COLUMNS.room_images.url]: publicUrl,
        [DB_COLUMNS.room_images.position]: position,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[galleryActions] DB insert error:", insertError);
      await supabase.storage.from(GALLERY_CONFIG.BUCKET).remove([storagePath]);
      return null;
    }

    return {
      id: insertedRecord[DB_COLUMNS.room_images.id],
      url: insertedRecord[DB_COLUMNS.room_images.url],
      storagePath: insertedRecord[DB_COLUMNS.room_images.storage_path],
    };
  } catch (error) {
    console.error("[galleryActions] Unexpected error:", error);
    return null;
  }
}

export async function deleteImage(imageId: string): Promise<boolean> {
  await requirePermission(PERMISSIONS.ROOMS.MANAGE);

  const supabase = createSupabaseServiceClient() as unknown as AnyClient;

  const { data, error: fetchError } = await supabase
    .from(DB_TABLES.ROOM_IMAGES)
    .select(DB_COLUMNS.room_images.storage_path)
    .eq(DB_COLUMNS.room_images.id, imageId)
    .single();

  if (fetchError || !data) return false;

  const { error: deleteError } = await supabase
    .from(DB_TABLES.ROOM_IMAGES)
    .delete()
    .eq(DB_COLUMNS.room_images.id, imageId);

  if (deleteError) return false;

  await supabase.storage.from(GALLERY_CONFIG.BUCKET).remove([data.storage_path]);
  return true;
}

export async function reorderImages(orderedIds: string[]): Promise<boolean> {
  await requirePermission(PERMISSIONS.ROOMS.MANAGE);

  const supabase = createSupabaseServiceClient() as unknown as AnyClient;

  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase
        .from(DB_TABLES.ROOM_IMAGES)
        .update({ [DB_COLUMNS.room_images.position]: position })
        .eq(DB_COLUMNS.room_images.id, id),
    ),
  );

  return results.every(({ error }) => !error);
}

export async function getRoomImages(roomId: string): Promise<RoomImage[]> {
  const supabase = createSupabaseServiceClient() as unknown as AnyClient;

  const { data, error } = await supabase
    .from(DB_TABLES.ROOM_IMAGES)
    .select("*")
    .eq(DB_COLUMNS.room_images.room_id, roomId)
    .order(DB_COLUMNS.room_images.position, { ascending: true });

  if (error) return [];
  return data as RoomImage[];
}
