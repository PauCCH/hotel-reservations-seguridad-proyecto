# Fase 1 — Diagnóstico NIST CSF 2.0 · Módulo de Autenticación (`auth`)

- **Responsable:** Paula
- **Rama:** `security/auth/fase1-diagnostico`
- **Commit base analizado:** `5af5fb1` (`develop`, 2026-09-28)
- **Estado:** P1.1 completo · P1.2–P1.4 pendientes

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
| O-01 | El `access_token` de la sesión y los emails se imprimen en la consola del servidor | `packages/core/src/auth/server/loginAction.ts:82,125` | A09 (exposición en logs) / DE.CM |
| O-02 | Escalamiento de privilegios en el signup: `handle_new_user` toma el rol de `raw_user_meta_data`, que el propio usuario controla. Con la anon key pública (K02), alguien podría llamar a `/auth/v1/signup` con `data.role = "owner"` | `20260512000002_users-table-policies.sql:58-65` | V1 · A01 / A04 |
| O-03 | Open redirect: `callbackUrl` se usa sin validar en `redirect()` y en `new URL(callbackUrl, origin)`, que acepta URLs absolutas | `portal-reservas/.../loginAction.ts:64`, `app/auth/callback/route.ts:34-35` | V3 · A01 / A08 (manipulación de parámetros) |
| O-04 | Contenido reflejado: `/auth/error` muestra `error` y `error_description` de la query. React escapa el HTML (probable inyección de texto/phishing, no XSS), pero hay que verificarlo | `app/auth/error/AuthErrorContent.tsx:14-28` | V2 · A03 (XSS reflected) |
| O-05 | `sync_role_to_jwt` quedó huérfano (tabla renombrada) y varias políticas RLS comparan `auth.jwt() ->> 'role' = 'admin'`, que en Supabase es el rol de Postgres (`authenticated`), no el rol de negocio | `20260609000003_sync_role_to_jwt.sql`; `rooms_rls_policies`, `create_amenities`, etc. | V1 · A01 (confianza en claims del JWT). Coordinar con Aarón |
| O-06 | Enumeración de usuarios: el portal responde distinto a "email no confirmado" (reenvía y redirige) que a "credenciales inválidas". El registro devuelve `EMAIL_ALREADY_REGISTERED` | `portal-reservas/.../loginAction.ts:41-59`, `signUp-action.ts:92-93` | PR.AA / A07 |
| O-07 | La cabecera `Origin`, que controla el cliente, se usa para construir `emailRedirectTo` | `loginAction.ts:42` (portal), `signUp-action.ts:84` | V3 · A08 |
| O-08 | El log de auditoría guarda el `email` tecleado y el mensaje de error del proveedor sin normalizar (posible log injection) | `packages/core/src/auth/server/loginAction.ts:96`, `panel-admin/.../loginAction.ts:28,52,64` | V3 · log injection (coordinar con Fabian) |
| O-09 | Política de contraseñas débil en el proveedor (`minimum_password_length = 6`, `secure_password_change = false`); la validación fuerte solo existe en el formulario/Zod | `packages/db/supabase/config.toml:175,211` | PR.AA-01 |
| O-10 | No hay cabeceras de seguridad ni CSP en ninguna app. Las cookies de sesión usan los valores por defecto de `@supabase/ssr`, que las deja legibles desde JS (sin `HttpOnly`) | `apps/*/next.config.ts`, `packages/db/src/client.ts` | V2/V3 · A05 |
| O-11 | Se usa `getSession()` (no verifica el JWT contra el servidor) para hidratar la sesión en SSR | `getServerAuthContext.ts:71`, `refreshSession.ts:41`, `getAuthContextAction.ts:18` | A01 / A07 |
| O-12 | Sin captcha ni bloqueo por cuenta; solo el rate limit por IP de Supabase | `config.toml:180-199` | PR.AA / fuerza bruta |

---

## 3. Mapeo de componentes contra NIST CSF 2.0 (P1.2)

_Pendiente._

## 4. Impacto operacional y de negocio — GOVERN / IDENTIFY (P1.3)

_Pendiente._

## 5. Línea base de controles — PROTECT / DETECT (P1.4)

_Pendiente._
