# Guía de uso de la API de auditoría (F3.4)

> Para Paula (`auth`), Joseph (`users`) y Aarón (`operations`): cómo registrar eventos en
> `audit_logs` desde sus módulos (tareas P3.4, J3.4, A3.4). Responsable de la API: Fabian.
> Código: `packages/core/src/audit/**`.

---

## 1. Qué cambió respecto a Fase 2 (léelo antes de usarla)

| Antes | Ahora |
|---|---|
| `import { logAuditEvent, getAuditRequestContext } from "@hotel/core/audit"` | `import { logAuditEvent, getAuditRequestContext } from "@hotel/core/audit/server"` |
| `@hotel/core/audit` exportaba todo | `@hotel/core/audit` solo exporta lo **seguro para el cliente**: `AUDIT_ACTIONS`, `AUDIT_ENTITIES`, tipos y formateadores |
| `logAuditEvent` era una Server Action pública (`"use server"`) | Es una función de servidor normal. **No es invocable por HTTP** |

**Por qué.** Un archivo con `"use server"` convierte cada función exportada en un endpoint HTTP que
cualquiera puede llamar sin sesión. Con eso un anónimo podía escribir eventos falsos atribuidos al
owner (demostrado, ver `evidencias/F3.3-server-action-exposure.txt`).

**Regla que se desprende:** nunca pongan `"use server"` en un archivo que exporte (o reexporte)
`logAuditEvent`. Llámenla **desde** una Server Action o un route handler, no la conviertan en una.
Hay un test (`server-boundary.test.ts`) que falla si alguien lo hace.

---

## 2. Uso mínimo

```ts
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "@hotel/core/audit";
import { getAuditRequestContext, logAuditEvent } from "@hotel/core/audit/server";

// dentro de una Server Action, DESPUÉS de verificar sesión y permisos
const { ipAddress, userAgent } = await getAuditRequestContext();

await logAuditEvent({
  actorId: session.user.id,
  actorEmail: session.user.email,
  action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
  entity: AUDIT_ENTITIES.USER,
  entityId: targetUserId,
  metadata: { from: "admin", to: "owner" },
  ipAddress,
  userAgent,
});
```

- `logAuditEvent` **nunca lanza**: si la escritura falla solo hace `console.error`. No hace falta
  `try/catch`, pero tampoco pueden asumir que quedó guardado.
- Llámenla **después** de que la operación se hizo (o se denegó), con datos que ya validaron.
- Úsenla siempre con `getAuditRequestContext()`: es la única fuente de IP y user-agent.

---

## 3. Contrato del evento (`AuditEvent`)

| Campo | Tipo | Notas |
|---|---|---|
| `action` | `string` (**obligatorio**) | Usen una constante de `AUDIT_ACTIONS`, no un string suelto |
| `actorId` | `string \| null` | `session.user.id`. Es FK a `auth.users` (`ON DELETE SET NULL`) |
| `actorEmail` | `string \| null` | Quién actuó. **No** pongan aquí el email del objetivo |
| `entity` | `string \| null` | Una constante de `AUDIT_ENTITIES` |
| `entityId` | `string \| null` | Id del objeto afectado (usuario, reserva…) |
| `metadata` | `Record<string, unknown>` | Datos del evento. Ver reglas en §5 |
| `ipAddress` | `string \| null` | De `getAuditRequestContext()`. Se descarta si no es una IP válida |
| `userAgent` | `string \| null` | De `getAuditRequestContext()` |

### Qué hace la API por ustedes (no lo dupliquen)

Todo texto se **normaliza al escribir**: CR, LF, tabuladores y demás caracteres de control pasan a
espacios, y cada campo se corta a 512 caracteres. En `metadata` se aplica a claves y valores, de forma
recursiva, hasta 4 niveles (lo más profundo se guarda como `"[truncated]"`). Esto evita la falsificación
de líneas de log (CWE-117). **No** hace falta que ustedes escapen HTML: el visor muestra todo como
texto.

---

## 4. Catálogo de acciones disponibles

Están en `packages/core/src/audit/config/constants.ts`. Si les falta una, **pídanmela o agréguenla
con un PR corto** (archivo compartido, avísenme): mantengan el formato `namespace.entidad.resultado`.
Hay un test que exige valores únicos y en minúsculas con puntos.

| Constante | Valor | Módulo sugerido | Cuándo |
|---|---|---|---|
| `AUTH_LOGIN_SUCCESS` | `auth.login.success` | Auth (ya cableada) | Login correcto |
| `AUTH_LOGIN_FAILED` | `auth.login.failed` | Auth (ya cableada) | Login fallido |
| `AUTH_ACCESS_DENIED` | `auth.access.denied` | Auth / todos | Acceso rechazado por rol o permiso (**hoy no se registra**) |
| `USER_INVITED` | `user.invited` | Usuarios | Se envía una invitación |
| `USER_ROLE_CHANGED` | `user.role.changed` | Usuarios | Cambio de rol (`metadata: { from, to }`) |
| `USER_PERMISSION_GRANTED` | `user.permission.granted` | Usuarios | Se otorga un permiso (`metadata: { permission }`) |
| `USER_PERMISSION_REVOKED` | `user.permission.revoked` | Usuarios | Se revoca un permiso |
| `USER_STATUS_CHANGED` | `user.status.changed` | Usuarios | Activar / desactivar cuenta |
| `RESERVATION_CREATED` | `reservation.created` | Operaciones | Se crea una reserva |
| `RESERVATION_UPDATED` | `reservation.updated` | Operaciones | Cambio de fechas, cuarto o estado |
| `RESERVATION_CANCELLED` | `reservation.cancelled` | Operaciones | Cancelación |
| `RESERVATION_DELETED` | `reservation.deleted` | Operaciones | Borrado |
| `AUDIT_LOG_VIEWED` | `audit.log.viewed` | Auditoría (ya cableada) | Lectura del visor |

Entidades: `AUDIT_ENTITIES.USER`, `.PERMISSION`, `.RESERVATION`, `.AUDIT_LOGS`.

Lo que cada módulo debería cubrir en Fase 3 (según el plan §5):

- **Paula (P3.4):** logout, `AUTH_ACCESS_DENIED` y los eventos de auth ya existentes.
- **Joseph (J3.4):** invitación, cambio de rol, otorgar/revocar permiso, activar/desactivar admin.
- **Aarón (A3.4):** crear / modificar / cancelar / borrar reserva.

---

## 5. Reglas para `metadata` (importantes: es información que se queda para siempre)

1. **Nunca** contraseñas, tokens, cookies, claves de API, números de tarjeta ni el cuerpo completo de
   una petición. La tabla es append-only: lo que entra no se puede borrar.
2. **Minimicen datos personales.** Guarden `entityId` y el cambio (`from`/`to`), no el perfil completo.
   El email y la IP ya son PII (Ley 8968); no agreguen más.
3. **No pongan input del usuario sin necesidad.** Si registran un login fallido, `email` es lo único
   que hace falta. Todo lo que llegue ahí lo controla un atacante.
4. Valores simples (string, number, boolean) y objetos pequeños. Nada de objetos enormes: se truncan.
5. **No confíen en el log para tomar decisiones de seguridad.** Es evidencia, no una fuente de verdad.

---

## 6. IP de origen: configuración de despliegue

`getAuditRequestContext()` **ya no** toma `x-forwarded-for` tal cual (cualquier cliente puede enviarla).

- Variable: `AUDIT_TRUSTED_PROXY_HOPS` (en `.env.example`). Es el número de proxies de confianza
  delante de la app.
- `0` (por defecto): se ignoran las cabeceras y `ip_address` queda en `null`. Es lo correcto en local.
- `N ≥ 1`: se toma la entrada que añadió el proxy, contando **desde la derecha** del `x-forwarded-for`,
  y se valida que sea una IP.
- Hay que fijarla según el despliegue real. Si se pone un valor mayor al real, un cliente puede volver
  a falsificar la IP. **Pendiente del equipo:** decidir y documentar el proxy de producción (AU-X03).

---

## 7. Integridad y verificación

Cuando las migraciones `20260922000003` (append-only) y `20260922000004` (hash encadenado) estén
aplicadas, cada fila guarda `seq`, `prev_hash` y `row_hash`, calculados por la base de datos. Para
comprobar la cadena (solo `service_role`):

```sql
select public.verify_audit_chain();   -- NULL = cadena íntegra; si no, el primer seq alterado
```

No pueden hacer `UPDATE`/`DELETE`/`TRUNCATE` sobre `audit_logs` (ni desde sus módulos): la base lo rechaza.

---

## 8. Checklist antes de abrir su PR

- [ ] Importo el escritor desde `@hotel/core/audit/server`, y las constantes desde `@hotel/core/audit`.
- [ ] No añadí `"use server"` a ningún archivo que exporte `logAuditEvent`.
- [ ] Registro **después** de verificar sesión y permisos, con el actor real de la sesión.
- [ ] Uso constantes de `AUDIT_ACTIONS` / `AUDIT_ENTITIES`.
- [ ] `metadata` sin secretos y con el mínimo de datos personales.
- [ ] Pasé `ipAddress` y `userAgent` desde `getAuditRequestContext()`.
- [ ] Mi test mockea `@hotel/core/audit/server` (no `@hotel/core/audit`) para el escritor.
