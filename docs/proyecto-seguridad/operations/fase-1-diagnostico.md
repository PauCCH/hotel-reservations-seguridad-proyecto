# Fase 1 — Diagnóstico NIST CSF 2.0 · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Rama | `security/operations/fase1-diagnostico` |
| Commit base analizado | `5af5fb1` (`develop`, 2026-09-28) |
| Estado | A1.1 y A1.2 completos · A1.3–A1.4 pendientes |

---

## 1. Alcance

El módulo cubre el ciclo de vida de una reserva: búsqueda y selección de habitaciones en el portal,
confirmación y pago (checkout → Stripe), y la gestión administrativa de reservas, habitaciones,
amenidades, horarios, galería y modo de confirmación en el panel.

| App / paquete | Rutas y features |
|---|---|
| `apps/portal-reservas` (:3001) | `features/search`, `features/rooms`, `features/room-detail`, `features/checkout`, `app/reserve/**`, `app/api/checkout/route.ts` |
| `apps/panel-admin` (:3002) | `features/reservations/**`, `features/rooms/**`, `app/admin/reservations/**`, `app/admin/rooms/**` |
| `packages/core` | `src/booking`, `src/payments` (hoy solo contienen un comentario: sin implementación) |
| `packages/db` | Migraciones de `rooms`, `reservations`, `amenities`, `room_amenities`, `room_schedules`, `room_images`, `system_settings` |

---

## 2. A1.1 Inventario de activos

Escala C/I/D (Confidencialidad / Integridad / Disponibilidad): **A** alto · **M** medio · **B** bajo.

### 2.1 Activos de información (datos)

| ID | Activo | Ubicación | Contenido | C | I | D | Notas |
|---|---|---|---|---|---|---|---|
| OP-D01 | Reservas | Tabla `reservations` (`20260503000001_create_reservations_table.sql`) | Código `RES-###`, fechas, huéspedes, `price_per_night`, `total_amount`, `status`, `cancellation_reason`, `user_id` | M | **A** | A | RLS habilitado **sin políticas** → solo accesible con service-role. |
| OP-D02 | Datos personales de huéspedes (PII) | Columnas `guest_name`, `guest_email`, `guest_phone` de `reservations`; formulario `GuestForm` del portal (incl. `specialRequests`) | Nombre, email, teléfono, peticiones especiales | **A** | M | M | Ley 8968 (CR) de protección de datos. En el portal hoy **no se envían al servidor** salvo el email (ver §3). |
| OP-D03 | Catálogo y tarifas de habitaciones | Tabla `rooms` (`regular_fee`, `high_season_fee`, `is_active`, capacidad) | Precios y disponibilidad | B | **A** | A | Lectura pública (`USING (true)`). El portal usa **mock data** (`features/rooms/mock-data/rooms.ts`), no esta tabla. |
| OP-D04 | Amenidades | Tablas `amenities`, `room_amenities` | Nombre, ícono, descripción (texto libre) | B | M | B | Texto libre editable por admins → se renderiza en portal/panel. |
| OP-D05 | Horarios de check-in/out | Tabla `room_schedules` | Franjas horarias por habitación | B | M | M | |
| OP-D06 | Galería de imágenes | Tabla `room_images` + bucket de Storage `room-images` (público) | Archivos subidos por admins y su URL pública | B | M | M | El bucket y sus políticas **no están en migraciones** (configurado a mano en Supabase). |
| OP-D07 | Configuración de modo de reservas | Tabla `system_settings` (`booking_confirmation_mode` = `manual`/`automatic`) | Parámetro que define si las reservas se aprueban solas | B | **A** | M | Cambiarlo altera el flujo de negocio sin tocar código. |
| OP-D08 | Sesión de pago | Stripe Checkout Session (`session_id` en la URL de éxito) | Identificador de sesión y montos enviados a Stripe | M | **A** | M | Los datos de tarjeta **nunca** tocan la app (página alojada de Stripe). |
| OP-D09 | Código de confirmación mostrado al huésped | `generateConfirmationCode()` en `features/checkout/domain/reservation.ts` | `HR-XXXXXX` derivado por hash del `session_id` | B | M | B | Determinista y calculado a partir de un parámetro de la URL. |

### 2.2 Activos de software (componentes y endpoints)

| ID | Componente | Archivo | Tipo | Control de acceso actual |
|---|---|---|---|---|
| OP-S01 | `POST /api/checkout` | `apps/portal-reservas/src/app/api/checkout/route.ts:12` | Route handler público | Ninguno (sin sesión, sin rate limit, sin validación de esquema) |
| OP-S02 | `openGatewaySession` | `apps/portal-reservas/src/features/checkout/services/gateway.server.ts:32` | Servicio server-side | — (recalcula precio desde mock por `roomIds`) |
| OP-S03 | `buildStripeCheckoutParams` | `apps/portal-reservas/src/features/checkout/domain/stripe.ts:12` | Construcción de parámetros hacia Stripe | — |
| OP-S04 | Página `/reserve` | `apps/portal-reservas/src/app/reserve/page.tsx` | Server component; lee `rooms`, `checkIn`, `checkOut`, `guests` de la URL | Público |
| OP-S05 | Página `/reserve/success` | `apps/portal-reservas/src/app/reserve/success/page.tsx` | Muestra éxito con cualquier `session_id` | Público, sin verificar el pago con Stripe |
| OP-S06 | Búsqueda / filtros / detalle de habitación | `features/search`, `features/rooms`, `features/room-detail` | Lógica 100 % cliente sobre mock data | Público |
| OP-S07 | `updateReservationStatusAction` | `apps/panel-admin/src/features/reservations/actions/updateStatus.ts:7` | Server action | `requirePermission(reservations_edit)` en el servicio |
| OP-S08 | `reservationService` (`getAllReservations`, `getReservationById`, `updateReservationStatus`, `getRoomNames`) | `apps/panel-admin/src/features/reservations/services/reservationService.ts` | Servicio con **service-role** (salta RLS) | `requirePermission` en 3 de 4 funciones; `getRoomNames` (línea 73) no lo tiene |
| OP-S09 | `bookingModeService` (`getBookingMode`, `updateBookingMode`) | `apps/panel-admin/src/features/reservations/services/bookingModeService.ts` | Server actions con service-role | `requirePermission(reservations_view/edit)` |
| OP-S10 | `roomActions` (`createRoomAction`, `updateRoomAction`, `toggleRoomStateAction`) | `apps/panel-admin/src/features/rooms/services/roomActions.ts` | Server actions con cliente de sesión | Solo RLS de `rooms` |
| OP-S11 | `amenityActions` (guardar/crear/editar/borrar) | `apps/panel-admin/src/features/rooms/services/amenityActions.ts` | Server actions con cliente de sesión | Solo RLS (`user_roles` admin/owner) |
| OP-S12 | `galleryActions` (`uploadImage`, `deleteImage`, `reorderImages`, `getRoomImages`) | `apps/panel-admin/src/features/rooms/services/galleryActions.ts` | Server actions con **service-role** | **Ninguno** en la acción |
| OP-S13 | `scheduleService` | `apps/panel-admin/src/features/rooms/services/scheduleService.ts` | Servicio con cliente anónimo | Solo RLS |
| OP-S14 | `getRooms` | `apps/panel-admin/src/features/rooms/services/getRooms.ts` | Server action con service-role | `requirePermission(rooms_manage)` |
| OP-S15 | Middleware del panel | `apps/panel-admin/src/middleware.ts` (matcher `/admin/:path*`) | Protección de rutas | Exige usuario autenticado y activo; **no verifica rol** (compartido con Auth — Paula) |
| OP-S16 | `requirePermission` / `requirePermissions` | `apps/panel-admin/src/shared/auth/requirePermission.ts` | Guard de autorización | Usa `auth.getSession()` (compartido con Users/Auth — Joseph/Paula) |
| OP-S17 | Políticas RLS del módulo | Migraciones `rooms_rls_policies`, `amenities_rls_policies`, `create_room_schedules`, `create_room_images_table`, `create_system_settings_table` | Control en BD | Ver §2.4 |

### 2.3 Servicios externos e infraestructura

| ID | Servicio | Uso en el módulo | Secreto asociado | Notas |
|---|---|---|---|---|
| OP-X01 | Stripe Checkout (REST, sin SDK) | Crear sesión de pago (`https://api.stripe.com/v1/checkout/sessions`) | `STRIPE_SECRET_KEY` (server) | Sin webhook: la app nunca confirma el pago. Si falta la clave, se usa un **gateway mock** que redirige directo a éxito. `STRIPE_SECRET_KEY` no está en `.env.example`. |
| OP-X02 | Supabase Postgres | Tablas del módulo | `SUPABASE_SERVICE_ROLE_KEY` (server), anon key (público) | El service-role se usa en reservas, galería, modo de reservas y `getRooms`. |
| OP-X03 | Supabase Storage | Bucket `room-images` (URLs públicas) | Service-role | Validación de tipo y tamaño **solo en el cliente** (`useGalleryStage.ts:25-29`). |
| OP-X04 | Pasarelas previstas (Tilopay, Evertec, PayPal, Booking.com) | Mencionadas en `packages/core/src/{booking,payments}/index.ts` | — | No implementadas; fuera del alcance evaluable. |

### 2.4 Controles existentes (línea base preliminar, insumo para A1.4)

| Control | Dónde | Observación |
|---|---|---|
| CHECK constraints de dominio | `reservations` (`status` ∈ lista, `check_out > check_in`, montos > 0), `rooms` (categoría, tarifas ≥ 1) | Buena integridad a nivel BD. |
| Snapshot de precio en la reserva | `reservations.price_per_night`, `total_amount` | Evita que un cambio de tarifa altere reservas pasadas. |
| Precio recalculado en servidor | `gateway.server.ts:33` resuelve habitaciones por ID y construye el precio desde el catálogo | El cliente **no** envía montos a `/api/checkout` → mitiga la manipulación directa del precio. |
| Datos de tarjeta fuera de la app | Stripe hosted checkout | Reduce el alcance PCI. |
| RLS habilitado en todas las tablas del módulo | Migraciones | Lectura pública de catálogo; escritura restringida (con las observaciones de §3). |
| `requirePermission` en servicios de reservas | `reservationService`, `bookingModeService`, `getRooms` | Autorización granular (`reservations_view/edit`, `rooms_manage`). |
| Matriz de transiciones de estado | `reservations/constants/status-transitions.ts` | **Definida pero no usada** en ningún lado. |
| Auditoría | — | El módulo **no registra ningún evento** en `audit_logs` (`logAuditEvent` no se usa). |

---

## 3. Observaciones preliminares (candidatas para la Fase 2 — sin confirmar)

Superficies detectadas durante el inventario. Cada una se confirma o descarta con una PoC en la Fase 2.

| # | Observación | Evidencia (archivo:línea) | Vector / OWASP tentativo |
|---|---|---|---|
| O1 | `galleryActions` usa service-role y no llama a `requirePermission`: cualquier sesión que alcance la server action podría subir, borrar o reordenar imágenes de cualquier habitación. | `galleryActions.ts:11`, `:71`, `:93` | V1 · A01 |
| O2 | El middleware del panel solo exige usuario autenticado; no verifica rol. Una cuenta de **cliente** del portal (mismo Supabase Auth) podría entrar a `/admin` e invocar las acciones de O1. | `panel-admin/src/middleware.ts:27-31` | V1 · A01 (coordinar con Paula) |
| O3 | Subida de archivos: extensión y `contentType` salen del archivo enviado por el cliente; la validación de tipo/tamaño es solo de UI. Un `.html`/`.svg` en un bucket público es un vector de XSS stored. | `galleryActions.ts:18-23`, `useGalleryStage.ts:25-29` | V2 · A03 (XSS) |
| O4 | `updateReservationStatus` no valida la transición (p. ej. `cancelled → approved`) ni el valor de `status` en tiempo de ejecución; `VALID_TRANSITIONS` no se usa. | `reservationService.ts:32-55`, `status-transitions.ts` | V3 · A04/A08 (manipulación de parámetros) |
| O5 | `updateBookingMode` escribe cualquier string en `system_settings` sin validar que sea `manual`/`automatic`. | `bookingModeService.ts:29-40` | V3 · A08 |
| O6 | `getRoomNames` usa service-role sin `requirePermission`. Impacto bajo (nombres públicos), pero incumple el patrón. | `reservationService.ts:73` | V1 · A01 (bajo) |
| O7 | Políticas RLS de `rooms`, `room_images` y `room_schedules` usan `auth.jwt() ->> 'role' = 'admin'`. En Supabase ese claim es el rol de Postgres (`authenticated`), y `sync_role_to_jwt` escribe el rol en `raw_user_meta_data`, que el propio usuario puede editar. Además, excluyen al rol `owner`. Hay que verificar si la política nunca coincide (rompe la función) o si es falsificable (escalamiento). | `20260609000001_rooms_rls_policies.sql`, `20260609000000_create_room_images_table.sql`, `20260517000000_create_room_schedules.sql`, `20260609000003_sync_role_to_jwt.sql` | V1 · A01 · confianza en JWT (coordinar con Paula) |
| O8 | `/reserve/success` muestra "pago exitoso" y un código de confirmación con cualquier `session_id`; no hay webhook ni verificación con Stripe. Con el gateway mock (sin clave) el pago se salta por completo. | `success/page.tsx:13-22`, `gateway.server.ts:45-49` | V3 · A08 (integridad de la pasarela) |
| O9 | `POST /api/checkout` es público, sin validación de esquema (`roomIds`, fechas, email), sin rate limit y sin protección de origen. `computeNights` fuerza un mínimo de 1 noche con fechas invertidas o inválidas. | `route.ts:12-16`, `reservation.ts:14-19` | V3 · A08 / CSRF |
| O10 | El checkout del portal **no persiste reservas** ni envía los datos del huésped (solo el email) al servidor; las habitaciones salen de mock data. El flujo "huésped → panel" (XSS stored cruzado) no existe hoy. | `gateway.server.ts:33`, `room-lookup.ts:9`, `useCheckoutSubmit.ts:29-34` | Afecta V2: puede requerir vulnerabilidad **introducida** (§4.1 del plan) |
| O11 | No hay sinks de inyección evidentes: todo el acceso a datos usa el query builder de Supabase (parametrizado), sin `.or()`/`.filter()` con strings, `rpc` ni `dangerouslySetInnerHTML` en el alcance. | búsqueda en el alcance del módulo | V1 · A03: probablemente requiera vulnerabilidad **introducida** |
| O12 | El módulo no genera eventos de auditoría (creación/cambio de estado de reservas, cambios de tarifas, modo de reservas, galería). | — | Detect (DE.CM) · insumo para A3.4 con la API de Fabian |

---

## 4. A1.2 Mapeo de componentes contra NIST CSF 2.0

Estado frente a la subcategoría: **Cumple** · **Parcial** (existe el control pero con huecos) ·
**No cumple** (control ausente) · **Por verificar** (requiere la PoC de la Fase 2).
La columna "Ref." remite a las observaciones de §3.

### 4.1 Flujo de datos del módulo (ID.AM-03)

```
Portal (navegador)                    portal-reservas (servidor)             Terceros
──────────────────                    ──────────────────────────             ────────
Búsqueda / filtros ── (todo en cliente, sobre mock data) ──┐
Selección → /reserve?rooms&checkIn&checkOut&guests ───────►│ ReservePage: resuelve rooms (mock),
                                                           │ calcula noches y total
GuestForm (nombre, email, tel., peticiones) ── validación  │
  solo cliente; solo el email sale del navegador ─────────►│ POST /api/checkout {roomIds, fechas, email}
                                                           │ → precio recalculado desde mock ──────► Stripe Checkout Session
Navegador ◄──────────────── redirect a URL de Stripe ◄─────┘                                          (datos de tarjeta)
Stripe ── redirect ──► /reserve/success?session_id=… (sin verificación ni webhook)

Panel (navegador admin)               panel-admin (servidor)                  Supabase
───────────────────────               ──────────────────────                  ────────
/admin/** ── middleware: usuario autenticado y activo ──►  server actions ──► service-role: reservations,
                                                                              system_settings, room_images, Storage
                                                           server actions ──► sesión del usuario (RLS): rooms,
                                                                              amenities, room_amenities
                                                           scheduleService ─► cliente anónimo (RLS): room_schedules
```

Hoy no hay ningún flujo que cree filas en `reservations` desde el portal: el checkout termina en Stripe
y la tabla solo se llena por otros medios (seed o carga manual).

### 4.2 Mapeo por componente

#### Portal — checkout y pago

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| OP-S01 `POST /api/checkout` | PROTECT | **PR.DS-10** Datos en uso protegidos (integridad de la entrada) | Recibe `roomIds`, fechas y email sin validar el esquema | No cumple | O9 |
| | PROTECT | **PR.IR-01** Redes y entornos protegidos de acceso lógico no autorizado | Endpoint público sin rate limit ni verificación de origen (CSRF) | No cumple | O9 |
| | PROTECT | **PR.PS-06** Prácticas de desarrollo seguro | No hay esquema (p. ej. Zod) en la frontera de la API | No cumple | O9 |
| OP-S02 `openGatewaySession` | PROTECT | **PR.DS-10** Integridad de los datos en uso | El precio se recalcula en el servidor, no se confía en el cliente | Cumple | — |
| | PROTECT | **PR.DS-10** | `computeNights` acepta fechas inválidas o invertidas y fuerza 1 noche | Parcial | O9 |
| | IDENTIFY | **ID.AM-02** Inventario de software y servicios | El precio sale de mock data y no del catálogo real (`rooms`) | Parcial | O10 |
| OP-S03 / OP-X01 Stripe | PROTECT | **PR.DS-02** Datos en tránsito protegidos | Llamada HTTPS a Stripe y tarjeta capturada en la página alojada de Stripe | Cumple | — |
| | GOVERN | **GV.SC-05/07** Requisitos y riesgos de proveedores | Stripe es proveedor crítico; no hay requisitos documentados ni monitoreo | Parcial | O8 |
| | IDENTIFY | **ID.AM-04** Inventario de servicios de proveedores | Stripe no figura en `.env.example`; existe un gateway mock silencioso | Parcial | O8 |
| OP-S05 `/reserve/success` | DETECT | **DE.CM-06** Actividad de proveedores externos monitoreada | No hay webhook ni consulta a Stripe para confirmar el pago | No cumple | O8 |
| | PROTECT | **PR.DS-10** Integridad | Muestra éxito y código `HR-…` para cualquier `session_id` | No cumple | O8 |
| OP-S04 `/reserve` + `GuestForm` | PROTECT | **PR.DS-10** | Parámetros de URL tratados como no confiables y redirige si faltan | Parcial | — |
| | PROTECT | **PR.DS-01** Datos en reposo protegidos (PII) | La PII no se persiste hoy (reduce la exposición) | Cumple (por omisión) | O10 |
| OP-S06 búsqueda / filtros | PROTECT | **PR.DS-10** | Lógica solo cliente sobre datos estáticos; no llega a consultas | Cumple | O11 |

#### Panel — reservas y modo de reservas

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| OP-S07/S08 `updateReservationStatus` | PROTECT | **PR.AA-05** Permisos con menor privilegio aplicados | `requirePermission(reservations_edit)` antes de escribir | Cumple | — |
| | PROTECT | **PR.DS-01** Integridad de datos en reposo | No valida la transición de estado ni el valor de `status` (depende del CHECK de BD) | Parcial | O4 |
| | PROTECT | **PR.PS-06** Desarrollo seguro | `VALID_TRANSITIONS` existe pero no se usa | No cumple | O4 |
| | PROTECT | **PR.IR-01** / CSRF | Server action de Next.js (protección de origen integrada; por verificar) | Por verificar | — |
| | DETECT | **DE.CM-03** Actividad de personal monitoreada | El cambio de estado y el motivo de cancelación no se auditan | No cumple | O12 |
| | PROTECT | **PR.PS-04** Registros de log generados | No se llama a `logAuditEvent` | No cumple | O12 |
| OP-S08 `getAllReservations` / `getReservationById` | PROTECT | **PR.AA-05** | `requirePermission(reservations_view)` con service-role | Cumple | — |
| | PROTECT | **PR.DS-01** (confidencialidad de PII) | La PII de huéspedes solo se expone con permiso de vista | Cumple | — |
| OP-S08 `getRoomNames` | PROTECT | **PR.AA-05** | Service-role sin `requirePermission` | No cumple (impacto bajo) | O6 |
| OP-S09 `updateBookingMode` | PROTECT | **PR.AA-05** | `requirePermission(reservations_edit)` | Cumple | — |
| | PROTECT | **PR.PS-01** Gestión de configuración | Escribe cualquier string en `system_settings`; no valida `manual`/`automatic` | No cumple | O5 |
| | DETECT | **DE.CM-09** Software, entorno y datos monitoreados | Un cambio de configuración de negocio no deja rastro | No cumple | O12 |
| OP-D01 tabla `reservations` | PROTECT | **PR.AA-05** / **PR.DS-01** | RLS habilitado sin políticas: niega todo salvo service-role | Cumple (estricto) | — |
| | PROTECT | **PR.DS-01** | CHECK de estado, fechas y montos; snapshot de precio | Cumple | — |

#### Panel — habitaciones, amenidades, horarios y galería

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| OP-S12 `galleryActions` | PROTECT | **PR.AA-05** | Service-role sin `requirePermission(rooms_manage)` en upload, delete y reorder | No cumple | O1 |
| | PROTECT | **PR.DS-01** Integridad de los datos en reposo (bucket) | Tipo y tamaño validados solo en el cliente; extensión y `contentType` del atacante | No cumple | O3 |
| | PROTECT | **PR.PS-05** Evitar ejecución de software no autorizado | Un HTML/SVG subido al bucket público podría ejecutarse en el navegador | Por verificar | O3 |
| | DETECT | **DE.CM-03** | Subidas y borrados sin auditoría | No cumple | O12 |
| OP-S10 `roomActions` | PROTECT | **PR.AA-05** | Solo depende de RLS de `rooms`; no llama a `requirePermission` | Parcial | O7 |
| | PROTECT | **PR.AA-04** Aserciones de identidad protegidas y verificadas | La política usa `auth.jwt() ->> 'role'`, y el rol se sincroniza a `user_metadata` (editable por el usuario) | Por verificar | O7 |
| | PROTECT | **PR.DS-10** | `createRoom` inserta el DTO completo (posible asignación masiva) | Por verificar | — |
| | DETECT | **DE.CM-03** | Cambios de tarifas y activación de habitaciones sin auditoría | No cumple | O12 |
| OP-S11 `amenityActions` | PROTECT | **PR.AA-05** | RLS por `user_roles` (admin/owner), pero no exige el permiso `rooms_manage` | Parcial | — |
| | PROTECT | **PR.DS-10** | Nombre, ícono y descripción libres, sin validar longitud ni formato | Parcial | — |
| OP-S13 `scheduleService` | PROTECT | **PR.AA-05** / **PR.AA-04** | Cliente anónimo + RLS basado en `auth.jwt() ->> 'role'` | Por verificar | O7 |
| OP-S14 `getRooms` | PROTECT | **PR.AA-05** | `requirePermission(rooms_manage)` | Cumple | — |

#### Transversal (compartido con otros módulos)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. | Dueño |
|---|---|---|---|---|---|---|
| OP-S15 middleware del panel | PROTECT | **PR.AA-05** | `/admin/**` exige sesión activa pero no rol admin/owner | Parcial | O2 | Paula |
| OP-S16 `requirePermission` | PROTECT | **PR.AA-03** Usuarios autenticados | Usa `getSession()` (lee la cookie) en lugar de `getUser()` (valida con el servidor) | Por verificar | — | Paula / Joseph |
| `next.config.ts` (portal y panel) | PROTECT | **PR.PS-01** / **PR.DS-02** | Sin CSP, HSTS, `X-Frame-Options` ni otras cabeceras de seguridad | No cumple | — | Paula |
| `.env.example` | GOVERN | **GV.PO-01** / **PR.PS-01** | Faltan `STRIPE_SECRET_KEY` y la documentación del modo mock | Parcial | O8 | Aarón |
| Vulnerabilidades del módulo | IDENTIFY | **ID.RA-01** Vulnerabilidades identificadas y registradas | Este diagnóstico + las PoC de la Fase 2 | En curso | §3 | Aarón |

### 4.3 Resumen de cobertura por subcategoría

| Subcategoría | Componentes evaluados | Cumple | Parcial | No cumple | Por verificar |
|---|---|---|---|---|---|
| ID.AM-02/03/04 | 2 (+ flujo en §4.1) | 0 | 2 | 0 | 0 |
| ID.RA-01 | 1 | — | — | — | En curso |
| GV.SC-05/07, GV.PO-01 | 2 | 0 | 2 | 0 | 0 |
| PR.AA-03/04/05 | 13 | 5 | 3 | 2 | 3 |
| PR.DS-01/02/10 | 15 | 7 | 4 | 3 | 1 |
| PR.PS-01/04/05/06 | 6 | 0 | 0 | 5 | 1 |
| PR.IR-01 | 2 | 0 | 0 | 1 | 1 |
| DE.CM-03/06/09 | 5 | 0 | 0 | 5 | 0 |

**Lectura:** la autorización del módulo es desigual. Reservas está bien protegido; galería y habitaciones
no, y habitaciones depende de un RLS dudoso. La integridad de los datos de negocio (transiciones de
estado, configuración, confirmación del pago) no tiene validación en el servidor. **DETECT es nulo**:
ninguna operación del módulo deja rastro de auditoría.

## 5. A1.3 Impacto operacional y de negocio (GOVERN / IDENTIFY)

_Pendiente._

## 6. A1.4 Línea base de controles PROTECT / DETECT

_Pendiente. Partir de §2.4 y §3._

## 7. Filas para la Matriz General de Gobernanza (G1)

_Pendiente. Formato de `plantillas/matriz-general-gobernanza.xlsx`:_

| Módulo y responsable | Activo crítico | Función NIST CSF | Categoría / subcategoría NIST CSF | Control de seguridad requerido (línea base) | Nivel de riesgo inherente |
|---|---|---|---|---|---|
| | | | | | |
