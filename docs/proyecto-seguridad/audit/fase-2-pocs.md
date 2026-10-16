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

## AUD-POC-4 — XSS stored vía `metadata.email` del log de login fallido

- **ID:** AUD-POC-4
- **Vector:** 2 — cliente
- **OWASP:** A03:2021 — Injection (XSS stored); equivalente A07 en clasificaciones
  que separan "Identification and Authentication Failures" del vector de XSS.
- **Subcategoría NIST CSF 2.0:** PR.DS-10 (integridad de datos en uso), PR.PS-05/06
  (prevención de ejecución no autorizada, desarrollo seguro)
- **Componente / archivo:línea:**
  Sumidero: `apps/panel-admin/src/features/audit-log/components/AuditLogDetailDrawer/AuditLogDetailDrawer.tsx:65-69`
  + `packages/core/src/audit/shared/utils.ts:74-87` (`formatMetadataHtml`).
  Fuente: `apps/panel-admin/src/features/auth/services/loginAction.ts:15,25-31`.
- **Origen:** REAL — es exactamente la cadena **O3 / riesgo AU-R01** de
  `fase-1-diagnostico.md`, ya calificada ahí como **Crítico (16)**, la más
  grave del módulo (no requiere cuenta ni permisos).

### Precondiciones
- Ninguna cuenta ni sesión para **inyectar** (el formulario de login es público).
- Cualquier cuenta `admin`/`owner` activa para **ejecutar** el payload al abrir
  el detalle del evento (ni siquiera necesita `audit:view`, por AUD-POC-1).

### Pasos reproducibles
1. `POST /auth/login` (sin sesión) con
   `email=<img src=x onerror="document.title=AUD-POC-4-XSS">` y cualquier password.
   El login falla (`INVALID_CREDENTIALS`) pero `loginAction.ts` registra el intento
   con `metadata.email` = el payload crudo, sin ninguna validación server-side.
2. Con una sesión admin cualquiera, `getAuditLogs({ action: "auth.login.failed" })`
   devuelve la fila con `metadata.email` intacto, sin ningún carácter escapado.
3. Al abrir esa fila en `AuditLogDetailDrawer`, `formatMetadataHtml(row.metadata)`
   interpola el valor crudo en HTML y el componente lo inyecta vía
   `dangerouslySetInnerHTML` — el `<img onerror>` ejecuta en el navegador del admin.
4. Detalle completo en `evidencias/F2.2-A07-stored-xss-metadata.txt`.

### Resultado esperado vs. obtenido
- **Esperado:** el email se guarda/renderiza como texto plano o se rechaza por
  formato inválido antes de persistir.
- **Obtenido:** el payload se persiste y se devuelve sin escapar; por código
  (`dangerouslySetInnerHTML` + `formatMetadataHtml` sin sanitizar, documentado así
  a propósito) se confirma que el drawer lo ejecuta. Confirmación por inspección
  de código, no por captura de navegador — esta sesión no tenía una herramienta de
  automatización de navegador conectada; la verificación visual (cambio de
  `document.title`) queda como paso manual documentado en la evidencia.

### Impacto
XSS stored explotable por cualquier persona no autenticada, que se ejecuta en la
sesión de **cualquier** admin/owner que revise el log — exactamente el flujo que
un admin seguiría tras ver un intento de login sospechoso. Sin CSP (`next.config.ts`
del panel, módulo de Paula) que lo mitigue como segunda capa.

### Evidencia
`evidencias/F2.2-A07-stored-xss-metadata.txt`

### Commit donde se reprodujo
`develop @ f9f8c8b` / branch `security/audit/fase2-pocs`, sin modificaciones de código.

---

## AUD-POC-5 — Falsificación de la IP de origen vía `X-Forwarded-For`

- **ID:** AUD-POC-5
- **Vector:** 3 — alteración de entrada
- **OWASP:** A08:2021 — Software and Data Integrity Failures (audit poisoning)
- **Subcategoría NIST CSF 2.0:** PR.DS-10 (integridad de datos en uso)
- **Componente / archivo:línea:** `packages/core/src/audit/server/getAuditRequestContext.ts:35-37`
- **Origen:** REAL — cadena **O4 / riesgo AU-R04** de `fase-1-diagnostico.md` (Crítico, 12).

### Precondiciones
Ninguna — el formulario público `/auth/login` es el punto de entrada.

### Pasos reproducibles
1. `POST /auth/login` sin sesión, con header `X-Forwarded-For: 203.0.113.250, NOT-AN-IP-ADDRESS`
   (203.0.113.250 es TEST-NET-3, una IP reservada de documentación — nunca puede
   ser una IP real de cliente, elegida para probar que no hay validación de formato).
2. Con una sesión admin cualquiera, `getAuditLogs({ search: "poison-poc" })` devuelve
   la fila con `ip_address: "203.0.113.250"` — exactamente el valor fijado por el atacante.
3. Detalle completo en `evidencias/F2.3-A08-audit-poisoning.txt`.

### Resultado esperado vs. obtenido
- **Esperado:** IP de la conexión real, o "no verificada" sin proxy de confianza documentado.
- **Obtenido:** la IP registrada es 100 % controlada por el atacante, sin validar formato ni origen.

### Impacto
Cualquier correlación forense por IP queda inutilizada; un atacante puede atribuir sus
acciones a cualquier IP, incluida la de un tercero, para incriminarlo.

### Evidencia
`evidencias/F2.3-A08-audit-poisoning.txt`

### Commit donde se reprodujo
`develop @ f9f8c8b` / branch `security/audit/fase2-pocs`, sin modificaciones.

---

## AUD-POC-6 — Inyección de una entrada de log falsificada (CWE-117)

- **ID:** AUD-POC-6
- **Vector:** 3 — alteración de entrada
- **OWASP:** A08:2021 — Software and Data Integrity Failures (audit poisoning / log injection)
- **Subcategoría NIST CSF 2.0:** PR.DS-10, PR.PS-06
- **Componente / archivo:línea:** `packages/core/src/audit/server/logAuditEvent.ts:34-43`
  (origen: `apps/panel-admin/src/features/auth/services/loginAction.ts:25-31`)
- **Origen:** REAL — cadena **O5 / riesgo AU-R04** de `fase-1-diagnostico.md` (Crítico, 12).

### Precondiciones
Ninguna para inyectar (formulario público). Cualquier admin para verla en el visor.

### Pasos reproducibles
1. `POST /auth/login` sin sesión con
   `email = "crlf-poison-poc@test.local\r\n[FORGED] 2026-10-16T00:00:00Z action=audit.log.purged actor=owner@hotel.local result=success\r\n"`.
   Nota: un CRLF en una cabecera HTTP es rechazado por el protocolo (probado: `User-Agent`
   con `\r\n` → `400 Bad Request`); el vector real es un campo del **cuerpo** del formulario,
   que sí acepta bytes de control literales.
2. Confirmado vía `getAuditLogs` que `actor_email`/`metadata.email` guardan el `\r\n` crudo.
3. Confirmado visualmente con sesión real de admin (Playwright + Chromium): el texto
   fabricado aparece partido en varias líneas dentro de la celda "Actor" de la tabla y en
   el drawer de detalle, simulando una segunda entrada de log
   (`action=audit.log.purged actor=owner@hotel.local`) dentro de un evento real.

### Resultado esperado vs. obtenido
- **Esperado:** rechazo por formato de email inválido, o normalización (sin `\r`/`\n`).
- **Obtenido:** se almacena y se muestra tal cual — permite fabricar lo que parece una
  entrada de log adicional, atribuida a otro usuario.

### Impacto
Un atacante no autenticado siembra en el propio registro de auditoría texto que simula
otro evento, confundiendo cualquier revisión manual o export a texto plano/CSV.

### Evidencia
- `evidencias/F2.3-A08-audit-poisoning.txt`
- `evidencias/F2.3-table-poisoned-rows.png` — tabla del visor, filtrada por "poison-poc"
- `evidencias/F2.3-drawer-poisoned-row.png` — drawer de detalle con el log falsificado

### Commit donde se reprodujo
`develop @ f9f8c8b` / branch `security/audit/fase2-pocs`, sin modificaciones.

---

## Resumen para el documento de PoCs (G2)

| ID | Vector | OWASP | Clasificación | Estado |
|---|---|---|---|---|
| AUD-POC-1 | 1 — servidor | A01 | Real | Confirmado, reproducido |
| AUD-POC-2 | 1 — servidor | A03 | Real | Confirmado, reproducido |
| AUD-POC-3 | 1 — servidor | A04 (soporte) | Real | Identificado por código |
| AUD-POC-4 | 2 — cliente | A03 (XSS stored) | Real — **Crítico** (AU-R01) | Confirmado por código + almacenamiento en vivo |
| AUD-POC-5 | 3 — entrada | A08 (IP spoofing) | Real — **Crítico** (AU-R04) | Confirmado en vivo |
| AUD-POC-6 | 3 — entrada | A08 (log injection, CWE-117) | Real — **Crítico** (AU-R04) | Confirmado en vivo + capturas de pantalla |

Los tres vectores del enunciado (1, 2, 3) tienen PoC real reproducida.
Pendiente: consolidar para G2 (documento de PoCs estandarizado, responsable: Fabian).
