# Fase 3 — Reporte de Parches · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Rama | `security/operations/fase3-parches` (creada **desde** `security/operations/fase2-pocs`, para aplicar los fixes sobre las vulnerabilidades introducidas/reales y comprobar que la PoC deja de funcionar — §4.1) |
| Insumo | `operations/fase-2-pocs.md` (OP-POC-1 … OP-POC-6) |
| Estado | A3.1, A3.2 y A3.3 completos (los 3 vectores parcheados). A3.4 implementada con la API de auditoría de Fabian y verificada en vivo (rama `security/operations/fase3-audit-logging`); pendiente PR. |

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
| OP-POC-6 | 3 — log injection | `logAuditEvent` en creación y cambio de estado de reservas, saneado por la API (A3.4) | **Bajo** (verificado en vivo, ver A3.4) |

---

## A3.1 — OP-POC-1 · Inyección en el filtro de "consultar mi reserva" → IDOR

**Ficha.** Responsable: Aarón · Módulo: operations · Rama: `security/operations/fase3-parches` · Commit: `1f43498`.

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

**Ficha.** Commit: `1f43498`. (Parchado junto al Vector 1 por ser el otro hallazgo de servidor.)

**Mapeo.** OWASP A01. NIST CSF 2.0: PR.AA-05, DE.CM-03. Archivo:
`apps/panel-admin/src/features/rooms/services/galleryActions.ts` (`uploadImage`, `deleteImage`, `reorderImages`).

**Diff.**
```ts
// ANTES: Server Action con cliente service-role, sin guard de autorización
export async function deleteImage(imageId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient() as unknown as AnyClient;
  // …

// DESPUÉS (A3.2): autorización server-side antes de tocar datos
export async function deleteImage(imageId: string): Promise<boolean> {
  await requirePermission(PERMISSIONS.ROOMS.MANAGE);
  const supabase = createSupabaseServiceClient() as unknown as AnyClient;
  // …
```

**Prueba de regresión.** Por lectura de código: las tres escrituras ahora pasan por `requirePermission`,
igual que los servicios hermanos del módulo (`reservationService`, `getRooms`). La invocación directa de la
Server Action con una cuenta sin `rooms_manage` lanza `PermissionDeniedError`. Captura con cuenta de permisos
acotados a agregar en `evidencias/` (requiere entorno con Supabase, igual que A2.4).

**Riesgo residual: Bajo.** La autorización ya no depende solo de la UI. Nota de defensa en profundidad: el
middleware del panel (dueño: Paula) sigue sin verificar rol; `requirePermission` es independiente de ese
middleware y lo cubre a nivel de acción.

---

## A3.2 — OP-POC-3 · XSS stored vía notas del huésped (Vector 2)

**Ficha.** Commit: `ceda94a`.

**Mapeo.** OWASP A03 (XSS stored). NIST CSF 2.0: PR.DS-01, PR.PS-06, DE.CM-09. Archivo:
`apps/panel-admin/src/features/reservations/components/detail/ReservationGuestCard/ReservationGuestCard.tsx`.

**Diff.**
```tsx
// ANTES (sink): HTML del huésped sin escapar, ejecuta en la sesión del admin
<span className={STYLES.fieldValue} dangerouslySetInnerHTML={{ __html: guest.notes }} />

// DESPUÉS (A3.2 de salida): render como texto — React escapa
<span className={STYLES.fieldValue}>{guest.notes}</span>
```

**Prueba de regresión.** Verificación por código: `{guest.notes}` interpola como texto, por lo que un payload
`<img src=x onerror=…>` se muestra literal en vez de ejecutarse. El vitest del panel corre en
`environment: node` (sin jsdom/RTL), así que no se agregó un test de render de componente para no modificar
configuración compartida (§4.4); la ejecución-ya-no-ocurre se confirma con la captura en vivo de A2.4
(payload mostrado como texto tras el fix).

**Riesgo residual: Bajo.** El XSS queda neutralizado por el escape por defecto de React. Como el almacenamiento
del valor crudo es legítimo, no se requiere más. Defensa en profundidad pendiente (no reabre la PoC): la **CSP**
global de Paula cortaría cualquier `inline`/`onerror` residual; alinear con F3.2 de Fabian (mismo patrón).

---

## A3.3 — OP-POC-4 · CSRF en `POST /api/checkout` (Vector 3)

**Ficha.** Commit: `e90807b`.

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

**Prueba de regresión.** La página de ataque de OP-POC-4 (y el `curl` sin `Origin` propio) ahora recibe
**403** y no crea reserva. Captura/salida a agregar en `evidencias/` (entorno con Supabase).

**Riesgo residual: Medio.** La verificación de `Origin` es una defensa estándar y suficiente contra el CSRF
basado en navegador, pero no es un token anti-CSRF ni añade rate limiting; un cliente que falsee cabeceras
fuera del navegador no está cubierto (fuera del modelo de amenaza de CSRF). Coordinar con Paula para que la
defensa encaje con cualquier política global de origen/CSP (P3.x).

---

## A3.3 (cont.) — OP-POC-5 · Manipulación de parámetros del checkout (Vector 3)

**Ficha.** Commit: `e90807b`.

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

**Ficha.** Rama: `security/operations/fase3-checkout-rooms-catalog` · Commit: `ce54581`.

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

## A3.4 — OP-POC-6 · Log injection / cobertura de auditoría

**Ficha.** Responsable: Aarón · Módulo: operations · Rama: `security/operations/fase3-audit-logging`
(desde `develop@1e6ce17`) · Commit: _pendiente_ · PR: _pendiente_.

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
  `reservations:edit`, con `UPDATE` fallido o con id inexistente → sin evento.
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

## Pendientes de la fase

- **A3.4** — PR (código, tests y evidencia en vivo listos).
- **A3.7** — video ≤ 5 min (solo IDE) explicando las líneas de A3.1–A3.4.
