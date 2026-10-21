-- Migration: Harden role assignment on signup (AUTH-POC-1 fix, P3.1)
--
-- Before: handle_new_user() took the role from
--   coalesce(raw_app_meta_data ->> 'role', raw_user_meta_data ->> 'role', 'client').
-- raw_user_meta_data is the `data` object of /auth/v1/signup, so anyone holding
-- the public anon key could self-register as `admin` (OWASP A01, NIST PR.AA-05).
--
-- After:
--   1. The role is read ONLY from raw_app_meta_data (writable only with the
--      service-role key / by GoTrue itself). Anything else -> 'client'.
--   2. Admin invitations no longer rely on user_metadata. The server promotes the
--      invited user with promote_invited_admin(), executable only by service_role.
--   3. sync_role_to_jwt() is dropped: it copied the business role into
--      raw_user_meta_data (user-editable via auth.updateUser) and its trigger
--      targeted public.users, which no longer exists (renamed to profiles).

-- 1. Trigger: never trust user-controlled metadata for the role ---------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, is_active)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',   -- Google OAuth puede venir como "name"
      null
    ),
    true
  );

  -- Solo app_metadata (no controlable por el cliente). raw_user_meta_data se ignora
  -- a propósito: un registro público siempre es 'client'.
  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case new.raw_app_meta_data ->> 'role'
      when 'owner' then 'owner'::public.user_role
      when 'admin' then 'admin'::public.user_role
      else 'client'::public.user_role
    end
  );

  return new;
end;
$$;

-- 2. Server-side promotion of invited admins -----------------------------------
create or replace function public.promote_invited_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_roles
  set role = 'admin'
  where user_id = p_user_id
    and role <> 'owner';

  if not found and not exists (
    select 1 from public.user_roles where user_id = p_user_id
  ) then
    raise exception 'promote_invited_admin: user % has no role row', p_user_id;
  end if;

  -- assign_admin_permissions solo corre en INSERT; la promoción es un UPDATE.
  perform public.set_admin_permissions(p_user_id);

  -- Mantener app_metadata como fuente de verdad del rol (no user_metadata).
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
  where id = p_user_id;
end;
$$;

revoke all on function public.promote_invited_admin(uuid) from public, anon, authenticated;
grant execute on function public.promote_invited_admin(uuid) to service_role;

-- 3. Drop the dead role -> user_metadata sync -----------------------------------
drop function if exists public.sync_role_to_jwt() cascade;
