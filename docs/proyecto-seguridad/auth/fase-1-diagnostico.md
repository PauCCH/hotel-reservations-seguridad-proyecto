# Fase 1 — Diagnóstico NIST CSF 2.0 · Módulo de Autenticación (`auth`)

- **Responsable:** Paula
- **Rama:** `security/auth/fase1-diagnostico`
- **Commit base analizado:** `5af5fb1` (`develop`, 2026-09-28) para P1.1; `11fa71e` para P1.2 (el merge de
  `develop` solo trajo documentación, el código del módulo no cambió)
- **Estado:** P1.1 a P1.4 completos · pendiente P1.5 (entrega por PR)

> Escala usada para valorar activos (C/I/D = confidencialidad, integridad, disponibilidad):
> **A** = alto, **M** = medio, **B** = bajo. La criticidad del activo es el valor más alto de las tres.

---

## 1. Inventario de activos (P1.1) — NIST CSF ID.AM

### 1.1 Activos de información (datos)

| ID | Activo | Dónde vive | Quién lo usa | C | I | D | Criticidad |
|---|---|---|---|---|---|---|---|
| AUTH-D01 | Credenciales de usuario (email + hash de contraseña) | `auth.users` (Supabase Auth) | Portal (clientes), panel (admins/owner) | A | A | M | **Alta** |
| AUTH-D02 | Sesión: `access_token` (JWT, 1 h) y `refresh_token` (con rotación) | Cookies `sb-<ref>-auth-token` que escribe `@supabase/ssr` en los 3 orígenes; memoria del navegador | Middlewares, server actions, cliente de navegador | A | A | M | **Alta** |
| AUTH-D03 | Claims del JWT (`sub`, `email`, `role` de Postgres, `user_metadata`, `app_metadata`) | Dentro de AUTH-D02 | Políticas RLS que usan `auth.uid()` y `auth.jwt()` | M | **A** | M | **Alta** |
| AUTH-D04 | Rol de la cuenta (`owner` / `admin` / `client`) | `public.user_roles` (se asigna en el trigger `handle_new_user`) | `verifyAdminRole`, RLS de varias tablas | M | **A** | M | **Alta** |
| AUTH-D05 | Estado de la cuenta (`profiles.is_active`) | `public.profiles` | Middleware del panel, `verifyAdminRole` | B | A | M | **Alta** |
| AUTH-D06 | Tokens de invitación/activación de admin (`access_token`, `refresh_token`, `type=invite` en el fragmento `#` de la URL) | Enlace del correo de invitación → `panel-admin/auth/activate` | `useActivationToken`, `verifyTokenAction`, `activateAdminAction` | A | A | B | **Alta** |
| AUTH-D07 | Invitaciones pendientes (`email`, `status`, `expires_at`, `invited_by`) | `public.pending_invitations` | Flujo de activación (compartido con Users/Joseph) | M | A | B | Media-Alta |
| AUTH-D08 | Código OAuth / PKCE (`code`) y parámetro `callbackUrl` | Query string de `portal-reservas/auth/callback` | `callback/route.ts`, `oauthService` | A | A | B | **Alta** |
| AUTH-D09 | Enlaces de verificación de email (signup) | Correo enviado por Supabase Auth → `/auth/callback` | `registerAction`, `loginAction` del portal (reenvío) | M | A | B | Media |
| AUTH-D10 | Datos de perfil al registrarse (`full_name`, metadatos libres de `signUp`) | `raw_user_meta_data` → `public.profiles` | Trigger `handle_new_user` | M | A | B | Media |
| AUTH-D11 | Eventos de auditoría de login (`auth.login.success/failed`, email, IP, user-agent, motivo) | `public.audit_logs` (módulo de Fabian) | Visor de auditoría del panel | M | **A** | M | **Alta** |
| AUTH-D12 | Logs de servidor (consola) de los flujos de auth | stdout del proceso Next.js | Operación / depuración | **A** (ver obs. O-01) | B | B | **Alta** |

### 1.2 Servicios externos y de plataforma

| ID | Servicio | Función en auth | Configuración relevante | Criticidad |
|---|---|---|---|---|
| AUTH-S01 | **Supabase Auth (GoTrue)** | Login con contraseña, signup, invitaciones, emisión/rotación de JWT, verificación de email | `config.toml`: `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `minimum_password_length = 6`, `enable_confirmations = false` (en la sección local), `secure_password_change = false`, `site_url = http://127.0.0.1:3000` | **Alta** |
| AUTH-S02 | **Rate limiting de Supabase Auth** | Límite de fuerza bruta a nivel de proveedor | `sign_in_sign_ups = 30` por 5 min por IP, `email_sent = 2`/h; **captcha deshabilitado** | Alta |
| AUTH-S03 | **Google OAuth** (vía Supabase) | Login social en el portal | `signInWithOAuth` con `redirectTo` = `window.location.origin` + `/auth/callback?callbackUrl=…` | Alta |
| AUTH-S04 | **Postgres de Supabase + RLS** | Almacena roles y perfiles; aplica autorización con los claims del JWT | Triggers `SECURITY DEFINER` sobre `auth.users` | **Alta** |
| AUTH-S05 | **Correo transaccional** | Supabase Auth envía los correos de invitación y verificación (SMTP del proyecto). Resend (`packages/core/src/email`) se usa para otros correos de la app | SMTP propio comentado en `config.toml`; por confirmar qué proveedor usa el proyecto remoto | Media |
| AUTH-S06 | **Next.js middleware** (Edge) | Refresca la sesión (portal) y protege `/admin/**` (panel) | `matcher` del portal: todo menos estáticos; panel: `/admin/:path*`; landing: sin auth | Alta |

### 1.3 Secretos y configuración

| ID | Activo | Ubicación | Exposición | Criticidad |
|---|---|---|---|---|
| AUTH-K01 | `SUPABASE_SERVICE_ROLE_KEY` (salta RLS) | `.env.local`; se usa en `createSupabaseServiceClient` (servidor y middleware del panel) | Solo servidor; nunca debe llegar al bundle del cliente | **Crítica** |
| AUTH-K02 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`; incluidos en el bundle del navegador | Pública por diseño: cualquiera puede llamar directo a la API de Supabase Auth | Alta (por lo que permite) |
| AUTH-K03 | Secreto de firma JWT del proyecto Supabase | Panel de Supabase (no en el repo) | Gestionado por Supabase | **Crítica** |
| AUTH-K04 | Client ID/secret de Google OAuth | Panel de Supabase / Google Cloud | No en el repo | Alta |
| AUTH-K05 | `RESEND_API_KEY` | `.env.local` | Solo servidor | Media |
| AUTH-K06 | Cabeceras de seguridad y CSP (`next.config.ts` ×3) | `apps/*/next.config.ts` | **No hay** CSP, HSTS, `X-Frame-Options` ni `Referrer-Policy` configuradas (dueña: Paula, §4.4) | Alta |

### 1.4 Componentes de software y endpoints

| ID | Componente | Archivo | Tipo | Entrada controlada por el usuario |
|---|---|---|---|---|
| AUTH-C01 | `loginAction` (core, genérico) | `packages/core/src/auth/server/loginAction.ts` | Server action | `email`, `password`, `redirectTo` |
| AUTH-C02 | `loginAction` del panel | `apps/panel-admin/src/features/auth/services/loginAction.ts` | Server action (POST `/auth/login`) | `email`, `password` |
| AUTH-C03 | `loginAction` del portal | `apps/portal-reservas/src/features/auth/services/loginAction.ts` | Server action (POST `/auth/login`) | `email`, `password`, **`callbackUrl`**; cabecera `Origin` |
| AUTH-C04 | `registerAction` (+ `signUp` de core) | `apps/portal-reservas/src/features/auth/services/signUp-action.ts`, `packages/core/src/auth/index.ts` | Server action (POST `/auth/register`) | `fullName`, `email`, `password`; cabecera `Origin` → `emailRedirectTo` |
| AUTH-C05 | Callback OAuth / verificación de email | `apps/portal-reservas/src/app/auth/callback/route.ts` | Route handler GET `/auth/callback` | `code`, **`callbackUrl`** |
| AUTH-C06 | Página de error de auth | `apps/portal-reservas/src/app/auth/error/{page,AuthErrorContent}.tsx` | Página GET `/auth/error` | **`error`, `error_description`** (se muestran en la página) |
| AUTH-C07 | Login con Google | `apps/portal-reservas/src/features/auth/services/oauthService.ts` | Cliente | `callbackUrl` |
| AUTH-C08 | Activación de admin | `apps/panel-admin/src/app/auth/activate/page.tsx`, `hooks/useActivationToken.ts`, `services/verifyTokenAction.ts`, `services/activateAdminAction.ts` | Página + 2 server actions | `access_token`, `refresh_token`, `type`, `password` |
| AUTH-C09 | `verifyActivationToken` / `completeAdminActivation` | `packages/core/src/auth/index.ts` | Lógica de servidor (usa service role) | Tokens + contraseña |
| AUTH-C10 | `verifyAdminRole` | `packages/core/src/auth/index.ts` | Lógica de servidor (service role) | `userId` de la sesión |
| AUTH-C11 | `getServerAuthContext`, `refreshSession`, `getAuthContextAction` | `packages/core/src/auth/server/*`, `apps/panel-admin/src/features/auth/services/getAuthContextAction.ts` | Server actions / SSR | Cookies de sesión |
| AUTH-C12 | `signOutAction` (core y panel) | `packages/core/src/auth/server/signOutAction.ts`, `apps/panel-admin/.../signOutAction.ts` | Server action | Cookies de sesión |
| AUTH-C13 | Cliente de sesión del navegador | `packages/core/src/auth/client/*`, `apps/portal-reservas/src/features/auth/services/authSessionService.ts` | Cliente | — |
| AUTH-C14 | Middleware del panel | `apps/panel-admin/src/middleware.ts` | Middleware | Cookies; consulta `profiles.is_active` con service role |
| AUTH-C15 | Middleware del portal | `apps/portal-reservas/src/middleware.ts` | Middleware | Cookies (solo refresca la sesión, no protege rutas) |
| AUTH-C16 | Middleware del landing | `apps/landing/src/middleware.ts` | Middleware | Solo locale; sin auth |
| AUTH-C17 | Fábricas de cliente Supabase | `packages/db/src/client.ts` | Librería | Opciones de cookies (se usan los valores por defecto de `@supabase/ssr`) |
| AUTH-C18 | Hidratación de sesión del panel: `getInitialAuthStatus` + `AuthProvider` propio | `apps/panel-admin/src/shared/services/getInitialAuthStatus.ts`, `apps/panel-admin/src/shared/auth/context/AuthProvider.tsx`, `apps/panel-admin/src/app/layout.tsx` | SSR + contexto de cliente | Cookies de sesión |

> **Nota (P1.2):** de los componentes de `packages/core/src/auth/server/*` (C01, C11 y C12 de core),
> ninguna app importa `loginAction`, `loginFormAction`, `signOutAction`, `refreshSession` ni
> `getServerAuthContext`. Cada app usa su propia versión (C02, C03, C18). Son código exportado sin uso.

### 1.5 Objetos de base de datos del módulo

| ID | Objeto | Migración | Nota |
|---|---|---|---|
| AUTH-B01 | Trigger `on_auth_user_created` → `handle_new_user()` (`SECURITY DEFINER`) | `20260409000001_sync_auth_users_trigger.sql`, redefinido en `20260512000002_users-table-policies.sql` | Crea `profiles` y `user_roles`. El rol sale de `raw_app_meta_data.role` → **`raw_user_meta_data.role`** → `'client'` |
| AUTH-B02 | Trigger `on_user_role_updated` → `sync_role_to_jwt()` | `20260609000003_sync_role_to_jwt.sql` | Copia el rol a `raw_user_meta_data` (claim `user_metadata.role` del JWT). Se definió sobre `public.users.role`, pero esa tabla ya se renombró a `profiles` y perdió la columna `role` (ver O-05) |
| AUTH-B03 | Trigger `on_auth_user_accepted_invite` → `handle_invitation_accepted()` | `20260512000003_create_pending_invitations_table.sql` | Marca la invitación como aceptada por coincidencia de email |
| AUTH-B04 | Tablas `public.user_roles`, `public.profiles` + política "Users can read own role" | `20260512000002_users-table-policies.sql` | Compartidas con Users (Joseph) |

---

## 2. Observaciones preliminares (a confirmar o descartar en Fase 2)

Estas observaciones salen de leer el código durante el inventario. **No son hallazgos confirmados**;
cada una se valida con una PoC en la Fase 2 o se descarta en la bitácora.

| ID | Observación | Evidencia (archivo:línea aprox.) | Vector / OWASP candidato |
|---|---|---|---|
| O-01 | El `access_token` de la sesión y los emails se imprimen en la consola del servidor. **Latente:** ninguna app importa este `loginAction` (ver nota de §1.4), pero sigue exportado y cualquiera podría reutilizarlo | `packages/core/src/auth/server/loginAction.ts:82,125` | A09 (exposición en logs) / DE.CM |
| O-02 | Escalamiento de privilegios en el signup: `handle_new_user` toma el rol de `raw_user_meta_data`, que el propio usuario controla. Con la anon key pública (K02), alguien podría llamar a `/auth/v1/signup` con `data.role = "owner"` | `20260512000002_users-table-policies.sql:58-65` | V1 · A01 / A04 |
| O-03 | Open redirect: `callbackUrl` se usa sin validar en `redirect()` y en `new URL(callbackUrl, origin)`, que acepta URLs absolutas | `portal-reservas/.../loginAction.ts:64`, `app/auth/callback/route.ts:34-35` | V3 · A01 / A08 (manipulación de parámetros) |
| O-04 | Contenido reflejado: `/auth/error` muestra `error` y `error_description` de la query. React escapa el HTML (probable inyección de texto/phishing, no XSS), pero hay que verificarlo | `app/auth/error/AuthErrorContent.tsx:14-28` | V2 · A03 (XSS reflected) |
| O-05 | `sync_role_to_jwt` quedó huérfano (tabla renombrada) y varias políticas RLS comparan `auth.jwt() ->> 'role' = 'admin'`, que en Supabase es el rol de Postgres (`authenticated`), no el rol de negocio | `20260609000003_sync_role_to_jwt.sql`; `rooms_rls_policies`, `create_amenities`, etc. | V1 · A01 (confianza en claims del JWT). Coordinar con Aarón |
| O-06 | Enumeración de usuarios: el portal responde distinto a "email no confirmado" (reenvía y redirige) que a "credenciales inválidas". El registro devuelve `EMAIL_ALREADY_REGISTERED` | `portal-reservas/.../loginAction.ts:41-59`, `signUp-action.ts:92-93` | PR.AA / A07 |
| O-07 | La cabecera `Origin`, que controla el cliente, se usa para construir `emailRedirectTo`. Supabase solo acepta URLs de su lista de redirecciones permitidas, así que el impacto depende de cómo esté configurada esa lista en el proyecto remoto | `loginAction.ts:42` (portal), `signUp-action.ts:84` | V3 · A08 |
| O-08 | El log de auditoría guarda el `email` tecleado y el mensaje de error del proveedor sin normalizar (posible log injection) | `packages/core/src/auth/server/loginAction.ts:96`, `panel-admin/.../loginAction.ts:28,52,64` | V3 · log injection (coordinar con Fabian) |
| O-09 | Política de contraseñas débil en el proveedor (`minimum_password_length = 6`, `secure_password_change = false`); la validación fuerte solo existe en el formulario/Zod | `packages/db/supabase/config.toml:175,211` | PR.AA-01 |
| O-10 | No hay cabeceras de seguridad ni CSP en ninguna app. Las cookies de sesión usan los valores por defecto de `@supabase/ssr`, que las deja legibles desde JS (sin `HttpOnly`) | `apps/*/next.config.ts`, `packages/db/src/client.ts` | V2/V3 · A05 |
| O-11 | Se usa `getSession()` (no verifica el JWT contra el servidor) para hidratar la sesión en SSR | `getServerAuthContext.ts:71`, `refreshSession.ts:41`, `getAuthContextAction.ts:18` | A01 / A07 |
| O-12 | Sin captcha ni bloqueo por cuenta; solo el rate limit por IP de Supabase | `config.toml:180-199` | PR.AA / fuerza bruta |
| O-13 | La activación de admin no exige una invitación. `completeAdminActivation` acepta cualquier par de tokens de sesión válido (el `type=invite` solo se revisa en el navegador), cambia la contraseña y pone `is_active = true`. Un admin desactivado podría obtener tokens directo de la API de Supabase con su contraseña y reactivarse solo | `packages/core/src/auth/index.ts:264-303`, `useActivationToken.ts:26`, `activateAdminAction.ts` | V1 · A01 (evasión de la desactivación) / A07 |
| O-14 | El login, el registro y el OAuth del portal, la activación de admin y el cierre de sesión no registran eventos de auditoría. Solo el login del panel llama a `logAuditEvent` | `portal-reservas/.../loginAction.ts`, `signUp-action.ts`, `callback/route.ts`, `activateAdminAction.ts`, `signOutAction.ts` | DE.CM-03 (coordinar con Fabian) |
| O-15 | El layout del panel pasa el objeto `Session` completo (`access_token` y `refresh_token`) como prop a un componente de cliente, así que viaja serializado en el payload RSC de cada página | `apps/panel-admin/src/app/layout.tsx:15-27`, `getInitialAuthStatus.ts` | PR.DS-02 |

---

## 3. Mapeo de componentes contra NIST CSF 2.0 (P1.2)

Estados: **Cumple** · **Parcial** · **No cumple** · **Por verificar** (requiere PoC, consulta a la BD o
revisar la configuración del proyecto remoto de Supabase). Es el mismo formato que usan Usuarios y Operaciones.

### 3.1 Flujo de datos del módulo (ID.AM-03)

```mermaid
flowchart LR
  CLI["Cliente (portal)"] -->|"login / registro<br/>email, password, callbackUrl"| SAP["Server actions del portal"]
  CLI -->|"OAuth Google"| GOOG["Google"]
  GOOG -->|"code + callbackUrl"| CB["/auth/callback"]
  SAP -->|"signInWithPassword / signUp"| GT["Supabase Auth<br/>auth.users"]
  CB -->|"exchangeCodeForSession (PKCE)"| GT
  ATK["Cualquiera con la anon key"] -.->|"API directa /auth/v1/*"| GT
  GT -->|"trigger handle_new_user"| DB["profiles + user_roles"]
  GT -->|"JWT + refresh token"| CK["Cookies sb-*-auth-token"]
  ADM["Admin (panel)"] -->|"login"| SAA["Server actions del panel"]
  SAA -->|"signInWithPassword"| GT
  SAA -->|"verifyAdminRole (service role)"| DB
  SAA -->|"logAuditEvent"| AUD["audit_logs"]
  INV["Invitado"] -->|"#access_token&refresh_token"| ACT["/auth/activate"]
  ACT -->|"setSession + updateUser<br/>is_active = true (service role)"| DB
  CK -->|"getUser()"| MW["middleware del panel /admin/**"]
  CK -->|"getSession() sin verificar"| SSR["Layout / AuthProvider"]
```

Puntos donde un dato cruza una frontera de confianza:

1. **Navegador → Supabase Auth directo:** la anon key es pública, así que cualquier validación que solo
   haga la app (Zod, criterios de contraseña, rol en metadata) se puede saltar llamando a la API (O-02, O-09).
2. **Query string → `redirect()`:** `callbackUrl` viaja del navegador al servidor sin validarse (O-03).
3. **Fragmento de la URL → server action de activación:** los tokens que llegan desde el correo se aceptan
   sin comprobar que correspondan a una invitación (O-13).
4. **Cookie → SSR:** parte del código lee la sesión con `getSession()`, que no revalida el JWT (O-11), y la
   reenvía completa al navegador (O-15).
5. **Server action → BD con service role:** RLS no aplica. El control depende de `verifyAdminRole` y del
   middleware (C10, C14).

### 3.2 Mapeo por componente

#### Inicio de sesión (panel y portal)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AUTH-C02 `loginAction` del panel | PROTECT | **PR.AA-03** Usuarios, servicios y hardware autenticados | Autentica en el servidor con Supabase y cierra la sesión si la cuenta no es admin/owner activo | Cumple | — |
| | PROTECT | **PR.AA-05** Permisos de acceso gestionados con menor privilegio | `verifyAdminRole` lee el rol de `user_roles` (no del JWT) y exige `is_active` | Cumple | — |
| `useAdminLogin` (UI del panel) | PROTECT | **PR.DS-10** Datos en uso protegidos | El parámetro `?error=` solo se muestra si está en la lista de claves conocidas | Cumple | — |
| AUTH-C03 `loginAction` del portal | PROTECT | **PR.AA-03** | Autentica en el servidor, pero responde distinto si el email existe sin confirmar (permite enumerar) | Parcial | O-06 |
| | PROTECT | **PR.DS-10** | `callbackUrl` va directo a `redirect()` sin validar que sea una ruta interna | No cumple | O-03 |
| | PROTECT | **PR.DS-10** | La cabecera `Origin` arma el `emailRedirectTo`; el impacto depende de la lista de redirecciones permitidas de Supabase | Por verificar | O-07 |
| AUTH-C01 `loginAction` de core (sin uso) | PROTECT | **PR.DS-01** Datos en reposo protegidos | Escribe el `access_token` y el email en los logs del servidor (latente: ninguna app lo importa) | No cumple | O-01 |
| | IDENTIFY | **ID.AM-08** Sistemas y datos gestionados durante su ciclo de vida | Cinco funciones de servidor exportadas sin uso, con un comportamiento distinto al de las que sí se usan | Parcial | §1.4 |
| AUTH-C06 `/auth/error` | PROTECT | **PR.DS-10** | React escapa la salida, pero muestra texto arbitrario de `error_description` (inyección de contenido) | Parcial | O-04 |

#### Registro y OAuth (portal)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AUTH-C04 `registerAction` | PROTECT | **PR.DS-10** | Valida nombre, email y contraseña con Zod en el servidor | Cumple | — |
| | PROTECT | **PR.AA-01** Identidades y credenciales gestionadas | Exige 8 caracteres más criterios, pero el proveedor acepta 6 y la API directa no pasa por Zod | Parcial | O-09 |
| | PROTECT | **PR.AA-03** | Devuelve `EMAIL_ALREADY_REGISTERED`, lo que revela qué emails tienen cuenta | Parcial | O-06 |
| AUTH-C05 `/auth/callback` | PROTECT | **PR.AA-03** | `exchangeCodeForSession` con PKCE: el `code` no sirve sin el verificador guardado en la cookie | Cumple | — |
| AUTH-C05 + AUTH-C07 (`callbackUrl`) | PROTECT | **PR.DS-10** | `new URL(callbackUrl, origin)` acepta URLs absolutas, lo que permite un open redirect después del login | No cumple | O-03 |

#### Activación de administradores (panel)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AUTH-C08/C09 `activateAdminAction` → `completeAdminActivation` | PROTECT | **PR.AA-01** | No comprueba que exista una invitación pendiente para el usuario; cualquier sesión válida se "activa" (`is_active = true`) | No cumple | O-13 |
| | PROTECT | **PR.AA-01** | En el servidor solo compara las dos contraseñas; la fuerza se valida en la UI y en el mínimo de 6 del proveedor | Parcial | O-09 |
| AUTH-C09 `verifyActivationToken` | PROTECT | **PR.AA-04** Aserciones de identidad protegidas y verificadas | `setSession` valida los tokens contra Supabase antes de aceptarlos | Cumple | — |
| AUTH-C08 `useActivationToken` | PROTECT | **PR.DS-02** Datos en tránsito protegidos | Los tokens llegan en el fragmento `#`, que no se envía al servidor ni aparece en el `Referer` ni en los logs de acceso | Cumple | — |
| AUTH-C09 + `pending_invitations` | IDENTIFY | **ID.AM-08** | No revisa `expires_at` ni `status` de la invitación; la vigencia depende solo de la expiración del enlace de Supabase | Parcial | O-13 |

#### Sesión, autorización y cierre

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AUTH-C14 middleware del panel | PROTECT | **PR.AA-04** | Usa `getUser()`, que revalida el JWT contra Supabase | Cumple | — |
| | PROTECT | **PR.AA-05** | Exige sesión e `is_active`, pero no el rol, y si la consulta del perfil falla deja pasar (`if (profile && …)`) | Parcial | Usuarios §4.2, Operaciones O2 |
| AUTH-C15 middleware del portal | PROTECT | **PR.AA-05** | Solo refresca la sesión; la protección de las rutas privadas depende de cada página | Por verificar | — |
| AUTH-C11/C18 hidratación de sesión (`getInitialAuthStatus`, `getAuthContextAction`) | PROTECT | **PR.AA-04** | Usa `getSession()`, que confía en la cookie sin revalidar el JWT, y con ese `user.id` consulta el perfil | Parcial | O-11 |
| | PROTECT | **PR.DS-02** | Envía la `Session` completa, con el `refresh_token`, en el payload RSC | Parcial | O-15 |
| AUTH-C10 `verifyAdminRole` | PROTECT | **PR.AA-05** | El rol sale de `user_roles` y el estado de `profiles`, en el servidor | Cumple | — |
| AUTH-C12 `signOutAction` del panel | PROTECT | **PR.AA-03** | `signOut()` revoca los refresh tokens (alcance global por defecto); el JWT de acceso vive hasta 1 h | Cumple | — |
| AUTH-C17 cookies de sesión | PROTECT | **PR.DS-02** | Usa los valores por defecto de `@supabase/ssr`: `SameSite=Lax`, pero sin `HttpOnly` ni `Secure` explícitos | Parcial | O-10 |
| AUTH-K06 `next.config.ts` ×3 | PROTECT | **PR.PS-01** Prácticas de gestión de configuración | No define CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` ni `Permissions-Policy` | No cumple | O-10 |
| Server actions de auth (Next.js 15) | PROTECT | **PR.DS-10** | El framework rechaza server actions cuyo `Origin` no coincide con el `Host` (protección CSRF integrada) | Cumple | — |

#### Base de datos y configuración de Supabase Auth

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AUTH-B01 `handle_new_user` | PROTECT | **PR.AA-05** | Asigna el rol desde `raw_user_meta_data`, que controla quien se registra (posible alta como `owner`). Compartido con Usuarios (O2) | No cumple | O-02 |
| | PROTECT | **PR.PS-06** Prácticas de desarrollo seguro | `SECURITY DEFINER` con `search_path = ''` | Cumple | — |
| AUTH-B02 `sync_role_to_jwt` + políticas con `auth.jwt() ->> 'role'` | PROTECT | **PR.AA-04** | El trigger quedó huérfano, el rol copiado vive en metadata editable y las políticas comparan el claim equivocado | No cumple | O-05 |
| AUTH-B03 `handle_invitation_accepted` | IDENTIFY | **ID.AM-08** | Marca invitaciones como aceptadas por email al insertarse en `auth.users`, lo que ocurre al invitar y no al aceptar. Coordinar con Joseph | Por verificar | — |
| AUTH-S01 política de contraseñas | PROTECT | **PR.AA-01** | `minimum_password_length = 6`, sin requisitos de complejidad y `secure_password_change = false` | No cumple | O-09 |
| | PROTECT | **PR.AA-01** | `enable_confirmations = false` en la configuración local; falta confirmar si el proyecto remoto exige verificar el email | Por verificar | — |
| AUTH-S01/S02 protección contra fuerza bruta | PROTECT | **PR.AA-03** | Rate limit por IP (30 intentos / 5 min), sin captcha ni bloqueo por cuenta | Parcial | O-12 |
| AUTH-S01 ciclo de vida de los tokens | PROTECT | **PR.AA-03** | JWT de 1 h y rotación de refresh tokens habilitada | Cumple | — |
| AUTH-K01 `SUPABASE_SERVICE_ROLE_KEY` | PROTECT | **PR.DS-01** | Sin prefijo `NEXT_PUBLIC_`: Next.js no la incluye en el bundle del navegador | Cumple | — |

#### Detección (compartido con Auditoría)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| Login del panel → `logAuditEvent` | DETECT | **DE.CM-03** Actividad del personal y uso de tecnología monitoreados | Registra éxitos y fallos con IP y user-agent; el email y el motivo se guardan sin normalizar | Parcial | O-08 |
| Login, registro y OAuth del portal, activación, logout | DETECT | **DE.CM-03** | No generan ningún evento de auditoría | No cumple | O-14 |
| Intentos fallidos repetidos | DETECT | **DE.AE-02** Eventos adversos potenciales analizados | No hay umbral ni alerta por fuerza bruta o credential stuffing | No cumple | O-12 |
| Registro de auditoría de auth (`audit_logs`, módulo de Fabian) | DETECT | **PR.PS-04** Registros generados y disponibles para monitoreo | Los eventos existen, pero la IP sale de `x-forwarded-for` (la controla el cliente) y los campos libres no se sanean | Parcial | O-08 |

### 3.3 Resumen de cobertura por subcategoría

| Subcategoría | Componentes evaluados | Cumple | Parcial | No cumple | Por verificar |
|---|---|---|---|---|---|
| PR.AA-01 | 5 | 0 | 2 | 2 | 1 |
| PR.AA-03 | 7 | 4 | 3 | 0 | 0 |
| PR.AA-04 | 4 | 2 | 1 | 1 | 0 |
| PR.AA-05 | 5 | 2 | 1 | 1 | 1 |
| PR.DS-01 | 2 | 1 | 0 | 1 | 0 |
| PR.DS-02 | 3 | 1 | 2 | 0 | 0 |
| PR.DS-10 | 7 | 3 | 1 | 2 | 1 |
| PR.PS-01/04/06 | 3 | 1 | 1 | 1 | 0 |
| DE.CM-03 / DE.AE-02 | 3 | 0 | 1 | 2 | 0 |
| ID.AM-08 | 3 | 0 | 2 | 0 | 1 |
| **Total** | **42** | **14** | **14** | **10** | **4** |

**Lectura:** la autenticación básica está bien resuelta porque se delega en Supabase: validación del JWT
en el middleware, PKCE en OAuth, rotación de tokens y rol leído de `user_roles` en el servidor. Los
problemas están en lo que la app construye **alrededor** del proveedor:

1. **Confianza en datos que controla el usuario:** el rol en metadata (O-02, O-05), `callbackUrl` (O-03)
   y tokens de sesión aceptados como si fueran de invitación (O-13).
2. **Controles que viven solo en la UI o la app:** la política de contraseñas y la validación del registro
   se saltan con la API directa (O-09).
3. **Higiene de sesión:** cookies sin `HttpOnly`, sin CSP, `getSession()` sin revalidar y tokens
   serializados al cliente (O-10, O-11, O-15).

**DETECT es casi nulo:** solo el login del panel deja rastro. El portal y la activación de admins no
generan eventos, y no hay detección de fuerza bruta.

**Insumos para la Fase 2.** Candidatas por vector:
- **Vector 1:** O-02 y O-13.
- **Vector 2:** O-04 y O-10.
- **Vector 3:** O-03 y O-08.

## 4. Impacto operacional y de negocio — GOVERN / IDENTIFY (P1.3)

### 4.1 Contexto organizacional (GV.OC)

| Subcategoría | Aplicación al módulo |
|---|---|
| **GV.OC-01** Misión | El módulo **establece quién es cada persona** que usa el sistema: clientes que reservan en el portal y personal que opera el hotel desde el panel. Todo control de acceso de los demás módulos (permisos de Usuarios, RLS de Operaciones, visor de Auditoría) parte de la identidad y la sesión que emite este módulo. Si falla, los demás controles autorizan a la persona equivocada. |
| **GV.OC-02** Partes interesadas | **Clientes** (crean su cuenta en el portal; sus credenciales y su email son PII), **owner y administradores** (sus cuentas dan acceso a reservas, tarifas y datos de huéspedes), **invitados** (admins en proceso de activación), **Supabase** (proveedor de identidad, emite y firma los JWT), **Google** (proveedor OAuth) y el **equipo de desarrollo**. |
| **GV.OC-03** Requisitos legales y contractuales | **Ley 8968** de Protección de la Persona frente al Tratamiento de sus Datos Personales (CR): credenciales, email y nombre de clientes y personal, con el deber de adoptar medidas de seguridad y de poder atribuir accesos ante un incidente. Términos de Supabase y de Google Cloud (custodia de la service role key y del client secret de OAuth). |
| **GV.OC-04** Servicios críticos que dependen del módulo | Inicio de sesión en el portal (requisito para reservar con cuenta), acceso al panel completo (reservas, habitaciones, CMS, auditoría, gestión de personal), activación de nuevo personal y verificación de email de clientes. |
| **GV.OC-05** Dependencias del módulo | **Supabase Auth** (sin él nadie puede iniciar sesión), **Postgres** de Supabase (`profiles`, `user_roles`), **Google OAuth**, **SMTP del proyecto** (correos de invitación y verificación), módulo de **Usuarios** (crea las invitaciones que este módulo activa), módulo de **Auditoría** (`logAuditEvent` para DETECT) y la configuración de **Next.js** (middleware, cabeceras y cookies de las 3 apps). |

### 4.2 Roles y apetito de riesgo (GV.RR / GV.RM)

- **Dueño del riesgo del módulo:** el owner del hotel. **Responsable técnico:** Paula.
- **GV.RR-02 Roles y autoridades:**
  - El módulo **autentica**; la autorización fina (permisos) es de Usuarios.
  - Se reconocen tres tipos de identidad: `owner`, `admin` y `client`.
  - La regla de negocio es que solo el owner o un admin con `admins:invite` crea cuentas de personal. Hoy
    no se cumple en la capa de auth: el rol puede venir de la metadata del registro (O-02) y la activación
    no exige invitación (O-13).
  - Las responsabilidades sobre la configuración de Supabase Auth (política de contraseñas, lista de
    redirecciones, SMTP, MFA) no están asignadas ni documentadas.
- **GV.RM-02 Apetito de riesgo propuesto:**
  - **Tolerancia cero** a que alguien se autentique como otra persona o nazca con un rol privilegiado sin autorización.
  - **Tolerancia cero** a que una cuenta desactivada recupere el acceso sin intervención del owner.
  - **Tolerancia muy baja** a la exposición de credenciales, tokens de sesión o PII de cuentas.
  - **Tolerancia baja** a que el dominio del hotel sirva de trampolín para phishing (redirecciones o mensajes falsos).
  - **Tolerancia moderada** a una indisponibilidad breve del login del portal: se puede reservar por otros
    canales. Para el panel la tolerancia es baja, porque detiene la operación de recepción.

### 4.3 Análisis de impacto por proceso de negocio

| Proceso | Activos | Pérdida de C | Pérdida de I | Pérdida de D | Impacto dominante |
|---|---|---|---|---|---|
| **P1. Inicio de sesión** (portal y panel) | AUTH-D01, D02, C02, C03, S01, S02 | **Alta**: credenciales y sesiones comprometidas dan acceso a PII de huéspedes (panel) o a las reservas del cliente (portal) | **Alta**: una sesión robada actúa en nombre de la víctima | **Alta** en el panel (recepción detenida); media en el portal | Confidencialidad |
| **P2. Registro, verificación de email y OAuth** (portal) | AUTH-D08, D09, D10, C04, C05, B01 | Media: revela qué emails tienen cuenta | **Crítica**: es donde nace la identidad y, por el trigger, el rol | **Alta**: si el registro o el callback fallan, no entran clientes nuevos | Integridad |
| **P3. Activación de cuentas de administrador** | AUTH-D06, D07, C08, C09 | Media: los enlaces de invitación contienen tokens de sesión | **Crítica**: decide qué cuenta pasa a `is_active = true` en el panel | Baja: retrasa la incorporación de personal | Integridad |
| **P4. Gestión de sesión y protección de rutas** (cookies, middleware, SSR, cierre de sesión) | AUTH-D02, D03, C10–C18, K06 | **Alta**: tokens legibles desde JS o serializados al cliente | **Alta**: si el middleware o la sesión se saltan, cualquier ruta del panel queda expuesta | Media: un fallo cerrado deja a todos fuera | Confidencialidad e integridad |
| **P5. Trazabilidad de eventos de autenticación** | AUTH-D11, audit_logs | Media: el log contiene emails e IPs | **Alta**: sin rastro completo y confiable no se atribuye un acceso ni se detecta fuerza bruta (no repudio) | — | Detección |

### 4.4 Escala de valoración

Se usa **la misma escala de los módulos de Operaciones y Usuarios** para que las filas de la Matriz
General de Gobernanza (G1) sean comparables.

| Nivel | Impacto (I) | Probabilidad (P) |
|---|---|---|
| 1 | **Bajo:** molestia, sin pérdida económica ni de datos | **Rara:** exige acceso privilegiado y una cadena compleja |
| 2 | **Medio:** pérdida económica acotada o afectación operativa de horas | **Posible:** exige cuenta con permisos o condiciones específicas |
| 3 | **Alto:** pérdida económica directa, afectación a varias personas o incumplimiento legal puntual | **Probable:** explotable con cualquier cuenta autenticada (el registro de clientes es abierto) |
| 4 | **Crítico:** control total del sistema, filtración masiva de PII, sanción o daño reputacional severo | **Casi segura:** anónimo, trivial, sin cuenta |

**Riesgo inherente = I × P:** 1–3 **Bajo** · 4–6 **Medio** · 8–9 **Alto** · 12–16 **Crítico**.

"Inherente" significa el riesgo del código en `11fa71e`, antes de los parches de la Fase 3, contando los
controles que ya existen (filas "Cumple" de §3.2). En la Fase 3 se recalcula como riesgo residual.

### 4.5 Escenarios de riesgo y riesgo inherente (ID.RA-03/04/05)

| ID | Escenario de amenaza | Activo | Ref. | I | P | Riesgo inherente | Justificación |
|---|---|---|---|---|---|---|---|
| **AUTH-R01** | Alguien se registra llamando a `/auth/v1/signup` con la anon key y `data: {"role": "owner"}`; el trigger `handle_new_user` le asigna ese rol | AUTH-D04, D10, B01, K02 | O-02 | 4 | 3 | **Crítico (12)** *(provisional)* | **Mismo riesgo que US-R01 de Usuarios**; en G1 se cuenta una sola vez. Control total del panel. `enable_signup = true` y la anon key es pública. **Provisional:** baja a Alto (8) si la PoC muestra que el campo no llega a `user_roles`. |
| **AUTH-R02** | Un enlace legítimo del hotel (`/auth/login?callbackUrl=https://…` o `/auth/callback`) redirige a un sitio falso después del login, que pide de nuevo la contraseña o los datos de pago | AUTH-D01, D08, C03, C05 | O-03 | 3 | 3 | **Alto (9)** | Phishing creíble con dominio real y sesión ya iniciada; afecta a muchos clientes a la vez. P = 3: anónimo y trivial de armar, pero exige que la víctima abra el enlace. |
| **AUTH-R03** | Fuerza bruta o *credential stuffing* contra el login del portal, del panel o directo contra la API de Supabase, sin MFA y con contraseñas de 6 caracteres permitidas | AUTH-D01, S01, S02 | O-09, O-12 | 3 | 3 | **Alto (9)** | Una cuenta de admin comprometida da acceso a reservas con PII. El rate limit por IP se esquiva rotando IPs. MFA está deshabilitado (`[auth.mfa.totp] enroll_enabled = false`). |
| **AUTH-R04** | Accesos, registros, activaciones y cierres de sesión no quedan registrados (o se registran con IP y campos falsificables) y no se pueden atribuir ni detectar | AUTH-D11 | O-08, O-14 | 3 | 3 | **Alto (9)** | Mismo criterio que OP-R04 y US-R03. Solo el login del panel deja rastro. Sin eventos del portal no hay forma de detectar R02 ni R03. |
| **AUTH-R05** | Un admin desactivado obtiene tokens directo de la API con su contraseña y los envía a `activateAdminAction`; queda con `is_active = true` y recupera el acceso al panel con sus permisos anteriores | AUTH-D05, D06, C08, C09 | O-13 | 3 | 2 | **Medio (6)** | Contradice la tolerancia cero a reactivaciones. P = 2: exige haber sido admin y conservar la contraseña (ex empleado o cuenta comprometida). |
| **AUTH-R06** | Un XSS en cualquiera de las 3 apps lee las cookies de sesión (sin `HttpOnly`) o el `refresh_token` serializado en la página, y el atacante secuestra la sesión de un admin | AUTH-D02, C17, C18, K06 | O-10, O-15 | 3 | 2 | **Medio (6)** | Sin CSP, nada limita el script. P = 2: exige un XSS previo; React escapa por defecto, pero Operaciones (O3) y Usuarios (O11) tienen candidatos. Este escenario **amplifica** los XSS de los demás módulos. |
| **AUTH-R07** | La autorización de otros módulos confía en claims del JWT: las políticas RLS comparan `auth.jwt() ->> 'role' = 'admin'` y el trigger `sync_role_to_jwt` quedó huérfano | AUTH-D03, B02 | O-05 | 2 | 2 | **Medio (4)** | En Supabase ese claim es el rol de Postgres (`authenticated`), no el rol de negocio. Las políticas fallan cerradas (nadie es "admin" vía RLS), lo que afecta la disponibilidad. Si alguien las "arregla" leyendo `user_metadata.role`, quedarían falsificables (relación con OP-R02, coordinar con Aarón). |
| **AUTH-R08** | Mensajes falsos en `/auth/error?error_description=…` (por ejemplo, "llame a este número para validar su tarjeta") servidos desde el dominio del hotel | AUTH-C06 | O-04 | 2 | 3 | **Medio (6)** | Inyección de contenido para ingeniería social; no ejecuta script porque React escapa la salida. Sube a Alto si la PoC logra XSS. |
| **AUTH-R09** | Enumeración de cuentas por la respuesta del registro (`EMAIL_ALREADY_REGISTERED`) o del login (email sin confirmar) | AUTH-D01, C03, C04 | O-06 | 1 | 4 | **Medio (4)** | Por sí sola no da acceso, pero confirma objetivos válidos para R03 y para phishing dirigido. Anónima y trivial. |
| **AUTH-R10** | Una cookie de sesión forjada con el `user_id` de otra persona hace que `getInitialAuthStatus` devuelva su perfil, rol y permisos en las páginas fuera de `/admin` | AUTH-C11, C18 | O-11 | 2 | 1 | **Bajo (2)** | Exige conocer un UUID válido y solo expone datos de perfil; el middleware sí revalida en `/admin/**`. |
| **AUTH-R11** | Alguien reutiliza el `loginAction` de core (sin uso hoy) y los `access_token` empiezan a quedar en los logs del servidor o del proveedor de hosting | AUTH-D12, C01 | O-01 | 3 | 1 | **Bajo (3)** | Riesgo latente: hoy no se ejecuta. Quien lea los logs podría suplantar sesiones durante 1 h. |
| **AUTH-R12** | Una cabecera `Origin` manipulada hace que el correo de verificación apunte a un dominio del atacante | AUTH-D09, C03, C04 | O-07 | 3 | 1 | **Bajo (3)** | Supabase solo acepta URLs de su lista de redirecciones permitidas. P sube si la lista del proyecto remoto incluye comodines. |

### 4.6 Resumen de impacto

- **Conteo:** 1 riesgo Crítico (AUTH-R01, provisional y compartido con US-R01), 3 Altos (R02 a R04),
  5 Medios (R05 a R09) y 3 Bajos (R10 a R12).
- **Procesos más expuestos:**
  - **P2 (registro):** la identidad y el rol nacen de datos que controla quien se registra.
  - **P1 (inicio de sesión):** sin MFA, sin bloqueo por cuenta y con redirección abierta después del login.
- **Control ausente de mayor efecto transversal:** la **higiene de sesión** (CSP, cookies `HttpOnly`) y la
  **auditoría de auth**. La primera convierte cualquier XSS del sistema en robo de sesión (R06); la segunda
  impide detectar R02, R03 y R05.
- **Prioridad para la Fase 2:**
  1. AUTH-R01 (vector 1). PoC conjunta con Joseph para no duplicar esfuerzo.
  2. AUTH-R05 (vector 1: control de acceso, evasión de la desactivación).
  3. AUTH-R02 y AUTH-R12 (vector 3: manipulación de parámetros de redirección).
  4. AUTH-R08 y AUTH-R06 (vector 2: reflejo en `/auth/error` y efecto de un XSS sobre la sesión). Si no se
     logra XSS real, usar una vulnerabilidad **introducida** (§4.1 del plan).
  5. AUTH-R04 (log injection en los eventos de login, con Fabian).

## 5. Línea base de controles — PROTECT / DETECT (P1.4)

La línea base es el **mínimo de controles** que el módulo debe cumplir para que cada riesgo de §4.5 quede
en Bajo o Medio:
- **Estado actual** es el punto de partida de la Fase 3.
- **Tarea** enlaza con el checklist P3.x del plan.
- Los controles usan solo **código propio o funciones incluidas en el stack** (Zod, configuración de
  Supabase Auth, TOTP y captcha gratuitos que Supabase ya soporta, RLS de Postgres, cabeceras de Next.js,
  `logAuditEvent`). Ninguno requiere herramientas de pago.
- Los IDs usan el prefijo `AUTH-LB` porque `AUTH-C` ya identifica componentes (§1.4).

### 5.1 Controles PROTECT

| ID | Control requerido (línea base) | Subcategoría | Riesgos | Estado actual | Brecha | Tarea | Coordinar con |
|---|---|---|---|---|---|---|---|
| **AUTH-LB01** | **El rol nunca sale de metadata editable**: `handle_new_user` ignora `raw_user_meta_data ->> 'role'` (siempre `client` en el registro) y el rol de una invitación lo fija el servidor (`app_metadata` o `user_roles` con service role) | PR.AA-05, PR.AA-04 | R01 | **No cumple** | Cualquier registro puede declarar su rol (O-02) | P3.1 | **Joseph** (es el mismo control que US-C02: acordar quién escribe la migración) |
| **AUTH-LB02** | **Activación ligada a una invitación válida**: `completeAdminActivation` comprueba en el servidor que exista una invitación `pending`, no vencida (`expires_at`) y del mismo `user_id`, y que el enlace sea de tipo `invite`. Una cuenta desactivada por el owner no se puede "reactivar" por esta vía | PR.AA-01, ID.AM-08 | R05 | **No cumple** | Cualquier sesión válida pasa a `is_active = true` (O-13) | P3.1 | **Joseph** (máquina de estados de invitaciones, US-C06) |
| **AUTH-LB03** | **Solo redirecciones internas**: `callbackUrl` se acepta únicamente si es una ruta relativa (empieza con `/`, sin `//` ni `/\`). Si no cumple, se usa `ROUTES.HOME`. `emailRedirectTo` se construye con `ENV.APP_URL` y no con la cabecera `Origin` | PR.DS-10 | R02, R12 | **No cumple** | `redirect()` y `new URL()` aceptan URLs absolutas (O-03, O-07) | P3.3 | — |
| **AUTH-LB04** | **Política de credenciales aplicada por el proveedor**: `minimum_password_length ≥ 8` con `password_requirements` (mayúsculas, minúsculas, dígitos, símbolos) y `secure_password_change = true`. La activación valida la fuerza también en el servidor | PR.AA-01 | R03 | **No cumple** | El proveedor acepta 6 caracteres y la API directa salta Zod (O-09) | P3.1 | — |
| **AUTH-LB05** | **Resistencia a fuerza bruta**: captcha en login y registro (Turnstile o hCaptcha, gratuitos e integrados en Supabase), MFA TOTP obligatorio para owner y admins, y límite de intentos fallidos por cuenta además del de IP | PR.AA-03 | R03 | **Parcial**: rate limit por IP de Supabase | Sin captcha, sin MFA, sin límite por cuenta (O-12) | P3.1 / P3.3 | — |
| **AUTH-LB06** | **Respuestas que no permiten enumerar cuentas**: mismo mensaje y mismo flujo para "credenciales inválidas" y "email sin confirmar". El registro responde igual exista o no la cuenta (el aviso llega por correo) | PR.AA-03 | R09 | **No cumple** | Respuestas distintas según el estado de la cuenta (O-06) | P3.3 | — |
| **AUTH-LB07** | **Identidad verificada en el servidor y sesión fuera del cliente**: `getUser()` en lugar de `getSession()` en `getInitialAuthStatus` y `getAuthContextAction`. Al navegador solo llegan `user` y `profile`, nunca la `Session` con tokens | PR.AA-04, PR.DS-02 | R06, R10 | **Parcial**: el middleware ya usa `getUser()` | La hidratación SSR confía en la cookie y serializa tokens (O-11, O-15) | P3.1 | **Joseph** (`requirePermission`, US-C09) |
| **AUTH-LB08** | **Middleware del panel que falla cerrado y exige rol**: además de sesión e `is_active`, exige rol `admin` u `owner`. Si la consulta del perfil falla, redirige al login | PR.AA-05 | R05 (y OP O2) | **Parcial**: exige sesión e `is_active` | Una sesión de cliente pasa y un error de consulta deja pasar | P3.1 | **Joseph**, **Aarón** (lo reportan en Usuarios §4.2 y Operaciones O2) |
| **AUTH-LB09** | **Cookies de sesión con flags explícitos**: `Secure` y `SameSite=Lax` explícitos en `createSupabaseServerClient`. `HttpOnly` exige mover al servidor el login con Google y la suscripción de sesión del navegador (hoy usan `createBrowserClient`); la decisión se toma en P3.3 | PR.DS-02 | R06 | **Parcial**: `SameSite=Lax` por defecto | Cookies legibles desde JS, sin `Secure` explícito (O-10) | P3.3 | — |
| **AUTH-LB10** | **CSP y cabeceras de seguridad en las 3 apps**: CSP con nonce (generado en el middleware), `frame-ancestors 'none'`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` | PR.PS-01 | R06, R08 | **No cumple** | Ninguna app define cabeceras de seguridad (O-10) | P3.2 | **Todo el equipo** (archivo compartido, §4.4 del plan: avisar antes del merge) |
| **AUTH-LB11** | **Contenido reflejado solo desde una lista blanca**: `/auth/error` muestra únicamente textos traducidos de códigos conocidos e ignora `error_description` | PR.DS-10 | R08 | **Parcial**: React escapa la salida | Muestra texto arbitrario de la query (O-04) | P3.2 | — |
| **AUTH-LB12** | **Sin secretos en logs y sin código de auth muerto**: eliminar (o alinear con las apps) las server actions sin uso de `packages/core/src/auth/server` y quitar los `console.log` con tokens o emails | PR.DS-01, ID.AM-08 | R11 | **No cumple** (latente) | El `loginAction` de core imprime el `access_token` (O-01) | P3.4 | — |
| **AUTH-LB13** | **La autorización no confía en claims del JWT editables o equivocados**: las políticas RLS usan funciones que leen `user_roles` (`is_admin_or_owner()`, `has_permission()`), nunca `auth.jwt() ->> 'role'` ni `user_metadata`. Eliminar el trigger huérfano `sync_role_to_jwt` | PR.AA-04 | R07 | **No cumple** | Políticas con el claim equivocado y rol copiado a metadata editable (O-05) | P3.1 | **Aarón** (dueño de esas políticas), **Joseph** (patrón común de RLS, US-C03) |
| **AUTH-LB14** | **Autenticación delegada y ciclo de sesión**: PKCE en OAuth, `getUser()` en el middleware, rol leído de `user_roles` en `verifyAdminRole`, JWT de 1 h, rotación de refresh tokens y `signOut()` global | PR.AA-03, PR.AA-04, PR.AA-05 | R02, R10 | **Cumple** | — | Mantener; test de regresión (P3.5) | — |
| **AUTH-LB15** | **Protección CSRF integrada y secretos solo en el servidor**: verificación de `Origin` de las server actions de Next.js 15, `SUPABASE_SERVICE_ROLE_KEY` sin prefijo `NEXT_PUBLIC_` y funciones `SECURITY DEFINER` con `search_path = ''` | PR.DS-10, PR.DS-01, PR.PS-06 | R01, R12 | **Cumple** | — | Mantener; verificar en la PoC del vector 3 | — |

### 5.2 Controles DETECT

| ID | Control requerido (línea base) | Subcategoría | Riesgos | Estado actual | Brecha | Tarea | Coordinar con |
|---|---|---|---|---|---|---|---|
| **AUTH-LB16** | **Auditoría de todos los eventos de autenticación** vía `logAuditEvent`. Eventos mínimos: `auth.login.success` y `auth.login.failed` en ambas apps, `auth.register`, `auth.oauth.success`, `auth.oauth.failed`, `auth.admin.activated`, `auth.activation.failed` y `auth.logout` | DE.CM-03, PR.PS-04 | R04 (soporta R02, R03, R05) | **Parcial**: solo el login del panel | El portal, la activación y el logout no dejan rastro (O-14) | P3.4 | **Fabian** (nuevos `AUDIT_ACTIONS` y guía de uso) |
| **AUTH-LB17** | **Campos de auditoría saneados y de origen confiable**: email normalizado (minúsculas, sin caracteres de control, longitud máxima), `reason` como código fijo y no el mensaje del proveedor, IP tomada solo del proxy de confianza | PR.PS-04 | R04 | **No cumple** | Email y motivo sin normalizar; IP desde `x-forwarded-for` (O-08) | P3.4 | **Fabian** (dueño de `getAuditRequestContext` y del saneamiento) |
| **AUTH-LB18** | **Detección de fuerza bruta**: umbral de intentos fallidos por email o IP en una ventana de tiempo, calculado sobre `audit_logs`, que genera un evento `auth.bruteforce.suspected` visible en el visor | DE.AE-02, DE.CM-01 | R03 | **No cumple** | Los ataques de credenciales son invisibles (O-12) | P3.4 | **Fabian** |

### 5.3 Resumen de la línea base

| Estado | PROTECT | DETECT | Total |
|---|---|---|---|
| Cumple | 2 (LB14, LB15) | 0 | 2 |
| Parcial | 5 (LB05, LB07, LB08, LB09, LB11) | 1 (LB16) | 6 |
| No cumple | 8 (LB01, LB02, LB03, LB04, LB06, LB10, LB12, LB13) | 2 (LB17, LB18) | 10 |
| **Total** | **15** | **3** | **18** |

**Relación con los riesgos altos y críticos:**

| Riesgo | Controles |
|---|---|
| AUTH-R01 | LB01 (+ LB13) |
| AUTH-R02 | LB03 |
| AUTH-R03 | LB04, LB05, LB18 |
| AUTH-R04 | LB16, LB17 |

Con estos controles implementados, el objetivo de la Fase 3 es dejar **R01 y R02 en Bajo** y el resto en
Bajo o Medio.

**Limitaciones (riesgo residual):**
- **AUTH-R03 queda en Medio:** el captcha, el MFA y el límite por cuenta frenan la fuerza bruta, pero no
  eliminan el *credential stuffing* distribuido con contraseñas filtradas. La verificación contra bases de
  contraseñas filtradas de Supabase es de pago y queda fuera.
- **AUTH-R04 queda en Medio:** la detección depende de que alguien revise el visor. Las alertas automáticas
  (SIEM o servicios de pago) quedan fuera por la regla de la profesora.
- **AUTH-R06 depende de LB09:** si no se puede usar `HttpOnly` sin reescribir el login con Google, la CSP
  (LB10) es la única barrera contra el robo de sesión por XSS y el riesgo residual queda en Medio.

---

## 6. Coordinación con otros módulos

| Módulo | Qué hay que acordar | Ref. |
|---|---|---|
| **Joseph** (Usuarios) | (1) **LB01 = US-C02:** `handle_new_user` es de ambos módulos. Hay que decidir quién escribe la migración y hacer una sola PoC para AUTH-R01 / US-R01. (2) **LB02 + US-C06:** la activación debe consultar el estado de la invitación que su módulo gestiona. (3) **LB07 + US-C09:** `getUser()` también en `requirePermission`. (4) **US-C07:** la revocación de sesión al desactivar una cuenta toca el middleware del panel (LB08). | O-02, O-13, O-11 |
| **Fabian** (Auditoría) | (1) Lista de `AUDIT_ACTIONS` nuevos de LB16. (2) Saneamiento de campos y origen confiable de la IP (LB17), que vive en `getAuditRequestContext`. (3) Cómo exponer en el visor el evento de fuerza bruta (LB18). | O-08, O-14 |
| **Aarón** (Operaciones) | (1) **LB13:** sus políticas RLS de `rooms`, `amenities`, `room_schedules` y `room_images` comparan `auth.jwt() ->> 'role'`, que es el rol de Postgres. Hoy fallan cerradas, no son falsificables vía `user_metadata`, lo que cambia el supuesto de OP-R02. (2) **LB08:** el middleware exigirá rol, como pide su O2. | O-05 |
| **Todo el equipo** | **LB10 (CSP y cabeceras)** se aplica en `next.config.ts` y `middleware.ts` de las 3 apps. Puede romper scripts inline o recursos externos (Stripe, imágenes de Supabase Storage, Google). Se avisa antes del merge y cada quien prueba su módulo. | §4.4 del plan |

Esta coordinación no bloquea la Fase 1: los acuerdos se cierran antes de la Fase 3.

---

## 7. Filas para la Matriz General de Gobernanza (G1)

Formato de `plantillas/matriz-general-gobernanza.xlsx`, listo para consolidar. La primera fila es el
**mismo riesgo** que la primera fila de Usuarios y se consolida en una sola.

| Módulo y responsable | Activo crítico | Función NIST CSF | Categoría / subcategoría NIST CSF | Control de seguridad requerido (línea base) | Nivel de riesgo inherente |
|---|---|---|---|---|---|
| Módulo 1: Autenticación (Paula) | Rol inicial de cada cuenta (`auth.users`, `user_roles`, trigger `handle_new_user`) — compartido con Usuarios | PROTECT (PR) | PR.AA-05: Permisos gestionados con menor privilegio; PR.AA-04: Aserciones de identidad protegidas y verificadas | Asignar el rol solo desde datos que fija el servidor e ignorar `user_metadata` en el trigger | Crítico (provisional) |
| Módulo 1: Autenticación (Paula) | Redirecciones posteriores al login (`callbackUrl` en `/auth/login` y `/auth/callback`, `emailRedirectTo`) | PROTECT (PR) | PR.DS-10: Integridad de datos en uso | Aceptar solo rutas internas relativas y construir los enlaces de correo con la URL configurada, no con `Origin` | Alto |
| Módulo 1: Autenticación (Paula) | Credenciales de clientes y personal (`auth.users`), endpoints de login del portal, del panel y de la API de Supabase | PROTECT (PR) | PR.AA-01: Identidades y credenciales gestionadas; PR.AA-03: Usuarios autenticados | Política de contraseñas en el proveedor, captcha, MFA TOTP para personal y límite de intentos por cuenta | Alto |
| Módulo 1: Autenticación (Paula) | Trazabilidad de eventos de autenticación (`audit_logs`) | DETECT (DE) | DE.CM-03: Monitoreo de actividad del personal; DE.AE-02: Análisis de eventos adversos; PR.PS-04: Generación de registros | Registrar todos los eventos de auth con campos saneados e IP confiable, y detectar intentos fallidos repetidos | Alto |
| Módulo 1: Autenticación (Paula) | Activación de cuentas de administrador (`activateAdminAction`, `completeAdminActivation`, `pending_invitations`) | PROTECT (PR) | PR.AA-01: Identidades gestionadas durante su ciclo de vida; ID.AM-08: Ciclo de vida de sistemas y datos | Exigir una invitación pendiente, vigente y del mismo usuario antes de activar; impedir que una cuenta desactivada se reactive sola | Medio |
| Módulo 1: Autenticación (Paula) | Sesión del usuario (cookies `sb-*-auth-token`, hidratación SSR, cabeceras HTTP) | PROTECT (PR) | PR.DS-02: Protección de datos en tránsito; PR.PS-01: Gestión de configuración; PR.AA-04: Aserciones verificadas | Cookies `Secure`/`SameSite` (y `HttpOnly` si es viable), CSP y cabeceras de seguridad, `getUser()` en el servidor y sin tokens en el payload del cliente | Medio |
| Módulo 1: Autenticación (Paula) | Claims del JWT usados en políticas RLS (`auth.jwt()`, trigger `sync_role_to_jwt`) | PROTECT (PR) | PR.AA-04: Aserciones de identidad protegidas y verificadas | Autorizar con funciones que leen `user_roles`, nunca con claims editables o con el rol de Postgres | Medio |

---

## 8. Límites del análisis y puntos por verificar

Este diagnóstico es **estático**: se leyeron el código, las migraciones y `config.toml` en `11fa71e`. No se
ejecutó nada ni se consultó el proyecto remoto de Supabase. Quedan para la Fase 2, o para una revisión de la
configuración remota con autorización:

1. ¿Llega `user_metadata.role` a `user_roles` en un registro hecho directo contra la API? (AUTH-R01; PoC
   conjunta con Joseph)
2. ¿Acepta `completeAdminActivation` tokens de una sesión normal, sin invitación, y deja la cuenta con
   `is_active = true`? (AUTH-R05)
3. ¿Qué tiene la configuración remota de Auth? Hay que revisar:
   - política de contraseñas;
   - confirmación de correo;
   - lista de redirecciones permitidas (comodines);
   - MFA;
   - captcha;
   - SMTP;
   - vigencia del enlace de invitación.
   `config.toml` solo describe el entorno local. (O-07, O-09, O-12)
4. ¿Existe en la BD el trigger `on_user_role_updated`, o `sync_role_to_jwt` quedó sin efecto? (O-05)
5. ¿Es viable `HttpOnly` sin reescribir el login con Google y la suscripción de sesión del navegador? (LB09)
6. La PoC del vector 2 probablemente requiera una vulnerabilidad **introducida** en una rama
   `security/auth/fase2-*` (§4.1 del plan), porque React escapa la salida de `/auth/error` (O-04).
