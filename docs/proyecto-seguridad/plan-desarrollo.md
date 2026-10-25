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

_Última actualización: 2026-10-24_

| Integrante | Módulo | Fase actual | Próxima tarea | Rama activa | Bloqueos |
|---|---|---|---|---|---|
| Paula | Autenticación | 3 — Remediación | Commit + PR de P3.5 + P3.6 (`auth/fase-3-parches.md` listo); luego P3.7 (video) y G3.1 (matriz de riesgo residual) | `security/auth/fase3-reporte-parches` (P3.5 + P3.6 commiteados, sin push ni PR; P3.1–P3.4 mergeados: PR #19, #20, #21) | P3.5 alimenta G3.1 (matriz de riesgo residual, la consolida Paula) y P3.6 alimenta G3.2 (reporte de parches, Joseph) |
| Joseph | Gestión de Usuarios | 2 — Evaluación ofensiva | J2.1 Vector 1 — servidor (A03 + A01) | — | — |
| Aarón | Operaciones / Transacciones | 3 — Remediación | A3.7 (video ≤ 5 min de A3.1–A3.4); luego G4 (paquete final) | `security/operations/fase3-audit-logging` (PR de A3.4 abierto, pendiente revisión cruzada) | — (A3.4 desbloqueada por PR #18 de Fabian) |
| Fabian | Logs / Auditoría | 2 — cerrada, pendiente G2 | Esperar G2 (consolidación del doc de PoCs) hasta que Paula/Joseph/Aarón cierren P2.4/J2.4/A2.4; mientras, puede adelantar Fase 3 (F3.1) | `security/audit/fase2-pocs` | G2 depende de los otros 3 módulos |

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
| H1b — Matriz General de Gobernanza | 2026-10-06 | Documento consolidado revisado por los 4. ✅ (aprobado 2026-10-05) |
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
  consolidado/                  ← SOLO LOCAL (en .gitignore): matriz de gobernanza, doc de PoCs, matriz de riesgo, reporte de parches
  auth/  users/  operations/  audit/
    fase-1-diagnostico.md
    fase-2-pocs.md
    fase-3-parches.md
    evidencias/                 ← capturas, requests/responses, salidas de tests
```
No subir datos reales de usuarios, claves ni tokens en las evidencias (tapar/redactar).

**Documentos consolidados (G1, G2, G3.1, G3.2) — acuerdo del 2026-10-05:** no se versionan en el repo.
`docs/proyecto-seguridad/consolidado/` está en `.gitignore`. El responsable arma el documento a partir de
las secciones de cada módulo (que sí están en el repo), lo comparte con el equipo fuera de GitHub y, cuando
los 4 dan el visto bueno, se marca como hecho en §6 con la fecha de aprobación. La versión aprobada se
incluye en el paquete final (G4).

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
- [x] P1.1 Inventario de activos (datos: credenciales, sesiones, tokens de activación; servicios: Supabase Auth, OAuth, Resend).
- [x] P1.2 Mapeo de componentes/endpoints contra NIST CSF 2.0.
- [x] P1.3 Impacto operacional y de negocio (GOVERN/IDENTIFY).
- [x] P1.4 Línea base de controles PROTECT/DETECT.
- [x] P1.5 Entregar `docs/proyecto-seguridad/auth/fase-1-diagnostico.md`.

**Fase 2**
- [x] P2.1 Vector 1 — servidor: inyección (A03) y control de acceso / confianza en JWT (A01).
- [x] P2.2 Vector 2 — cliente: XSS reflected/stored en flujos de auth.
- [x] P2.3 Vector 3 — CSRF / manipulación de parámetros (A08) y log injection en eventos de login.
- [x] P2.4 Entregar `auth/fase-2-pocs.md` + evidencias.

**Fase 3**
- [x] P3.1 Parches del vector 1 (PR propio).
- [x] P3.2 Parches del vector 2 + CSP global (archivo compartido, avisar al equipo).
- [x] P3.3 Parches del vector 3 + cookies `HttpOnly`/`Secure`/`SameSite`.
- [x] P3.4 Auditoría del módulo: eventos de auth saneados vía API de Fabian.
- [x] P3.5 Tests de regresión + riesgo residual por hallazgo.
- [x] P3.6 Entregar `auth/fase-3-parches.md`.
- [ ] P3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-28 | Rama de trabajo de Fase 1 creada | `security/auth/fase1-diagnostico` | Publicada en `origin` |
| 2026-09-28 | P1.1 Inventario de activos + 12 observaciones preliminares | `security/auth/fase1-diagnostico`, commit `04ef70e` | Revisado por Paula, hecho |
| 2026-10-03 | Merge de `develop` en la rama (conflicto en el tablero §2 resuelto) | `security/auth/fase1-diagnostico`, commit `11fa71e` | Hecho |
| 2026-10-03 | P1.2 Mapeo NIST CSF 2.0: flujo de datos (ID.AM-03), 42 controles evaluados por componente y resumen de cobertura; 3 observaciones nuevas (O-13 a O-15) | `security/auth/fase1-diagnostico`, commit `f6edcab` | Hecho; 14 cumplen, 14 parciales, 10 no cumplen, 4 por verificar; DETECT casi nulo (§3) |
| 2026-10-03 | P1.3 Impacto: contexto GV.OC, apetito de riesgo, BIA por 5 procesos, misma escala I×P que Operaciones y Usuarios y 12 escenarios de riesgo inherente | `security/auth/fase1-diagnostico`, commit `60b6871` | Hecho; 1 Crítico (provisional, compartido con US-R01), 3 Altos, 5 Medios, 3 Bajos (§4) |
| 2026-10-03 | P1.4 Línea base: 18 controles (15 PROTECT, 3 DETECT) con estado, brecha, tarea P3.x y coordinación; 7 filas listas para G1 y límites del análisis | `security/auth/fase1-diagnostico` | Hecho; 2 cumplen, 6 parciales, 10 no cumplen (§5–§8) |
| 2026-10-05 | P1.5 Entrega de la Fase 1 | `security/auth/fase1-diagnostico`, PR #4 (merge `e41b2a2`) | Mergeado a `develop`; Fase 1 cerrada |
| 2026-10-19 | Rama de Fase 2 creada desde `develop` | `security/auth/fase2-pocs` | Local (aún sin push) |
| 2026-10-19 | P2.1 Vector 1: AUTH-POC-1 (A01 escalamiento de rol en signup, real, O-02), AUTH-POC-2 (A01 claim JWT en RLS + `getSession`, real, O-05/O-11), AUTH-POC-3 (A03 inyección en filtro PostgREST, **introducida** §4.1) | `security/auth/fase2-pocs` | Hecho; `auth/fase-2-pocs.md` + test de regresión `lookupAccount.server.test.ts` (2/2 en verde); evidencias en vivo pendientes de Supabase |
| 2026-10-19 | P2.2 Vector 2: AUTH-POC-4 (XSS reflejado en `/auth/error` vía `error_description`, **introducida** §4.1, sobre la superficie real O-04) | `security/auth/fase2-pocs` | Hecho; sink `authErrorHtml.ts` + test `authErrorHtml.test.ts` (3/3 en verde) |
| 2026-10-20 | P2.4 (parcial) — captura en vivo de AUTH-POC-4: XSS reflejado ejecutándose sobre `/auth/error` (navegador integrado, portal con `.env.local` placeholder) | `security/auth/fase2-pocs` | Hecho; `evidencias/AUTH-POC-4-xss-reflected.jpg`. Faltan capturas de POC-1/2/5/6 (requieren Supabase; sin Docker en la máquina) |
| 2026-10-21 | P2.4 (capturas en vivo) — montado Supabase local (Docker) y capturadas AUTH-POC-1 (escalamiento de rol, Studio), AUTH-POC-2 (claims JWT + política RLS de `rooms`), AUTH-POC-6 (audit poisoning en `audit_logs`), AUTH-POC-5 (open redirect 303 → `example.com`) | `security/auth/fase2-pocs` | Hecho; evidencias en `auth/evidencias/`. CR/LF literal + spoofing de IP (`x-forwarded-for`) quedan a nivel HTTP (documentados). AUTH-POC-3: evidencia es el test de regresión |
| 2026-10-19 | P2.3 Vector 3: AUTH-POC-5 (open redirect vía `callbackUrl`, real, O-03) y AUTH-POC-6 (log injection / audit poisoning + IP spoofing en login, real, O-08, solapa AU-R04). CSRF evaluado sin hallazgo (Server Actions validan Origin) | `security/auth/fase2-pocs` | Hecho; ambos reales (sin vuln introducida); capturas en vivo pendientes de entorno; fix P3.3/P3.4 coordinado con Fabian |
| 2026-10-21 | P2.4 Entrega de la Fase 2 (6 PoCs + evidencias) | `security/auth/fase2-pocs`, PR #17 (merge `9c1d10d`) | Mergeado a `develop`; Fase 2 cerrada |
| 2026-10-21 | Rama de Fase 3 creada desde `develop` (`91b169c`) | `security/auth/fase3-parches` | Publicada en `origin` |
| 2026-10-21 | P3.1 (código) — AUTH-POC-1: `handle_new_user` ignora `raw_user_meta_data.role` (solo `app_metadata`, default `client`); invitaciones promovidas con `promote_invited_admin()` (solo `service_role`); `createAdminAccountAction` exige `admins:invite`; se elimina `sync_role_to_jwt`. AUTH-POC-2: RLS de `rooms`/`room_schedules`/`room_images` usan `is_admin_or_owner()`; lecturas de sesión en servidor vía `getVerifiedSession()` (`getUser()`). AUTH-POC-3: `lookupAccount` sin `.or()` (UUID + `.eq()`, nombre comparado en código) | `security/auth/fase3-parches`, commits `1ef0b61` (POC-1), `e1994f9` (POC-2), `b5e546b` (POC-3); migraciones `20261021000001`, `20261021000002` | Código hecho; tests en verde (core 71, portal 60, panel 19) y sin errores nuevos de type-check. Re-test en vivo hecho (ver entrada siguiente); PR pendiente |
| 2026-10-21 | P3.1 (re-test en vivo) — Supabase local levantado; aplicadas 6 migraciones pendientes (4 de `develop` + las 2 de P3.1). AUTH-POC-1: mismo signup con `role:"admin"` queda `client`; invitación + `promote_invited_admin` sigue creando admin; `anon`/`authenticated` reciben `permission denied`. AUTH-POC-2: `client` actualiza 0 filas de `rooms`, admin 1; token forjado rechazado por `getUser()` (403 `bad_jwt`). AUTH-POC-3: payload corregido vuelca 7/7 perfiles con el código vulnerable y 0 con el parche; nuevo caso de test | `security/auth/fase3-parches`, commits `858546d` (test), `53396aa` (evidencias) | Hecho; `evidencias/P3.1-AUTH-POC-{1,2,3}-retest.txt`. Riesgo residual propuesto: Bajo para POC-1, POC-2(a) y POC-3; Medio para POC-2(b) mientras `getAuditLogs.ts` (Fabian) y `admins-table/permissions.ts` (Joseph) usen `getSession()`. Pendiente: bajar a mano `attacker-escalation@poc.local` (escalada en Fase 2) |
| 2026-10-21 | Corrección de AUTH-POC-3 en `fase-2-pocs.md`: el payload documentado (`a,is_active.eq.true`, `accountId="none"`) fallaba en vivo con `22P02`; reemplazado por uno que sí vuelca la tabla y enlazada la evidencia en vivo | `security/auth/fase3-parches`, commit `53396aa` | Hecho; avisar a Fabian antes de G2 (documento de PoCs consolidado) |
| 2026-10-21 | PR de P3.1 abierto contra `develop` (parches AUTH-POC-1/2/3 + re-test en vivo + corrección de AUTH-POC-3 en Fase 2); revisores pedidos: Joseph y Aarón (cambios en sus archivos, G3.3); nota a Fabian (`getSession()` en `getAuditLogs.ts`, payload corregido para G2) | `security/auth/fase3-parches`, PR #19 (commits `1ef0b61` … `4a3f0df`) | Abierto, pendiente de revisión y merge (hito H3) |
| 2026-10-21 | Rama de P3.2 creada desde `develop` (`91b169c`; PR #19 aún sin merge, por eso este plan no trae las entradas de P3.1) | `security/auth/fase3-xss-csp` | Local (aún sin push). Al mergear #19 habrá conflicto en esta tabla y en §2: conservar ambas versiones |
| 2026-10-21 | P3.2 — AUTH-POC-4: eliminado el sink (`authErrorHtml.ts` + `dangerouslySetInnerHTML`); `/auth/error` resuelve en servidor una clave de allowlist (`resolveAuthError.ts`) y ya no refleja `error`/`error_description` (cierra también O-04). CSP global con nonce por request (`@hotel/core/security`) + `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS (prod) en los middlewares de portal, panel (matcher ampliado a todas las rutas; control de sesión sigue solo en `/admin`) y landing; layout del portal dinámico para el nonce | `security/auth/fase3-xss-csp`, commits `caa2f95` (AUTH-POC-4), `ee693e6` (CSP) | Hecho; tests en verde (core 76, portal 58, panel 19). Re-test en vivo: PoC neutralizada y, con el sink de la Fase 2 restaurado a propósito, la CSP bloquea el `onerror` (violación en consola). Build de producción: 17/17 scripts con nonce, 0 violaciones, login OK. Evidencias: `P3.2-AUTH-POC-4-retest.txt`, `P3.2-AUTH-POC-4-fixed.jpg`, `P3.2-AUTH-POC-4-csp-blocks-sink.jpg`. Riesgo residual propuesto: Bajo |
| 2026-10-21 | PR #19 (P3.1) mergeado en `develop` (merge `d3ab864`); `develop` traído a la rama de P3.2. Conflicto en el plan (§2 y §5.1) resuelto conservando ambas versiones | `security/auth/fase3-xss-csp`, merge de `origin/develop` | Hecho; tests en verde tras el merge (core 79, portal 62, panel 19), sin errores nuevos de type-check. P3.2 pendiente de PR |
| 2026-10-22 | PR de P3.2 abierto y mergeado en `develop` (XSS de AUTH-POC-4 + CSP global con nonce); aviso al equipo sobre la CSP en los 3 `middleware.ts` incluido en el PR | `security/auth/fase3-xss-csp`, PR #20 (merge `0cc3dd0`) | Mergeado; P3.2 cerrada |
| 2026-10-22 | Rama de P3.3 + P3.4 creada desde `develop` (`0cc3dd0`); ambas tareas irán en un solo PR (§4.2: grupo de parches relacionados del vector 3 — AUTH-POC-5 y AUTH-POC-6) | `security/auth/fase3-redirect-cookies-audit` | Local (aún sin push) |
| 2026-10-22 | P3.3 + P3.4 (código) — AUTH-POC-5: `resolveSafeRedirectPath` (`@hotel/core/auth`) en el callback de OAuth y el login del portal (solo rutas internas; rechaza absolutas, `//host`, `/\host`, control chars y `/..//host`). Cookies de sesión `HttpOnly` + `Secure` (prod) + `SameSite=Lax` (`SESSION_COOKIE_OPTIONS` en `@hotel/db`); sesión del portal vía Server Actions (`sessionActions.ts`) y, con aprobación de Paula, `scheduleService`/`amenityService` de Aarón movidos a Server Actions (`scheduleActions.ts`, `getRoomAmenitiesFormDataAction`). AUTH-POC-6: `loginAudit.ts` — un login fallido no tiene actor (email tecleado solo en `metadata.attempted_email` si es válido), motivo con código cerrado (sin `error.message` del proveedor), aplicado en los login de core, panel y portal (el portal antes no auditaba); eliminados los `console.log` que imprimían el `access_token` y el email | `security/auth/fase3-redirect-cookies-audit`, commits `164676f` (AUTH-POC-5), `ee4a491` (AUTH-POC-6), `ea95951` (cookies + Server Actions) | Código hecho; tests en verde (core 95, portal 62, panel 19), sin errores nuevos de type-check. Re-test en vivo: ver entrada siguiente |
| 2026-10-22 | P3.3 + P3.4 (re-test en vivo, Supabase local) — AUTH-POC-5: mismo enlace de la Fase 2 (`/auth/login?callbackUrl=https://example.com/`) termina en `localhost:3001/`; callback con `code` PKCE real y `callbackUrl` `https://evil.example/phish` o `//evil.example` → `localhost:3001/` (ruta interna de control se respeta). Cookies: `Set-Cookie … HttpOnly; SameSite=lax` y `document.cookie` vacío con sesión iniciada. AUTH-POC-6: payloads (A) atribución forjada y (B) CR/LF reales + `X-Forwarded-For` enviados por HTTP crudo a panel y portal → filas sin actor, línea forjada descartada, IP falsa ignorada; `verify_audit_chain()` íntegra; sin token en logs. No regresión: logout del portal, login admin, horarios (`saveRoomSchedulesAction`) y amenidades (`getRoomAmenitiesFormDataAction`) del panel OK; la escritura anónima previa ahora da RLS `42501` | `security/auth/fase3-redirect-cookies-audit`, sobre `164676f`/`ee4a491`/`ea95951` | Hecho; evidencias `P3.3-AUTH-POC-5-cookies-retest.txt`, `P3.3-AUTH-POC-5-step1-malicious-link.jpg`, `P3.3-AUTH-POC-5-step2-stays-on-site.jpg`, `P3.4-AUTH-POC-6-retest.txt`. Riesgo residual propuesto: Bajo para AUTH-POC-5, O-10 y AUTH-POC-6 |
| 2026-10-22 | PR de P3.3 + P3.4 abierto y mergeado en `develop` (AUTH-POC-5, cookies HttpOnly, AUTH-POC-6); aviso a Aarón y Fabian en la descripción (sin menciones) | `security/auth/fase3-redirect-cookies-audit`, PR #21 (merge `fa35c7c`) | Mergeado; P3.3 y P3.4 cerradas |
| 2026-10-22 | Rama de P3.5 + P3.6 creada desde `develop` (`fa35c7c`); ambas en la misma rama porque el riesgo residual es la sección 5 de la plantilla de parches (§4.6) | `security/auth/fase3-reporte-parches` | Local (aún sin push) |
| 2026-10-22 | P3.5 + P3.6 — `auth/fase-3-parches.md`: ficha con PRs #19–#21 y commits; 9 parches (AUTH-PAT-1…9) con mapeo OWASP/NIST, diff antes/después, prueba de regresión y riesgo residual; tabla con las columnas de `matriz-riesgo-residual.xlsx` lista para G3.1; riesgos de Fase 1 sin parche (R03, R05, R09, R12); tabla de tests por hallazgo; consulta de detección de cuentas auto-escaladas (verificada en local: solo `attacker-escalation@poc.local`). Mapeo de AUTH-POC-2 a AUTH-R07/R10 (ver entrada siguiente) | `security/auth/fase3-reporte-parches`, commit `docs(security): auth phase 3 patch report…` (sobre `5ab5550`) | Hecho; regresión en verde sobre `develop@fa35c7c` (core 95, portal 62, panel 19; auth+security 43 y 18). Residual: Bajo en AUTH-POC-1, 2(a), 3, 4, 5, 6, O-10, R11; Medio en AUTH-POC-2(b) y AUTH-R04; R03 Alto y R05/R09/R12 sin cambio. P3.6 se marca al mergear el PR |
| 2026-10-22 | Corrección en `fase-2-pocs.md`: el "Riesgo asociado" de AUTH-POC-2 decía AUTH-R02 / AUTH-R03 (open redirect y fuerza bruta en la Fase 1); se cambió a AUTH-R07 / AUTH-R10, que son los riesgos de O-05 y O-11 que la PoC confirma. La numeración de la Fase 1 no cambió después del 2026-10-03, así que fue un error de transcripción al escribir la PoC (commit `1c9ad910`). Nota de corrección agregada en la ficha | `security/auth/fase3-reporte-parches`, commit `5ab5550` | Hecho; avisar a Fabian por G2 (documento de PoCs consolidado) |

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
- [x] J1.5 Entregar `docs/proyecto-seguridad/users/fase-1-diagnostico.md`.

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
| 2026-10-01 | J1.5 Entrega de la Fase 1 (revisado y mergeado por Aarón) | `security/users/fase1-diagnostico`, PR #6 (merge `9b066e8`) | Mergeado a `develop`; Fase 1 cerrada |

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
- [x] A1.5 Entregar `docs/proyecto-seguridad/operations/fase-1-diagnostico.md`.

**Fase 2**
- [x] A2.1 Vector 1 — servidor: inyección en búsqueda/filtros (A03) e IDOR / cambio de estado sin permiso (A01).
- [x] A2.2 Vector 2 — cliente: XSS stored desde datos del huésped hacia el panel.
- [x] A2.3 Vector 3 — manipulación de parámetros del checkout (precio/fechas) y CSRF (A08) + log injection.
- [x] A2.4 Entregar `operations/fase-2-pocs.md` + evidencias (PR #11 y PR #14 mergeados a `develop`).

**Fase 3**
- [x] A3.1 Parches del vector 1 (consultas parametrizadas / validación con esquemas, verificación de dueño + RLS).
- [x] A3.2 Parches del vector 2 (sanitización de entrada y escape de salida).
- [x] A3.3 Parches del vector 3 (recalcular totales server-side, validar integridad de la pasarela, anti-CSRF).
- [x] A3.4 Auditoría del módulo: registrar creación/cambio de reservas vía API de Fabian.
- [x] A3.5 Tests de regresión + riesgo residual por hallazgo.
- [x] A3.6 Entregar `operations/fase-3-parches.md`.
- [ ] A3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-28 | Configuración local (`.env`) y plan de desarrollo | `docs/plan-proyecto-seguridad`, PR #2 | Mergeado a `develop` |
| 2026-09-28 | G0.2 Plantillas movidas a `plantillas/` | `docs/plan-proyecto-seguridad` | Hecho |
| 2026-09-28 | A1.1 Inventario de activos (datos, componentes, servicios externos, controles existentes) + 12 observaciones candidatas para Fase 2 | `security/operations/fase1-diagnostico` | Hecho; en `operations/fase-1-diagnostico.md` (commit `187fd2a`) |
| 2026-09-28 | A1.2 Mapeo NIST CSF 2.0: flujo de datos (ID.AM-03), 40+ controles evaluados por componente, resumen de cobertura | `security/operations/fase1-diagnostico` | Hecho; DETECT sin cobertura, PR.AA desigual (commit `c52ab13`) |
| 2026-09-28 | A1.3 Impacto: contexto GV.OC, apetito de riesgo, BIA por proceso, escala I×P y 11 escenarios de riesgo inherente | `security/operations/fase1-diagnostico` | Hecho; 4 Altos (R01–R04), 6 Medios, 1 Bajo (commit `a7b2c68`) |
| 2026-09-28 | A1.4 Línea base: 16 controles (13 PROTECT, 3 DETECT) con estado, brecha, tarea A3.x y coordinación; 7 filas listas para G1 | `security/operations/fase1-diagnostico` | Hecho; 2 cumplen, 5 parciales, 9 no cumplen / por verificar (commit `95900a9`) |
| 2026-09-28 | A1.5 Entrega de la Fase 1 | `security/operations/fase1-diagnostico`, PR #3 (merge `d68b50c`) | Mergeado a `develop`; Fase 1 cerrada |
| 2026-10-01 | Revisión y merge de PR #6 (diagnóstico de Users) y PR #5 (cronograma comprimido a sprints Jira) | merges `9b066e8`, `257db31` | Users aporta 7 filas a G1 con la misma escala I×P; G1 lleva 2 de 4 módulos |
| 2026-10-01 | A2.1 Vector 1: OP-POC-1 (inyección en filtro PostgREST → IDOR, vulnerabilidad **introducida** sobre `/api/reservations/lookup`, con test de regresión en Vitest) + OP-POC-2 (hallazgo **real**: `galleryActions` sin `requirePermission`, confirma O1/O2) | `security/operations/fase2-pocs` | Hecho; en `operations/fase-2-pocs.md`; pendiente evidencia de red para OP-POC-2 y grabación de `curl` de OP-POC-1 en entorno con conectividad a Supabase (ver nota de entorno en el documento) |
| 2026-10-05 | G1 Matriz General de Gobernanza: consolidación de los 4 diagnósticos sobre la plantilla (27 filas, riesgo AUTH-R01 = US-R01 unido), hoja de resumen y criterios, versión `.md` para revisión; corrección del tablero duplicado | `docs/g1-matriz-gobernanza` | Hecho; 3 Críticos, 12 Altos, 12 Medios; aprobada por los 4 el 2026-10-05 y compartida fuera del repo |
| 2026-10-18 | Merge de `develop` en la rama (resuelto conflicto del plan; se recuperó la evidencia de Fase 2 de auditoría que la rama había quedado sin integrar) | `security/operations/fase2-pocs`, merge `f615045` | Hecho; test de regresión de A2.1 en verde tras el merge |
| 2026-10-18 | A2.2 Vector 2: OP-POC-3 (XSS **stored** vía notas del huésped, vulnerabilidad **introducida**) — campo `guest_notes` nuevo + persistencia de la reserva en el checkout + render sin escapar (`dangerouslySetInnerHTML`) en `ReservationGuestCard` del panel. Entrada anónima (checkout público) que ejecuta en la sesión del admin. Alineado con AUD-POC-4 de Fabian | `security/operations/fase2-pocs`, commit `e1828a4` | Hecho; en `operations/fase-2-pocs.md`; type-check de portal/panel limpio (fallos de `@hotel/db` y galería son preexistentes de `develop`); pendiente captura de pantalla en entorno con Supabase conectado |
| 2026-10-18 | A2.3 Vector 3 (solo documentación, 3 hallazgos **reales** sin código nuevo): OP-POC-4 (CSRF en `POST /api/checkout`, route handler sin token/Origin; contrasta con la Server Action protegida del panel), OP-POC-5 (manipulación de parámetros: fechas en el pasado / sin control de disponibilidad / aforo arbitrario — **precio NO manipulable**, se recalcula server-side) y OP-POC-6 (log injection: hallazgo negativo, operaciones no registra logs; cross-module con AUD-POC-6, se cierra en A3.4) | `security/operations/fase2-pocs` | Hecho; en `operations/fase-2-pocs.md`. Los 3 vectores del enunciado tienen PoC. Falta A2.4 (evidencias en vivo + PR) |
| 2026-10-18 | Entrega de Fase 2: push de la rama + PR #11 contra `develop` (A2.1+A2.2+A2.3) | `security/operations/fase2-pocs`, PR #11 | Abierto; mergeable, sin CI en el repo. Pendiente revisión cruzada (G3.3) y evidencias en vivo |
| 2026-10-18 | A3.1 Parches del Vector 1: OP-POC-1 → filtro parametrizado `.eq(code).eq(email)` (fin de la inyección/IDOR, test de regresión reescrito: la PoC ya no funciona); OP-POC-2 → `requirePermission(ROOMS.MANAGE)` en `uploadImage`/`deleteImage`/`reorderImages`. Rama de Fase 3 creada **desde** `fase2-pocs` para aplicar los fixes sobre las vulns | `security/operations/fase3-parches`, commit `1f43498` | Hecho; test en verde; type-check limpio para los archivos tocados. Pendiente A3.2 (escape XSS), A3.3 (validación + anti-CSRF), A3.4 (logging saneado, depende de util de Fabian) |
| 2026-10-18 | A3.2 Parche del Vector 2 (OP-POC-3): `ReservationGuestCard` deja de usar `dangerouslySetInnerHTML` y renderiza `{guest.notes}` como texto (React escapa) → la PoC de XSS stored deja de ejecutarse. Sin test automatizado de componente (el vitest del panel corre en `environment: node`, sin jsdom/RTL; agregarlo tocaría config compartida §4.4): regresión por código + captura en vivo de A2.4. Alineado con F3.2 + CSP de Paula | `security/operations/fase3-parches`, commit `ceda94a` | Hecho; type-check limpio. Pendiente A3.3 (validación + anti-CSRF), A3.4 (logging saneado, bloqueado por util de Fabian) |
| 2026-10-18 | A3.3 Parches del Vector 3: OP-POC-4 → anti-CSRF en `POST /api/checkout` (rechaza `Origin` distinto al del propio sitio); OP-POC-5 → esquema Zod (`checkoutSchema.ts`: fechas futuras, check-out > check-in, aforo > 0) + validación de capacidad (≤ suma de `room.capacity`) y de disponibilidad (sin solapamiento) en `openGatewaySession`; precio ya era server-side. Test de regresión del esquema (5 casos) en verde | `security/operations/fase3-parches`, commit `e90807b` | Hecho; type-check limpio. Pendiente A3.4 (logging saneado — bloqueado por util de saneo de Fabian), A3.5 (riesgo residual), A3.6 (`fase-3-parches.md`), A3.7 (video) |
| 2026-10-18 | A3.5 + A3.6: `operations/fase-3-parches.md` (§4.6) con ficha, mapeo OWASP/NIST, diff antes/después, prueba de regresión y riesgo residual por hallazgo (OP-POC-1/2/3 Bajo; OP-POC-4 Medio por falta de token/rate-limit; OP-POC-5 Medio por TOCTOU; OP-POC-6 Alto, sin remediar). A3.4 documentado como stub bloqueado por Fabian | `security/operations/fase3-parches` | Hecho. Fase 3 completa salvo A3.4 (bloqueada) y A3.7 (video) |
| 2026-10-18 | Endurecimiento A3.3: cierre de la carrera TOCTOU de OP-POC-5 con restricción `reservations_no_overlap` (`EXCLUDE USING gist`, `btree_gist`); `persistReservation` detecta la violación (SQLSTATE 23P01) y el checkout responde 409. Riesgo residual de OP-POC-5 baja de Medio a **Bajo**. Rama empujada a `origin` | `security/operations/fase3-parches`, commit `08eae14` | Hecho; type-check limpio |
| 2026-10-18 | Entrega de Fase 2: PR #11 mergeado a `develop` (merge `a26cbc9`). Sincronización de la rama de Fase 3 con `develop` (merge `593f79c`, limpio) y apertura del PR de Fase 3 (A3.1–A3.3) contra `develop` | `security/operations/fase3-parches`, PR #12 | Abierto; mergeable, sin CI en el repo. Pendiente revisión cruzada G3.3 (≥ 1 revisor de otro módulo) y merge para H3 |
| 2026-10-20 | A2.4 Evidencias en vivo de las 6 PoCs reproducidas contra **Supabase local** (`supabase start`, migraciones + seed; sin tocar el proyecto compartido): OP-POC-1 (inyección→IDOR, fuga de PII), OP-POC-3 (XSS ejecutando en el panel — captura), OP-POC-4/5 (checkout acepta CSRF/params → 200) y OP-POC-6 (negativo). **OP-POC-2 reproducida en vivo**: replay del Server Action `deleteImage` con cuenta sin `rooms:manage` → HTTP 200 + fila borrada (middleware no chequea rol). 9 archivos en `operations/evidencias/` | `security/operations/fase2-pocs`, commit `767a0d6`, PR #14 | Abierto, mergeable. Pendiente G3.3 |
| 2026-10-20 | Hallazgo al verificar: el checkout **no persiste** (`persistReservation` inserta `room_id` de `mockRooms` string en `reservations.room_id` uuid/FK → `22P02`). Impacto en A3.3: el anti-CSRF y la validación Zod de fechas/aforo **sí** funcionan (verificados), pero el chequeo de disponibilidad + la restricción `EXCLUDE`/TOCTOU de OP-POC-5 son **inalcanzables** (todo checkout da 409, el `EXCLUDE` nunca dispara). Riesgo residual de OP-POC-5 (disponibilidad/overbooking) corregido de Bajo a **⚠️ no verificado**; documentado en `fase-2-pocs.md` y `fase-3-parches.md` | `fase2-pocs` commit `e5c5a6a`, `fase3-parches` commit `15ad4b0` | Hecho. Fix real (reconciliar catálogo de rooms) queda como **follow-up** post-entrega |
| 2026-10-20 | Merge de `develop` (con PoCs de Users #10 y 2.ª entrega de Operaciones #13) en ambas ramas: **sin conflictos**. PR #14 y PR #12 quedan `MERGEABLE`/`CLEAN` y al día con `develop` | `fase2-pocs` merge `3b63764`, `fase3-parches` merge `7adf3f6` | Listos para mergear; pendiente solo G3.3 |
| 2026-10-20 | PR #12, #14 y #15 mergeados a `develop` (último merge `191ad4e`); A2.4 cerrada | — | Hecho |
| 2026-10-20 | A3.3 — reconciliación del catálogo de rooms (opción A): migración `20261020000001_seed_portal_catalog_rooms.sql` (8 habitaciones con uuid fijo) + mapa server-side `room-catalog.ts` (catálogo → uuid) + `persistReservation` inserta una fila por habitación. Verificado en vivo contra Supabase local (10 casos: checkout persiste, solapamiento 409, carrera de 5 requests → 1 fila, `EXCLUDE` dispara `23P01`, multi-habitación atómico, regresiones de fechas/aforo/Origin). Test `room-catalog.test.ts` en verde. OP-POC-5 vuelve a **Bajo** con evidencia | `security/operations/fase3-checkout-rooms-catalog`, commit `ce54581`, PR #16; evidencia `A3.3-rooms-catalog-live.txt` | Hecho; PR #16 abierto, pendiente G3.3 |
| 2026-10-24 | A3.4 (código) — auditoría del módulo con la API de Fabian (`@hotel/core/audit/server`, PR #18): `reservation.created` por fila en `openGatewaySession` (actor nulo, sin PII ni `guest_notes`/`code`; `persistReservation` ahora devuelve `id, room_id`) y `reservation.updated`/`reservation.cancelled` en `updateReservationStatus` (estado previo → nuevo, admin verificado con `getVerifiedSession`, solo tras `requirePermission` y `UPDATE` exitoso). Tests nuevos `gateway.server.test.ts` (4) y `tests/reservations/updateReservationStatus.test.ts` (5); suites portal 66/66 y panel 24/24; sin errores nuevos de type-check. `fase-3-parches.md` §A3.4 actualizado: OP-POC-6 pasa de Alto a **Bajo** por código y tests | `security/operations/fase3-audit-logging` (desde `develop@1e6ce17`) | Código hecho, sin commit. Pendiente: evidencia en vivo (Docker apagado en esta sesión) y PR. Límite declarado: los intentos rechazados (400/403/409, sin permiso) no se registran |
| 2026-10-24 | A3.4 (evidencia en vivo) — Supabase local (Docker) con las 4 migraciones pendientes aplicadas en local (append-only y hash encadenado de Fabian, P3.1 de Paula). Checkout con XSS + CR/LF en nombre y notas → 200 y 2 × `reservation.created` sin PII ni payload; 403 (Origin ajeno) y 409 (solapamiento) sin evento; en el panel, aprobar → `reservation.updated` (`pending → approved`, actor `sec.owner`) y cancelar con motivo con CR/LF → `reservation.cancelled` con el motivo en una sola línea; visor muestra los 4 eventos; `verify_audit_chain()` íntegra. OP-POC-6 queda en **Bajo** con evidencia | `security/operations/fase3-audit-logging`; evidencia `A3.4-audit-logging-live.txt` | Hecho; pendiente commit y PR |
| 2026-10-24 | A3.4 endurecimiento: quitado `"use server"` de `createReservation.server.ts` (evita exponer `persistReservation`/`areRoomsAvailable` como Server Actions públicas); tests del portal 66/66 y checkout en vivo OK (seq 10). Limpieza de un pendiente viejo de evidencias en `fase-3-parches.md` (ya cerrado en A2.4/A3.3). G3.3 cerrada (ver §6) | `security/operations/fase3-audit-logging` | Hecho |

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
- [x] F1.5 Entregar `docs/proyecto-seguridad/audit/fase-1-diagnostico.md`.

**Fase 2**
- [x] F2.1 Vector 1 — servidor: inyección en filtros del visor (A03) y acceso/alteración de logs sin permiso (A01).
- [x] F2.2 Vector 2 — cliente: XSS stored a través de campos del log.
- [x] F2.3 Vector 3 — audit poisoning: falsificar origen o contenido de eventos y evadir detección (A08).
- [x] F2.4 Entregar `audit/fase-2-pocs.md` + evidencias.

**Fase 3**
- [x] F3.1 Parches del vector 1 (RLS append-only, filtros parametrizados).
- [x] F3.2 Parches del vector 2 (escape de salida en el visor).
- [x] F3.3 Parches del vector 3 (normalizar/sanitizar cabeceras y campos, origen de IP confiable, firma o hash encadenado).
- [x] F3.4 Guía de uso de la API de auditoría para los demás módulos (`audit/guia-api-auditoria.md`).
- [x] F3.5 Tests de regresión + riesgo residual por hallazgo.
- [ ] F3.6 Entregar `audit/fase-3-parches.md`.
- [ ] F3.7 Grabar video (≤ 5 min, solo IDE).

**Bitácora**
| Fecha | Tarea | Rama / commit / PR | Resultado |
|---|---|---|---|
| 2026-09-23 | Scaffold del módulo de auditoría (tabla, servicio, UI, IP/UA en login) | `feature/audit-log-module-scaffold`, PR #1 | Mergeado a `develop` |
| 2026-10-02 | F1.1–F1.4: `docs/proyecto-seguridad/audit/fase-1-diagnostico.md` sobre `257db31` | `security/audit/fase1-diagnostico` | 7 activos de datos, 15 de software, 15 observaciones, 12 escenarios de riesgo (2 Críticos, 3 Altos) y 19 controles de línea base. Los 3 vectores del enunciado tienen hallazgo real. Pendiente F1.5 (PR) |
| 2026-10-05 | F1.5 Entrega de la Fase 1 (revisado y mergeado por Aarón) | `security/audit/fase1-diagnostico`, PR #7 (merge `bc917f3`) | Mergeado a `develop`; Fase 1 cerrada |
| 2026-10-15 | F2.1 Vector 1 (A01 + A03): 2 PoCs reproducidas contra `localhost:3002` sobre `develop@f9f8c8b` — AUD-POC-1 (acceso a `audit_logs` sin permiso `audit:view`, por fallo de `verifyAdminRole` + uso de service-role client) y AUD-POC-2 (inyección en el filtro `search` vía `.or()` sin sanitizar). AUD-POC-3 (pageSize sin tope) documentado como hallazgo de soporte. Sin vulnerabilidad introducida (los 3 hallazgos son reales, de la Fase 1) | `security/audit/fase2-pocs`, commit `072778d` | Mergeado en la rama; `audit/fase-2-pocs.md` + evidencias |
| 2026-10-15 | F2.2 Vector 2 (XSS stored, AUD-POC-4): reproducido en vivo — login anónimo con `email=<img src=x onerror=...>` queda en `metadata.email` sin escapar y se confirma recuperable intacto vía `getAuditLogs` (misma cuenta sin `audit:view` de F2.1). Ejecución confirmada por inspección de código (`formatMetadataHtml` + `dangerouslySetInnerHTML` del drawer, documentado como sin-escape a propósito); no se capturó con navegador por no haber herramienta de automatización conectada en la sesión. Es la cadena O3/AU-R01 ya identificada en Fase 1 como riesgo Crítico (16) | `security/audit/fase2-pocs`, commit `6f7e16d` | Mergeado en la rama; `audit/fase-2-pocs.md` + evidencias |
| 2026-10-15 | F2.3 Vector 3 (audit poisoning, AUD-POC-5 + AUD-POC-6): reproducido en vivo con MCP de Playwright/Chromium — AUD-POC-5 falsifica `x-forwarded-for` (IP TEST-NET-3, sin validar) y AUD-POC-6 inyecta `\r\n` + texto fabricado (`action=audit.log.purged actor=owner@hotel.local`) vía el campo `email` del login, visible en la tabla y el drawer del visor real (capturas de pantalla). Es la cadena O4+O5/AU-R04 ya identificada en Fase 1 como riesgo Crítico (12). Los 3 vectores del enunciado tienen PoC real | `security/audit/fase2-pocs`, commit `dfed1d3` | Hecho; `audit/fase-2-pocs.md` + `audit/evidencias/F2.3-*.txt`/`.png` |
| 2026-10-16 | Re-verificación F2.1/F2.2 con navegador real (Playwright+Chromium) en vez de solo curl, a pedido de Fabian; confirma ejecución real del XSS (no solo inspección de código) | `security/audit/fase2-pocs`, commit `235ed73` | Hecho |
| 2026-10-16 | F2.4 Revisión de `audit/fase-2-pocs.md` contra la plantilla §4.5: las 6 PoCs completas (AUD-POC-3 como hallazgo de soporte, sin repro activo por diseño); push de la rama a `origin` y PR contra `develop` | `security/audit/fase2-pocs` | Hecho |
| 2026-10-21 | F3.1–F3.5: 7 parches (AUD-PAT-1 a 7) con 65 tests en verde, re-prueba en navegador real de las PoCs 1, 2, 4, 5 y 6 (la 3 no es observable en vivo: el tope de 100 supera las filas existentes; lo cubre un test). **Hallazgo nuevo:** `logAuditEvent` era una Server Action pública (cualquier anónimo falsificaba eventos); corregido con `@hotel/core/audit/server`. Guía de la API publicada para P3.4/J3.4/A3.4. Las migraciones append-only y hash encadenado solo se probaron en Postgres local; **sin aplicar al Supabase remoto** | `security/audit/fase3-parches-v1`, commits `56c053c`…`9404908` | Hecho en la rama; pendiente PR, F3.6 (entrega) y F3.7 (video) |

---

## 6. Tareas grupales (consolidación)

| ID | Tarea | Responsable | Depende de | Estado |
|---|---|---|---|---|
| G0.1 | Tomar decisión §4.1 | Todos | — | [x] 2026-09-28 |
| G0.2 | Guardar plantillas de la profesora en `plantillas/` | Aarón | — | [x] 2026-09-28 |
| G1 | Matriz General de Gobernanza del Sistema | Aarón | P1.5, J1.5, A1.5, F1.5 | [x] 2026-10-05 — 27 filas (3 Críticos, 12 Altos, 12 Medios); aprobada por los 4; fuera del repo (§4.3) |
| G2 | Documento de PoCs estandarizado | Fabian | P2.4, J2.4, A2.4, F2.4 | [ ] |
| G3.1 | Matriz de Riesgos NIST CSF actualizada (riesgo residual) | Paula | P3.5, J3.5, A3.5, F3.5 | [ ] |
| G3.2 | Reporte Técnico de Parches | Joseph | P3.6, J3.6, A3.6, F3.6 | [ ] |
| G3.3 | Revisión cruzada de PRs (cada PR con ≥ 1 revisor de otro módulo) | Todos | Fase 3 | [x] 2026-10-24 — acuerdo del equipo: cada PR lo revisa alguien de otro módulo y luego su autor lo mergea (por eso los merges aparecen hechos por el autor y no siempre hay una review formal en GitHub) |
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
