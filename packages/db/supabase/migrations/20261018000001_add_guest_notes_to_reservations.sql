-- Adds a free-text "special requests / guest notes" column to reservations.
--
-- SECURITY COURSE PROJECT — part of the OP-POC-3 controlled vulnerability
-- (stored XSS, guest → admin panel) introduced per the team decision in
-- docs/proyecto-seguridad/plan-desarrollo.md §4.1. The column itself is a
-- legitimate domain field (every hotel lets guests leave requests); the
-- vulnerability lives in how the panel renders it unescaped. The Fase 3 fix
-- (A3.2) escapes the value on output and does NOT require dropping this column.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_notes text;

COMMENT ON COLUMN public.reservations.guest_notes IS
  'Optional free-text special requests entered by the guest at checkout.';
