-- Reconciles the portal's room catalog with public.rooms (A3.3 / OP-POC-5 follow-up).
--
-- The public portal still renders rooms from its static mock catalog
-- (`apps/portal-reservas/src/features/rooms/mock-data/rooms.ts`, ids like "mv-1"),
-- but `reservations.room_id` is a uuid FK to public.rooms. Every checkout failed
-- with 22P02 (invalid uuid), so neither the availability check nor the
-- `reservations_no_overlap` EXCLUDE constraint could ever run.
--
-- This inserts one row per mock room with a FIXED uuid. The portal maps each
-- mock id to its uuid server-side (`features/checkout/constants/room-catalog.ts`);
-- both files must stay in sync (a Vitest test checks the portal side).
--
-- Category: public.rooms only allows Standard/Deluxe/Suite, so the mock types
-- Family → Deluxe and Villa → Suite. Fees mirror the mock nightly price.
-- Idempotent: re-running (or a later seed) leaves existing rows untouched.

INSERT INTO public.rooms (
  id, name, category, capacity_adults, capacity_kids,
  description, regular_fee, high_season_fee, is_pet_friendly
) VALUES
  -- Monteverde
  ('0a330000-0000-4000-8000-000000000101', 'Cabaña Estándar del Bosque',   'Standard', 2, 0,
   'Catálogo del portal (mv-1).', 145.00, 145.00, false),
  ('0a330000-0000-4000-8000-000000000102', 'Suite Dosel Panorámica',       'Suite',    2, 0,
   'Catálogo del portal (mv-2).', 280.00, 280.00, false),
  ('0a330000-0000-4000-8000-000000000103', 'Eco-Lodge Familiar',           'Deluxe',   5, 0,
   'Catálogo del portal (mv-3).', 320.00, 320.00, false),
  ('0a330000-0000-4000-8000-000000000104', 'Villa Quetzal Exclusiva',      'Suite',    4, 0,
   'Catálogo del portal (mv-4).', 550.00, 550.00, false),
  -- Arenal & La Fortuna
  ('0a330000-0000-4000-8000-000000000201', 'Habitación Vista Volcán',      'Standard', 2, 0,
   'Catálogo del portal (lf-1).', 180.00, 180.00, false),
  ('0a330000-0000-4000-8000-000000000202', 'Suite Aguas Termales Privadas', 'Suite',   2, 0,
   'Catálogo del portal (lf-2).', 350.00, 350.00, false),
  ('0a330000-0000-4000-8000-000000000203', 'Lodge de Aventura',            'Deluxe',   6, 0,
   'Catálogo del portal (lf-3).', 290.00, 290.00, false),
  ('0a330000-0000-4000-8000-000000000204', 'Gran Villa Tabacón Signature', 'Suite',    8, 0,
   'Catálogo del portal (lf-4).', 850.00, 850.00, false)
ON CONFLICT (id) DO NOTHING;
