-- Migration: RLS checks the business role, not the JWT `role` claim (AUTH-POC-2 fix, P3.1)
--
-- Before: "... manageable by admins only" policies used auth.jwt() ->> 'role' = 'admin'.
-- In Supabase the top-level `role` claim is the Postgres role ('authenticated' /
-- 'anon'), never the business role, so the check was misplaced trust in the wrong
-- claim (OWASP A01, NIST PR.AA-05).
--
-- After: same pattern already used for amenities (20260527000001) and
-- system_settings: public.is_admin_or_owner(), which looks up public.user_roles
-- for auth.uid(). user_roles is only writable server-side (no client policies).

-- === ROOMS ===
drop policy if exists "Rooms are manageable by admins only" on public.rooms;

create policy "Rooms are manageable by admins and owners" on public.rooms
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- === ROOM SCHEDULES ===
drop policy if exists "Room schedules are manageable by admins only" on public.room_schedules;

create policy "Room schedules are manageable by admins and owners" on public.room_schedules
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());

-- === ROOM IMAGES ===
drop policy if exists "Room images are manageable by admins only" on public.room_images;

create policy "Room images are manageable by admins and owners" on public.room_images
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
