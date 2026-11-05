# Fase 3 — Reporte de Parches · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Ramas | `security/operations/fase3-parches` (A3.1–A3.3, creada **desde** `security/operations/fase2-pocs` para aplicar los fixes sobre las vulnerabilidades introducidas/reales y comprobar que la PoC deja de funcionar — §4.1) · `security/operations/fase3-checkout-rooms-catalog` (A3.3, catálogo de habitaciones) · `security/operations/fase3-audit-logging` (A3.4) |
| Pull Requests | [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12) (A3.1–A3.3) · [#15](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/15) (bitácora) · [#16](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/16) (catálogo de habitaciones) · [#23](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/23) (A3.4) · [#33](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/33) (A3.8) — todos mergeados a `develop` |
| Insumo | `operations/fase-2-pocs.md` (OP-POC-1 … OP-POC-6) |
| Estado | A3.1–A3.6 completas y mergeadas a `develop`; los 6 hallazgos (OP-POC-1…6) parcheados y re-probados. A3.8 (OP-R05 y OP-R07, riesgos de Fase 1) en la rama `security/operations/fase3-op-r05-r07`, PR [#33](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/33) mergeado a `develop` (`6f43035`). A3.7 (video) grabado. |

> Formato por parche según §4.6: ficha · mapeo · diff antes/después · prueba de regresión · riesgo residual.

---

## Resumen de riesgo residual

| PoC | Vector | Parche | Riesgo residual |
|---|---|---|---|
| OP-POC-1 | 1 — inyección/IDOR | Filtro parametrizado `.eq()` | **Bajo** |
| OP-POC-2 | 1 — control de acceso | `requirePermission(ROOMS.MANAGE)` | **Bajo** |
| OP-POC-3 | 2 — XSS stored | Escape de salida (`{guest.notes}`) | **Bajo** |
| OP-POC-4 | 3 — CSRF | Verificación de `Origin` | **Medio** (sin token anti-CSRF ni rate limiting) |
| OP-POC-5 | 3 — manipulación de parámetros | Esquema Zod + capacidad (fechas/aforo); disponibilidad + `EXCLUDE` + catálogo de rooms reconciliado | **Bajo** (fechas/aforo y disponibilidad/TOCTOU verificados en vivo, ver A3.3) |
| OP-POC-6 | 3 — evasión de auditoría | `logAuditEvent` en creación y cambio de estado de reservas, saneado por la API (A3.4) | **Bajo** (verificado en vivo, ver A3.4) |
| OP-R05 | Riesgo de Fase 1 (sin PoC propia) | `VALID_TRANSITIONS` en el servidor + `UPDATE` condicional + trigger en la base (A3.8) | **Bajo** (verificado en vivo, ver A3.8) |
| OP-R07 | Riesgo de Fase 1 (sin PoC propia) | `BookingMode` validado en el servidor + `CHECK` en la base + auditoría del cambio (A3.8) | **Bajo** (verificado en vivo, ver A3.8) |

---

## A3.1 — OP-POC-1 · Inyección en el filtro de "consultar mi reserva" → IDOR

**Ficha.** Responsable: Aarón · Módulo: operations · Rama: `security/operations/fase3-parches` · Commit: `1f43498` · PR: [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12).

**Mapeo.** OWASP A03 (injection, clase PostgREST) + A01 (IDOR). NIST CSF 2.0: PR.DS-10, PR.AA-05, ID.RA-01.
Archivo: `apps/portal-reservas/src/features/reservation-lookup/services/lookupReservation.server.ts`.

**Diff (antes → después).**
```ts
// ANTES (vulnerable): sintaxis de filtro inyectable por concatenación
const filter = `${c.code}.ilike.%${input.code}%,${c.guest_email}.ilike.%${input.email}%`;
const { data } = await supabase.from(DB_TABLES.RESERVATIONS).select(/* … */).or(filter).limit(50);

// DESPUÉS (A3.1): filtros parametrizados AND'd — los valores van como literales
const { data } = await supabase
  .from(DB_TABLES.RESERVATIONS)
  .select(/* … */)
  .eq(c.code, input.code)
  .eq(c.guest_email, input.email)
  .limit(50);
```

**Prueba de regresión.** `lookupReservation.server.test.ts` reescrito: ahora verifica que `.or()` **no** se
invoca y que el payload de ataque (`email = "a,status.ilike.%"`) llega a `.eq()` como valor literal. La PoC
original (devolver todas las filas) ya no es posible. `pnpm --filter @hotel/portal-reservas exec vitest run
src/features/reservation-lookup` → 2/2 en verde.

**Riesgo residual: Bajo.** El vector de inyección y el IDOR quedan neutralizados en código. Queda una laxitud
de configuración independiente: la consulta aún corre como cliente **service-role** (la tabla es deny-all bajo
RLS). Acotar ese acceso (RLS específica o función `SECURITY DEFINER` que devuelva solo la reserva del dueño)
se deja como mejora de menor privilegio; no reabre la PoC. Hermano del fix F3.1 de Fabian (`getAuditLogs`).

---

## A3.1 (cont.) — OP-POC-2 · `galleryActions` sin verificación de permisos

**Ficha.** Responsable: Aarón · Rama: `security/operations/fase3-parches` · Commit: `1f43498` · PR: [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12). (Parchado junto a OP-POC-1 por ser el otro hallazgo de servidor.)

**Mapeo.** OWASP A01. NIST CSF 2.0: PR.AA-05, DE.CM-03. Archivo:
`apps/panel-admin/src/features/rooms/services/galleryActions.ts` (`uploadImage`, `deleteImage`, `reorderImages`).

**Diff.**
```ts
// ANTES: Server Action con cliente service-role, sin guard de autorización
export async function deleteImage(imageId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient() as unknown as AnyClient;
  // …

// DESPUÉS (A3.1): autorización server-side antes de tocar datos
export async function deleteImage(imageId: string): Promise<boolean> {
  await requirePermission(PERMISSIONS.ROOMS.MANAGE);
  const supabase = createSupabaseServiceClient() as unknown as AnyClient;
  // …
```

**Prueba de regresión (en vivo, Supabase local, 2026-11-01)** — `evidencias/A3.1-A3.2-regression-live.txt`:
se repitió exactamente el replay de la Fase 2 (`Next-Action: 4092c2ef…f3be`, mismo id de `deleteImage`) con
la cuenta `sec.admin.norooms@hotel.local` (sin `rooms:manage`) sobre una imagen de prueba. Antes: HTTP 200,
`true` y fila borrada. Ahora: `PermissionDeniedError: Permission denied: rooms:manage` desde
`requirePermission` y la fila **sigue en la BD**. Las tres escrituras pasan por el mismo guard.

**Riesgo residual: Bajo.** La autorización ya no depende solo de la UI. Nota de defensa en profundidad: el
middleware del panel (dueño: Paula) sigue sin verificar rol; `requirePermission` es independiente de ese
middleware y lo cubre a nivel de acción.

---

## A3.2 — OP-POC-3 · XSS stored vía notas del huésped (Vector 2)

**Ficha.** Responsable: Aarón · Rama: `security/operations/fase3-parches` · Commit: `ceda94a` · PR: [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12).

**Mapeo.** OWASP A03 (XSS stored). NIST CSF 2.0: PR.DS-01, PR.PS-06, DE.CM-09. Archivo:
`apps/panel-admin/src/features/reservations/components/detail/ReservationGuestCard/ReservationGuestCard.tsx`.

**Diff.**
```tsx
// ANTES (sink): HTML del huésped sin escapar, ejecuta en la sesión del admin
<span className={STYLES.fieldValue} dangerouslySetInnerHTML={{ __html: guest.notes }} />

// DESPUÉS (A3.2 de salida): render como texto — React escapa
<span className={STYLES.fieldValue}>{guest.notes}</span>
```

**Prueba de regresión (en vivo, Supabase local, 2026-11-01)** — `evidencias/A3.1-A3.2-regression-live.txt`:
la reserva `581567fd…` tiene en `guest_notes` el payload `<img src=x onerror=alert(document.cookie)>` + una
línea falsa. Al abrir su detalle en el panel, el DOM muestra el payload como **texto literal** y contiene
**0** elementos `img[onerror]` y **0** `img[src="x"]`. Antes (Fase 2, `A2.2-xss-executed-panel.png`) el
mismo tipo de payload se ejecutaba. No se agregó un test de render de componente porque el vitest del panel
corre en `environment: node` (sin jsdom/RTL) y cambiarlo tocaría configuración compartida (§4.4).

**Riesgo residual: Bajo.** El XSS queda neutralizado por el escape por defecto de React. Como el almacenamiento
del valor crudo es legítimo, no se requiere más. Defensa en profundidad ya activa: la **CSP** global con nonce
de Paula (P3.2, PR #20) está presente en la respuesta del panel (`script-src 'self' 'nonce-…' 'strict-dynamic'`)
y bloquearía cualquier handler inline residual; F3.2 de Fabian aplicó el mismo patrón en el visor de auditoría.

---

## A3.3 — OP-POC-4 · CSRF en `POST /api/checkout` (Vector 3)

**Ficha.** Responsable: Aarón · Rama: `security/operations/fase3-parches` · Commit: `e90807b` · PR: [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12).

**Mapeo.** OWASP A08. NIST CSF 2.0: PR.PS-06, DE.CM-09. Archivo:
`apps/portal-reservas/src/app/api/checkout/route.ts`.

**Diff.**
```ts
// ANTES: route handler sin ninguna defensa de origen
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as CheckoutSessionPayload;
  const result = await openGatewaySession(payload);
  return Response.json(result.body, { status: result.status });
}

// DESPUÉS (A3.3): rechaza peticiones cross-site por cabecera Origin
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== ENV.APP_URL) {
    return Response.json({ error: CHECKOUT_API_ERROR.FORBIDDEN_ORIGIN },
      { status: CHECKOUT_HTTP_STATUS.FORBIDDEN });
  }
  // … resto igual
}
```

**Prueba de regresión (en vivo, Supabase local).** La misma petición de la PoC con un `Origin` ajeno ahora
recibe **403** y no crea reserva: caso 10 de `evidencias/A3.3-rooms-catalog-live.txt` (2026-10-20) y caso 2
de `evidencias/A3.4-audit-logging-live.txt` (2026-10-24, `Origin: https://evil.example` → 403, sin fila ni
evento).

**Riesgo residual: Medio.** La verificación de `Origin` es una defensa estándar y suficiente contra el CSRF
basado en navegador, pero no es un token anti-CSRF ni añade rate limiting; un cliente que falsee cabeceras
fuera del navegador no está cubierto (fuera del modelo de amenaza de CSRF). Las cookies de sesión ya son
`SameSite=Lax` (P3.3 de Paula, PR #21), lo que suma una segunda barrera en el navegador, pero el checkout es
anónimo y no depende de esa cookie.

---

## A3.3 (cont.) — OP-POC-5 · Manipulación de parámetros del checkout (Vector 3)

**Ficha.** Responsable: Aarón · Rama: `security/operations/fase3-parches` · Commits: `e90807b` (esquema Zod, capacidad, disponibilidad), `08eae14` (restricción `EXCLUDE`) · PR: [#12](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/12).

**Mapeo.** OWASP A08 + A04 (insecure design). NIST CSF 2.0: PR.DS-01, PR.PS-06, ID.RA-01. Archivos:
`apps/portal-reservas/src/features/checkout/domain/checkoutSchema.ts` (nuevo),
`.../services/gateway.server.ts`, `.../services/createReservation.server.ts`.

**Diff (resumen).**
```ts
// ANTES: se persistía lo que mandara el cliente, sin reglas de negocio.

// DESPUÉS (A3.3):
// 1) Esquema Zod estricto antes de confiar en nada:
const parsed = checkoutPayloadSchema.safeParse(payload); // fechas futuras, check_out>check_in, guests>=1
if (!parsed.success) return { status: 400, body: { error: INVALID_REQUEST } };
// 2) Capacidad: guests <= suma de room.capacity  → 400
// 3) Disponibilidad: sin solapamiento con reservas no canceladas → 409
if (!(await areRoomsAvailable(input.roomIds, input.checkIn, input.checkOut)))
  return { status: 409, body: { error: UNAVAILABLE } };
```

**Prueba de regresión.** `checkoutSchema.test.ts` (5 casos): acepta reserva futura válida; rechaza check-in en
el pasado, rango invertido, `guests = 0` y lista de habitaciones vacía. En verde (5/5). El **precio** ya se
recalculaba server-side desde el catálogo (no era manipulable), por lo que ese sub-vector no requería parche.
El test cubre el esquema Zod; el camino de disponibilidad (`areRoomsAvailable`) y la restricción `EXCLUDE`
se verifican en vivo contra la BD (ver "Reconciliación del catálogo" abajo), y `room-catalog.test.ts`
mantiene sincronizado el mapa catálogo → uuid.

**Riesgo residual (historial — primera verificación, 2026-10-20 en Supabase local, antes de `ce54581`):**
- **Fechas / aforo → Bajo (verificado).** El esquema Zod (fechas futuras, `check_out > check_in`, `guests ≥ 1`)
  y la validación de capacidad (`guests ≤ Σ room.capacity`, sobre `mockRooms` en memoria) corren antes de
  cualquier acceso a BD y rechazan la PoC con `400`. El precio sigue recalculado server-side.
- **Disponibilidad / overbooking / TOCTOU → ⚠️ No verificado (control inalcanzable).** `areRoomsAvailable`
  ejecuta `.in("room_id", ["mv-1"])` y `persistReservation` inserta `room_id = "mv-1"` (id de `mockRooms`),
  **pero `reservations.room_id` es `uuid NOT NULL` con FK a `rooms`**. Resultado real (reproducido): ambas
  consultas fallan con **`22P02` (invalid input syntax for type uuid)**. Como `areRoomsAvailable` hace
  *fail-closed*, **todo checkout responde `409`**, y el insert nunca alcanza el `EXCLUDE`, por lo que la
  violación `23P01` que cierra el TOCTOU **nunca se dispara**. Es decir: la restricción `reservations_no_overlap`
  está creada pero es **código muerto** mientras el portal reserve contra el catálogo `mockRooms` (ids string)
  en vez de la tabla `rooms` (ids uuid). Efecto colateral: **el checkout queda roto para toda reserva legítima**
  (siempre `409`). La afirmación anterior de "TOCTOU cerrado a nivel DB / Bajo" **no está sustentada** hasta
  reconciliar el modelo de habitaciones.

### Reconciliación del catálogo de habitaciones (cierra el "no verificado")

**Ficha.** Responsable: Aarón · Rama: `security/operations/fase3-checkout-rooms-catalog` · Commit: `ce54581` · PR: [#16](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/16).

**Decisión.** Opción A: enlazar el catálogo del portal con filas reales de `rooms`. Se descartó la opción B
(`reservations.room_id` → `text`) porque eliminaba la FK a `rooms`: debilitaba la integridad referencial para
tapar un bug.

**Diff (resumen).**
```ts
// Migración 20261020000001_seed_portal_catalog_rooms.sql: las 8 habitaciones del catálogo en public.rooms
// con uuid FIJO (Family → Deluxe, Villa → Suite por el CHECK de category), idempotente (ON CONFLICT DO NOTHING).

// constants/room-catalog.ts — mapa server-side catálogo → uuid
export const ROOM_DB_ID = { "mv-1": "0a330000-…-000000000101", /* … 8 entradas */ };

// gateway.server.ts
const roomDbIds = toRoomDbIds(input.roomIds);          // id desconocido → 400
if (!(await areRoomsAvailable(roomDbIds, …)))           // ANTES: input.roomIds ("mv-1") → 22P02 → 409 siempre
const persisted = await persistReservation(input, rooms, roomDbIds, nights);

// createReservation.server.ts — ANTES: un solo insert con room_id = rooms[0].id ("mv-1")
// DESPUÉS: una fila por habitación en UNA sentencia → el EXCLUDE protege todas, no solo la primera,
// y un conflicto en cualquiera revierte la reserva completa.
supabase.from(RESERVATIONS).insert(rooms.map((room, i) => ({ room_id: roomDbIds[i], … })));
```

**Prueba de regresión (en vivo, Supabase local, 2026-10-20)** — `evidencias/A3.3-rooms-catalog-live.txt`:

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | Checkout legítimo `mv-1` | 200 + fila persistida | ✅ 200, `RES-0xx` con `room_id` uuid |
| 2 | Mismo cuarto, fechas solapadas | 409 | ✅ 409 |
| 3 | Estadía consecutiva (check-in = check-out previo) | 200 | ✅ 200 (`daterange '[)'`) |
| 4 | **Carrera TOCTOU:** 5 checkouts en paralelo | 1 fila | ✅ 1×200 + 4×409, 1 fila |
| 5 | INSERT directo solapado (salta la app) | `23P01` | ✅ `reservations_no_overlap` dispara |
| 6 | Multi-habitación `[lf-1, lf-2]` | 200 + 2 filas | ✅ |
| 7 | Multi-habitación solapando `lf-2` | 409, sin fila parcial | ✅ `lf-3` sin fila |
| 8 | Habitación desconocida | 400 | ✅ |
| 9 | Regresión: fecha 2020 / aforo 99 | 400 / 400 | ✅ |
| 10 | Regresión OP-POC-4: `Origin` ajeno | 403 | ✅ |

Automatizado: `room-catalog.test.ts` (3 casos: todo el catálogo mapeado a uuid válido y único, orden,
id desconocido → `null`). En verde junto a `checkoutSchema.test.ts` (8/8).

**Riesgo residual de OP-POC-5: Bajo.** Fechas, aforo y disponibilidad se validan server-side, y la
exclusión a nivel de BD (`EXCLUDE`) es la autoridad final ante la carrera TOCTOU: con la app saltada
(caso 5) la BD sigue rechazando el doble-booking. **Límites declarados:**
- En el caso 4, HTTP no distingue si cada 409 vino de la app o del `EXCLUDE`. Lo que se verifica es el invariante
  (1 sola fila), y el caso 5 prueba la restricción por separado.
- Cada habitación del catálogo es **una unidad** en BD. El `inventory` del mock (ej. 8 cabañas `mv-1`) no se
  modela; es una decisión de producto, no de seguridad.
- El catálogo del portal sigue siendo estático. El mapa y la migración deben mantenerse sincronizados; el test
  cubre el lado del portal.

---

## A3.4 — OP-POC-6 · Evasión de los registros de auditoría

**Ficha.** Responsable: Aarón · Módulo: operations · Rama: `security/operations/fase3-audit-logging`
(desde `develop@1e6ce17`) · Commits: `1dba1a7` (auditoría), `7e84d9a` (endurecimiento `"use server"`), `5fe93b7` (docs y evidencia) · PR: [#23](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/23), aprobado por Fabian (G3.3).

**Mapeo.** OWASP A09 (Security Logging and Monitoring Failures) + A08/CWE-117 (log injection, cubierto por la
API). NIST CSF 2.0: DE.CM-09, DE.AE-03, PR.PS-04. Archivos:
`apps/portal-reservas/src/features/checkout/services/gateway.server.ts`,
`apps/portal-reservas/src/features/checkout/services/createReservation.server.ts`,
`apps/panel-admin/src/features/reservations/services/reservationService.ts`.

**Desbloqueo.** Fabian publicó en `develop` (PR #18) la API `@hotel/core/audit/server`, el saneo al escribir
(`audit/shared/sanitize.ts`: CR/LF y caracteres de control → espacio, corte a 512) y las constantes
`RESERVATION_*` (`audit/guia-api-auditoria.md`). A3.4 la usa tal cual; no se duplica el saneo.

**Qué se registra.**

| Evento | Dónde | Actor | `metadata` |
|---|---|---|---|
| `reservation.created` (uno por fila/habitación) | `openGatewaySession`, después de que `persistReservation` inserta | `null` (el checkout es anónimo) | `source`, `room_id`, `check_in`, `check_out`, `nights`, `guests`, `total_amount` |
| `reservation.updated` | `updateReservationStatus`, después de `requirePermission(reservations:edit)` y del `UPDATE` | admin verificado (`getVerifiedSession` → `getUser()`) | `from`, `to` |
| `reservation.cancelled` | ídem, cuando `to = cancelled` | ídem | `from`, `to`, `cancellation_reason` |

Decisiones (reglas §5 de la guía):
- **Sin PII ni texto libre del huésped** en el evento de creación: ni nombre, ni email, ni teléfono, ni
  `guest_notes` (el vector de OP-POC-3). Tampoco el `code` de la reserva, que junto al email permite consultarla
  (OP-POC-1). Solo valores ya validados por Zod o calculados en servidor.
- El email del huésped **no** va en `actorEmail` (sería el objetivo, no quien actúa).
- `cancellation_reason` sí se guarda (lo escribe un admin autenticado y es la justificación del cambio); la API
  lo sanea al escribir.
- Solo se registra lo que ocurrió: un checkout rechazado (400/403/409), un `UPDATE` fallido, un id inexistente o
  un admin sin permiso no generan evento.
- `logAuditEvent` se llama desde `gateway.server.ts` y `reservationService.ts`, que **no** son módulos
  `"use server"` (regla §1 de la guía).
- **Endurecimiento:** se quita `"use server"` de `createReservation.server.ts`. Con esa directiva,
  `persistReservation` y `areRoomsAvailable` podían quedar expuestas como Server Actions públicas, invocables sin
  el chequeo de `Origin` ni la validación Zod del route handler. No se demostró la explotación; se elimina la
  superficie porque el archivo solo lo importa `gateway.server.ts`. Re-test en vivo tras el cambio: checkout →
  200 y `reservation.created` (seq 10), cadena íntegra.

**Diff (antes → después).**
```ts
// ANTES: persistReservation no devolvía nada y nadie registraba la reserva.
const { error } = await supabase.from(RESERVATIONS).insert(rows);
return { ok: true };

// DESPUÉS: devuelve las filas creadas y el gateway registra una por habitación.
const { data, error } = await supabase.from(RESERVATIONS).insert(rows).select("id, room_id");
return { ok: true, reservations: data };
// gateway.server.ts
for (const reservation of persisted.reservations) {
  await logAuditEvent({ actorId: null, actorEmail: null, action: AUDIT_ACTIONS.RESERVATION_CREATED,
    entity: AUDIT_ENTITIES.RESERVATION, entityId: reservation.id, metadata: { room_id, check_in, … },
    ipAddress, userAgent });
}
```
```ts
// ANTES: updateReservationStatus cambiaba el estado sin dejar rastro.
await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);
await supabase.from(RESERVATIONS).update(updateData).eq("id", id);

// DESPUÉS: lee el estado previo, actualiza y registra from → to con el admin verificado.
const { data: previous } = await supabase.from(RESERVATIONS).select("status").eq("id", id).maybeSingle();
await supabase.from(RESERVATIONS).update(updateData).eq("id", id);
if (!previous) return;
const { user } = await getVerifiedSession(createSupabaseServerClient(await cookies()));
await logAuditEvent({ actorId: user?.id, action: isCancellation ? RESERVATION_CANCELLED : RESERVATION_UPDATED,
  entityId: id, metadata: { from: previous.status, to: status, … }, ipAddress, userAgent });
```

**Prueba de regresión (Vitest).**
- `apps/portal-reservas/src/features/checkout/services/gateway.server.test.ts` (4 casos): un evento
  `reservation.created` por fila con actor nulo y metadata exacta; el payload de OP-POC-3/AUD-POC-6
  (`<img onerror>` + `\r\n` + línea falsa) y la PII del huésped **no** aparecen en el evento; 409 y payload
  inválido no registran nada.
- `apps/panel-admin/tests/reservations/updateReservationStatus.test.ts` (5 casos): aprobación →
  `reservation.updated` con `from/to` y el admin real; cancelación → `reservation.cancelled` con motivo; sin
  `reservations:edit`, con `UPDATE` fallido o con id inexistente → sin evento. (Desde A3.8 el id inexistente
  además lanza `ReservationNotFoundError`; ver A3.8.)
- Suites completas en verde: portal 66/66, panel 24/24. Type-check sin errores nuevos (los de `@hotel/db` y
  galería son preexistentes de `develop`).

**Prueba de regresión (en vivo, Supabase local, 2026-10-24)** — `evidencias/A3.4-audit-logging-live.txt`:

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | Checkout `[mv-3, lf-4]` con XSS + CR/LF en nombre y notas | 200 + 2 × `reservation.created`, sin PII ni payload | ✅ seq 4 y 5, actor nulo; búsqueda de PII/payload en `metadata` → 0 |
| 2 | Mismo checkout con `Origin` ajeno / fechas ocupadas | 403 / 409, sin evento | ✅ `max(seq)` sigue en 5 |
| 3 | Aprobar reserva en el panel (owner) | `reservation.updated` con `from/to` y actor | ✅ seq 7, `pending → approved`, `sec.owner@hotel.local` |
| 4 | Cancelar con motivo que trae CR/LF | `reservation.cancelled`, motivo en una línea | ✅ seq 8; CR/LF en el log: no (en `reservations`: sí) |
| 5 | Visor `/admin/audit-log` | Los 4 eventos visibles | ✅ |
| 6 | `verify_audit_chain()` | Cadena íntegra | ✅ `NULL` |

El caso "admin sin `reservations:edit`" no se repitió en vivo; lo cubre el test del panel.

**Contraste con la PoC de la Fase 2.** En el código anterior (`develop@1e6ce17`) las mismas acciones —checkout
con una línea falsa en las notas y cancelación desde el panel— crean y cancelan reservas sin escribir ningún
evento (`evidencias/A2.3-OP-POC-6-audit-evasion-live.txt`). Con A3.4, cada una queda registrada y el texto
saneado: la PoC original ya no evade la auditoría.

**Riesgo residual de OP-POC-6: Bajo (verificado en vivo).** El módulo ya deja
rastro de cada creación y cambio de estado, con actor verificado en el panel, y el saneo CWE-117 lo garantiza la
API de Fabian (append-only + hash encadenado cuando sus migraciones están aplicadas). **Límites declarados:**
- Los intentos **rechazados** (CSRF 403, payload 400, solapamiento 409, `PermissionDeniedError`) no se registran.
  Detectar ataques en curso requeriría un evento de rechazo (`AUTH_ACCESS_DENIED` o uno nuevo de reservas, en el
  archivo compartido de Fabian).
- No existe en el código una ruta para borrar o editar fechas de una reserva, así que `reservation.deleted` no
  tiene dónde cablearse.
- La IP queda `null` mientras `AUDIT_TRUSTED_PROXY_HOPS` no se fije para el despliegue real (pendiente AU-X03).

---

## A3.8 — OP-R05 y OP-R07 · Reglas de negocio del estado de reservas y del modo de confirmación

Riesgos de la Fase 1 que quedaron sin parche en A3.1–A3.4 (fuera de los 3 vectores) y que la Matriz de Riesgo
Residual dejaba en **Medio** («Tolerado»). Se cierran con el control de línea base OP-C04 + OP-C05 de la Matriz
General de Gobernanza: «Aplicar `VALID_TRANSITIONS` en `updateReservationStatus` y validar `BookingMode` contra un
enum en `updateBookingMode`, ambos en el servidor».

**Ficha.** Responsable: Aarón · Módulo: operations · Rama: `security/operations/fase3-op-r05-r07` (desde
`develop@a230045`, actualizada a `develop@1241dc3`) · Commit: `8f5608f` · PR: [#33](https://github.com/PauCCH/hotel-reservations-seguridad-proyecto/pull/33).

**Mapeo.** OWASP A04 (Insecure Design: reglas de negocio solo en la UI) + A08 (el valor llega de un parámetro del
cliente sin validar). NIST CSF 2.0: PR.DS-01 (integridad de datos en reposo), PR.PS-01 (configuración) y, para la
auditoría del modo, DE.CM-03. Archivos:
`apps/panel-admin/src/features/reservations/domain/reservation-rules.ts` (nuevo),
`apps/panel-admin/src/features/reservations/services/reservationService.ts`,
`apps/panel-admin/src/features/reservations/services/bookingModeService.ts`,
`packages/db/supabase/migrations/20261104000001_operations_status_and_booking_mode_guards.sql` (nueva),
`packages/core/src/audit/config/constants.ts` (acción `system.setting.changed`, archivo compartido de Fabián).

**PoC (Fase 1, por código).** Ambas funciones son Server Actions: el panel solo muestra los botones válidos
(`FooterActionButtons`), pero el servidor aceptaba cualquier valor. Repitiendo la Server Action con su
`Next-Action` id, un admin con `reservations:edit` podía reabrir una reserva `cancelled` como `approved` (o
`completed → pending`), y guardar en `booking_confirmation_mode` un valor fuera del enum (`"disabled"`, HTML…),
sin validación en tiempo de ejecución, sin `CHECK` en la base y sin rastro en la auditoría.
`VALID_TRANSITIONS` existía en `constants/status-transitions.ts`, pero nadie lo usaba.

**Diff (antes → después).**
```ts
// reservationService.ts — ANTES: cualquier estado destino; UPDATE directo por id
await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);
const { data: previous } = await supabase.from(RESERVATIONS).select("status").eq("id", id).maybeSingle();
await supabase.from(RESERVATIONS).update(updateData).eq("id", id);

// DESPUÉS (A3.8): enum + máquina de estados en el servidor, y UPDATE condicional (compare-and-set)
await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);
if (!isReservationStatus(status)) throw new InvalidStatusTransitionError(null, String(status));
const { data: previous, error: readError } = await supabase.from(RESERVATIONS).select("status").eq("id", id).maybeSingle();
if (!previous) throw new ReservationNotFoundError();
const from = previous.status;
if (!isValidStatusTransition(from, status)) throw new InvalidStatusTransitionError(from, status);
const { data: updated } = await supabase.from(RESERVATIONS).update(updateData)
  .eq("id", id).eq("status", from)        // solo si nadie lo cambió entre la lectura y el UPDATE
  .select("id");
if (!updated?.length) throw new InvalidStatusTransitionError(from, status);
```
```ts
// bookingModeService.ts — ANTES: el tipo BookingMode no existe en ejecución
export async function updateBookingMode(mode: BookingMode) {
  await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);
  await supabase.from(SYSTEM_SETTINGS).update({ setting_value: mode }).eq("setting_key", BOOKING_MODE_SETTING_KEY);
}

// DESPUÉS (A3.8): enum validado en el servidor y cambio auditado (from → to, admin verificado)
if (!isBookingMode(mode)) throw new InvalidBookingModeError();
// … UPDATE …
await logAuditEvent({ action: AUDIT_ACTIONS.SYSTEM_SETTING_CHANGED, entity: AUDIT_ENTITIES.SYSTEM_SETTING,
  entityId: BOOKING_MODE_SETTING_KEY, metadata: { setting, from, to: mode }, actorId: user?.id, … });
```
```sql
-- 20261104000001: última línea en la base (aplica también al cliente service-role, que salta la RLS)
create trigger reservations_status_transition before update of status on public.reservations
  for each row execute function public.enforce_reservation_status_transition();   -- pending→approved|cancelled, approved→completed|cancelled
alter table public.system_settings add constraint system_settings_booking_mode_valid
  check (setting_key <> 'booking_confirmation_mode' or setting_value in ('manual', 'automatic'));
```

**Prueba de regresión (Vitest).**
- `apps/panel-admin/tests/reservations/updateReservationStatus.test.ts` (19 casos): las 4 transiciones válidas
  pasan; 7 inválidas (`cancelled → approved`, `completed → pending`, `pending → completed`…) y un estado fuera del
  enum se rechazan **antes** del `UPDATE` y sin evento; el `UPDATE` filtra por el estado validado y, si no
  coincide ninguna fila (cambio concurrente), se rechaza. Un id inexistente ahora lanza `ReservationNotFoundError`
  (antes terminaba sin error y sin hacer nada). Se conservan los 5 casos de auditoría de A3.4.
- `apps/panel-admin/tests/reservations/updateBookingMode.test.ts` (8 casos): `"automatic"` se guarda y se audita
  `manual → automatic`; `"disabled"`, `"AUTOMATIC"`, `""`, una cadena de inyección, HTML y un número se rechazan
  antes del `UPDATE`; sin `reservations:edit` no se toca nada.
- Contraste: con los servicios de `develop` estos mismos tests fallan 19 veces (el código anterior hacía el
  `UPDATE` con cualquier valor). Suite del panel: 46/46; `@hotel/core` audit 14/14. Type-check sin errores nuevos
  (los 6 de `@hotel/db` y `UploadDropzone` son preexistentes de `develop`).

**Prueba de regresión (en vivo, Supabase local, 2026-11-04)** — `evidencias/A3.8-op-r05-r07-live.txt`, como
`service_role` y dentro de una transacción revertida:

| # | Caso | Esperado | Obtenido |
|---|---|---|---|
| 1 | `cancelled → approved` | Rechazo en la base | ✅ `invalid reservation status transition: cancelled -> approved` |
| 2 | `approved → pending` | Rechazo en la base | ✅ `invalid reservation status transition: approved -> pending` |
| 3 | `pending → approved` (flujo legítimo) | Se actualiza | ✅ `RES-002` → `approved` (revertido) |
| 4 | `booking_confirmation_mode = 'disabled'` | Rechazo en la base | ✅ viola `system_settings_booking_mode_valid` |
| 5 | `booking_confirmation_mode = 'automatic'` (legítimo) | Se actualiza | ✅ (revertido) |
| 6 | Estado final | Sin cambios | ✅ mismos conteos y modo `manual` |

**Riesgo residual de OP-R05 y OP-R07: Bajo.** La PoC (reenviar la Server Action con un estado o modo arbitrario)
ya no funciona: el servidor rechaza el valor antes del `UPDATE` y, si alguien escribiera saltándose la app con el
cliente service-role, la base lo rechaza también. Cumple PR.DS-01. **Límites declarados:**
- Las transiciones rechazadas no generan evento de auditoría (mismo límite que A3.4: no hay un evento de rechazo
  en el catálogo).
- La migración está probada en local; falta aplicarla al Supabase remoto junto con las demás pendientes.
- `system.setting.changed` se agregó al catálogo compartido de auditoría (archivo de Fabián): avisarle.

---

## Pendientes de la fase

- ~~**A3.7** — video ≤ 5 min (solo IDE)~~ — grabado (2026-11-05).
- Aplicar la migración `20261104000001` (A3.8) al Supabase remoto, junto con las de Auditoría (avisado a Fabián).
