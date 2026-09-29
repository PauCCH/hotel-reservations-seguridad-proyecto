# Fase 1 — Diagnóstico NIST CSF 2.0 · Módulo Operaciones / Transacciones

| Campo | Valor |
|---|---|
| Módulo | Operaciones / Transacciones (`operations`) |
| Responsable | Aarón Líos Cubillo |
| Rama | `security/operations/fase1-diagnostico` |
| Commit base analizado | `5af5fb1` (`develop`, 2026-09-28) |
| Estado | A1.1 completo · A1.2–A1.4 pendientes |

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

_Pendiente._

## 5. A1.3 Impacto operacional y de negocio (GOVERN / IDENTIFY)

_Pendiente._

## 6. A1.4 Línea base de controles PROTECT / DETECT

_Pendiente. Partir de §2.4 y §3._

## 7. Filas para la Matriz General de Gobernanza (G1)

_Pendiente. Formato de `plantillas/matriz-general-gobernanza.xlsx`:_

| Módulo y responsable | Activo crítico | Función NIST CSF | Categoría / subcategoría NIST CSF | Control de seguridad requerido (línea base) | Nivel de riesgo inherente |
|---|---|---|---|---|---|
| | | | | | |
