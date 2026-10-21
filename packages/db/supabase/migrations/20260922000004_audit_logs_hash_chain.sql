-- Tamper-evidence for public.audit_logs: every row stores the hash of the
-- previous row (prev_hash) and its own hash (row_hash). Editing, deleting or
-- reordering a row breaks every hash after it, which verify_audit_chain()
-- reports. Computed in the database (BEFORE INSERT) so callers can't forge it
-- and concurrent inserts are serialised.
--
-- actor_id is deliberately NOT part of the hash: it is nulled by
-- ON DELETE SET NULL when an auth user is removed, and that legitimate update
-- must not invalidate the chain. actor_email keeps the identity.
--
-- Limit: plain SHA-256 detects accidental/partial tampering, but an attacker
-- with full write access to the table could recompute the whole chain. Anchor
-- the latest row_hash outside the database (or switch to HMAC with a key held
-- outside Postgres) to close that gap.

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS seq       BIGINT,
    ADD COLUMN IF NOT EXISTS prev_hash TEXT,
    ADD COLUMN IF NOT EXISTS row_hash  TEXT;

CREATE OR REPLACE FUNCTION public.audit_logs_compute_hash(
    r public.audit_logs
) RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT pg_catalog.encode(
        pg_catalog.sha256(
            pg_catalog.convert_to(
                pg_catalog.concat_ws(
                    '|',
                    r.seq,
                    COALESCE(r.prev_hash, ''),
                    r.id,
                    COALESCE(r.actor_email, ''),
                    r.action,
                    COALESCE(r.entity, ''),
                    COALESCE(r.entity_id, ''),
                    r.metadata::text,
                    COALESCE(r.ip_address, ''),
                    COALESCE(r.user_agent, ''),
                    pg_catalog.to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
                ),
                'UTF8'
            )
        ),
        'hex'
    )
$$;

-- Backfill rows that predate the chain, in creation order. The append-only
-- trigger would reject these UPDATEs, so it is disabled for this statement only.
ALTER TABLE public.audit_logs DISABLE TRIGGER audit_logs_no_update_delete;
DO $$
DECLARE
    rec  public.audit_logs;
    prev text := NULL;
    n    bigint := 0;
BEGIN
    FOR rec IN SELECT * FROM public.audit_logs ORDER BY created_at, id LOOP
        n := n + 1;
        rec.seq := n;
        rec.prev_hash := prev;
        rec.row_hash := public.audit_logs_compute_hash(rec);
        UPDATE public.audit_logs
           SET seq = rec.seq, prev_hash = rec.prev_hash, row_hash = rec.row_hash
         WHERE id = rec.id;
        prev := rec.row_hash;
    END LOOP;
END $$;
ALTER TABLE public.audit_logs ENABLE TRIGGER audit_logs_no_update_delete;

ALTER TABLE public.audit_logs
    ALTER COLUMN seq SET NOT NULL,
    ALTER COLUMN row_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_seq ON public.audit_logs (seq);

CREATE OR REPLACE FUNCTION public.audit_logs_chain_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    last_row public.audit_logs;
BEGIN
    -- Serialise writers so two concurrent inserts can't share a predecessor.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.audit_logs.chain'));

    SELECT * INTO last_row FROM public.audit_logs ORDER BY seq DESC LIMIT 1;

    NEW.seq := COALESCE(last_row.seq, 0) + 1;
    NEW.prev_hash := last_row.row_hash;
    NEW.row_hash := public.audit_logs_compute_hash(NEW);
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS audit_logs_hash_chain ON public.audit_logs;
CREATE TRIGGER audit_logs_hash_chain
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.audit_logs_chain_on_insert();

-- Returns the seq of the first row whose stored hash or link is wrong, or NULL
-- when the whole chain is intact.
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    rec      public.audit_logs;
    expected text := NULL;
    n        bigint := 0;
BEGIN
    FOR rec IN SELECT * FROM public.audit_logs ORDER BY seq LOOP
        n := n + 1;
        IF rec.seq <> n
           OR rec.prev_hash IS DISTINCT FROM expected
           OR rec.row_hash <> public.audit_logs_compute_hash(rec) THEN
            RETURN rec.seq;
        END IF;
        expected := rec.row_hash;
    END LOOP;
    RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.verify_audit_chain() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO service_role;
