# Fase 3 — Parches y riesgo residual — Módulo Logs / Auditoría (Fabian)

> Plantilla por parche según `plan-desarrollo.md` §4.6. Este documento **complementa** a
> `fase-2-pocs.md` (que no se modifica): cada parche indica qué `AUD-POC-n` de Fase 2 cierra.
> Evidencias en `evidencias/` (archivos `F3*`). Guía para los demás módulos: `guia-api-auditoria.md`.

---

## 0. Ficha

| | |
|---|---|
| **Responsable** | Fabian |
| **Módulo** | Logs / Auditoría (`audit`) |
| **Rama** | `security/audit/fase3-parches-v1` (desde `develop@e32fd48`) |
| **PR** | _pendiente (F3.6)_ |
| **Línea base vulnerable** | `develop@e32fd48` / PoCs de `fase-2-pocs.md` |

| Commit | Contenido |
|---|---|
| `56c053c` | F3.1 — filtros saneados, `requirePermission(audit:view)`, migración append-only |
| `4d567eb` | F3.2 — metadatos del drawer como texto, se elimina el sumidero `innerHTML` |
| `e291cac` | F3.3a — IP con proxy de confianza + sanitización de campos al escribir |
| `c527a5f` | F3.3b — hash encadenado (`seq`/`prev_hash`/`row_hash`) + `verify_audit_chain()` |
| `1883972` | Evidencia de la re-prueba en navegador real |
| `7f00d93` | F3.3c — `logAuditEvent` deja de ser una Server Action pública (**hallazgo nuevo**) |
| `9404908` | F3.4 — catálogo `AUDIT_ACTIONS`/`AUDIT_ENTITIES` ampliado para los otros módulos |

**Tests:** 65 en verde — 52 en `packages/core/src/audit/**` y 13 en `apps/panel-admin/tests/audit-log/`
(`pnpm --filter @hotel/core vitest run src/audit`, `pnpm --filter @hotel/panel-admin vitest run tests/audit-log`).
Se escribieron **antes** que el código (se vieron en rojo) en F3.2, F3.3 y F3.4.

---

## 1. Resumen

| Parche | Cierra | Riesgo (Fase 1) | OWASP | NIST CSF 2.0 | Residual |
|---|---|---|---|---|---|
| AUD-PAT-1 Permiso `audit:view` | AUD-POC-1 | AU-R02 (Alto 9) | A01 | PR.AA-05 | **Medio** |
| AUD-PAT-2 Filtros y paginación | AUD-POC-2, AUD-POC-3 | AU-R03 (Alto 9), AU-R06, AU-R11 | A03, A04 | PR.DS-10 | **Bajo** |
| AUD-PAT-3 Salida como texto | AUD-POC-4 | AU-R01 (**Crítico 16**) | A03 | PR.DS-10 | **Bajo** |
| AUD-PAT-4 Origen de IP confiable | AUD-POC-5 | AU-R04 (**Crítico 12**) | A08 | PR.DS-10, DE.AE-03 | **Medio** |
| AUD-PAT-5 Sanitización al escribir | AUD-POC-6 | AU-R04 (**Crítico 12**) | A08 (CWE-117) | PR.DS-10 | **Bajo** |
| AUD-PAT-6 Append-only + hash encadenado | — (AU-R05, sin PoC) | AU-R05 (Alto 8) | A08 | PR.DS-01, DE.CM-09 | **Medio** |
| AUD-PAT-7 Escritor no expuesto por HTTP | **hallazgo nuevo** | AU-R04 / AU-R05 | A01, A08 | PR.AA-05, PR.DS-10 | **Bajo** |

---

## AUD-PAT-1 — Verificación del permiso `audit:view`

- **Cierra:** AUD-POC-1 · **Riesgo:** AU-R02 · **OWASP:** A01 · **NIST:** PR.AA-05
- **Archivo:** `apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts:50-53`

**Antes** — lanzaba `PermissionDeniedError(audit:view)` pero nunca comprobaba el permiso:

```ts
const admin = await verifyAdminRole(session.user.id);
if (!admin) throw new PermissionDeniedError(PERMISSIONS.AUDIT.VIEW);
// (sin más verificación: cualquier admin activo leía todo el log)
```

**Después:**

```ts
const admin = await verifyAdminRole(session.user.id);
if (!admin) throw new PermissionDeniedError(PERMISSIONS.AUDIT.VIEW);

await requirePermission(PERMISSIONS.AUDIT.VIEW);
```

**Regresión:** test `rejects an admin without audit:view (AUD-POC-1)` en
`apps/panel-admin/tests/audit-log/getAuditLogs.test.ts` y **re-prueba en vivo**
(`evidencias/F3-retest-poc-4-5-6-2.txt`): con la cuenta admin sin `audit:view`, la llamada directa a
`getAuditLogs` lanza `PermissionDeniedError: Permission denied: audit:view` y no devuelve filas (antes:
200 con el log completo).

**Riesgo residual — Medio.** El permiso ahora se exige, pero `getAuditLogs` sigue leyendo con
**service-role** (salta RLS) y usa `getSession()` en vez de `getUser()` (O13), igual que `requirePermission`.
Si el JWT fuera manipulable, la verificación caería. Es el mismo patrón de Paula; se coordina con ella.
El middleware tampoco verifica rol (O14, compartido).

---

## AUD-PAT-2 — Filtros del visor y paginación

- **Cierra:** AUD-POC-2 (A03) y AUD-POC-3 · **Riesgo:** AU-R03, AU-R06, AU-R11 · **NIST:** PR.DS-10
- **Archivos:** `features/audit-log/utils/sanitizeAuditLogParams.ts` (nuevo), `getAuditLogs.ts`, `constants/pagination.ts`

**Antes** — `params.search` iba crudo dentro del `.or()` de PostgREST:

```ts
query = query.or(`action.ilike.%${params.search}%,actor_email.ilike.%${params.search}%`);
```

**Después** — todo parámetro pasa por una lista blanca antes de tocar la consulta:

| Parámetro | Control |
|---|---|
| `search` | Solo letras, números, espacio y `@ . _ + -`; máx. 100 caracteres. Se eliminan `, ( ) " \ % :` |
| `action` | Debe ser un valor de `AUDIT_ACTIONS`; si no, se ignora |
| `from` / `to` | Deben parsear como fecha; se normalizan a ISO. Inválida → `Error("Invalid date filter")` |
| `page` / `pageSize` | Enteros ≥ 1; `pageSize` con tope de 100 |

**Regresión:** **re-probada en vivo** (`evidencias/F3-retest-poc-4-5-6-2.txt`): `search = x%,actor_email.neq.""`
devolvía todas las filas en Fase 2; ahora `total = 0`, igual que la línea base `zzz_nonexistent_zzz`.
`pageSize = 100000` no es observable en vivo (la tabla tiene menos de 100 filas); lo cubre el test unitario.

**Riesgo residual — Bajo.** La inyección se corta por construcción (lista blanca, no escape). Costo
funcional: no se puede buscar por `%`, comillas ni comas. Queda `throw new Error(error.message)` en
`getAuditLogs` para errores de Postgres que no sean de fecha (O10, parcial); el mensaje podría llegar al
cliente en desarrollo.

---

## AUD-PAT-3 — Metadatos del log renderizados como texto

- **Cierra:** AUD-POC-4 (XSS stored) · **Riesgo:** AU-R01 (**Crítico**) · **OWASP:** A03 · **NIST:** PR.DS-10
- **Archivos:** `packages/core/src/audit/shared/utils.ts`, `AuditLogDetailDrawer.tsx`

**Antes** — HTML construido por concatenación e inyectado con `dangerouslySetInnerHTML`:

```ts
export function formatMetadataHtml(metadata: AuditMetadata): string { /* …`<span>${rendered}</span>` sin escape */ }
// drawer
<div dangerouslySetInnerHTML={{ __html: formatMetadataHtml(row.metadata) }} />
```

**Después** — se elimina la causa raíz (el sumidero) en vez de escapar:

```ts
export function formatMetadataEntries(metadata: AuditMetadata): { key: string; value: string }[]
// drawer
{metadataEntries.map(({ key, value }) => (
  <div key={key}><strong>{key}</strong><span>{value}</span></div>   // nodos de texto de React
))}
```

`formatMetadataHtml` ya no existe y un test verifica que no se reexporte.

**Regresión (en vivo, Chromium):** payload `<img src=x onerror="document.title='AUD-POC-4-F3-RETEST'">`
→ 0 elementos `<img>`, 0 atributos `onerror`, `document.title` sin cambios, y el `innerHTML` del valor es
`&lt;img src=x onerror=…&gt;`. Captura: `evidencias/F3.2-xss-neutralized-drawer.png`.

**Riesgo residual — Bajo.** Ya no hay ruta de HTML hacia el DOM; no depende de una codificación que se pueda
saltar. Defensa en profundidad pendiente (no es de este módulo): CSP global, de Paula (P3.2). Las filas viejas
de Fase 2 que ya están en la base también se muestran como texto.

---

## AUD-PAT-4 — Origen de IP confiable

- **Cierra:** AUD-POC-5 · **Riesgo:** AU-R04 · **OWASP:** A08 · **NIST:** PR.DS-10, DE.AE-03
- **Archivos:** `server/getAuditRequestContext.ts`, `shared/sanitize.ts` (`resolveClientIp`), `.env.example`

**Antes** — el primer valor de `x-forwarded-for`, controlado por el cliente:

```ts
const firstForwarded = forwardedFor?.split(",")[0]?.trim();
const ipAddress = firstForwarded || headerList.get("x-real-ip");
```

**Después** — se confía solo en la parte que añade un proxy propio:

```ts
const ipAddress = resolveClientIp(
  headerList.get("x-forwarded-for"), headerList.get("x-real-ip"), getTrustedProxyHops(),
);
```

- `AUDIT_TRUSTED_PROXY_HOPS = 0` (por defecto) → se ignoran las cabeceras y la IP queda en `null`.
- `= N ≥ 1` → entrada N contando desde la **derecha** del `x-forwarded-for`; debe pasar `net.isIP`.
- `logAuditEvent` vuelve a validar la IP antes de escribir.

**Regresión (en vivo):** `X-Forwarded-For: 203.0.113.250, NOT-AN-IP-ADDRESS` → `ip_address = null`
(antes `203.0.113.250`). Tests: 6 casos en `getAuditRequestContext.test.ts` y 12 en `sanitize.test.ts`.

**Riesgo residual — Medio.** Depende de configurar bien `AUDIT_TRUSTED_PROXY_HOPS`; con un valor mayor al
real, el cliente vuelve a falsificar la IP, y con el valor por defecto se pierde la IP. El proxy de
producción sigue sin definirse (AU-X03). Es una decisión de despliegue, no de código.

---

## AUD-PAT-5 — Sanitización de campos al escribir (log injection)

- **Cierra:** AUD-POC-6 (CWE-117) · **Riesgo:** AU-R04 · **OWASP:** A08 · **NIST:** PR.DS-10
- **Archivos:** `shared/sanitize.ts` (`sanitizeAuditText`, `sanitizeAuditMetadata`), `server/logAuditEvent.ts`

**Antes** — `actor_email`, `entity`, `user_agent` y `metadata` se guardaban tal cual, con `\r\n` y sin tope.
**Después** — se aplica a **todos** los textos y a claves y valores de `metadata`: caracteres de control y
separadores Unicode (` / `) → espacio; máximo 512 caracteres; `metadata` hasta 4 niveles.

**Regresión (en vivo):** email con `\r\n[FORGED] … action=audit.log.purged actor=owner@hotel.local …` queda en
una sola línea (`evidencias/F3.3-crlf-neutralized-drawer.png`). En el DOM, el botón de la fila vieja conserva
`\r\n` literal y el de la nueva tiene espacios.

**Riesgo residual — Bajo.** Ya no se puede fabricar una entrada de log separada. El **texto** falsificado
sigue visible dentro del mismo campo (el contenido no se rechaza), por lo que un lector descuidado podría
leerlo; la defensa completa es validar el formato del email en el servidor, que es del módulo de Paula.

---

## AUD-PAT-6 — Tabla append-only y hash encadenado

- **Cierra:** AU-R05 / O6 (sin PoC en Fase 2) · **OWASP:** A08 · **NIST:** PR.DS-01, DE.CM-09
- **Migraciones:** `20260922000003_audit_logs_append_only.sql`, `20260922000004_audit_logs_hash_chain.sql`

**Antes** — el comentario decía "append-only" pero solo era cierto para `authenticated`; `service_role`
podía reescribir o borrar el histórico sin dejar rastro.

**Después:**

1. `REVOKE UPDATE, DELETE, TRUNCATE` a todos los roles de PostgREST; `INSERT` solo para `service_role`.
2. Trigger que rechaza `UPDATE`/`DELETE`/`TRUNCATE`. Única excepción: el `ON DELETE SET NULL` de
   `actor_id` (si no, no se podría borrar un usuario).
3. Hash encadenado calculado **en la base** (`BEFORE INSERT`, con advisory lock): `seq`, `prev_hash`,
   `row_hash = sha256(seq|prev_hash|campos…)`. `actor_id` queda fuera del hash por el punto anterior.
4. `verify_audit_chain()` devuelve el primer `seq` alterado, o `NULL` si todo está íntegro (solo `service_role`).

**Regresión — Postgres 17 desechable (Docker), NO el Supabase remoto:**

| Prueba | Resultado |
|---|---|
| Backfill de 2 filas previas | cadena válida |
| `UPDATE` como `service_role` | `permission denied` |
| `DELETE` como superusuario | `audit_logs is append-only: DELETE is not allowed` |
| Borrar un usuario de `auth.users` | permitido; la cadena sigue íntegra |
| 30 inserts con 10 en paralelo | 32 filas, 32 `seq` distintos, cadena íntegra |
| Alterar una fila deshabilitando el trigger | `verify_audit_chain()` la señala |
| `verify_audit_chain()` como `authenticated` | `permission denied` |

**Limitaciones que importan:**

- **Las migraciones no están aplicadas en el Supabase remoto.** Hacerlo es un cambio compartido y difícil de
  revertir; falta decidirlo con el equipo. Hasta entonces, en el remoto la tabla **no** es append-only.
- Sin test automático en Vitest (es SQL); la prueba se hizo a mano en el contenedor.
- SHA-256 sin clave detecta alteraciones parciales, pero quien tenga **escritura total** a la tabla puede
  recalcular toda la cadena.

**Riesgo residual — Medio.** Sube a Bajo cuando (a) se apliquen las migraciones al entorno real y (b) se
ancle el último `row_hash` fuera de la base de datos, o se use HMAC con una clave que Postgres no tenga.

---

## AUD-PAT-7 — `logAuditEvent` no es una Server Action (hallazgo nuevo)

- **Cierra:** vector no cubierto en Fase 1 ni en Fase 2 · **Riesgo:** AU-R04 / AU-R05 por otra vía
- **OWASP:** A01, A08 · **NIST:** PR.AA-05, PR.DS-10
- **Archivos:** `server/logAuditEvent.ts`, `server/getAuditRequestContext.ts`, `server/index.ts` (nuevo), `packages/core/package.json`

**Causa raíz.** Ambos archivos empezaban con `"use server"`, así que cada función exportada era un endpoint
HTTP público. `logAuditEvent` figuraba en `server-reference-manifest.json`. La sanitización de AUD-PAT-5 no lo
evita: limpia el texto, pero no puede saber que el llamante es ilegítimo.

**Antes (sin sesión):**

```
curl -X POST localhost:3002/auth/login -H 'Next-Action: 4075680f…3d24' \
  --data '[{"actorEmail":"owner@hotel.local","action":"audit.log.purged","entity":"audit_logs", …}]'
→ HTTP 200; el visor muestra la fila atribuida a owner@hotel.local
```

**Después:** se quita `"use server"`, se crea `@hotel/core/audit/server` (solo servidor) y
`@hotel/core/audit` queda con constantes, tipos y formateadores. El mismo `curl` → `404 Server action not found.`

**Regresión:** `server-boundary.test.ts` (4 tests) falla si vuelve la directiva o si el `index` seguro para
el cliente reexporta el escritor. Re-probado en vivo con arranque limpio; el login legítimo sigue
registrando `auth.login.success`. Detalle: `evidencias/F3.3-server-action-exposure.txt`.

**Riesgo residual — Bajo.** Cualquier código de **servidor** sigue pudiendo escribir cualquier evento, por
diseño. Mitigación: revisión de PRs de los demás módulos (guía §8). **Nota:** la fila de la demostración
(`id 838f2471-90f5-4601-8950-e08d06872105`, acción `audit.log.purged`) quedó en el Supabase remoto como
evidencia; hoy se puede borrar con SQL manual porque la migración append-only no está aplicada allí.

---

## 2. Hallazgos de Fase 1 sin parche en Fase 3

Ninguno estaba en el alcance de los tres vectores del enunciado; se declaran para que el riesgo residual sea honesto.

| Obs. | Riesgo | Estado | Residual |
|---|---|---|---|
| O7 `logAuditEvent` traga errores | AU-R07 | Sin cambios | Medio |
| O9 `audit.log.viewed` por cada página y filtro | AU-R08 | Sin cambios | Medio |
| O11 Sin retención ni rotación (Ley 8968) | AU-R06, AU-R09 | Sin cambios | Medio |
| O12 Cobertura de eventos | AU-R10 | **Parcial:** catálogo ampliado y guía publicada; depende de que P3.4/J3.4/A3.4 cableen los eventos | Medio |
| O13 / O14 `getSession()` y middleware sin rol | AU-R02 | Coordinar con Paula | Medio |
| O15 `actor_id` → `NULL` al borrar usuario | AU-R12 | Sin cambios; el hash lo tolera a propósito | Medio |

---

## 3. Riesgo residual por hallazgo (insumo de G3.1)

| Riesgo Fase 1 | Inherente | Residual | Justificación breve |
|---|---|---|---|
| AU-R01 XSS stored vía metadatos | Crítico (16) | **Bajo** | Sumidero eliminado y verificado en navegador; falta CSP (Paula) como segunda capa |
| AU-R04 Audit poisoning (IP + inyección + escritor expuesto) | Crítico (12) | **Medio** | Contenido y escritor cerrados; la IP depende de configurar el proxy (AU-X03) |
| AU-R02 Lectura sin permiso | Alto (9) | **Medio** | Permiso exigido y re-probado en vivo; sigue `getSession()` y service-role |
| AU-R03 Inyección en `search` | Alto (9) | **Bajo** | Lista blanca, re-probada en vivo |
| AU-R05 Alteración del histórico | Alto (8) | **Medio** | Controles hechos y probados solo en BD local; sin aplicar al remoto; SHA-256 sin clave |
| AU-R06 Volcado / carga | Medio (6) | **Medio** | Tope de `pageSize`; sigue sin retención |
| AU-R11 Fuga por mensajes de error | Bajo (3) | **Bajo** | Fechas validadas; mensaje de BD aún se propaga |

---

## 4. Pendiente para cerrar la Fase 3

- [ ] **Decidir y aplicar** las migraciones `…0003` y `…0004` en el Supabase remoto (cambio compartido).
- [ ] Definir el proxy de producción y fijar `AUDIT_TRUSTED_PROXY_HOPS`.
- [ ] Revisión cruzada del PR (G3.3) y PR contra `develop`.
- [ ] Video (F3.7, ≤ 5 min, solo IDE).
- [ ] Opcional: anclar `row_hash` fuera de la BD o pasar a HMAC (baja AU-R05 a Bajo).
