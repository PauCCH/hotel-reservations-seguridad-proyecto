/**
 * @file room-catalog.ts — Maps the portal's mock room ids to public.rooms uuids.
 *
 * The portal renders rooms from its static mock catalog ("mv-1", "lf-2", …) but
 * `reservations.room_id` is a uuid FK to public.rooms. Sending the mock id made
 * every checkout fail with 22P02, so the availability check and the
 * `reservations_no_overlap` EXCLUDE constraint (A3.3 / OP-POC-5) never ran.
 *
 * The uuids are fixed and seeded by migration
 * `20261020000001_seed_portal_catalog_rooms.sql`; keep both in sync
 * (`room-catalog.test.ts` checks every mock room is mapped).
 */

export const ROOM_DB_ID: Readonly<Record<string, string>> = Object.freeze({
  "mv-1": "0a330000-0000-4000-8000-000000000101",
  "mv-2": "0a330000-0000-4000-8000-000000000102",
  "mv-3": "0a330000-0000-4000-8000-000000000103",
  "mv-4": "0a330000-0000-4000-8000-000000000104",
  "lf-1": "0a330000-0000-4000-8000-000000000201",
  "lf-2": "0a330000-0000-4000-8000-000000000202",
  "lf-3": "0a330000-0000-4000-8000-000000000203",
  "lf-4": "0a330000-0000-4000-8000-000000000204",
});

/**
 * Resolves catalog ids to their database uuids. Returns null when any id is
 * unknown, so the caller rejects the request instead of hitting the DB.
 */
export function toRoomDbIds(roomIds: string[]): string[] | null {
  const dbIds = roomIds.map((id) => ROOM_DB_ID[id]);
  return dbIds.every((id): id is string => id !== undefined) ? dbIds : null;
}
