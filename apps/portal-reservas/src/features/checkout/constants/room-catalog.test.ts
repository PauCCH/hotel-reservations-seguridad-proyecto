/**
 * @file room-catalog.test.ts — Keeps the mock catalog and the DB uuids in sync.
 *
 * If a mock room had no uuid the checkout would reject it (400); if the mapping
 * produced a non-uuid string the DB would reject it (22P02) and availability /
 * the EXCLUDE constraint (A3.3 / OP-POC-5) would silently stop working again.
 */

import { describe, expect, it } from "vitest";
// Relative on purpose: the portal's vitest config has no "@/" alias.
import { mockRooms } from "../../rooms/mock-data/rooms";
import { ROOM_DB_ID, toRoomDbIds } from "./room-catalog";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("room catalog → public.rooms uuid map", () => {
  it("maps every mock room to a valid, unique uuid", () => {
    const dbIds = mockRooms.map((room) => ROOM_DB_ID[room.id]);
    for (const id of dbIds) expect(id).toMatch(UUID);
    expect(new Set(dbIds).size).toBe(dbIds.length);
  });

  it("resolves known ids in order", () => {
    expect(toRoomDbIds(["lf-2", "mv-1"])).toEqual([ROOM_DB_ID["lf-2"], ROOM_DB_ID["mv-1"]]);
  });

  it("returns null when any id is unknown", () => {
    expect(toRoomDbIds(["mv-1", "not-a-room"])).toBeNull();
  });
});
