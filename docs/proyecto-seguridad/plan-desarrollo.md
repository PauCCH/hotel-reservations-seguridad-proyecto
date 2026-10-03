# Plan de desarrollo — Proyecto Final IC-8071 Seguridad del Software

> **Documento vivo.** Es la fuente de verdad del avance del equipo. Se actualiza al terminar cada tarea
> (checkbox + entrada en la bitácora del integrante). Si algo no está marcado aquí, se asume que no está hecho.

---

## 0. Cómo usar este documento

### Para las personas
1. Abrí una sesión de Claude en este repo y escribí solo: **`Soy <Paula | Joseph | Aarón | Fabian>`**.
2. Claude te dirá en qué fase está tu módulo, qué hiciste ya y cuál es tu próxima tarea.
3. Al terminar una tarea, pedile a Claude que actualice este archivo (o hacelo a mano) y hacé commit.

### Para Claude (protocolo de inicio de sesión)
Cuando la persona se identifique:
1. Leé este archivo completo y ubicá la sección del integrante (§5).
2. Verificá el estado real contra el repo antes de confiar en los checkboxes:
   - `git fetch origin` y `git branch -a | grep security/<modulo>` para ver ramas del módulo.
   - `git log origin/develop --oneline -20` y PRs abiertos (`gh pr list`) para ver qué se integró.
   - Existencia de los archivos de evidencia en `docs/proyecto-seguridad/<modulo>/`.
3. Respondé con: **(a)** fase actual del módulo, **(b)** lo completado, **(c)** la próxima tarea concreta
   (primer checkbox sin marcar de la fase actual), **(d)** dependencias o bloqueos con otros módulos,
   **(e)** días que faltan para el próximo hito (§3).
4. Si el repo y este archivo no coinciden, señalalo y proponé corregir el archivo.
5. Al cerrar una tarea: marcá el checkbox, agregá una línea a la bitácora del integrante con fecha,
   rama/commit y resultado, y actualizá la tabla de §2.
6. Trabajá solo dentro del módulo de la persona salvo que pida otra cosa; los cambios en archivos
   compartidos (§4.4) se coordinan con su dueño.
7. Tratá a cada integrante por su nombre; no asumas pronombres.

---

## 1. Contexto del proyecto

- **Curso:** IC-8071 Seguridad del Software (TEC). **Valor:** 20 %. **Grupal (4 personas).**
- **Entrega final:** **9 de noviembre de 2026, 8:00 p. m.** Se entrega como **un solo proyecto** (no documentos por persona).
- **Enunciado:** `D:\Documentos\TEC\Seguridad\Proyecto\Enunciado Proyecto Seguridad del Software.pdf` (copia local de Aarón).
- **Aplicación evaluada:** este monorepo de reservas de hotel (Next.js 15 + Supabase).
  - `apps/portal-reservas` (:3001) — portal público de clientes: registro, login, búsqueda, checkout.
  - `apps/panel-admin` (:3002) — panel de administración: admins, invitaciones, reservas, habitaciones, CMS, auditoría.
  - `apps/landing` (:3000) — sitio informativo.
  - `packages/core` — lógica compartida (`auth`, `audit`, `permissions`, `booking`, `payments`, `email`).
  - `packages/db/supabase/migrations` — esquema, RLS y triggers.
- **Repo de trabajo:** `origin` = `PauCCH/hotel-reservations-seguridad-proyecto`, rama base `develop`.
  (`upstream` = repo original del producto; no se empuja ahí).

### Objetivo por fase (resumen del enunciado)
| Fase | Qué se hace | Entregable |
|---|---|---|
| **1. Diagnóstico (NIST CSF 2.0)** | Cada quien mapea su módulo contra subcategorías NIST CSF 2.0, inventario de activos, impacto (GOVERN/IDENTIFY) y línea base de controles (PROTECT/DETECT). | **Matriz General de Gobernanza del Sistema** (consolidada, 4 módulos). |
| **2. Evaluación ofensiva (OWASP)** | PoC reproducible por módulo que cubra los **3 vectores**: (1) servidor: A03 inyección + A01 control de acceso / confianza en JWT; (2) cliente: XSS stored/reflected; (3) alteración de entrada: CSRF/manipulación de parámetros (A08) + log injection / audit poisoning. | **Documento de PoCs estandarizado** (todas las PoC del equipo). |
| **3. Remediación (NIST Protect & Detect)** | Cada quien corrige su módulo con commits/PR propios: consultas parametrizadas, sanitización, CSP, cookies seguras, menor privilegio; y corrige la lógica de auditoría de su módulo (sanitización + firmas/tracing). | **Matriz de Riesgos NIST CSF actualizada** (riesgo residual), **Reporte Técnico de Parches**, **video individual ≤ 5 min**. |

### Escala de riesgo residual (Fase 3)
- **Alto / Crítico:** el parche trata el síntoma, no la causa; se puede saltar con otra codificación. Re-trabajo inmediato.
- **Medio:** la vulnerabilidad principal se eliminó pero quedan configuraciones laxas (ej. sin rate limiting).
- **Bajo:** vector neutralizado en código, la PoC original ya no funciona y el control cumple la subcategoría NIST.

### Reglas del video (¡cero si se incumplen!)
- Máximo 5 min por integrante, **solo repo + IDE**, explicando las líneas modificadas.
- **Prohibido:** diapositivas, leer documentos, explicaciones teóricas.

---

## 2. Tablero de estado (actualizar siempre)

_Última actualización: 2026-10-02_

| Integrante | Módulo | Fase actual | Próxima tarea | Rama activa | Bloqueos |
|---|---|---|---|---|---|
| Paula | Autenticación | 1 — Diagnóstico | P1.1 Inventario de activos del módulo | `security/auth/fase1-diagnostico` (sin commits en `develop`) | — |
| Joseph | Gestión de Usuarios | 1 — Diagnóstico ✅ | J2.1 Vector 1 (servidor): A03 + A01 | `security/users/fase1-diagnostico` (mergeada, PR #6) | — |
| Aarón | Operaciones / Transacciones | 2 — Evaluación ofensiva | A2.1 Vector 1 (servidor): A03 + A01 | `security/operations/fase2-pocs` | — |
| Fabian | Logs / Auditoría | 1 — Diagnóstico | F1.5 Revisar y entregar `fase-1-diagnostico.md` (PR a `develop`) | `security/audit/fase1-diagnostico` | — |

### Estado global del repo
- [x] Monorepo levantable con `.env` de Supabase/Resend (2026-09-28).
- [x] Módulo base de auditoría integrado (PR #1, 2026-09-23): tabla `audit_logs`, permiso `audit:view`,
      servicio `logAuditEvent`, captura de IP/user-agent en login, UI en `panel-admin/admin/audit-log`.
- [x] Decisión de equipo sobre la **línea base vulnerable** (ver §4.1) — 2026-09-28.
- [x] Responsables de las tareas grupales asignados (ver §6) — 2026-09-28.
- [x] Plantillas de la profesora guardadas en `docs/proyecto-seguridad/plantillas/` (2026-09-28):
  - `matriz-general-gobernanza.xlsx` → base de G1 (Fase 1).
  - `ejemplo-poc-audit-poisoning.docx` → formato de referencia para las PoC y G2 (Fase 2).
  - `matriz-riesgo-residual.xlsx` → base de G3.1 (Fase 3).
  - `reporte-tecnico-parches.docx` → base de G3.2 (Fase 3).
  - `rubrica-evaluacion.xlsx` → rúbrica oficial; revisarla antes de cerrar cada entregable.

---

## 3. Cronograma e hitos

Cronograma comprimido a 3 sprints (tablero Jira `AUD`, board "AUD board"), para terminar con margen antes
de la entrega real: **Sprint 1 — Fase 1** (29 sep–5 oct), **Sprint 2 — Fase 2** (6–12 oct),
**Sprint 3 — Fase 3** (13–26 oct). Deja ~2 semanas de colchón antes del 9 de nov.

| Hito | Fecha límite | Criterio de terminado |
|---|---|---|
| H0 — Arranque | 2026-09-28 | ~~Decisión §4.1 tomada~~ (hecho), plantillas acordadas, tablero Jira armado, cada quien leyó su sección. ✅ |
| H1 — Fase 1 individual (Sprint 1) | 2026-10-05 | Cada módulo tiene su archivo `fase-1-diagnostico.md` completo. |
| H1b — Matriz General de Gobernanza | 2026-10-06 | Documento consolidado revisado por los 4. |
| H2 — Fase 2 individual (Sprint 2) | 2026-10-12 | Cada módulo con PoC de los 3 vectores + evidencias reproducibles. |
| H2b — Documento de PoCs | 2026-10-13 | Documento estandarizado consolidado. |
| H3 — Parches integrados (Sprint 3) | 2026-10-21 | PRs de cada módulo aprobados y mergeados a `develop`, pruebas de regresión en verde. |
| H3b — Matriz de riesgo residual + Reporte de parches | 2026-10-23 | Ambos documentos consolidados. |
| H4 — Videos | 2026-10-25 | 4 videos grabados y revisados contra la regla de §1. |
| **Entrega interna (equipo)** | **2026-10-26** | Paquete único armado, con margen antes de la fecha real. |
| **Entrega real (curso)** | **2026-11-09 20:00** | Fecha límite oficial de la profesora — fija, no se comprime. |

---

## 4. Acuerdos del equipo

### 4.1 Línea base vulnerable (decidido — 2026-09-28)
El enunciado pide una app vulnerable; esta app es un producto real del equipo.

**Decisión:** se priorizan las vulnerabilidades reales encontradas en el código actual y, **si un vector
del enunciado no tiene un hallazgo real en el módulo, se permite introducir una vulnerabilidad controlada**
para poder demostrarlo.

Reglas para las vulnerabilidades introducidas:
- Solo en ramas `security/<modulo>/fase2-...`, nunca directo en `develop`; la versión vulnerable queda
  identificada por un commit concreto (se anota en la bitácora y en la PoC).
- Commit dedicado y explícito, ej.: `chore(security): introduce controlled vuln for <MOD>-POC-n`.
- En la PoC se marca como **"introducida"** (vs. **"real"**) para que la Matriz de Gobernanza y el
  reporte sean honestos sobre el origen del hallazgo.
- El parche de la Fase 3 debe eliminar la causa raíz y la PoC original debe dejar de funcionar.
- Nada de esto se despliega en un entorno con datos reales.

### 4.2 Ramas, commits y PRs (trazabilidad individual, obligatoria)
- Ramas: `security/<modulo>/<fase>-<descripcion>`, con `<modulo>` ∈ `auth`, `users`, `operations`, `audit`.
  Ej.: `security/operations/fase3-checkout-price-tampering`.
- Commits en Conventional Commits y **hechos por el integrante dueño del módulo** (autor git correcto).
  Ej.: `fix(checkout): recalculate total server-side`.
- Un PR por parche (o por grupo pequeño de parches relacionados) contra `develop` en `origin`.
  El PR enlaza la PoC que corrige y lleva la evidencia de regresión.
- Registrar en la bitácora: rama, hash de commits y enlace del PR (se usan en el Reporte de Parches).

### 4.3 Estructura de documentos
```
docs/proyecto-seguridad/
  plan-desarrollo.md            ← este archivo
  plantillas/                   ← plantillas de la profesora + rúbrica (no editar; copiar a consolidado/)
  consolidado/                  ← matriz de gobernanza, doc de PoCs, matriz de riesgo, reporte de parches
  auth/  users/  operations/  audit/
    fase-1-diagnostico.md
    fase-2-pocs.md
    fase-3-parches.md
    evidencias/                 ← capturas, requests/responses, salidas de tests
```
No subir datos reales de usuarios, claves ni tokens en las evidencias (tapar/redactar).

### 4.4 Archivos compartidos (coordinar con el dueño antes de tocar)
| Archivo / área | Dueño | Motivo |
|---|---|---|
| `packages/core/src/audit/**` (API `logAuditEvent`, constantes `AUDIT_ACTIONS`) | Fabian | Los demás módulos registran sus eventos a través de esta API. |
| Cabeceras de seguridad / CSP (`next.config.*`, `middleware.ts` de cada app) | Paula | Cookies de sesión y CSP afectan a todo el sistema. |
| `packages/core/src/permissions/**` y migraciones de roles/permisos | Joseph | Modelo de privilegios. |
| `packages/db/supabase/migrations/**` | Cada quien para sus tablas; **nombres de migración únicos** (timestamp). | Evitar colisiones como la del PR #1. |

### 4.5 Plantilla mínima de una PoC (Fase 2)
Cada PoC en `fase-2-pocs.md` debe tener: ID (`<MOD>-POC-n`), vector (1/2/3), OWASP, subcategoría NIST CSF,
componente/archivo:línea, precondiciones, pasos reproducibles, resultado esperado vs. obtenido, impacto,
evidencia, commit donde se reprodujo.

### 4.6 Plantilla mínima de un parche (Fase 3)
1. Ficha: responsable, módulo, PR, commits, rama.
2. Mapeo: OWASP, NIST CSF 2.0, archivos/líneas.
3. Diff antes/después.
4. Prueba de regresión: la PoC ya no funciona + test automatizado (Vitest) cuando aplique.
5. Riesgo residual (Alto/Medio/Bajo) con justificación.

---

## 5. Rutas de trabajo por integrante

Las "superficies a revisar" son **puntos de partida para el diagnóstico**, no hallazgos confirmados.
Cada hallazgo se confirma o descarta en la Fase 2 y se anota en la bitácora.

---

### 5.1 Paula — Autenticación (`auth`)

**Alcance (código):**
- `packages/core/src/auth/**` (`loginAction`, `refreshSession`, `signOutAction`, `getServerAuthContext`, cliente de sesión).
- `apps/panel-admin/src/features/auth/**` (login admin, activación de cuenta, `verifyTokenAction`).
- `apps/portal-reservas/src/features/auth/**` (login, registro, OAuth) y `apps/portal-reservas/src/app/auth/**` (incluye `callback/route.ts`).
- `apps/*/src/middleware.ts` (protección de rutas y refresco de sesión).
- Migraciones: `20260409000001_sync_auth_users_trigger.sql`, `20260609000003_sync_role_to_jwt.sql`.

**Superficies a revisar:** confianza en claims del JWT (rol sincronizado al token), validación de tokens de
activación, redirecciones en el callback de OAuth, flags de cookies de sesión, rate limiting / fuerza bruta,
mensajes de error que permiten enumerar usuarios, reflejo de parámetros en páginas de error/login.

**Subcategorías NIST CSF 2.0 sugeridas:** PR.AA-01/02/03/05, PR.DS-02, DE.CM-01/03, ID.AM-07, GV.RM.

**Fase 1**
- [ ] P1.1 Inventario de activos (datos: credenciales, sesiones, tokens de activación; servicios: Supabase Auth, OAuth, Resend).
- [ ] P1.2 Mapeo de componentes/endpoints contra NIST CSF 2.0.
- [ ] P1.3 Impacto operacional y de negocio (GOVERN/IDENTIFY).
- [ ] P1.4 Línea base de controles PROTECT/DETECT.
- [ ] P1.5 Entregar `docs/proyecto-seguridad/auth/fase-1-diagnostico.md`.

**Fase 2**
- [ ] P2.1 Vector 1 — servidor: inyección (A03) y control de acceso / confianza en JWT (A01).
- [ ] P2.2 Vector 2 — cliente: XSS reflected/stored en flujos de auth.
- [ ] P2.3 Vector 3 — CSRF / manipulación de parámetros (A08) y log injection en eventos de login.
- [ ] P2.4 Entregar `auth/fase-2-pocs.md` + evidencias.

**Fase 3**
- [ ] P3.1 Parches del vector 1 (PR propio).
- [ ] P3.2 Parches del vector 2 + CSP global (archivo compartido, avisar al equipo).
- [ ] P3.3 Parches del vector 3 + cookies `HttpOnly`/`Secure`/`SameSite`.
- [ ] P3.4 Auditoría del módulo: eventos de auth saneados vía API de Fabian.
- [ ] P3.5 Tests de regresión + riesgo residual por hallazgo.
- [ ] P3.6 Entregar `auth/fase-3-parches.md`.
- [ ] P3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| | | | |

---

### 5.2 Joseph — Gestión de Usuarios (`users`)

**Alcance (código):**
- `apps/panel-admin/src/features/admins-table/**` (`getAdmins`, `permissions`, `toggleAdminStatus`, `PermissionDrawer`, filtros).
- `apps/panel-admin/src/features/invitations/**` (`createAdminAccountAction`, `resendInvitation`, `revokeInvitation`).
- `apps/panel-admin/src/app/admin/admins/**`, `apps/panel-admin/src/app/admin/invitations/**`.
- `packages/core/src/permissions/**`.
- Migraciones: `create_users_table`, `users-table-policies`, `create_pending_invitations_table`, `fix_admin_invitations`,
  `add_owner_to_admin_policies`, `admins-permissions`, `seed_owner_permissions`, `migrate_admins_permissions`,
  `auto-assign-admin-basic-permissions`, `add_client_user_role`.

**Superficies a revisar:** escalamiento vertical (admin → owner) y horizontal al asignar permisos o
activar/desactivar cuentas, verificación de permisos en server actions vs. solo en UI, políticas RLS de
`users`/`admins_permissions`, construcción de filtros de búsqueda con entrada del usuario, datos de
usuario (nombre, email) renderizados en tablas y drawers, flujo de invitaciones (reuso/expiración de enlaces).

**Subcategorías NIST CSF 2.0 sugeridas:** PR.AA-05, PR.AA-01, PR.DS-01, ID.AM-07/08, GV.RR, DE.CM-03.

**Fase 1**
- [x] J1.1 Inventario de activos (tablas `users`, permisos, invitaciones; roles owner/admin/client).
- [x] J1.2 Mapeo de componentes/endpoints contra NIST CSF 2.0.
- [x] J1.3 Impacto operacional y de negocio (GOVERN/IDENTIFY).
- [x] J1.4 Línea base de controles PROTECT/DETECT.
- [ ] J1.5 Entregar `docs/proyecto-seguridad/users/fase-1-diagnostico.md`.

**Fase 2**
- [ ] J2.1 Vector 1 — servidor: inyección en filtros/búsquedas (A03) y escalamiento de privilegios (A01).
- [ ] J2.2 Vector 2 — cliente: XSS stored con datos de usuario en listados/drawers.
- [ ] J2.3 Vector 3 — CSRF / manipulación de parámetros en cambios de permisos/estado (A08) y log injection.
- [ ] J2.4 Entregar `users/fase-2-pocs.md` + evidencias.

**Fase 3**
- [ ] J3.1 Parches del vector 1 (verificación de permisos server-side + RLS de menor privilegio).
- [ ] J3.2 Parches del vector 2 (sanitización/escape de salida).
- [ ] J3.3 Parches del vector 3 (tokens anti-CSRF / validación de origen, validación estricta de parámetros).
- [ ] J3.4 Auditoría del módulo: registrar cambios de permisos/estado vía API de Fabian.
- [ ] J3.5 Tests de regresión + riesgo residual por hallazgo.
- [ ] J3.6 Entregar `users/fase-3-parches.md`.
- [ ] J3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-28 | J1.1 Inventario de activos: 9 activos de datos, 15 componentes, 4 servicios externos, controles existentes y 13 observaciones candidatas para la Fase 2 | `security/users/fase1-diagnostico` | Hecho; en `users/fase-1-diagnostico.md` (§2–§3) |
| 2026-09-28 | J1.2 Mapeo NIST CSF 2.0: flujo de datos (ID.AM-03), 43 controles evaluados por componente y resumen de cobertura | `security/users/fase1-diagnostico` | Hecho; 14 cumplen, 9 parciales, 18 no cumplen, 2 por verificar; DETECT sin cobertura (§4) |
| 2026-09-28 | J1.3 Impacto: contexto GV.OC, apetito de riesgo, BIA por proceso, misma escala I×P que Operaciones y 11 escenarios de riesgo inherente | `security/users/fase1-diagnostico` | Hecho; 1 Crítico (provisional), 2 Altos, 6 Medios, 2 Bajos (§5) |
| 2026-09-28 | J1.4 Línea base: 16 controles (13 PROTECT, 3 DETECT) con estado, brecha, tarea J3.x y coordinación; 7 filas listas para G1 | `security/users/fase1-diagnostico` | Hecho; 2 cumplen, 6 parciales, 8 no cumplen / por verificar (§6–§8) |

---

### 5.3 Aarón — Operaciones / Transacciones (`operations`)

**Alcance (código):**
- Portal: `apps/portal-reservas/src/features/checkout/**` (`checkout.service`, `gateway.server`, `guestValidation`, `stripe`, `reservation`),
  `apps/portal-reservas/src/app/api/checkout/route.ts`, `apps/portal-reservas/src/app/reserve/**`,
  `features/search`, `features/rooms`, `features/room-detail`.
- Panel: `apps/panel-admin/src/features/reservations/**` (`reservationService`, `actions/updateStatus`, `bookingModeService`),
  `apps/panel-admin/src/features/rooms/**`, `apps/panel-admin/src/app/admin/reservations/**`, `.../admin/rooms/**`.
- `packages/core/src/booking`, `packages/core/src/payments`.
- Migraciones: `create_rooms_table`, `create_reservations_table`, `create_amenities`, `create_room_schedules`,
  `create_room_images_table`, `rooms_rls_policies`, `amenities_rls_policies`, `create_system_settings_table`.

**Superficies a revisar:** montos/precios/fechas calculados o confiados desde el cliente en el checkout,
acceso a reservas de otros usuarios (IDOR) y cambio de estado sin permiso, parámetros de búsqueda y filtros
que llegan a consultas, datos del huésped (nombre, notas) mostrados luego en el panel admin (XSS stored cruzado),
CSRF en acciones de estado de reserva, integridad del webhook/pasarela de pago, toggle de modo de reservas.

**Subcategorías NIST CSF 2.0 sugeridas:** PR.DS-01/02/10, PR.AA-05, PR.PS-06, ID.AM-07, ID.RA-01, DE.CM-09.

**Fase 1**
- [x] A1.1 Inventario de activos (reservas, habitaciones, precios, datos de huéspedes, pasarela de pago).
- [x] A1.2 Mapeo de componentes/endpoints contra NIST CSF 2.0.
- [x] A1.3 Impacto operacional y de negocio (GOVERN/IDENTIFY).
- [x] A1.4 Línea base de controles PROTECT/DETECT.
- [ ] A1.5 Entregar `docs/proyecto-seguridad/operations/fase-1-diagnostico.md`.

**Fase 2**
- [ ] A2.1 Vector 1 — servidor: inyección en búsqueda/filtros (A03) e IDOR / cambio de estado sin permiso (A01).
- [ ] A2.2 Vector 2 — cliente: XSS stored desde datos del huésped hacia el panel.
- [ ] A2.3 Vector 3 — manipulación de parámetros del checkout (precio/fechas) y CSRF (A08) + log injection.
- [ ] A2.4 Entregar `operations/fase-2-pocs.md` + evidencias.

**Fase 3**
- [ ] A3.1 Parches del vector 1 (consultas parametrizadas / validación con esquemas, verificación de dueño + RLS).
- [ ] A3.2 Parches del vector 2 (sanitización de entrada y escape de salida).
- [ ] A3.3 Parches del vector 3 (recalcular totales server-side, validar integridad de la pasarela, anti-CSRF).
- [ ] A3.4 Auditoría del módulo: registrar creación/cambio de reservas vía API de Fabian.
- [ ] A3.5 Tests de regresión + riesgo residual por hallazgo.
- [ ] A3.6 Entregar `operations/fase-3-parches.md`.
- [ ] A3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-28 | Configuración local (`.env`) y plan de desarrollo | `docs/plan-proyecto-seguridad`, PR #2 | Mergeado a `develop` |
| 2026-09-28 | G0.2 Plantillas movidas a `plantillas/` | `docs/plan-proyecto-seguridad` | Hecho |
| 2026-09-28 | A1.1 Inventario de activos (datos, componentes, servicios externos, controles existentes) + 12 observaciones candidatas para Fase 2 | `security/operations/fase1-diagnostico` | Hecho; en `operations/fase-1-diagnostico.md` (commit `187fd2a`) |
| 2026-09-28 | A1.2 Mapeo NIST CSF 2.0: flujo de datos (ID.AM-03), 40+ controles evaluados por componente, resumen de cobertura | `security/operations/fase1-diagnostico` | Hecho; DETECT sin cobertura, PR.AA desigual (commit `c52ab13`) |
| 2026-09-28 | A1.3 Impacto: contexto GV.OC, apetito de riesgo, BIA por proceso, escala I×P y 11 escenarios de riesgo inherente | `security/operations/fase1-diagnostico` | Hecho; 4 Altos (R01–R04), 6 Medios, 1 Bajo (commit `a7b2c68`) |
| 2026-09-28 | A1.4 Línea base: 16 controles (13 PROTECT, 3 DETECT) con estado, brecha, tarea A3.x y coordinación; 7 filas listas para G1 | `security/operations/fase1-diagnostico` | Hecho; 2 cumplen, 5 parciales, 9 no cumplen / por verificar |

---

### 5.4 Fabian — Logs / Auditoría (`audit`)

**Alcance (código):**
- `packages/core/src/audit/**` (`logAuditEvent`, `getAuditRequestContext`, `shared/utils`, constantes).
- `apps/panel-admin/src/features/audit-log/**` (`getAuditLogs`, tabla, filtros, `AuditLogDetailDrawer`).
- `apps/panel-admin/src/app/admin/audit-log/**`.
- Migraciones: `20260922000001_add_audit_view_permission.sql`, `20260922000002_create_audit_logs_table.sql`.

**Superficies a revisar:** origen de la IP registrada (cabeceras de proxy controlables por el cliente),
user-agent y otros campos libres guardados sin normalizar (saltos de línea, caracteres de control),
renderizado de metadatos del log en el drawer (XSS stored vía log), filtros de búsqueda del visor,
posibilidad de insertar/editar/borrar filas de `audit_logs` según RLS, integridad (firma o encadenamiento
de hash) y cobertura de eventos de los otros módulos.

**Subcategorías NIST CSF 2.0 sugeridas:** DE.CM-01/03/09, DE.AE-02/03, PR.PS-04, PR.DS-01, RS.AN-03, GV.OV.

**Dependencias:** es la API que usan los demás para la parte "Detect" de la Fase 3. Publicar temprano
(idealmente antes de H2) la guía de uso y los nuevos `AUDIT_ACTIONS` que necesita cada módulo.

**Fase 1**
- [x] F1.1 Inventario de activos (tabla `audit_logs`, permiso `audit:view`, visor, contexto de request).
- [x] F1.2 Mapeo de componentes/endpoints contra NIST CSF 2.0.
- [x] F1.3 Impacto operacional y de negocio (GOVERN/IDENTIFY).
- [x] F1.4 Línea base de controles PROTECT/DETECT.
- [ ] F1.5 Entregar `docs/proyecto-seguridad/audit/fase-1-diagnostico.md`.

**Fase 2**
- [ ] F2.1 Vector 1 — servidor: inyección en filtros del visor (A03) y acceso/alteración de logs sin permiso (A01).
- [ ] F2.2 Vector 2 — cliente: XSS stored a través de campos del log.
- [ ] F2.3 Vector 3 — audit poisoning: falsificar origen o contenido de eventos y evadir detección (A08).
- [ ] F2.4 Entregar `audit/fase-2-pocs.md` + evidencias.

**Fase 3**
- [ ] F3.1 Parches del vector 1 (RLS append-only, filtros parametrizados).
- [ ] F3.2 Parches del vector 2 (escape de salida en el visor).
- [ ] F3.3 Parches del vector 3 (normalizar/sanitizar cabeceras y campos, origen de IP confiable, firma o hash encadenado).
- [ ] F3.4 Guía de uso de la API de auditoría para los demás módulos.
- [ ] F3.5 Tests de regresión + riesgo residual por hallazgo.
- [ ] F3.6 Entregar `audit/fase-3-parches.md`.
- [ ] F3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-23 | Scaffold del módulo de auditoría (tabla, servicio, UI, IP/UA en login) | `feature/audit-log-module-scaffold`, PR #1 | Mergeado a `develop` |
| 2026-10-02 | F1.1–F1.4: `docs/proyecto-seguridad/audit/fase-1-diagnostico.md` sobre `257db31` | `security/audit/fase1-diagnostico` | 7 activos de datos, 15 de software, 15 observaciones, 12 escenarios de riesgo (2 Críticos, 3 Altos) y 19 controles de línea base. Los 3 vectores del enunciado tienen hallazgo real. Pendiente F1.5 (PR) |

---

## 6. Tareas grupales (consolidación)

| ID | Tarea | Responsable | Depende de | Estado |
|---|---|---|---|---|
| G0.1 | Tomar decisión §4.1 | Todos | — | [x] 2026-09-28 |
| G0.2 | Guardar plantillas de la profesora en `plantillas/` | Aarón | — | [x] 2026-09-28 |
| G1 | Matriz General de Gobernanza del Sistema | Aarón | P1.5, J1.5, A1.5, F1.5 | [ ] |
| G2 | Documento de PoCs estandarizado | Fabian | P2.4, J2.4, A2.4, F2.4 | [ ] |
| G3.1 | Matriz de Riesgos NIST CSF actualizada (riesgo residual) | Paula | P3.5, J3.5, A3.5, F3.5 | [ ] |
| G3.2 | Reporte Técnico de Parches | Joseph | P3.6, J3.6, A3.6, F3.6 | [ ] |
| G3.3 | Revisión cruzada de PRs (cada PR con ≥ 1 revisor de otro módulo) | Todos | Fase 3 | [ ] |
| G4 | Paquete final único + entrega | Aarón | Todo lo anterior | [ ] |

El responsable de una tarea grupal consolida y da formato; el contenido de cada módulo lo aporta su dueño.
En el protocolo de inicio (§0), Claude también debe mencionar las tareas grupales de la persona cuando
sus dependencias estén listas o su hito esté cerca.

---

## 7. Comandos útiles

```bash
pnpm install
pnpm dev                                          # las 3 apps
pnpm --filter @hotel/panel-admin dev              # solo panel (:3002)
pnpm --filter @hotel/portal-reservas dev          # solo portal (:3001)
pnpm --filter @hotel/portal-reservas vitest       # tests del portal
pnpm --filter @hotel/panel-admin vitest           # tests del panel
pnpm lint && pnpm type-check                      # antes de abrir PR
```
