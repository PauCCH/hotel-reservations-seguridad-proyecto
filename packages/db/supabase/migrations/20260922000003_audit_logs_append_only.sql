-- Harden public.audit_logs as append-only (audit finding: tamper-resistance).
-- The table already has RLS enabled with a SELECT-only policy for admins and no
-- UPDATE/DELETE policies. This migration adds defence in depth for roles that
-- bypass RLS (service_role) or hold broad default grants.

-- 1. Privileges: nobody that talks to PostgREST can modify or wipe history.
--    INSERT stays with service_role (used by logAuditEvent); SELECT stays with
--    authenticated (RLS-gated) and service_role (used by getAuditLogs).
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT ON public.audit_logs FROM anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;

-- 2. Explicitly document that no write policies exist for client roles.
--    (Policies are not created for UPDATE/DELETE/INSERT: RLS denies by default.)

-- 3. Trigger guard: also blocks the table owner / superuser-less paths that
--    ignore grants. The only permitted UPDATE is the referential action
--    `ON DELETE SET NULL` on actor_id (deleting an auth user nulls the link and
--    must not fail); any other column change is rejected.
CREATE OR REPLACE FUNCTION public.audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.actor_id IS NULL
           AND OLD.actor_id IS NOT NULL
           AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update_delete
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.audit_logs_block_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON public.audit_logs;
CREATE TRIGGER audit_logs_no_truncate
    BEFORE TRUNCATE ON public.audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION public.audit_logs_block_mutation();
