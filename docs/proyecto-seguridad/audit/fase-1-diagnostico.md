# Fase 1 — Diagnóstico NIST CSF 2.0 · Módulo Logs / Auditoría

| Campo | Valor |
|---|---|
| Módulo | Logs / Auditoría (`audit`) |
| Responsable | Fabián Vargas Araya |
| Rama | `security/audit/fase1-diagnostico` |
| Commit base analizado | `257db31` (`develop`, 2026-10-02) |
| Estado | F1.1–F1.4 completos · listo para revisión (F1.5) |

---

## 1. Alcance

El módulo es el registro de evidencia del sistema: escribe eventos de auditoría desde cualquier flujo
del servidor (`logAuditEvent`), les adjunta el contexto de la petición (IP y user-agent) y los expone a
los administradores en un visor paginado con filtros y un panel de detalle.

Es un módulo **transversal**: los otros tres (Autenticación, Gestión de Usuarios, Operaciones) son sus
productores de eventos, y la función DETECT de los tres depende de que este módulo funcione y sea
confiable. Hoy solo Autenticación lo usa.

| App / paquete | Rutas y archivos |
|---|---|
| `packages/core` | `src/audit/server/logAuditEvent.ts`, `src/audit/server/getAuditRequestContext.ts`, `src/audit/shared/utils.ts`, `src/audit/shared/types.ts`, `src/audit/config/constants.ts`, `src/audit/index.ts` |
| `apps/panel-admin` (:3002) | `features/audit-log/services/getAuditLogs.ts`, `features/audit-log/components/**` (tabla, filtros, drawer, paginación), `features/audit-log/hooks/**`, `app/admin/audit-log/page.tsx` |
| `packages/db` | `20260922000001_add_audit_view_permission.sql`, `20260922000002_create_audit_logs_table.sql` |
| Consumidores actuales | `apps/panel-admin/src/features/auth/services/loginAction.ts`, `packages/core/src/auth/server/loginAction.ts`, el propio `getAuditLogs.ts` |

Fuera de alcance: la lógica de autenticación que rodea a los call sites (de Paula), el modelo de
permisos (de Joseph) y las operaciones que *deberían* auditarse pero aún no lo hacen (de Aarón). Lo que
sí entra es la **API** que esos módulos consumen y la **integridad del registro resultante**.

---

## 2. F1.1 Inventario de activos

Escala C/I/D (Confidencialidad / Integridad / Disponibilidad): **A** alto · **M** medio · **B** bajo.

### 2.1 Activos de información (datos)

| ID | Activo | Ubicación | Contenido | C | I | D | Notas |
|---|---|---|---|---|---|---|---|
| AU-D01 | Registro de auditoría | Tabla `audit_logs` (`20260922000002_create_audit_logs_table.sql`) | `id`, `actor_id`, `actor_email`, `action`, `entity`, `entity_id`, `metadata` (JSONB), `ip_address`, `user_agent`, `created_at` | M | **A** | M | Es la evidencia del sistema. La integridad es el atributo dominante: un log alterado es peor que no tener log. |
| AU-D02 | Identidad del actor | `actor_id` (FK → `auth.users`, `ON DELETE SET NULL`), `actor_email` | Quién hizo la acción | M | **A** | B | Al borrar un usuario se pierde `actor_id`; solo queda el email como texto. Afecta el no repudio histórico. |
| AU-D03 | Metadatos del evento | Columna `metadata` JSONB | Contenido arbitrario definido por cada call site. Hoy incluye `email`, `reason`, `requireAdmin`, `page`, `pageSize`, `search`, `action` | M | **A** | B | **Campo libre sin esquema ni saneamiento.** En `auth.login.failed` el `email` lo controla un usuario **anónimo** (`loginAction.ts:28`). |
| AU-D04 | Contexto de red del actor | `ip_address`, `user_agent` | IP de origen y cadena de user-agent | M | **A** | B | Ambos derivan de cabeceras HTTP que el cliente controla (ver AU-S02). Son **datos personales** (la IP identifica). |
| AU-D05 | Permiso `audit:view` | Enum `public.user_permission` (`20260922000001`) + tabla `user_permissions` | Valor de enum que habilita la lectura del log | B | **A** | M | Se siembra al owner (`set_owner_permissions`) y se puede otorgar a admins desde el módulo de permisos (Joseph). |
| AU-D06 | Catálogo de acciones auditables | `packages/core/src/audit/config/constants.ts` | `AUDIT_ACTIONS` (3 valores), `AUDIT_ENTITIES` (2 valores) | B | M | B | Contrato público con los otros módulos. Hoy cubre solo login y la lectura del propio log. |
| AU-D07 | PII acumulada en el log | `actor_email`, `ip_address`, `metadata.email` | Email e IP de administradores y de cualquiera que intente iniciar sesión | **A** | M | B | Ley 8968 (CR). Sin política de retención, sin minimización, sin base legal documentada. |

### 2.2 Activos de software (componentes y endpoints)

| ID | Componente | Archivo | Tipo | Control de acceso actual |
|---|---|---|---|---|
| AU-S01 | `logAuditEvent` | `packages/core/src/audit/server/logAuditEvent.ts:30` | Server function (`"use server"`) con **service-role** | **Ninguno**: cualquier código del servidor puede escribir cualquier fila. Nunca lanza: los errores solo van a `console.error`. |
| AU-S02 | `getAuditRequestContext` | `packages/core/src/audit/server/getAuditRequestContext.ts:32` | Server function | Lee `x-forwarded-for` (primer elemento) → `x-real-ip` → `user-agent`. Sin lista de proxies de confianza. |
| AU-S03 | `getAuditLogs` | `apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts:33` | Server Action con **service-role** (salta RLS) | `getSession()` + `verifyAdminRole()`. **No llama a `requirePermission(audit:view)`** aunque lance `PermissionDeniedError(PERMISSIONS.AUDIT.VIEW)`. |
| AU-S04 | Página `/admin/audit-log` | `apps/panel-admin/src/app/admin/audit-log/page.tsx:6` | Server component | Hereda el middleware del panel; delega la autorización a AU-S03; `forbidden()` ante error de auth. |
| AU-S05 | `AuditLogTableView` | `.../components/AuditLogTableView/AuditLogTableView.tsx:14` | Client component | Orquesta filtros, tabla, drawer y paginación. |
| AU-S06 | `AuditLogTable` | `.../components/AuditLogTable/AuditLogTable.tsx:10` | Client component | Renderiza celdas con escape de React (`{row.action}`, `{row.actor_email}`) y el resumen de metadatos vía `truncateMetadata`. |
| AU-S07 | `AuditLogDetailDrawer` | `.../components/AuditLogDetailDrawer/AuditLogDetailDrawer.tsx:9` | Client component | Renderiza `metadata` con **`dangerouslySetInnerHTML`** (línea 68). |
| AU-S08 | `AuditLogFilters` | `.../components/AuditLogFilters/AuditLogFilters.tsx:9` | Client component | `search` libre, `action` desde `AUDIT_ACTIONS`, `from`/`to` como `<input type="date">`. Toda la validación es de UI. |
| AU-S09 | `useAuditLogTable` | `.../hooks/useAuditLogTable.ts:36` | Hook cliente | Fija `pageSize = AUDIT_LOG_PAGE_SIZE` (25) e invoca AU-S03 en cada cambio de filtro o página. |
| AU-S10 | `formatMetadataHtml` | `packages/core/src/audit/shared/utils.ts:74` | Helper puro | **Interpola valores en HTML sin escapar**, por diseño documentado ("so the consumer can opt into `dangerouslySetInnerHTML`"). |
| AU-S11 | `truncateMetadata`, `formatAuditTimestamp`, `buildAuditAction` | `packages/core/src/audit/shared/utils.ts:31,50,18` | Helpers puros | `truncateMetadata` produce texto plano (lo escapa React). `formatAuditTimestamp` fija UTC. |
| AU-S12 | Tabla `audit_logs` + RLS | `20260922000002_create_audit_logs_table.sql` | Control en BD | Un solo policy: `SELECT` para `authenticated` con `is_admin_or_owner() AND has_permission('audit:view')`. **Sin policies de INSERT/UPDATE/DELETE** y **sin trigger append-only**. |
| AU-S13 | `set_owner_permissions` (modificada) | `20260922000002_create_audit_logs_table.sql` | Función `SECURITY DEFINER` | Siembra `audit:view` al owner y hace backfill del owner existente. |
| AU-S14 | Middleware del panel | `apps/panel-admin/src/middleware.ts` (matcher `/admin/:path*`) | Protección de ruta | Exige usuario autenticado y `is_active`; **no verifica rol**. Compartido — dueña: Paula. |
| AU-S15 | Call sites productores | `apps/panel-admin/src/features/auth/services/loginAction.ts:25,48,60,72`; `packages/core/src/auth/server/loginAction.ts:93,117` | Consumidores de la API | Cada uno construye su `metadata` a mano; no hay esquema ni validación central. |

### 2.3 Servicios externos e infraestructura

| ID | Servicio | Uso en el módulo | Secreto asociado | Notas |
|---|---|---|---|---|
| AU-X01 | Supabase Postgres | Almacena `audit_logs`, `user_permissions`, `user_roles` | `SUPABASE_SERVICE_ROLE_KEY` | **Toda** escritura y **toda** lectura del log pasan por service-role, que salta RLS por completo. La RLS de AU-S12 nunca se ejerce en el flujo real de la app. |
| AU-X02 | Supabase Auth | Origen de `actor_id` (FK a `auth.users`) y de la sesión que valida AU-S03 | anon key (público) | `getAuditLogs` usa `getSession()` (lee la cookie) y no `getUser()` (valida contra el servidor). Compartido con Auth — Paula. |
| AU-X03 | Infraestructura de despliegue / proxy | Origen de `x-forwarded-for` y `x-real-ip` | — | **No está definida ni documentada.** Sin saber qué proxy está delante, no hay forma de confiar en esas cabeceras. |
| AU-X04 | `console.error` (stdout del proceso) | Único destino de los fallos de escritura de auditoría | — | No hay agregador de logs, ni alertas, ni retención. Un fallo de auditoría es invisible en la práctica. |

### 2.4 Controles existentes (línea base preliminar, insumo para F1.4)

| Control | Dónde | Observación |
|---|---|---|
| RLS habilitado en `audit_logs` | Migración `20260922000002` | Policy de SELECT correcta y bien pensada (`is_admin_or_owner() AND has_permission('audit:view')`)… pero **AU-S03 la salta** usando service-role. |
| Permiso dedicado `audit:view` | Enum + seeding al owner | Separa "ser admin" de "poder leer el log". El código no lo aplica (ver O1). |
| Sin policies de escritura para `authenticated` | Migración `20260922000002` | Un usuario autenticado no puede insertar, editar ni borrar filas directamente. Correcto, pero no cubre al service-role. |
| Índices de consulta | `created_at DESC`, `actor_id`, `action` | Soportan el visor y los filtros. Disponibilidad razonable. |
| Auditoría tolerante a fallos | `logAuditEvent` nunca lanza | Decisión deliberada: un fallo de log no debe romper el login. El efecto colateral es pérdida silenciosa de evidencia (ver O7). |
| Escape de React en la tabla | `AuditLogTable.tsx:40-52` | Todas las celdas de la tabla son texto escapado. El agujero está solo en el drawer. |
| Timestamp en UTC fijo | `formatAuditTimestamp` (`timeZone: "UTC"`) | Marcas de tiempo estables y comparables entre evidencias. |
| Paginación en el servidor | `.range(offset, …)` | Evita traer la tabla completa… si se respeta el `pageSize` del cliente (ver O9). |
| Tests existentes | `getAuditRequestContext.test.ts`, `utils.test.ts` | Cubren el comportamiento funcional, no el de seguridad. `logAuditEvent` y `getAuditLogs` no tienen tests. |

---

## 3. Observaciones preliminares (candidatas para la Fase 2 — sin confirmar)

Superficies detectadas durante el inventario. Cada una se confirma o descarta con una PoC en la Fase 2.

| # | Observación | Evidencia (archivo:línea) | Vector / OWASP tentativo |
|---|---|---|---|
| O1 | `getAuditLogs` solo verifica `verifyAdminRole()`; **nunca comprueba el permiso `audit:view`**, aunque el error que lanza diga lo contrario. Cualquier admin activo lee el registro completo del sistema. Además usa service-role, así que la policy RLS que sí exige el permiso queda sin efecto. | `getAuditLogs.ts:43-51` vs. `20260922000002_…sql` (policy `audit_logs_admin_select`) | V1 · A01 |
| O2 | `params.search` se interpola directo en el filtro `.or()` de PostgREST, sin escapar comas, puntos ni paréntesis. Permite romper la expresión e inyectar condiciones propias en la consulta. | `getAuditLogs.ts:57` | V1 · **A03 (inyección)** |
| O3 | `formatMetadataHtml` interpola los valores de `metadata` en HTML sin escapar y el drawer los pinta con `dangerouslySetInnerHTML`. **Cadena completa:** un anónimo envía un login fallido con el email `<img src=x onerror=…>` → se guarda crudo en `metadata.email` → un admin abre el detalle → el script corre con su sesión. | `utils.ts:74-86`, `AuditLogDetailDrawer.tsx:22,65-69`, origen: `loginAction.ts:25-31` | V2 · **XSS stored** |
| O4 | La IP sale del primer elemento de `x-forwarded-for` sin lista de proxies de confianza. Cualquier cliente puede enviar la cabecera y fijar la IP que quedará grabada. | `getAuditRequestContext.ts:35-37` | V3 · **A08 (audit poisoning)** |
| O5 | Ningún campo se normaliza: `user_agent`, `actor_email` y los valores de `metadata` se guardan con saltos de línea, retornos de carro y caracteres de control tal cual llegan. Tampoco hay longitud máxima. | `logAuditEvent.ts:34-43`, `getAuditRequestContext.ts:41` | V3 · **log injection** (CWE-117) |
| O6 | No hay control de integridad: ni firma, ni hash encadenado, ni trigger que impida `UPDATE`/`DELETE`. El comentario de la migración dice "append-only", pero eso solo es cierto para `authenticated`; el service-role puede reescribir el pasado sin dejar rastro. | `20260922000002_…sql` (sin trigger; comentario línea 24), `client.ts:39` | V3 · A08 · RS.AN-03 |
| O7 | `logAuditEvent` traga todos los errores y los manda a `console.error`. Si la escritura falla (RLS, red, columna, payload inválido) el flujo sigue como si nada y nadie se entera. Un atacante que provoque fallos de escritura opera en silencio. | `logAuditEvent.ts:31,45-49` | V3 · DE.AE-08 |
| O8 | `pageSize` llega del cliente al Server Action sin tope. El hook manda 25, pero la acción es invocable directamente con `pageSize: 1000000` → volcado completo del log y presión sobre la BD. | `getAuditLogs.ts:17-24,47,62` | V1/V3 · A04 |
| O9 | La propia lectura del log escribe una fila (`audit.log.viewed`) por cada página y cada cambio de filtro. Permite inflar el registro con ruido (dilución de evidencia) y crea un bucle de auto-auditoría. | `getAuditLogs.ts:68-76`, `useAuditLogTable.ts:71-77` | V3 · A08 |
| O10 | `from`/`to` van directo a `.gte`/`.lte` sin validar formato. Un valor inválido produce un error de Postgres cuyo mensaje se propaga al cliente (`throw new Error(error.message)` → `setError(err.message)`). Fuga de detalles del backend. | `getAuditLogs.ts:54-55,64`, `useAuditLogTable.ts:64-66` | V1 · A03 (fuga por mensaje de error) |
| O11 | Sin retención ni rotación. La tabla crece sin límite y acumula PII (email + IP) de forma indefinida, incluida la de personas que **nunca** lograron iniciar sesión. | `20260922000002_…sql`, `loginAction.ts:28` | GV.OC-03 · Ley 8968 |
| O12 | Cobertura mínima: solo 3 acciones (`auth.login.success`, `auth.login.failed`, `audit.log.viewed`). Usuarios y Operaciones no emiten ningún evento; tampoco se registran los accesos denegados. | `constants.ts:1-5`, O12 del diagnóstico de Operaciones | DE.CM-03/09 |
| O13 | `getAuditLogs` usa `getSession()` (lee la cookie) en lugar de `getUser()` (valida el token contra Supabase). Si el JWT es manipulable, la verificación del lector cae. Mismo patrón que `requirePermission`. | `getAuditLogs.ts:37-41`, `requirePermission.ts:14-18` | V1 · A01 · confianza en JWT (coordinar con Paula) |
| O14 | El middleware del panel no verifica rol. Una cuenta de cliente del portal llega a `/admin/audit-log`; ahí la frena `verifyAdminRole`, pero la superficie de ataque del Server Action queda expuesta a cualquier sesión. | `panel-admin/src/middleware.ts:27-31` | V1 · A01 (compartido — Paula) |
| O15 | `actor_id` es `ON DELETE SET NULL`. Al borrar un usuario, sus eventos pierden la referencia fuerte y queda solo `actor_email` (texto, no verificado). Degrada el no repudio histórico. | `20260922000002_…sql:3` | PR.DS-01 · RS.AN-03 |

---

## 4. F1.2 Mapeo de componentes contra NIST CSF 2.0

Estado frente a la subcategoría: **Cumple** · **Parcial** (existe el control pero con huecos) ·
**No cumple** (control ausente) · **Por verificar** (requiere la PoC de la Fase 2).
La columna "Ref." remite a las observaciones de §3.

### 4.1 Flujo de datos del módulo (ID.AM-03)

```
PRODUCCIÓN DEL EVENTO
─────────────────────
Cliente (incl. anónimo)                 Servidor (Next.js)                      Supabase
───────────────────────                 ──────────────────                      ────────
POST login + cabeceras ───────────────► getAuditRequestContext()
  email (campo libre)                     └─ x-forwarded-for[0] ─┐  ← controlable por el cliente
  x-forwarded-for (falsificable)          └─ user-agent ─────────┤  ← controlable por el cliente
  user-agent (falsificable)                                      │
                                        loginAction               │
                                          └─ metadata.email ──────┤  ← controlable por el cliente
                                                                  ▼
                                        logAuditEvent(event) ── service-role (salta RLS) ──► INSERT audit_logs
                                          └─ sin saneamiento, sin esquema, sin firma
                                          └─ error ──► console.error (nadie lo ve)

CONSUMO DEL EVENTO
──────────────────
Navegador admin                         panel-admin (servidor)                  Supabase
───────────────                         ──────────────────────                  ────────
/admin/audit-log ── middleware: sesión activa (sin rol) ──► AuditLogPage
                                          └─ getAuditLogs(params)
                                               ├─ getSession()        ← cookie, no getUser()
                                               ├─ verifyAdminRole()   ← NO comprueba audit:view
                                               └─ service-role ───────────────────► SELECT audit_logs
                                                    ├─ .eq(action) .gte(from) .lte(to)   (RLS saltada)
                                                    └─ .or(`…ilike.%${search}%`)  ← interpolación cruda
                                          └─ logAuditEvent(audit.log.viewed)  ← una fila por página
Tabla (texto escapado por React) ◄────────┘
  click en metadatos
     └─► Drawer: dangerouslySetInnerHTML(formatMetadataHtml(metadata))  ← ejecuta lo que guardó el atacante
```

**Lectura del flujo:** las tres entradas que un atacante controla (email del formulario, `x-forwarded-for`,
`user-agent`) viajan sin saneamiento desde una petición anónima hasta el navegador de un administrador,
y en el último tramo se renderizan como HTML. El módulo que debería ser la fuente de verdad de la
evidencia es, hoy, un canal de entrega de carga útil.

### 4.2 Mapeo por componente

#### Escritura de eventos (`packages/core/src/audit`)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AU-S01 `logAuditEvent` | PROTECT | **PR.PS-04** Se generan registros de log y están disponibles para el monitoreo | Existe el escritor y se invoca en el flujo de login | Parcial | O12 |
| | PROTECT | **PR.DS-01** Confidencialidad, integridad y disponibilidad de los datos en reposo | Escribe sin saneamiento, sin esquema de `metadata` y sin control de integridad | No cumple | O5, O6 |
| | PROTECT | **PR.AA-05** Permisos con menor privilegio | Usa service-role para todas las escrituras; cualquier código del servidor puede falsificar un evento | No cumple | O6 |
| | DETECT | **DE.AE-08** Se declaran incidentes cuando se cumplen los criterios | Un fallo de escritura solo va a `console.error`: no hay alerta ni reintento | No cumple | O7 |
| | RESPOND | **RS.AN-03** Se realiza un análisis que establece qué ocurrió durante un incidente | Sin firma ni encadenamiento, la evidencia no resiste cuestionamiento | No cumple | O6 |
| AU-S02 `getAuditRequestContext` | PROTECT | **PR.DS-10** Integridad de los datos en uso | Confía en `x-forwarded-for` sin lista de proxies de confianza | No cumple | O4 |
| | DETECT | **DE.AE-03** La información de los eventos se correlaciona de distintas fuentes | La IP registrada puede no ser la real: cualquier correlación por IP es inválida | No cumple | O4 |
| | PROTECT | **PR.PS-04** | Garantiza que `ip_address`/`user_agent` no queden nulos | Cumple | — |
| AU-D06 `AUDIT_ACTIONS` / `AUDIT_ENTITIES` | DETECT | **DE.CM-09** Se monitorean el software, los servicios y los datos | Solo 3 acciones; ningún evento de Usuarios ni de Operaciones | No cumple | O12 |
| | DETECT | **DE.CM-03** Se monitorea la actividad del personal | Login sí; cambios administrativos no | Parcial | O12 |
| | PROTECT | **PR.PS-06** Prácticas de desarrollo seguro | Catálogo centralizado y tipado (`Object.freeze` + tipo derivado) | Cumple | — |
| AU-S15 Call sites | PROTECT | **PR.DS-10** | Cada uno arma `metadata` a mano, sin esquema ni lista blanca de campos | No cumple | O3, O5 |
| | DETECT | **DE.CM-03** | Login fallido registra `email` y `reason`: buena señal de detección | Cumple | — |

#### Lectura y visualización (`panel-admin/features/audit-log`)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. |
|---|---|---|---|---|---|
| AU-S03 `getAuditLogs` | PROTECT | **PR.AA-05** Permisos con menor privilegio | No comprueba `audit:view`; basta ser admin activo | No cumple | O1 |
| | PROTECT | **PR.AA-03** Los usuarios son autenticados | `getSession()` lee la cookie en vez de validar el token con `getUser()` | Por verificar | O13 |
| | PROTECT | **PR.DS-10** Integridad de los datos en uso | `search` se interpola en `.or()`; `from`/`to` y `pageSize` no se validan | No cumple | O2, O8, O10 |
| | PROTECT | **PR.DS-01** Confidencialidad en reposo | Service-role salta la RLS que sí exigía el permiso | No cumple | O1 |
| | DETECT | **DE.CM-03** | Registra `audit.log.viewed` (quién consultó el log) | Cumple | O9 |
| | DETECT | **DE.AE-02** Los eventos potencialmente adversos se analizan | Una fila por página genera ruido que diluye la evidencia real | Parcial | O9 |
| | PROTECT | **PR.PS-06** | Mensajes de error de Postgres propagados al cliente | No cumple | O10 |
| AU-S12 Tabla `audit_logs` + RLS | PROTECT | **PR.AA-05** | Policy de SELECT correcta: `is_admin_or_owner() AND has_permission('audit:view')` | Cumple (en BD) | O1 |
| | PROTECT | **PR.DS-01** Integridad en reposo | Sin policies de UPDATE/DELETE para `authenticated`, pero **sin trigger** que lo impida al service-role | Parcial | O6 |
| | PROTECT | **PR.DS-01** | `actor_id ON DELETE SET NULL` degrada la atribución histórica | Parcial | O15 |
| | PROTECT | **PR.IR-04** Se mantiene la capacidad de recursos adecuada | Sin retención ni rotación; crecimiento ilimitado | No cumple | O11 |
| | IDENTIFY | **ID.AM-08** Los activos se gestionan durante todo su ciclo de vida | No hay ciclo de vida definido para la evidencia (ni archivado ni purga) | No cumple | O11 |
| AU-S07 `AuditLogDetailDrawer` | PROTECT | **PR.DS-10** | `dangerouslySetInnerHTML` sobre datos de origen no confiable | **No cumple** | O3 |
| | PROTECT | **PR.PS-05** Se previene la instalación y ejecución de software no autorizado | Ejecuta script arbitrario en el navegador del admin | **No cumple** | O3 |
| AU-S10 `formatMetadataHtml` | PROTECT | **PR.PS-06** Desarrollo seguro | Construye HTML por concatenación de strings sin escapar, por diseño | **No cumple** | O3 |
| AU-S06 `AuditLogTable` | PROTECT | **PR.DS-10** | Celdas renderizadas con escape de React | Cumple | — |
| AU-S08 `AuditLogFilters` | PROTECT | **PR.DS-10** | Validación solo de UI (`<select>` y `type="date"`); el servidor no revalida | No cumple | O2, O10 |

#### Transversal (compartido con otros módulos)

| Componente | Función | Subcategoría NIST CSF 2.0 | Por qué aplica | Estado | Ref. | Dueño |
|---|---|---|---|---|---|---|
| AU-S14 middleware del panel | PROTECT | **PR.AA-05** | `/admin/**` exige sesión activa pero no rol admin/owner | Parcial | O14 | **Paula** |
| AU-X02 `getSession()` vs `getUser()` | PROTECT | **PR.AA-03** / **PR.AA-04** | Patrón repetido en `getAuditLogs` y `requirePermission` | Por verificar | O13 | Paula / Joseph |
| AU-D05 permiso `audit:view` | PROTECT | **PR.AA-05** | El permiso existe y se otorga, pero el código no lo exige | No cumple | O1 | Joseph (modelo), Fabián (uso) |
| `next.config.ts` (panel) | PROTECT | **PR.PS-01** Gestión de configuración | Sin CSP: nada frena el XSS de O3 como segunda capa | No cumple | O3 | Paula |
| AU-X03 proxy / despliegue | IDENTIFY | **ID.AM-04** Inventario de servicios de proveedores | No se sabe qué proxy antecede a la app → no se puede confiar en `x-forwarded-for` | No cumple | O4 | Equipo |
| AU-X04 destino de los fallos | DETECT | **DE.CM-01** Se monitorean las redes y los servicios | Solo `console.error`, sin agregador ni alertas | No cumple | O7 | Fabián |
| Vulnerabilidades del módulo | IDENTIFY | **ID.RA-01** Las vulnerabilidades se identifican y registran | Este diagnóstico + las PoC de la Fase 2 | En curso | §3 | Fabián |
| Cobertura de eventos del equipo | GOVERN | **GV.OV-03** Se evalúa el desempeño de la gestión de riesgos | Nadie mide si lo que debería auditarse se audita | No cumple | O12 | Fabián (coordina) |

### 4.3 Resumen de cobertura por subcategoría

| Subcategoría | Componentes evaluados | Cumple | Parcial | No cumple | Por verificar |
|---|---|---|---|---|---|
| ID.AM-03/04/08 | 3 | 0 | 0 | 2 | 0 (+1 flujo en §4.1) |
| ID.RA-01 | 1 | — | — | — | En curso |
| GV.OV-03 | 1 | 0 | 0 | 1 | 0 |
| PR.AA-03/04/05 | 6 | 1 | 1 | 2 | 2 |
| PR.DS-01/10 | 10 | 1 | 2 | 7 | 0 |
| PR.PS-01/04/05/06 | 7 | 2 | 1 | 4 | 0 |
| PR.IR-04 | 1 | 0 | 0 | 1 | 0 |
| DE.AE-02/03/08 | 3 | 0 | 1 | 2 | 0 |
| DE.CM-01/03/09 | 5 | 1 | 1 | 3 | 0 |
| RS.AN-03 | 1 | 0 | 0 | 1 | 0 |

**Lectura:** el módulo tiene buenas intenciones en la capa de base de datos (permiso dedicado, policy de
SELECT bien escrita, sin escritura para `authenticated`) y las anula en la capa de aplicación, porque
**todo pasa por service-role**. La RLS existe pero nunca se ejerce. La autorización se degrada de
"necesitás `audit:view`" a "basta ser admin".

Los tres atributos que debería garantizar un registro de auditoría fallan los tres:
**integridad** (sin firma ni append-only real, O6), **fidelidad** (IP y campos falsificables, O4/O5) y
**confidencialidad del acceso** (sin el permiso que lo controla, O1). Encima, el visor convierte el log
en un vector de ejecución contra quien lo revisa (O3).

---

## 5. F1.3 Impacto operacional y de negocio (GOVERN / IDENTIFY)

### 5.1 Contexto organizacional (GV.OC)

| Subcategoría | Aplicación al módulo |
|---|---|
| **GV.OC-01** Misión | El módulo no genera ingresos: sostiene la **rendición de cuentas**. Es lo que permite responder "¿quién hizo esto y cuándo?" ante un fraude de recepción, una tarifa alterada o una reserva cancelada sin razón. Sin él, el hotel no puede demostrar nada ante un huésped, una aseguradora o un regulador. |
| **GV.OC-02** Partes interesadas | **Owner** (necesita supervisar a su personal y asumir el riesgo), **administradores** (son el sujeto auditado **y** los lectores del log), **huéspedes** (su PII aparece en los metadatos de eventos), **los otros 3 módulos** (consumidores de la API), **un eventual auditor o perito**. |
| **GV.OC-03** Requisitos legales y contractuales | **Ley 8968** (CR): `audit_logs` almacena email e IP de personas identificables, incluidas las que solo *intentaron* entrar. Exige finalidad declarada, minimización y plazo de conservación — hoy no hay ninguno de los tres. Para disputas de cobro bajo la **Ley 7472**, el log es la prueba del lado del hotel; si es alterable, no prueba nada. |
| **GV.OC-04** Servicios críticos que dependen del módulo | Investigación de incidentes, no repudio de acciones administrativas, detección de ataques de fuerza bruta contra el login, y la **función DETECT completa de los otros tres módulos** en la Fase 3. |
| **GV.OC-05** Dependencias del módulo | **Supabase** (tabla, service-role, Auth para `actor_id`), módulo de **Autenticación** (produce los únicos eventos de hoy y define la sesión del lector), módulo de **Usuarios** (otorga `audit:view`), **infraestructura de despliegue** (define si `x-forwarded-for` es confiable — hoy indefinida). |

### 5.2 Roles y apetito de riesgo (GV.RR / GV.RM)

- **Dueño del riesgo del módulo:** el owner del hotel. **Responsable técnico:** Fabián.
- **Rol particular:** este módulo es **control compensatorio de los otros tres**. Su degradación no se
  ve sola: eleva la probabilidad efectiva de todos los riesgos del sistema, porque nada se detecta.
- **GV.RM-02 Apetito de riesgo propuesto:**
  - **Tolerancia cero** a la alteración o el borrado de registros existentes sin rastro (integridad).
  - **Tolerancia cero** a la ejecución de código en el navegador del administrador que revisa el log.
  - **Tolerancia muy baja** a atribuciones falsas (IP o actor falsificados): un log que miente es peor
    que no tener log, porque dirige la investigación hacia un inocente.
  - **Tolerancia moderada** a la pérdida de **nuevos** eventos por indisponibilidad breve, siempre que
    la pérdida quede registrada en algún lado (hoy no queda).

### 5.3 Análisis de impacto por proceso de negocio

| Proceso | Activos | Pérdida de C | Pérdida de I | Pérdida de D | Impacto dominante |
|---|---|---|---|---|---|
| **P1. Registrar la evidencia** (producción) | AU-D01, AU-D03, AU-D04, AU-S01, AU-S02 | Media: los metadatos arrastran PII a un almacén sin política | **Crítica**: un evento falsificado o envenenado dirige la investigación hacia la persona equivocada | Media: perder eventos nuevos deja huecos, pero no destruye el histórico | Integridad |
| **P2. Consultar la evidencia** (visor) | AU-D01, AU-S03, AU-S05–S08 | **Alta**: el log concentra la actividad de todo el sistema y hoy lo ve cualquier admin sin `audit:view` | **Alta**: el visor es el punto donde un payload almacenado ejecuta con sesión de admin | Baja: si el visor cae, los datos siguen en la BD | Confidencialidad e integridad |
| **P3. Investigar un incidente** | AU-D01, AU-D02, AU-S12 | — | **Crítica**: sin firma ni append-only real, cualquier conclusión es cuestionable; no hay no repudio | **Alta**: sin retención definida, la evidencia de hace meses puede no existir | Integridad y no repudio |
| **P4. Dar servicio DETECT a los otros módulos** | AU-D06, AU-S01, AU-S15 | — | **Alta**: con 3 acciones registradas, el 90 % del sistema es invisible | — | Detección |
| **P5. Cumplir con la protección de datos** | AU-D07 | **Alta**: acumulación indefinida de email e IP de terceros sin base legal documentada | — | — | Confidencialidad / legal |

### 5.4 Escala de valoración

Misma escala que el resto del equipo, para que la matriz consolidada (G1) sea comparable.

| Nivel | Impacto (I) | Probabilidad (P) |
|---|---|---|
| 1 | **Bajo:** molestia, sin pérdida económica ni de datos | **Rara:** exige acceso privilegiado y una cadena compleja |
| 2 | **Medio:** pérdida económica acotada o afectación operativa de horas | **Posible:** exige cuenta con permisos o condiciones específicas |
| 3 | **Alto:** pérdida económica directa, afectación a varios huéspedes o incumplimiento legal puntual | **Probable:** explotable con cualquier cuenta autenticada (el registro de clientes es abierto) |
| 4 | **Crítico:** fraude sistemático, filtración masiva de PII, sanción o daño reputacional severo | **Casi segura:** anónimo, trivial, sin cuenta |

**Riesgo inherente = I × P:** 1–3 **Bajo** · 4–6 **Medio** · 8–9 **Alto** · 12–16 **Crítico**.
"Inherente" = riesgo del código en `257db31`, antes de los parches de la Fase 3. Los controles que ya
existen (§2.4) sí se consideran; en la Fase 3 se recalcula como riesgo residual.

### 5.5 Escenarios de riesgo y riesgo inherente (ID.RA-03/04/05)

| ID | Escenario de amenaza | Activo | Ref. | I | P | Riesgo inherente | Justificación |
|---|---|---|---|---|---|---|---|
| **AU-R01** | Un atacante **anónimo** envía un login fallido con un payload HTML en el campo de email; queda guardado en `metadata.email` y se ejecuta cuando un administrador abre el detalle del evento en el drawer. Roba la sesión del admin o ejecuta acciones con sus permisos. | AU-D03, AU-S07, AU-S10 | O3 | 4 | 4 | **Crítico (16)** | No requiere cuenta, no requiere permisos y el cebo es irresistible: un login fallido sospechoso es exactamente lo que un admin va a ir a revisar. Sin CSP que lo contenga. Es la cadena más grave del módulo. |
| **AU-R02** | Un administrador **sin** `audit:view` (o cuya sesión fue robada) lee el registro completo: emails, IPs y actividad de todo el personal y de los intentos de login. | AU-D01, AU-D07, AU-S03 | O1, O13 | 3 | 3 | **Alto (9)** | El permiso existe y la RLS lo exige, pero el código lo salta con service-role. Cualquier admin activo del panel lo logra sin herramientas. |
| **AU-R03** | Manipulación de la consulta vía el filtro `search`: se rompe la expresión `.or()` para alterar el conjunto de resultados, ocultar filas de una investigación o alcanzar columnas no previstas. | AU-D01, AU-S03 | O2 | 3 | 3 | **Alto (9)** | Interpolación directa en PostgREST. El alcance real (¿solo `audit_logs` o también recursos embebidos?) se determina con la PoC F2.1. |
| **AU-R04** | Audit poisoning por cabeceras: el atacante fija `x-forwarded-for` y `user-agent` arbitrarios, de modo que sus acciones quedan atribuidas a otra IP, y mete saltos de línea y caracteres de control para falsificar entradas o romper el procesamiento posterior del log. | AU-D04, AU-S02, AU-S01 | O4, O5 | 3 | 4 | **Crítico (12)** | Trivial y anónimo (una cabecera HTTP). Destruye la fidelidad de toda correlación por IP y permite incriminar a un tercero. Sin proxy de confianza documentado, no hay forma de distinguir la IP real. |
| **AU-R05** | Alteración o borrado del histórico: quien tenga acceso al service-role (o cualquier ruta de código del servidor que lo use) edita o elimina filas de `audit_logs` sin dejar evidencia. | AU-D01, AU-S12, AU-X01 | O6 | 4 | 2 | **Alto (8)** | El impacto es total: destruye el no repudio de todo el sistema. P = 2 porque exige la clave de servicio o ejecución de código en el servidor, pero el diseño no ofrece **ninguna** barrera ni detección. Sin hash encadenado, el borrado es indetectable. |
| **AU-R06** | Volcado completo del log invocando el Server Action con un `pageSize` arbitrario, y/o degradación del servicio por consultas pesadas sobre una tabla que crece sin límite. | AU-D01, AU-S03 | O8, O11 | 3 | 2 | **Medio (6)** | Exige sesión de admin (combinado con AU-R02, cualquier admin). Exfiltración masiva de PII en una sola llamada. |
| **AU-R07** | Supresión silenciosa de evidencia: el atacante provoca fallos de escritura (payload inválido, saturación) y `logAuditEvent` los traga; sus acciones no quedan registradas y nadie recibe una alerta. | AU-S01, AU-X04 | O7 | 3 | 2 | **Medio (6)** | El `try/catch` es deliberado y razonable (no romper el login), pero sin contador de fallos, alerta ni cola de reintento se vuelve un punto ciego explotable. |
| **AU-R08** | Dilución de la evidencia: se inunda la tabla con eventos `audit.log.viewed` (o logins fallidos) hasta que la actividad maliciosa real se pierde entre el ruido y el visor se vuelve inservible. | AU-D01, AU-S03 | O9, O11 | 2 | 3 | **Medio (6)** | Una fila por cada página y cada tecleo en el filtro. Sin rate limit ni retención. |
| **AU-R09** | Incumplimiento de la Ley 8968: conservación indefinida de email e IP de personas que nunca fueron usuarias (intentos fallidos de login), sin finalidad declarada ni plazo de borrado. | AU-D07 | O11 | 3 | 2 | **Medio (6)** | Riesgo regulatorio, no técnico. Se mitiga con una política de retención y minimización, no con código defensivo. |
| **AU-R10** | Ceguera operativa: un fraude en Operaciones o un cambio de permisos en Usuarios ocurre y no deja ningún rastro, porque esos módulos no emiten eventos. | AU-D06, AU-S15 | O12 | 3 | 2 | **Medio (6)** | Es el riesgo de "no cumple" más transversal: eleva la probabilidad efectiva de todos los riesgos de los otros tres módulos. Se cierra con la guía de uso (F3.4) + los parches de cada quien. |
| **AU-R11** | Fuga de detalles del backend por mensajes de error de Postgres propagados al cliente mediante `from`/`to` inválidos. | AU-S03 | O10 | 1 | 3 | **Bajo (3)** | Facilita el reconocimiento previo a AU-R03. Impacto directo bajo. |
| **AU-R12** | Pérdida de atribución histórica al borrar una cuenta (`actor_id → NULL`), quedando solo un email como texto sin verificar. | AU-D02 | O15 | 2 | 2 | **Medio (4)** | Un admin que sabe que será investigado pide que le borren la cuenta y debilita la evidencia en su contra. |

### 5.6 Resumen de impacto

- **2 riesgos Críticos** (AU-R01, AU-R04), **3 Altos** (R02, R03, R05), **6 Medios** y **1 Bajo**.
  Es el perfil más cargado del equipo, y tiene sentido: el módulo se construyó como línea base
  deliberadamente sin endurecer (§4.1 del plan) y es el único cuyo propósito *es* la seguridad.
- **AU-R01 es la prioridad absoluta.** Es la única cadena del sistema que va de **anónimo** a
  **ejecución de código con sesión de administrador**, y pasa por el módulo encargado de la evidencia.
- **AU-R04 y AU-R05 atacan lo mismo desde dos lados:** si la entrada se puede envenenar (R04) y el
  histórico se puede reescribir (R05), el log deja de ser prueba. Los dos se cierran con controles de
  integridad, no con validación de entrada.
- **AU-R10 no es un riesgo del módulo sino del equipo.** Es el que convierte el trabajo de los otros
  tres en parcial: sin eventos, su columna DETECT queda en "no cumple" por más que parcheen PROTECT.
- **Los tres vectores del enunciado tienen hallazgo real**, sin necesidad de introducir una
  vulnerabilidad controlada:
  - **Vector 1 (servidor):** AU-R03 (A03, inyección de filtro) y AU-R02 (A01, control de acceso roto).
  - **Vector 2 (cliente):** AU-R01 (XSS stored vía metadatos del log).
  - **Vector 3 (alteración de entrada):** AU-R04 (A08, falsificación de origen + log injection) y
    AU-R05 (alteración del histórico).
- **Prioridad para la Fase 2:**
  1. AU-R01 → F2.2 (vector 2). Mayor severidad y PoC más demostrativa.
  2. AU-R03 + AU-R02 → F2.1 (vector 1).
  3. AU-R04 + AU-R05 → F2.3 (vector 3).
  4. AU-R06 a AU-R08 como evidencia de apoyo dentro de las mismas PoC.

---

## 6. F1.4 Línea base de controles PROTECT / DETECT

La línea base es el **mínimo de controles** que el módulo debe cumplir para que cada riesgo de §5.5
quede en Bajo o Medio. La columna "Estado actual" es el punto de partida de la Fase 3. La columna
"Tarea" enlaza con el checklist F3.x del plan.

### 6.1 Controles PROTECT

| ID | Control requerido (línea base) | Subcategoría | Riesgos | Estado actual | Brecha | Tarea | Coordinar con |
|---|---|---|---|---|---|---|---|
| **AU-C01** | **Escape de salida en el visor**: eliminar `dangerouslySetInnerHTML` del drawer y renderizar los metadatos como texto (React escapa) o con HTML construido a partir de nodos, no de concatenación. `formatMetadataHtml` se elimina o se reescribe para escapar cada clave y cada valor. | PR.DS-10, PR.PS-05, PR.PS-06 | R01 | **No cumple**: `AuditLogDetailDrawer.tsx:68` + `utils.ts:84` | HTML concatenado sin escapar, renderizado como HTML | F3.2 | — |
| **AU-C02** | **CSP en el panel** que bloquee scripts inline y orígenes no confiables, como segunda capa frente a cualquier XSS que se escape de AU-C01. | PR.PS-01 | R01 | **No cumple**: `next.config.ts` sin cabeceras de seguridad | Sin defensa en profundidad | F3.2 | **Paula** (CSP global del panel) |
| **AU-C03** | **Saneamiento en la escritura**: `logAuditEvent` normaliza todo campo de texto antes de insertar — quita caracteres de control y saltos de línea (`\r`, `\n`, `\u0000`–`\u001F`), recorta a una longitud máxima por campo, y valida `metadata` contra un esquema (claves permitidas, profundidad y tamaño máximos). Defensa en profundidad respecto de AU-C01. | PR.DS-01, PR.DS-10, PR.PS-06 | R01, R04 | **No cumple**: inserta tal cual lo que recibe | Sin normalización, sin límites, sin esquema | F3.3 | Todos (afecta a sus call sites) |
| **AU-C04** | **Origen de IP confiable**: `x-forwarded-for` solo se acepta si la petición viene de un proxy conocido (lista configurable); si no, se usa la IP de la conexión. Documentar la topología de despliegue en `.env.example` y en el README. Si no hay proxy confiable, registrar la IP como "no verificada". | PR.DS-10, PR.AA-04 | R04 | **No cumple**: toma el primer elemento de la cabecera sin condición | Cualquier cliente fija su propia IP registrada | F3.3 | Equipo (definir AU-X03) |
| **AU-C05** | **Autorización real en la lectura**: `getAuditLogs` llama a `requirePermission(PERMISSIONS.AUDIT.VIEW)` y usa el cliente de **sesión** (RLS activa) en lugar del service-role, de modo que la policy `audit_logs_admin_select` se ejerza de verdad. Defensa en dos capas: app y BD. | PR.AA-05, PR.DS-01 | R02, R06 | **No cumple**: solo `verifyAdminRole()` + service-role | El permiso `audit:view` existe pero nunca se exige | F3.1 | Joseph (constantes de permisos) |
| **AU-C06** | **Consultas parametrizadas en los filtros**: `search` se aplica con `.ilike()` por columna (o con los caracteres de PostgREST escapados), nunca interpolado en `.or()`. `action` validado contra `AUDIT_ACTIONS`, `from`/`to` validados como fecha ISO, `pageSize` acotado a un máximo del servidor (p. ej. 100) y `page` ≥ 1. Esquema Zod en la frontera del Server Action. | PR.DS-10, PR.PS-06 | R03, R06, R10, R11 | **No cumple**: interpolación cruda y cero validación en runtime | La validación vive solo en la UI | F3.1 | — |
| **AU-C07** | **Mensajes de error genéricos**: los errores de base de datos se registran en el servidor y al cliente se le devuelve un mensaje neutro. | PR.PS-06 | R11 | **No cumple**: `throw new Error(error.message)` llega a la UI | Fuga de detalles del backend | F3.1 | — |
| **AU-C08** | **`audit_logs` append-only de verdad**: trigger `BEFORE UPDATE OR DELETE` que lanza excepción, o revocación explícita de UPDATE/DELETE sobre la tabla, de forma que ni el service-role pueda reescribir el pasado por la vía normal. | PR.DS-01, PR.AA-05 | R05 | **No cumple**: "append-only" solo por ausencia de policies | El service-role salta la RLS por completo | F3.3 | — |
| **AU-C09** | **Integridad verificable**: cada fila lleva un hash que encadena con la anterior (`prev_hash` + hash del contenido canonizado), calculado en un trigger de BD. Un procedimiento de verificación recorre la cadena y detecta cualquier fila alterada, insertada o borrada. | PR.DS-01, RS.AN-03 | R05, R04 | **No cumple**: no hay firma ni encadenamiento | La evidencia no resiste cuestionamiento | F3.3 | — |
| **AU-C10** | **Escritura con menor privilegio**: la inserción se hace mediante una función `SECURITY DEFINER` acotada (o un rol dedicado con solo `INSERT`), en lugar del service-role de propósito general. | PR.AA-05 | R05 | **No cumple**: service-role compartido con el resto de la app | Cualquier código del servidor puede falsificar un evento | F3.3 | — |
| **AU-C11** | **Retención y minimización**: plazo de conservación definido (propuesta: 12 meses en caliente, archivado o purga después), job de purga, y revisión de qué PII se guarda en `metadata` (no registrar el email completo en intentos fallidos, o hashearlo). | PR.DS-01, GV.OC-03, ID.AM-08 | R09, R08, R06 | **No cumple**: crecimiento indefinido | Sin política ni mecanismo | F3.3 | Equipo (decisión de negocio) |
| **AU-C12** | **Atribución duradera**: `actor_id` con `ON DELETE SET NULL` se complementa con `actor_email` **inmutable** y un identificador estable, de forma que borrar la cuenta no degrade la evidencia. | PR.DS-01 | R12 | **Parcial**: `actor_email` se guarda, pero sin garantía de inmutabilidad | Atribución débil tras el borrado de la cuenta | F3.3 | Joseph (ciclo de vida de cuentas) |
| **AU-C13** | **Middleware del panel restringido por rol** (`admin`/`owner` activos) y verificación de sesión con `getUser()` en lugar de `getSession()`. | PR.AA-03, PR.AA-05 | R02 | **Parcial**: solo exige sesión activa | Un cliente del portal alcanza la superficie del Server Action | F3.1 | **Paula** (dueña de `middleware.ts`) |
| **AU-C14** | **RLS de SELECT sobre `audit_logs` basada en permisos** (`is_admin_or_owner() AND has_permission('audit:view')`). | PR.AA-05 | R02 | **Cumple** (en BD) | Mantener; que AU-C05 la ponga en uso real | Mantener | — |

### 6.2 Controles DETECT

| ID | Control requerido (línea base) | Subcategoría | Riesgos | Estado actual | Brecha | Tarea | Coordinar con |
|---|---|---|---|---|---|---|---|
| **AU-C15** | **Catálogo de acciones ampliado y guía de uso publicada**: `AUDIT_ACTIONS` cubre autenticación, gestión de usuarios y permisos, y operaciones (estado de reservas, tarifas, modo de reservas, galería). Documento con el contrato de `logAuditEvent`, qué va en `metadata`, qué **no** debe ir (PII, secretos) y ejemplos por módulo. | DE.CM-03, DE.CM-09, PR.PS-04 | R10 | **No cumple**: 3 acciones, sin guía | Los otros tres módulos no tienen de dónde agarrarse | **F3.4 (antes de H2)** | **Paula, Joseph, Aarón** |
| **AU-C16** | **Registro de accesos denegados y entradas rechazadas**: `PermissionDeniedError`, `AuthenticationRequiredError`, fallos de validación de esquema y filtros rechazados generan su propio evento, para detectar sondeos. | DE.CM-03, DE.AE-02 | R02, R03, R06 | **No cumple**: los intentos de abuso son invisibles | Solo se registra el éxito y el login fallido | F3.4 | Todos |
| **AU-C17** | **Fallos de auditoría visibles**: `logAuditEvent` mantiene el `try/catch` (no debe romper el flujo) pero incrementa un contador o emite una señal diferenciada; un fallo de escritura es un evento de seguridad, no una línea de `console.error`. | DE.AE-08, DE.CM-01 | R07 | **No cumple**: silencio total | Punto ciego explotable | F3.3 / F3.4 | — |
| **AU-C18** | **Procedimiento de verificación de integridad**: comando o endpoint administrativo que recorre la cadena de hashes de AU-C09 y reporta la primera inconsistencia, ejecutable como parte de una investigación. | RS.AN-03, DE.AE-03 | R05 | **No cumple** | No hay forma de saber si el log fue alterado | F3.3 / F3.5 | — |
| **AU-C19** | **Control del ruido en el propio visor**: `audit.log.viewed` se registra una vez por sesión de consulta (o con los parámetros agregados), no una fila por página y por tecleo en el filtro. | DE.AE-02 | R08 | **No cumple**: una fila por cada invocación | La evidencia real se diluye | F3.1 | — |

### 6.3 Resumen de la línea base

| Estado | PROTECT | DETECT | Total |
|---|---|---|---|
| Cumple | 1 (C14) | 0 | 1 |
| Parcial | 2 (C12, C13) | 0 | 2 |
| No cumple | 11 (C01–C11) | 5 (C15–C19) | 16 |
| **Total** | **14** | **5** | **19** |

**Relación con los riesgos críticos y altos:**
R01 → C01, C02 (+ C03) · R04 → C04, C03 (+ C09) · R02 → C05, C13, C14 · R03 → C06 (+ C07) ·
R05 → C08, C09, C10, C18.

Objetivo de la Fase 3: dejar **R01, R02, R03 y R04 en Bajo**; **R05 en Bajo** si AU-C08 y AU-C09 quedan
implementados y verificados, o en **Medio** si solo se logra el trigger append-only sin encadenamiento
de hash. **R09** (retención) y **R10** (cobertura del equipo) quedarán en Medio o Bajo según cuánto
alcancen a parchar los otros tres módulos dentro del Sprint 3; el residual se documenta como riesgo
aceptado.

**Dependencia crítica de calendario:** AU-C15 (catálogo de acciones + guía de uso) debe estar publicado
**antes de H2 (12 de octubre)**, porque los controles DETECT de los otros tres módulos dependen de él.
Es la única tarea de la Fase 3 de este módulo que no puede esperar al Sprint 3.

---

## 7. Filas para la Matriz General de Gobernanza (G1)

**Revisión 2026-10-06 (propuesta por Aarón como responsable de G1, por retroalimentación de la
profesora — a confirmar por Fabian):** la versión anterior tenía 3 filas que mezclaban dos funciones
(PR/DE, PR/RS, PR/GV) en una celda. Esta versión separa cada control por función y los toma de
§6.1/§6.2 (AU-C01 a AU-C19). Las filas GOVERN e IDENTIFY ya estaban identificadas en §4.2
(GV.OV-03 y ID.AM-08) pero no habían llegado a esta tabla. Los controles AU-C16/C17/C19 (registro de
denegados, fallos visibles, ruido del visor) no tienen una PoC propia planificada para la Fase 2 (su
propio §5.6 los marca como "evidencia de apoyo" dentro de las 3 PoC principales) y se dejaron fuera de
G1 por el mismo criterio que usó la profesora: no listar lo que no se va a demostrar por separado.
Siguen en la línea base (§6) como controles de la Fase 3.

Formato de `plantillas/matriz-general-gobernanza.xlsx`, listo para consolidar:

| Módulo y responsable | Activo crítico | Función NIST CSF | Categoría / subcategoría NIST CSF | Control de seguridad requerido (línea base) | Nivel de riesgo inherente |
|---|---|---|---|---|---|
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Metadatos del evento renderizados en el visor (`AuditLogDetailDrawer`, `formatMetadataHtml`) | PROTECT (PR) | PR.PS-05: Prevención de la ejecución de software no autorizado | Eliminar `dangerouslySetInnerHTML` del drawer; renderizar los metadatos como texto (React escapa) o con nodos, nunca con HTML concatenado (AU-C01) | Crítico |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Contexto de red del actor (`ip_address`, `user_agent`) y su origen (`getAuditRequestContext`) | PROTECT (PR) | PR.DS-10: Integridad de los datos en uso | Aceptar `x-forwarded-for` solo desde proxies de confianza documentados (si no, marcar la IP como no verificada); normalizar y acotar en longitud todo campo de texto antes de insertar (AU-C04 + AU-C03) | Crítico |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Lectura del registro (`getAuditLogs`) y permiso `audit:view` | PROTECT (PR) | PR.AA-05: Permisos gestionados con menor privilegio | `requirePermission(audit:view)` + cliente de **sesión** (no service-role) para que la RLS se ejerza de verdad; middleware del panel restringido por rol y `getUser()` en vez de `getSession()` (AU-C05 + AU-C13) | Alto |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Filtros del visor (`search`, `action`, `from`, `to`, `pageSize`) | PROTECT (PR) | PR.DS-10: Integridad de los datos en uso | `search` con `.ilike()` parametrizado (nunca interpolado en `.or()`); `action`/`from`/`to`/`pageSize` validados con esquema en el servidor; mensajes de error genéricos al cliente (AU-C06 + AU-C07) | Alto |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Registro de auditoría (`audit_logs`) como evidencia: integridad del histórico | PROTECT (PR) | PR.DS-01: Integridad de los datos en reposo | Trigger `BEFORE UPDATE OR DELETE` que bloquee la escritura (append-only real, también para el service-role), hash encadenado por fila con procedimiento de verificación, y escritura solo mediante una función `SECURITY DEFINER` acotada (AU-C08 + AU-C09 + AU-C10) | Alto |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Cobertura de eventos del sistema (`AUDIT_ACTIONS`) y API de auditoría para los demás módulos | DETECT (DE) | DE.CM-03: Monitoreo de la actividad del personal | Ampliar el catálogo de acciones a los cuatro módulos, publicar la guía de uso de `logAuditEvent` (antes de H2) y registrar también los accesos denegados (`PermissionDeniedError`, fallos de validación) (AU-C15 + AU-C16) | Medio |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Supervisión de la cobertura de auditoría del equipo | GOVERN (GV) | GV.OV-03: Se evalúa el desempeño de la gestión de riesgos | Revisar en cada fase cuántos de los eventos que los 4 módulos deberían emitir realmente se emiten, contra el catálogo publicado (§4.2: hoy nadie lo mide) | Medio |
| Módulo 4: Logs / Auditoría (Fabián Vargas) | Ciclo de vida de la evidencia (retención y minimización de PII en `audit_logs`) | IDENTIFY (ID) | ID.AM-08: Sistemas y datos gestionados durante su ciclo de vida | Definir y documentar el plazo de conservación (propuesta: 12 meses), implementar el job de purga, y minimizar la PII que se guarda en `metadata` de intentos fallidos (AU-C11) | Medio |

### 7.1 Trazabilidad fila → PoC → parche

| Fila (activo) | PoC | Estado |
|---|---|---|
| Metadatos renderizados en el visor | AU-POC-F2.2 (por crear) | Planificada (vector 2, prioridad 1 — la más grave del módulo) |
| Contexto de red (IP/user-agent) | AU-POC-F2.3 (por crear) | Planificada (vector 3, prioridad 3) |
| Lectura del registro / `audit:view` | AU-POC-F2.1a (por crear) | Planificada (vector 1, prioridad 2) |
| Filtros del visor | AU-POC-F2.1b (por crear) | Planificada (vector 1, prioridad 2) |
| Integridad del histórico | AU-POC-F2.3 (misma PoC que IP, o una propia si da el tiempo) | Planificada (vector 3, prioridad 3) |
| Cobertura de eventos / API de auditoría | — (se verifica con la guía publicada antes de H2, no con una PoC de ataque) | N/A |
| Supervisión de la cobertura (GOVERN) | — (control de gobernanza; se revisa en cada fase, no con una PoC) | N/A |
| Ciclo de vida de la evidencia (IDENTIFY) | — (se verifica con el job de purga y la política documentada) | N/A |

---

## 8. Insumos para los demás módulos

Hallazgos de este diagnóstico que afectan a otras personas. Se comunican ahora, no al final del sprint.

| Para | Hallazgo | Dónde |
|---|---|---|
| **Paula** (Auth) | El middleware del panel no verifica rol (O14); `getSession()` se usa en lugar de `getUser()` en `getAuditLogs` y en `requirePermission` (O13); no hay CSP en `next.config.ts`, lo que deja AU-R01 sin segunda capa (O3). | `middleware.ts:27-31`, `getAuditLogs.ts:37-41`, `requirePermission.ts:14-18` |
| **Paula** (Auth) | Los dos `loginAction` guardan el email crudo enviado por un anónimo en `metadata.email`: es el origen del XSS stored de AU-R01. El parche definitivo va en mi módulo (AU-C01/C03), pero conviene que lo tenga presente en su PoC de Fase 2. | `panel-admin/.../loginAction.ts:28`, `core/.../loginAction.ts:96` |
| **Joseph** (Usuarios) | El permiso `audit:view` existe en el enum y se otorga, pero ningún código lo exige (O1). Si su módulo tiene una UI para asignar permisos, hoy asignar o quitar `audit:view` no cambia nada. | `getAuditLogs.ts:43-44`, `20260922000002_…sql` |
| **Aarón** (Operaciones) | Confirmo su O12: ninguna operación de su módulo emite eventos. Los `AUDIT_ACTIONS` que pidió (`reservation.status_changed`, `booking_mode.updated`, `room.*`, `room_gallery.*`, `checkout.session_created`) entran en AU-C15, con la guía de uso, **antes de H2**. | `constants.ts`, control AU-C15 |
| **Todos** | Hasta que AU-C03 esté implementado, cualquier evento que registren con texto controlado por el usuario alimenta AU-R01. Si necesitan auditar antes del parche, no metan texto libre del usuario en `metadata`. | `logAuditEvent.ts:34-43` |
