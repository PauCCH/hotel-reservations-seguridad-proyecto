-- Prevents double-booking the same room for overlapping dates at the database
-- level, closing the TOCTOU race left by the application-level availability
-- check (A3.3 / OP-POC-5 residual). Two concurrent checkouts can both pass the
-- `areRoomsAvailable` read, but only one INSERT can satisfy this constraint.
--
-- `daterange(check_in, check_out, '[)')` is half-open, so back-to-back stays
-- (one guest's check_out == the next guest's check_in) do NOT overlap and are
-- allowed. Cancelled reservations free the room, so they are excluded.
--
-- NOTE: `btree_gist` is required to combine the `=` operator on room_id with
-- the `&&` (overlap) operator on the date range in a single GiST exclusion.
-- If existing seed data already contains overlaps, this migration will fail —
-- clean or cancel the overlapping rows first.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
