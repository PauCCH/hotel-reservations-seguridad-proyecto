-- Migration: Sync user role to JWT custom claim
-- Purpose: When a user's role changes in public.users, update auth.users metadata so JWT includes role
-- This enables Storage RLS policies to check auth.jwt() ->> 'role'

-- Create the sync function
create or replace function public.sync_role_to_jwt()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', new.role)
  where id = new.id;

  return new;
end;
$$;

-- Create trigger on user role updates
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) and not exists (
    select 1 from information_schema.triggers
    where trigger_name = 'on_user_role_updated'
    and event_object_table = 'users'
  ) then
    execute 'create trigger on_user_role_updated
      after update of role on public.users
      for each row
      when (old.role is distinct from new.role)
      execute function public.sync_role_to_jwt()';
  end if;
end $$;

-- Backfill existing users with their current role
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    update auth.users u
    set raw_user_meta_data =
      coalesce(u.raw_user_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', pu.role)
    from public.users pu
    where u.id = pu.id
      and u.raw_user_meta_data ->> 'role' is null;
  end if;
end $$;
