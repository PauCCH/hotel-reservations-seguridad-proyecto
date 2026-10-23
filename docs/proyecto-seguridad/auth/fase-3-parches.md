# Fase 3 — Reporte de Parches y riesgo residual · Módulo de Autenticación (`auth`)

> Formato por parche según `plan-desarrollo.md` §4.6: ficha · mapeo · diff antes/después · prueba de
> regresión · riesgo residual. Este documento **complementa** a `fase-2-pocs.md`: cada parche indica qué
> `AUTH-POC-n` cierra y qué escenario de riesgo de la Fase 1 (`fase-1-diagnostico.md` §4.5) reduce.
> Evidencias en `evidencias/` (archivos `P3.x-*`).

---

## 0. Ficha

| Campo | Valor |
|---|---|
| Responsable | Paula |
| Módulo | Autenticación (`auth`) |
| Tareas | P3.1 (vector 1), P3.2 (vector 2 + CSP), P3.3 (vector 3 + cookies), P3.4 (auditoría), P3.5 (regresión + riesgo residual), P3.6 (este documento) |
| Línea base vulnerable | `develop@9c1d10d` (merge del PR #17, PoCs de la Fase 2) |
| Insumos | `auth/fase-1-diagnostico.md` (§4.5 riesgos AUTH-R01…R12), `auth/fase-2-pocs.md` (AUTH-POC-1…6) |

| PR | Rama | Merge | Commits | Contenido |
|---|---|---|---|---|
| #19 | `security/auth/fase3-parches` | `d3ab864` | `1ef0b61`, `e1994f9`, `b5e546b`, `858546d` (+ docs `ead3887`, `3321348`, `53396aa`, `4a3f0df`, `2b4d9f6`) | P3.1 — AUTH-POC-1, AUTH-POC-2, AUTH-POC-3 |
| #20 | `security/auth/fase3-xss-csp` | `0cc3dd0` | `caa2f95`, `ee693e6` (+ docs `c99822f`) | P3.2 — AUTH-POC-4 + CSP global |
| #21 | `security/auth/fase3-redirect-cookies-audit` | `fa35c7c` | `164676f`, `ee4a491`, `ea95951` (+ docs `6f736d6`) | P3.3 + P3.4 — AUTH-POC-5, cookies, AUTH-POC-6 |

**Tests (P3.5):** `@hotel/core` 95 ✓ · `@hotel/portal-reservas` 62 ✓ · `@hotel/panel-admin` 19 ✓ sobre
`develop@fa35c7c`. Los de regresión del módulo están en §10. Type-check sin errores nuevos (los de `@hotel/db`
— `gallery_*`/`room_schedules` faltantes en las constantes — y `UploadDropzone` ya estaban en `develop`).

---

## 1. Resumen

| Parche | Cierra | Riesgo Fase 1 (inherente) | OWASP | NIST CSF 2.0 | Residual |
|---|---|---|---|---|---|
| AUTH-PAT-1 Rol de registro solo desde `app_metadata` | AUTH-POC-1 | AUTH-R01 (**Crítico 12**) | A01 | PR.AA-05, PR.AA-01 | **Bajo** |
| AUTH-PAT-2a RLS con el rol de negocio | AUTH-POC-2 (a) | AUTH-R07 (Medio 4) | A01 | PR.AA-05 | **Bajo** |
| AUTH-PAT-2b Sesión verificada en servidor | AUTH-POC-2 (b) | AUTH-R10 (Bajo 2) | A07 | PR.AA-02, PR.AA-03 | **Medio** |
| AUTH-PAT-3 Búsqueda de cuenta parametrizada | AUTH-POC-3 (introducida) | — (sin escenario en Fase 1) | A03, A01 | PR.DS-10 | **Bajo** |
| AUTH-PAT-4 Sin reflejo en `/auth/error` | AUTH-POC-4 (introducida), O-04 | AUTH-R08 (Medio 6 → Alto con la PoC) | A03 (XSS) | PR.PS-06, PR.DS-01 | **Bajo** |
| AUTH-PAT-5 CSP con nonce + cabeceras | AUTH-POC-4 (defensa en profundidad) | AUTH-R06 (Medio 6) | A05 | PR.PS-01, PR.DS-02 | **Bajo** |
| AUTH-PAT-6 Redirección solo interna | AUTH-POC-5 | AUTH-R02 (**Alto 9**) | A01, A08 | PR.PS-06, PR.DS-02 | **Bajo** |
| AUTH-PAT-7 Cookies `HttpOnly`/`Secure`/`SameSite` | O-10 | AUTH-R06 (Medio 6) | A05, A07 | PR.DS-02, PR.AA-03 | **Bajo** |
| AUTH-PAT-8 Eventos de login sin atribución forjada | AUTH-POC-6 | AUTH-R04 (**Alto 9**) | A09, A03 | DE.CM-01, DE.AE-02/03 | **Bajo** (PoC) / **Medio** (R04) |
| AUTH-PAT-9 Sin token en logs del servidor | O-01 | AUTH-R11 (Bajo 3) | A09 | PR.DS-01 | **Bajo** |

Riesgos de la Fase 1 que **no** tienen parche en esta fase (fuera de los 3 vectores del enunciado): AUTH-R03,
AUTH-R05, AUTH-R09 y AUTH-R12 — ver §11. Su riesgo residual es igual al inherente.

---

## 2. Filas para la Matriz de Riesgos actualizada (G3.1)

Mismas columnas que `plantillas/matriz-riesgo-residual.xlsx`.

| Módulo y Responsable | Vulnerabilidad identificada (OWASP) | Subcategoría NIST CSF | Control / Parche aplicado (Fase 3) | Riesgo inherente | Riesgo residual | Estado final |
|---|---|---|---|---|---|---|
| Autenticación (Paula) | A01 — Escalamiento de privilegios en el registro: rol tomado de `user_metadata` (AUTH-POC-1) | PR.AA-05, PR.AA-01 | Trigger `handle_new_user` solo lee `app_metadata`; promoción de admins con `promote_invited_admin()` (solo `service_role`) y permiso `admins:invite` | Crítico | Bajo | Mitigado |
| Autenticación (Paula) | A01/A07 — Confianza en el claim `role` del JWT en RLS y sesión sin verificar (AUTH-POC-2) | PR.AA-05, PR.AA-02 | RLS con `is_admin_or_owner()` (tabla `user_roles`); `getVerifiedSession()` con `auth.getUser()` en servidor | Medio | Bajo (RLS) / Medio (sesión: quedan 2 lectores fuera del módulo) | Mitigado parcialmente |
| Autenticación (Paula) | A03 — Inyección en filtro PostgREST, introducida (AUTH-POC-3) | PR.DS-10 | Filtro parametrizado `.eq()` sobre UUID validado; nombre comparado en código | Alto (estimado) | Bajo | Mitigado |
| Autenticación (Paula) | A03 — XSS reflejado en `/auth/error`, introducido (AUTH-POC-4) + inyección de texto (O-04) | PR.PS-06, PR.DS-01 | Sink eliminado; allowlist de códigos resuelta en servidor; CSP global con nonce sin `'unsafe-inline'` | Alto | Bajo | Mitigado |
| Autenticación (Paula) | A01/A08 — Open redirect vía `callbackUrl` (AUTH-POC-5) | PR.PS-06, PR.DS-02 | `resolveSafeRedirectPath`: solo rutas del mismo origen, en login y callback OAuth | Alto | Bajo | Mitigado |
| Autenticación (Paula) | A05/A07 — Cookies de sesión legibles desde JS (O-10) | PR.DS-02, PR.AA-03 | Cookies `HttpOnly` + `Secure` (prod) + `SameSite=Lax`; lecturas autenticadas del navegador vía Server Actions | Medio | Bajo | Mitigado |
| Autenticación (Paula) | A09 — Log injection / atribución forjada en eventos de login (AUTH-POC-6) | DE.CM-01, DE.AE-02/03 | Login fallido sin actor; email solo en metadata si es válido; motivo con código cerrado; portal auditado; sin token en logs | Alto | Bajo (PoC) / Medio (cobertura de eventos y alertas) | Mitigado parcialmente |

---

## 3. AUTH-PAT-1 — AUTH-POC-1 · Rol de registro controlado por el cliente

**Ficha.** Responsable: Paula · Tarea: P3.1 · Rama: `security/auth/fase3-parches` · PR #19 · Commit:
`1ef0b61`.

**Mapeo.** OWASP A01 (escalamiento vertical). NIST CSF 2.0: PR.AA-05 (menor privilegio), PR.AA-01. Riesgo
Fase 1: **AUTH-R01 (Crítico 12)**, compartido con US-R01 (Usuarios). Archivos:
`packages/db/supabase/migrations/20261021000001_auth_signup_role_hardening.sql`,
`packages/core/src/auth/index.ts` (`inviteAdminByEmail`),
`apps/panel-admin/src/features/invitations/services/createAdminAccountAction.ts`.

**Diff (antes → después).**
```sql
-- ANTES (20260512000002): el rol salía del `data` del signup público
CAST(coalesce(new.raw_app_meta_data ->> 'role', new.raw_user_meta_data ->> 'role', 'client') as public.user_role)

-- DESPUÉS (20261021000001): solo app_metadata (no controlable por el cliente)
case new.raw_app_meta_data ->> 'role'
  when 'owner' then 'owner'::public.user_role
  when 'admin' then 'admin'::public.user_role
  else 'client'::public.user_role
end
```
```ts
// ANTES: la invitación dependía de user_metadata.role (el mismo campo del ataque)
options.data = { role: "admin", full_name };

// DESPUÉS: el servidor promueve al invitado; la función solo la ejecuta service_role
options.data = { full_name };
await supabase.rpc(RPC_FUNCTIONS.PROMOTE_INVITED_ADMIN, { p_user_id: data.user.id });
```
Además: `createAdminAccountAction` exige `admins:invite` (antes era una Server Action pública sin permiso) y se
elimina `sync_role_to_jwt()` (huérfana; copiaba el rol a metadata editable por el usuario).

**Prueba de regresión.** En vivo — `evidencias/P3.1-AUTH-POC-1-retest.txt`: el mismo `curl` de signup con
`"role":"admin"` crea la cuenta como `client`; una invitación sigue creando un admin con sus permisos base;
`promote_invited_admin` responde `42501 permission denied` a `anon` y a `authenticated`. Sin test automatizado:
la lógica vive en un trigger de Postgres y el repo no tiene infraestructura de tests de base de datos (pgTAP).

**Riesgo residual: Bajo.** La causa raíz está eliminada: ningún dato del cliente decide el rol. Laxitud
restante, que no reabre la PoC: las cuentas escaladas **antes** del parche no se degradan solas. Consulta de
detección para el despliegue (admins sin `app_metadata.role` ni invitación registrada):
```sql
select u.email, ur.role, u.created_at
from public.user_roles ur join auth.users u on u.id = ur.user_id
where ur.role = 'admin'
  and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
  and not exists (select 1 from public.pending_invitations pi where pi.user_id = u.id);
```
En el entorno local devuelve solo `attacker-escalation@poc.local` (la cuenta de la PoC de la Fase 2).

---

## 4. AUTH-PAT-2 — AUTH-POC-2 · Claim del JWT en RLS y sesión no verificada

**Ficha.** Responsable: Paula · Tarea: P3.1 · Rama: `security/auth/fase3-parches` · PR #19 · Commit:
`e1994f9`.

**Mapeo.** OWASP A01 + A07. NIST CSF 2.0: PR.AA-05, PR.AA-02, PR.AA-03. Riesgos Fase 1: **AUTH-R07 (Medio 4)**
para (a) y **AUTH-R10 (Bajo 2)** para (b). *(En `fase-2-pocs.md` la PoC figuraba con "AUTH-R02 / AUTH-R03";
se corrigió a R07/R10 el 2026-10-22, con nota en la propia ficha.)* Archivos:
`packages/db/supabase/migrations/20261021000002_auth_rls_business_role.sql`,
`packages/core/src/auth/server/getVerifiedSession.ts` y sus usos.

**Diff (antes → después).**
```sql
-- ANTES: el claim top-level `role` es el rol de Postgres ('authenticated'), nunca 'admin'
CREATE POLICY "Rooms are manageable by admins only" ON public.rooms
    USING (auth.jwt() ->> 'role' = 'admin');

-- DESPUÉS: rol de negocio desde user_roles (mismo patrón que amenities y system_settings)
create policy "Rooms are manageable by admins and owners" on public.rooms
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
-- ídem room_schedules y room_images
```
```ts
// ANTES (getServerAuthContext, refreshSession, panel): decodifica la cookie sin verificar
const { data } = await supabase.auth.getSession();
const user = data.session?.user ?? null;

// DESPUÉS: getVerifiedSession() → auth.getUser() valida el JWT contra Supabase Auth
const { session, user } = await getVerifiedSession(supabase);
```

**Prueba de regresión.** `packages/core/src/auth/server/getVerifiedSession.test.ts` (3 ✓): token rechazado →
sin sesión aunque la cookie exista; sin sesión → sin log; el usuario verificado reemplaza al de la cookie. En
vivo — `evidencias/P3.1-AUTH-POC-2-retest.txt`: un `client` con `user_metadata.role = "admin"` actualiza 0 filas
de `rooms` y el admin real 1; un token con el `sub` cambiado al del admin y la firma original recibe
`403 bad_jwt` de `/auth/v1/user`.

**Riesgo residual: Bajo para (a), Medio para (b).**
- (a) Ninguna política confía ya en el claim `role` del JWT.
- (b) Los lectores del módulo usan `getUser()`, pero quedan lectores con `getSession()` fuera del módulo:
  `apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts` (Fabian) y
  `apps/panel-admin/src/features/admins-table/services/permissions.ts` (Joseph). También queda el helper
  `getSession()` de `packages/core/src/auth/index.ts`, marcado `@deprecated` y sin uso. Mitigación parcial: el
  middleware del panel valida con `getUser()` en `/admin/**` y la RLS de la base vuelve a verificar el JWT.

---

## 5. AUTH-PAT-3 — AUTH-POC-3 · Inyección en filtro PostgREST (introducida)

**Ficha.** Responsable: Paula · Tarea: P3.1 · Rama: `security/auth/fase3-parches` · PR #19 · Commits:
`b5e546b` (fix), `858546d` (caso de test con el payload que funciona en vivo).

**Mapeo.** OWASP A03 (clase PostgREST) + A01 (divulgación). NIST CSF 2.0: PR.DS-10, PR.AA-05. Sin escenario en
la Fase 1: la vulnerabilidad se **introdujo** en la Fase 2 (plan §4.1); riesgo inherente estimado **Alto**
(divulgación masiva de PII, sin autenticación). Archivo:
`apps/portal-reservas/src/features/auth/services/lookupAccount.server.ts`.

**Diff (antes → después).**
```ts
// ANTES: el input del usuario forma parte de la sintaxis del filtro
const filter = `${c.full_name}.ilike.%${input.name}%,${c.id}.eq.${input.accountId}`;
await supabase.from(DB_TABLES.PROFILES).select(/* … */).or(filter).limit(50);

// DESPUÉS: UUID validado, filtro parametrizado y nombre comparado en código (sin comodines)
if (!name || name.length > MAX_NAME_LENGTH || !UUID_PATTERN.test(accountId)) return [];
const { data } = await supabase.from(DB_TABLES.PROFILES).select(/* … */).eq(c.id, accountId).maybeSingle();
if (!row.full_name || normalizeName(row.full_name) !== name) return [];
```

**Prueba de regresión.** `lookupAccount.server.test.ts` reescrito (6 ✓): no se llama a `.or()` ni a `.ilike()`;
el payload de la Fase 2 y el que volcaba la tabla en vivo no devuelven nada; un `accountId` no UUID se rechaza
antes de consultar; `%`, `_`, `*` no amplían la búsqueda. En vivo — `evidencias/P3.1-AUTH-POC-3-retest.txt`: el
filtro vulnerable devolvía 7/7 perfiles; la consulta del parche, 0. *(El payload documentado originalmente en
la Fase 2 fallaba en vivo con `22P02`; se corrigió en `fase-2-pocs.md`.)*

**Riesgo residual: Bajo.** Ya no hay strings de filtro construidos con input del usuario. Queda, como en
OP-POC-1, que la función corre con el cliente service-role; acotarla a una función `SECURITY DEFINER` sería una
mejora de menor privilegio que no reabre la PoC.

---

## 6. AUTH-PAT-4 — AUTH-POC-4 · XSS reflejado en `/auth/error` (introducido) + O-04

**Ficha.** Responsable: Paula · Tarea: P3.2 · Rama: `security/auth/fase3-xss-csp` · PR #20 · Commit:
`caa2f95`.

**Mapeo.** OWASP A03 (XSS reflejado). NIST CSF 2.0: PR.PS-06, PR.DS-01. Riesgo Fase 1: **AUTH-R08 (Medio 6)**,
que la Fase 1 marcaba "sube a Alto si la PoC logra XSS" → **Alto** tras AUTH-POC-4. Archivos:
`apps/portal-reservas/src/app/auth/error/{page.tsx, AuthErrorContent.tsx, resolveAuthError.ts}` (se elimina
`authErrorHtml.ts`).

**Diff (antes → después).**
```tsx
// ANTES: el query param se renderizaba como HTML
return { __html: raw };                                   // authErrorHtml.ts
<p dangerouslySetInnerHTML={errorDetailHtml} />           // AuthErrorContent.tsx
// …y error_description también se reflejaba como texto (O-04, phishing)

// DESPUÉS: el servidor resuelve una clave de allowlist; al cliente solo llega esa clave
const errorKey = resolveAuthErrorKey(await searchParams);  // page.tsx
<AuthErrorContent errorKey={errorKey} />
<p>{t.AUTH.ERRORS[errorKey]}</p>                          // solo copy propio de la app
```

**Prueba de regresión.** `resolveAuthError.test.ts` (4 ✓; reemplaza `authErrorHtml.test.ts`, que afirmaba el
sink): códigos conocidos → su clave; desconocido, repetido o ausente → `UNKNOWN_ERROR`; `error_description` se
ignora; marcado o texto libre en `error` nunca se refleja. En vivo — `evidencias/P3.2-AUTH-POC-4-retest.txt` y
`P3.2-AUTH-POC-4-fixed.jpg`: la URL de la PoC ya no inyecta marcado ni el payload llega como prop al componente.

**Riesgo residual: Bajo.** Sink eliminado y parámetros no reflejados (cierra también O-04). Segunda capa en
AUTH-PAT-5.

---

## 7. AUTH-PAT-5 — CSP global con nonce y cabeceras de seguridad

**Ficha.** Responsable: Paula · Tarea: P3.2 · Rama: `security/auth/fase3-xss-csp` · PR #20 · Commit:
`ee693e6`. Archivo compartido (§4.4): `middleware.ts` de las 3 apps — aviso al equipo en el PR #20.

**Mapeo.** OWASP A05 (configuración) como defensa en profundidad contra A03 (XSS). NIST CSF 2.0: PR.PS-01,
PR.DS-02. Riesgo Fase 1: **AUTH-R06 (Medio 6)** — "sin CSP, nada limita el script". Archivos:
`packages/core/src/security/index.ts`, `apps/{portal-reservas,panel-admin,landing}/src/middleware.ts`,
`apps/portal-reservas/src/app/layout.tsx`.

**Diff (antes → después).**
```ts
// ANTES: ninguna app enviaba CSP ni cabeceras de seguridad

// DESPUÉS: nonce por request en el middleware de cada app
const { requestHeaders, csp } = prepareSecurityHeaders(request.headers, { isDev, supabaseUrl });
const response = NextResponse.next({ request: { headers: requestHeaders } });
applySecurityHeaders(response.headers, csp, isDev);
// script-src 'self' 'nonce-…' 'strict-dynamic' (sin 'unsafe-inline'); object-src 'none';
// base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests (prod)
// + nosniff, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy, HSTS (prod)
```
El matcher del middleware del panel se amplió a todas las rutas (antes `/admin/*`), manteniendo el control de
sesión solo en `/admin`. El layout del portal llama a `headers()` para que todas las páginas sean dinámicas y
reciban el nonce.

**Prueba de regresión.** `packages/core/src/security/index.test.ts` (8 ✓): `script-src` sin `'unsafe-inline'`,
nonce + `strict-dynamic`, directivas de bloqueo, mismo nonce en request y response, HSTS solo en producción. En
vivo — `evidencias/P3.2-AUTH-POC-4-csp-blocks-sink.jpg`: con el sink de la Fase 2 **restaurado a propósito**, el
`<img onerror>` se inyecta pero el navegador bloquea el handler (violación de CSP en consola). Build de
producción del portal: 17/17 scripts con nonce, 0 violaciones; panel y landing sin violaciones.

**Riesgo residual: Bajo.** Un sink HTML que reaparezca no ejecuta script inline. Laxitud aceptada:
`style-src 'unsafe-inline'` (estilos inline de Tailwind/HeroUI; no ejecuta script). Recursos de otros orígenes
deben agregarse a la política (aviso en el PR #20).

---

## 8. AUTH-PAT-6 — AUTH-POC-5 · Open redirect vía `callbackUrl`

**Ficha.** Responsable: Paula · Tarea: P3.3 · Rama: `security/auth/fase3-redirect-cookies-audit` · PR #21 ·
Commit: `164676f`.

**Mapeo.** OWASP A01 (unvalidated redirect) + A08 (manipulación de parámetros). NIST CSF 2.0: PR.PS-06,
PR.DS-02. Riesgo Fase 1: **AUTH-R02 (Alto 9)**. Archivos: `packages/core/src/auth/shared/safeRedirect.ts`,
`apps/portal-reservas/src/app/auth/callback/route.ts`,
`apps/portal-reservas/src/features/auth/services/loginAction.ts`.

**Diff (antes → después).**
```ts
// ANTES: new URL(absoluta, origin) ignora origin; redirect() acepta URLs externas
const callbackUrl = searchParams.get(CALLBACK_SEARCH_PARAMS.CALLBACK_URL) || ROUTES.HOME;
return NextResponse.redirect(new URL(callbackUrl, origin));      // callback/route.ts
redirect(callbackUrl || ROUTES.HOME);                            // loginAction.ts

// DESPUÉS: solo rutas del mismo origen, normalizadas; si no, inicio
const callbackUrl = resolveSafeRedirectPath(searchParams.get(CALLBACK_SEARCH_PARAMS.CALLBACK_URL), ROUTES.HOME);
redirect(resolveSafeRedirectPath(callbackUrl, ROUTES.HOME));
```

**Prueba de regresión.** `packages/core/src/auth/shared/safeRedirect.test.ts` (6 ✓): absolutas, `//host`,
`javascript:`, `/\host`, tab/CR/LF, `/..//host` y `/.//host` → fallback; `%2F%2F` queda como ruta inerte. En vivo
— `evidencias/P3.3-AUTH-POC-5-cookies-retest.txt` y capturas `P3.3-AUTH-POC-5-step{1,2}-*.jpg`: el mismo enlace
de la Fase 2 (`/auth/login?callbackUrl=https://example.com/`) termina en `localhost:3001/`; el callback con un
`code` PKCE real y `https://evil.example/phish` o `//evil.example` redirige a `localhost:3001/`, y una ruta
interna de control se respeta.

**Riesgo residual: Bajo.** Ambos flujos aceptan solo rutas internas. El login del panel ya usaba una ruta fija.

---

## 9. AUTH-PAT-7 — Cookies de sesión `HttpOnly` / `Secure` / `SameSite` (O-10)

**Ficha.** Responsable: Paula · Tarea: P3.3 · Rama: `security/auth/fase3-redirect-cookies-audit` · PR #21 ·
Commit: `ea95951`. Toca código de Operaciones (Aarón) con aprobación de Paula; aviso en el PR #21.

**Mapeo.** OWASP A05 + A07. NIST CSF 2.0: PR.DS-02, PR.AA-03. Riesgo Fase 1: **AUTH-R06 (Medio 6)** — un XSS lee
las cookies de sesión. Archivos: `packages/db/src/client.ts`,
`apps/portal-reservas/src/features/auth/{services/sessionActions.ts, services/authSessionService.ts,
hooks/useAuthSession.ts}`, `apps/panel-admin/src/features/rooms/{services/scheduleActions.ts,
services/scheduleService.ts, services/amenityActions.ts, components/**/hooks/*}`.

**Diff (antes → después).**
```ts
// ANTES: defaults de @supabase/ssr → httpOnly: false (token legible por document.cookie)
createServerClient(url, anonKey, { cookies: { getAll, setAll } });

// DESPUÉS
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
createServerClient(url, anonKey, { cookieOptions: SESSION_COOKIE_OPTIONS, cookies: { getAll, setAll } });
```
Como el cliente del navegador deja de ver la sesión, lo que dependía de él pasa a Server Actions: header y
cierre de sesión del portal (`getSessionUserAction`, `signOutAction`), y horarios y carga de amenidades del panel
(`getRoomSchedulesAction`, `saveRoomSchedulesAction`, `getRoomAmenitiesFormDataAction`).

**Prueba de regresión.** En vivo — `evidencias/P3.3-AUTH-POC-5-cookies-retest.txt`: `Set-Cookie:
sb-127-auth-token=…; HttpOnly; SameSite=lax`; con sesión iniciada en portal y panel, `document.cookie` está
vacío. No regresión: login/logout del portal; horarios guardados por Server Action con la cookie del admin,
mientras que la escritura anónima previa ahora recibe RLS `42501`; amenidades cargadas (10 del catálogo, 7 de la
habitación). Sin test automatizado de las opciones de cookie (configuración; verificada en vivo).

**Riesgo residual: Bajo.** El token no es accesible desde JavaScript. `Secure` se aplica solo en producción
(dev corre en `http://localhost`).

---

## 10. AUTH-PAT-8 / AUTH-PAT-9 — AUTH-POC-6 · Log injection en login + token en logs (O-01)

**Ficha.** Responsable: Paula · Tarea: P3.4 · Rama: `security/auth/fase3-redirect-cookies-audit` · PR #21 ·
Commit: `ee4a491`. Complementa la F3.3 de Fabian (saneo en el sink e IP de fuente confiable); su API no se
modificó.

**Mapeo.** OWASP A09 + A03 (log injection, CWE-117). NIST CSF 2.0: DE.CM-01, DE.AE-02/03, PR.DS-01. Riesgos
Fase 1: **AUTH-R04 (Alto 9)** y **AUTH-R11 (Bajo 3)**. Archivos:
`packages/core/src/auth/shared/loginAudit.ts`, `packages/core/src/auth/server/loginAction.ts`,
`apps/panel-admin/src/features/auth/services/loginAction.ts`,
`apps/portal-reservas/src/features/auth/services/loginAction.ts`.

**Diff (antes → después).**
```ts
// ANTES: el email tecleado como actor y el mensaje crudo del proveedor
await logAuditEvent({
  actorEmail: email,
  action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
  metadata: { email, reason: error?.message ?? "Invalid credentials" },
  ipAddress, userAgent,
});
console.log(`Session created for user ${user.id}: ${session?.access_token}`);   // core loginAction

// DESPUÉS: sin actor; email solo si es válido; motivo con código cerrado; sin token en logs
await logAuditEvent({
  actorEmail: null,
  action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
  metadata: buildFailedLoginMetadata(email, loginFailureReasonFromAuthError(error)),
  ipAddress, userAgent,
});
```
El portal, que no auditaba sus logins, ahora registra fallidos y exitosos con las mismas reglas.

**Prueba de regresión.** `loginAudit.test.ts` (7 ✓) y 3 casos nuevos en `loginAction.test.ts` (6 ✓ en total):
el payload con CR/LF no aparece en el evento, un email válido queda solo como `attempted_email`, el actor es el
usuario autenticado y el `access_token` no se imprime. En vivo — `evidencias/P3.4-AUTH-POC-6-retest.txt`: los
payloads de la Fase 2 se enviaron por HTTP crudo (CR/LF reales y `X-Forwarded-For: 10.0.0.1`) a panel y portal;
las filas quedan sin actor, sin la línea forjada y sin la IP falsa; `verify_audit_chain()` sigue íntegra y los
logs del servidor no contienen el token.

**Riesgo residual: Bajo para AUTH-POC-6 y AUTH-R11; Medio para AUTH-R04.** La atribución forjada, el texto libre
y el token en logs quedan eliminados. AUTH-R04 es más amplio que la PoC: los eventos de registro, activación y
cierre de sesión todavía no se auditan, y no hay alertas automáticas (la detección depende de revisar el visor).
`ip_address` queda `null` mientras no se configure `AUDIT_TRUSTED_PROXY_HOPS` (correcto en dev; en producción
detrás de un proxy se registra la IP real).

---

## 11. Riesgos de la Fase 1 sin parche en esta fase

No corresponden a ninguno de los 3 vectores del enunciado ni tuvieron PoC, así que su riesgo residual es igual
al inherente. Quedan como trabajo posterior.

| Riesgo | Inherente = residual | Situación | Control pendiente |
|---|---|---|---|
| AUTH-R03 Fuerza bruta / credential stuffing | Alto (9) | `minimum_password_length = 6`, MFA (`enroll_enabled = false`) y captcha deshabilitados; solo el rate limit por IP de Supabase | Contraseña ≥ 12, MFA para admins, captcha y límite por cuenta |
| AUTH-R05 Reactivación de un admin desactivado vía `activateAdminAction` | Medio (6) | Sin cambios | Verificar el estado de la invitación antes de activar (coordinado con Joseph) |
| AUTH-R09 Enumeración de cuentas por mensajes de registro/login | Medio (4) | Sin cambios | Mensaje genérico en registro |
| AUTH-R12 `Origin` manipulado en el correo de verificación | Bajo (3) | `loginAction`/`signUp-action` del portal siguen usando la cabecera `origin` | Usar `ENV.APP_URL` fijo; la allowlist de redirecciones de Supabase limita el impacto |

---

## 12. Pruebas de regresión (P3.5)

| Hallazgo | Test automatizado | Re-test en vivo |
|---|---|---|
| AUTH-POC-1 | — (trigger SQL; sin infraestructura de tests de BD) | `P3.1-AUTH-POC-1-retest.txt` |
| AUTH-POC-2 | `packages/core/src/auth/server/getVerifiedSession.test.ts` (3) | `P3.1-AUTH-POC-2-retest.txt` |
| AUTH-POC-3 | `apps/portal-reservas/src/features/auth/services/lookupAccount.server.test.ts` (6) | `P3.1-AUTH-POC-3-retest.txt` |
| AUTH-POC-4 / O-04 | `apps/portal-reservas/src/app/auth/error/resolveAuthError.test.ts` (4) | `P3.2-AUTH-POC-4-retest.txt`, `P3.2-AUTH-POC-4-fixed.jpg` |
| CSP | `packages/core/src/security/index.test.ts` (8) | `P3.2-AUTH-POC-4-csp-blocks-sink.jpg` |
| AUTH-POC-5 | `packages/core/src/auth/shared/safeRedirect.test.ts` (6) | `P3.3-AUTH-POC-5-cookies-retest.txt`, `P3.3-AUTH-POC-5-step{1,2}-*.jpg` |
| O-10 cookies | — (configuración) | `P3.3-AUTH-POC-5-cookies-retest.txt` |
| AUTH-POC-6 / O-01 | `packages/core/src/auth/shared/loginAudit.test.ts` (7), `packages/core/src/auth/server/loginAction.test.ts` (6) | `P3.4-AUTH-POC-6-retest.txt` |

```bash
pnpm --filter @hotel/core exec vitest run src/auth src/security        # 43 ✓
pnpm --filter @hotel/portal-reservas exec vitest run src/features/auth src/app/auth   # 18 ✓
```

---

## 13. Coordinación y pendientes

| Con | Tema | Estado |
|---|---|---|
| Joseph (Usuarios) | `requirePermission.ts` usa `getVerifiedSession()`; `createAdminAccountAction` exige `admins:invite` (PR #19) | Avisado en el PR #19 |
| Joseph | `admins-table/services/permissions.ts` todavía usa `getSession()` (deja AUTH-POC-2 (b) en Medio) | Pendiente en su módulo |
| Aarón (Operaciones) | RLS de `rooms`/`room_schedules`/`room_images` (PR #19); horarios y amenidades vía Server Actions (PR #21) | Avisado en los PR #19 y #21 |
| Fabian (Auditoría) | `getAuditLogs.ts` todavía usa `getSession()`; `auth.login.failed` ahora sin actor (email en `metadata.attempted_email`) | Avisado en los PR #19 y #21 |
| Fabian | Payload de AUTH-POC-3 corregido en `fase-2-pocs.md` (para G2) | Avisado en el PR #19 |
| Despliegue | Ejecutar la consulta de §3 y degradar las cuentas auto-escaladas antes del parche | Pendiente |
| Equipo | Recursos de otros orígenes deben agregarse a la CSP (`packages/core/src/security`) | Avisado en el PR #20 |
