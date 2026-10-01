/**
 * @file route.ts — POST /api/reservations/lookup — public "find my reservation".
 *
 * ⚠️ See `lookupReservation.server.ts` for the OP-POC-1 controlled
 * vulnerability notice. This handler intentionally does not re-validate
 * `code`/`email` beyond presence, matching the real gap already documented
 * for `/api/checkout` (finding O9).
 */

import { lookupReservation } from "@/features/reservation-lookup";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; email?: unknown };

  const code = typeof body.code === "string" ? body.code : "";
  const email = typeof body.email === "string" ? body.email : "";

  if (!code || !email) {
    return Response.json({ results: [] }, { status: 400 });
  }

  const results = await lookupReservation({ code, email });
  return Response.json({ results }, { status: 200 });
}
