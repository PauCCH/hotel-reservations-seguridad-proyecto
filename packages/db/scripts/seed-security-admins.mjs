// Seed de cuentas de prueba para la evaluación de seguridad (Fase 2 — Operaciones).
// Crea dos cuentas en el panel-admin:
//   1) owner            -> rol 'owner'  (trigger le da TODOS los permisos, incl. reservations:view y rooms:manage)
//   2) admin sin rooms  -> rol 'admin'  (trigger le da solo view:dashboard + reservations:view; SIN rooms:manage)
//
// La cuenta owner sirve para OP-POC-3 (ver el detalle de una reserva y disparar el XSS stored).
// La cuenta admin-sin-rooms sirve para OP-POC-2 (invocar galleryActions sin el permiso rooms:manage).
//
// Uso (desde la raíz del repo, el .env raíz ya tiene las variables):
//   node --env-file=.env packages/db/scripts/seed-security-admins.mjs
//
// Es idempotente: si una cuenta ya existe, la reutiliza y solo reajusta el rol.
// NO usar contra datos reales — son credenciales de prueba para entorno local.

import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
      "Corré con:  node --env-file=.env packages/db/scripts/seed-security-admins.mjs",
  );
  process.exit(1);
}

// Credenciales de PRUEBA (solo entorno local de desarrollo).
const ACCOUNTS = [
  {
    label: "OWNER (OP-POC-3: ver reservas / disparar XSS)",
    email: "sec.owner@hotel.local",
    password: "Owner.Sec-2026",
    role: "owner",
  },
  {
    label: "ADMIN sin rooms:manage (OP-POC-2: galleryActions sin permiso)",
    email: "sec.admin.norooms@hotel.local",
    password: "Admin.Sec-2026",
    role: "admin",
  },
];

const supabase = createServerClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  cookies: { getAll: () => [], setAll: () => {} },
});

async function findUserByEmail(email) {
  // Proyecto de dev: pocos usuarios, una página alcanza.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function ensureUser({ email, password }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error) return { id: data.user.id, created: true };

  // Ya existía: lo buscamos y le reseteamos la contraseña para asegurar el login.
  const existing = await findUserByEmail(email);
  if (!existing) throw new Error(`createUser falló y no se encontró el usuario: ${error.message}`);
  await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
  return { id: existing.id, created: false };
}

async function setRole(userId, role) {
  // Borramos e insertamos para que SIEMPRE dispare el trigger AFTER INSERT
  // (set_owner_permissions / set_admin_permissions), que es lo que asigna los permisos.
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(`insert user_roles (${role}): ${error.message}`);
}

async function ensureProfileActive(userId) {
  // El trigger de signup ya crea el perfil activo; esto lo garantiza por si acaso.
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, is_active: true }, { onConflict: "id" });
  if (error) throw new Error(`upsert profiles: ${error.message}`);
}

async function readPermissions(userId) {
  const { data } = await supabase
    .from("user_permissions")
    .select("permission")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.permission).sort();
}

console.log(`\nSeed de cuentas de seguridad contra ${SUPABASE_URL}\n`);

for (const acc of ACCOUNTS) {
  try {
    const { id, created } = await ensureUser(acc);
    await ensureProfileActive(id);
    await setRole(id, acc.role);
    const perms = await readPermissions(id);
    console.log(`✔ ${acc.label}`);
    console.log(`    email:    ${acc.email}`);
    console.log(`    password: ${acc.password}`);
    console.log(`    user_id:  ${id} (${created ? "creado" : "ya existía, reutilizado"})`);
    console.log(`    rol:      ${acc.role}`);
    console.log(
      `    permisos: ${acc.role === "owner" ? "(owner ⇒ todos, vía short-circuit)" : perms.join(", ") || "(ninguno)"}`,
    );
    console.log("");
  } catch (e) {
    console.error(`✗ ${acc.label}\n    ERROR: ${e.message}\n`);
    process.exitCode = 1;
  }
}

console.log("Listo. Entrá en http://localhost:3002/auth/login con cada cuenta.\n");
