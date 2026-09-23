CREATE TABLE public.audit_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    actor_email TEXT,
    action     TEXT NOT NULL,
    entity     TEXT,
    entity_id  TEXT,
    metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_actor_id   ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_action     ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_select"
    ON public.audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin_or_owner() AND public.has_permission('audit:view'));
-- No INSERT/UPDATE/DELETE policies: service_role bypasses RLS; table is append-only.

-- Extend owner permission seeding to include the new audit:view permission,
-- and backfill any existing owner so the RLS SELECT policy above does not
-- lock the owner out of the audit log.
CREATE OR REPLACE FUNCTION public.set_owner_permissions(owner_id uuid)
RETURNS void
language plpgsql
security definer
set search_path = ''
as $$
BEGIN
    INSERT INTO public.user_permissions (user_id, permission, granted_by)
    VALUES
        (owner_id, 'view:dashboard', null),
        (owner_id, 'reservations:view', null),
        (owner_id, 'reservations:edit', null),
        (owner_id, 'reservations:delete', null),
        (owner_id, 'admins:view', null),
        (owner_id, 'admins:invite', null),
        (owner_id, 'admins:disable', null),
        (owner_id, 'admins:revoke', null),
        (owner_id, 'cms:manage', null),
        (owner_id, 'permissions:manage', null),
        (owner_id, 'rooms:manage', null),
        (owner_id, 'invoices:view', null),
        (owner_id, 'clients:view', null),
        (owner_id, 'audit:view', null)
    ON CONFLICT (user_id, permission) DO NOTHING;
END $$;

-- Backfill existing owner with the new permission
DO $$
DECLARE
    owner_user_id uuid;
BEGIN
    SELECT ur.user_id
    INTO owner_user_id
    FROM public.user_roles as ur
    WHERE role = 'owner'
    LIMIT 1;

    IF owner_user_id IS NOT NULL THEN
        PERFORM set_owner_permissions(owner_user_id);
    END IF;
END $$;
