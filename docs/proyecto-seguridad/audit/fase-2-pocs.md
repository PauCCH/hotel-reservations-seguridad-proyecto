# Fase 2 — PoCs de Evaluación Ofensiva — Módulo Logs / Auditoría (Fabian)

> Plantilla por PoC según `plan-desarrollo.md` §4.5. Evidencias completas en `evidencias/`.

---

## AUD-POC-1 — Acceso no autorizado a `audit_logs` (A01)

- **ID:** AUD-POC-1
- **Vector:** 1 — servidor
- **OWASP:** A01:2021 — Broken Access Control
- **Subcategoría NIST CSF 2.0:** PR.AA-05 (permisos least-privilege), DE.CM-01 (monitoreo de acceso)
- **Componente / archivo:línea:**
  `apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts:43-44,50`
  (contraste con `packages/db/supabase/migrations/20260922000002_create_audit_logs_table.sql:20-23`)
- **Origen:** REAL (hallazgo O1/O13 de `fase-1-diagnostico.md`; no se introdujo nada).

### Precondiciones
- App corriendo en `localhost:3002` (panel-admin, dev).
- Cuenta con rol `admin` o `owner`, `is_active = true`, **sin** el permiso `audit:view`
  asignado en `user_permissions` (cuenta de prueba del equipo: `vargasarayafabian11@gmail.com`).

### Pasos reproducibles
1. Login normal vía `/auth/login` con la cuenta sin `audit:view`. Se obtiene cookie
   de sesión Supabase (`sb-<ref>-auth-token`).
2. Invocar el Server Action `getAuditLogs` directamente (sin pasar por la UI del
   visor), vía `POST /admin/audit-log` con el header `Next-Action` apuntando al id
   del action (`7f70e31cc888bbc13237e8faa69e5a64927ba28da9`, resuelto desde
   `apps/panel-admin/.next/server/server-reference-manifest.json`) y body
   `[{"page":1,"pageSize":5}]`.
3. Ver detalle completo de la petición/respuesta en `evidencias/F2.1-A01-broken-access-control.txt`.

### Resultado esperado vs. obtenido
- **Esperado:** `403` / `PermissionDeniedError` — la cuenta no tiene `audit:view`.
- **Obtenido:** `200 OK` con el log de auditoría completo (`total: 14`), incluyendo
  eventos de otros actores (`owner@hotel.local`).

### Impacto
Cualquier cuenta `admin`/`owner` activa, sin importar sus permisos granulares, lee
el 100 % del historial de auditoría del sistema (incluye intentos de login fallidos
de otras cuentas, IPs, user-agents). Rompe el modelo de permisos que el propio
código pretende hacer cumplir (lanza el error de permiso correcto, pero nunca
evalúa la condición).

### Evidencia
`evidencias/F2.1-A01-broken-access-control.txt`

### Commit donde se reprodujo
Reproducido sobre el estado de `develop` en el commit `f9f8c8b` (branch
`security/audit/fase2-pocs`), sin modificaciones de código — el código vulnerable
ya existe en `develop`.

---

## AUD-POC-2 — Inyección en el filtro `search` del visor (A03)

- **ID:** AUD-POC-2
- **Vector:** 1 — servidor
- **OWASP:** A03:2021 — Injection
- **Subcategoría NIST CSF 2.0:** PR.PS-04 (hardening de entrada), DE.CM-03 (monitoreo de consultas anómalas)
- **Componente / archivo:línea:**
  `apps/panel-admin/src/features/audit-log/services/getAuditLogs.ts:56-57`
- **Origen:** REAL (hallazgo O2/O10 de `fase-1-diagnostico.md`).

### Precondiciones
- Misma sesión admin que AUD-POC-1 (el permiso `audit:view` es irrelevante dado
  AUD-POC-1 — cualquier admin/owner activo puede reproducir esto).

### Pasos reproducibles
1. Con la sesión autenticada, invocar `getAuditLogs` con un `search` de control
   que no debería producir resultados: `{"search":"zzz_nonexistent_zzz"}` → `total: 0`.
2. Repetir con `{"search":"x%,actor_email.neq.\"\""}`. La coma y el operador
   `neq` rompen la cadena `.or()` armada en el código (`action.ilike.%${search}%,actor_email.ilike.%${search}%`)
   e inyectan una condición `actor_email.neq.""`, verdadera para toda fila.
3. Detalle completo en `evidencias/F2.1-A03-filter-injection.txt`.

### Resultado esperado vs. obtenido
- **Esperado:** `0` filas, igual que el control (ningún campo contiene literalmente `x%,actor_email.neq...`).
- **Obtenido:** `total: 14` — el 100 % de las filas de la tabla.

### Impacto
Un atacante con sesión admin controla la semántica del filtro de búsqueda del
visor más allá de un simple `ilike`, pudiendo construir condiciones PostgREST
arbitrarias contra `audit_logs`. Combinado con AUD-POC-1 (sin chequeo de permiso)
y AUD-POC-3 (sin tope de `pageSize`), permite volcar la tabla completa sin pasar
por la UI ni necesitar `audit:view`.

### Evidencia
`evidencias/F2.1-A03-filter-injection.txt`

### Commit donde se reprodujo
Igual que AUD-POC-1: `develop @ f9f8c8b`, sin modificaciones.

---

## AUD-POC-3 — `pageSize` sin límite server-side (hallazgo de soporte, A01/A04)

- **ID:** AUD-POC-3
- **Vector:** 1 — servidor
- **OWASP:** A04:2021 — Insecure Design (falta de límite de recursos), agrava A01
- **Subcategoría NIST CSF 2.0:** PR.PS-04
- **Componente / archivo:línea:** `getAuditLogs.ts:17-24,47,62`
- **Origen:** REAL (hallazgo O8 de `fase-1-diagnostico.md`).
- **Estado:** identificado por lectura de código (`pageSize` del cliente no tiene
  tope server-side); no se ejecutó un volcado masivo real para no generar carga
  ni ruido en la base de pruebas. Se deja como hallazgo de soporte para el
  reporte de parches (F3.1), reproducible trivialmente combinando AUD-POC-1 con
  `{"pageSize": 100000}`.

---

## Resumen para el documento de PoCs (G2)

| ID | Vector | OWASP | Clasificación | Estado |
|---|---|---|---|---|
| AUD-POC-1 | 1 — servidor | A01 | Real | Confirmado, reproducido |
| AUD-POC-2 | 1 — servidor | A03 | Real | Confirmado, reproducido |
| AUD-POC-3 | 1 — servidor | A04 (soporte) | Real | Identificado por código |

Pendiente: F2.2 (vector 2 — XSS stored en campos del log) y F2.3 (vector 3 —
audit poisoning / falsificación de origen).
