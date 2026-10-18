# Fase 3 — Reporte de Parches · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Rama | `security/operations/fase3-parches` (creada **desde** `security/operations/fase2-pocs`, para aplicar los fixes sobre las vulnerabilidades introducidas/reales y comprobar que la PoC deja de funcionar — §4.1) |
| Insumo | `operations/fase-2-pocs.md` (OP-POC-1 … OP-POC-6) |
| Estado | A3.1, A3.2 y A3.3 completos (los 3 vectores parcheados). A3.4 pendiente (bloqueado por la utilidad de saneo de Fabian). |

> Formato por parche según §4.6: ficha · mapeo · diff antes/después · prueba de regresión · riesgo residual.

---

## Resumen de riesgo residual

| PoC | Vector | Parche | Riesgo residual |
|---|---|---|---|
| OP-POC-1 | 1 — inyección/IDOR | Filtro parametrizado `.eq()` | **Bajo** |
| OP-POC-2 | 1 — control de acceso | `requirePermission(ROOMS.MANAGE)` | **Bajo** |
| OP-POC-3 | 2 — XSS stored | Escape de salida (`{guest.notes}`) | **Bajo** |
| OP-POC-4 | 3 — CSRF | Verificación de `Origin` | **Medio** (sin token anti-CSRF ni rate limiting) |
| OP-POC-5 | 3 — manipulación de parámetros | Esquema Zod + capacidad + disponibilidad + restricción `EXCLUDE` | **Bajo** (TOCTOU cerrado a nivel DB) |
| OP-POC-6 | 3 — log injection | — (A3.4 pendiente) | **Alto** (sin remediar: operaciones aún no registra ni sanea logs) |

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

**Riesgo residual: Bajo.** Las reglas de negocio quedan validadas en el servidor y la condición de carrera
**TOCTOU** entre el chequeo de disponibilidad y la inserción quedó **cerrada a nivel de base de datos** con
la restricción `reservations_no_overlap` (migración `20261018000002_reservations_no_overlap.sql`:
`EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out, '[)') WITH &&) WHERE status <> 'cancelled'`).
El chequeo aplicativo `areRoomsAvailable` se mantiene por UX (respuesta temprana), pero el `EXCLUDE` es la
garantía autoritativa: dos inserciones concurrentes solapadas no pueden coexistir y la segunda recibe
`409`. Requiere la extensión `btree_gist` (incluida en la migración). Estadías contiguas (check-out = próximo
check-in) siguen permitidas por el rango semiabierto.

---

## A3.4 — OP-POC-6 · Log injection / cobertura de auditoría — **PENDIENTE (bloqueado)**

**Estado.** No remediado todavía. Operaciones aún no registra eventos de auditoría (brecha DETECT real,
OP-POC-6). El parche A3.4 debe: (a) instrumentar `logAuditEvent` en creación/cambio de estado de reservas, y
(b) **sanitizar** los campos libres (`guest_notes`, `guest_name`) antes de registrarlos, reutilizando la
utilidad de saneo que Fabian expone en **F3.3/F3.4**.

**Bloqueo.** Depende de que Fabian publique esa utilidad y la guía de uso de la API de auditoría (F3.4). Sin
ella, instrumentar el logging reintroduciría AU-R04 (log injection) en los eventos de operaciones.

**Riesgo residual actual: Alto** (sin control DETECT en el módulo). Baja a **Bajo** una vez cerrada A3.4 con
saneo. Coordinación en `operations/fase-2-pocs.md` §Coordinación y con la bitácora de Fabian.

---

## Pendientes de la fase

- **A3.4** — logging saneado (arriba), al liberar Fabian su utilidad.
- **A3.7** — video ≤ 5 min (solo IDE) explicando las líneas de A3.1–A3.3.
- **Evidencias en vivo** — capturas de regresión (XSS mostrado como texto, 403 de CSRF, 400/409 de parámetros)
  en un entorno con Supabase conectado; compartidas con A2.4.
