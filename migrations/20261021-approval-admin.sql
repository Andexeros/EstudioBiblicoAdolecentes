-- Ejecutar con el rol propietario de DATABASE_URL, en la misma base y rama de Huellas.
-- Lectura de neon_auth."user" solamente. No se modifican sus tablas ni sus identificadores.
BEGIN;
CREATE TABLE IF NOT EXISTS public.huellas_memberships (
  user_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','blocked')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('owner','admin','user')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deletion_id uuid,
  deletion_email text,
  CHECK (role <> 'owner' OR (status = 'approved' AND deletion_id IS NULL)),
  CHECK (deletion_id IS NULL OR status = 'blocked')
);
CREATE UNIQUE INDEX IF NOT EXISTS huellas_one_owner ON public.huellas_memberships (role) WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS huellas_memberships_status_role ON public.huellas_memberships (status, role);
CREATE TABLE IF NOT EXISTS public.huellas_admin_audit (
  id bigserial PRIMARY KEY,
  actor_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject','block','reactivate','set_group','grant_admin','revoke_admin','delete_requested','delete','delete_failed')),
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS huellas_audit_recent ON public.huellas_admin_audit (id DESC);
CREATE INDEX IF NOT EXISTS huellas_audit_target ON public.huellas_admin_audit (target_id, action);
CREATE TABLE IF NOT EXISTS public.huellas_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS huellas_limits_expiry ON public.huellas_rate_limits (window_started_at);

-- Idempotente: no vuelve a poner en pendiente a usuarios que ya fueron revisados.
INSERT INTO public.huellas_memberships (user_id, created_at)
SELECT id::text, "createdAt" FROM neon_auth."user" u
WHERE NOT EXISTS (SELECT 1 FROM public.huellas_admin_audit a WHERE a.target_id = u.id::text AND a.action = 'delete')
ON CONFLICT (user_id) DO NOTHING;

-- El correo solo identifica al propietario en la primera migración. Después manda su user_id.
DO $bootstrap$
DECLARE owner_id text; matches integer;
BEGIN
  SELECT user_id INTO owner_id FROM public.huellas_memberships WHERE role = 'owner';
  IF owner_id IS NULL THEN
    SELECT count(*), min(id::text) INTO matches, owner_id FROM neon_auth."user"
      WHERE lower(email) = 'abelpravata@gmail.com' AND "emailVerified" IS TRUE;
    IF matches <> 1 THEN
      RAISE EXCEPTION 'La migración se canceló: debe existir exactamente una cuenta verificada del propietario. No se cambió ninguna cuenta.';
    END IF;
    UPDATE public.huellas_memberships SET status = 'approved', role = 'owner', updated_at = now()
      WHERE user_id = owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'La migración se canceló: no se pudo vincular la cuenta propietaria.'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = owner_id AND "emailVerified" IS TRUE) THEN
    RAISE EXCEPTION 'La migración se canceló: revisá la identidad del propietario existente.';
  END IF;
END $bootstrap$;

CREATE OR REPLACE FUNCTION public.huellas_protect_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF OLD.role = 'owner' AND (TG_OP = 'DELETE' OR NEW.role <> 'owner' OR NEW.status <> 'approved'
      OR NEW.user_id <> OLD.user_id OR NEW.deletion_id IS NOT NULL) THEN
    RAISE EXCEPTION 'HUELLAS_OWNER_PROTECTED';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS huellas_protect_owner ON public.huellas_memberships;
CREATE TRIGGER huellas_protect_owner BEFORE UPDATE OR DELETE ON public.huellas_memberships
  FOR EACH ROW EXECUTE FUNCTION public.huellas_protect_owner();

CREATE OR REPLACE FUNCTION public.huellas_consume_limit(p_key text, p_limit integer, p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE hits integer;
BEGIN
  IF p_limit < 1 OR p_seconds < 1 THEN RAISE EXCEPTION 'HUELLAS_INVALID_ACTION'; END IF;
  INSERT INTO public.huellas_rate_limits AS r (key) VALUES (p_key)
  ON CONFLICT (key) DO UPDATE SET
    attempts = CASE WHEN r.window_started_at <= now() - make_interval(secs => p_seconds) THEN 1 ELSE least(r.attempts + 1, p_limit + 1) END,
    window_started_at = CASE WHEN r.window_started_at <= now() - make_interval(secs => p_seconds) THEN now() ELSE r.window_started_at END
  RETURNING attempts INTO hits;
  IF random() < 0.02 THEN DELETE FROM public.huellas_rate_limits WHERE window_started_at < now() - interval '2 days'; END IF;
  RETURN hits <= p_limit;
END $fn$;

CREATE OR REPLACE FUNCTION public.huellas_set_own_group(p_user text, p_group text)
RETURNS text LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE member public.huellas_memberships%ROWTYPE;
BEGIN
  SELECT * INTO member FROM public.huellas_memberships WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR member.status NOT IN ('pending','approved') OR member.deletion_id IS NOT NULL THEN
    RAISE EXCEPTION 'HUELLAS_ACCESS_DENIED';
  END IF;
  IF p_group NOT IN ('adolescentes','intermedio','grande') OR p_group IS NULL THEN RAISE EXCEPTION 'HUELLAS_INVALID_GROUP'; END IF;
  INSERT INTO public.huellas_user_preferences (user_id, study_group) VALUES (p_user, p_group)
    ON CONFLICT (user_id) DO UPDATE SET study_group = excluded.study_group, updated_at = now();
  UPDATE public.huellas_memberships SET updated_at = now(), version = version + 1 WHERE user_id = p_user;
  RETURN p_group;
END $fn$;

-- Una operación + su auditoría constituyen una sola transacción. Los bloqueos cierran carreras
-- con revocaciones de rol y con otras decisiones tomadas desde una lista desactualizada.
CREATE OR REPLACE FUNCTION public.huellas_admin_action(p_actor text, p_target text, p_action text,
  p_version integer, p_group text DEFAULT NULL, p_confirmation text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE actor public.huellas_memberships%ROWTYPE; target public.huellas_memberships%ROWTYPE;
  verified boolean; target_email text; inserted_count integer; old_group text; event_details jsonb; new_status text; new_role text;
BEGIN
  PERFORM user_id FROM public.huellas_memberships WHERE user_id IN (p_actor, p_target) ORDER BY user_id FOR UPDATE;
  SELECT * INTO actor FROM public.huellas_memberships WHERE user_id = p_actor;
  IF actor.user_id IS NULL OR actor.status <> 'approved' OR actor.role NOT IN ('owner','admin') OR actor.deletion_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = p_actor AND "emailVerified" IS TRUE) THEN
    RAISE EXCEPTION 'HUELLAS_FORBIDDEN';
  END IF;
  SELECT * INTO target FROM public.huellas_memberships WHERE user_id = p_target;
  IF NOT FOUND THEN
    INSERT INTO public.huellas_memberships (user_id)
      SELECT id::text FROM neon_auth."user" WHERE id::text = p_target
      AND NOT EXISTS (SELECT 1 FROM public.huellas_admin_audit WHERE target_id = p_target AND action = 'delete')
      ON CONFLICT (user_id) DO NOTHING;
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    SELECT * INTO target FROM public.huellas_memberships WHERE user_id = p_target FOR UPDATE;
  END IF;
  IF target.user_id IS NULL THEN RAISE EXCEPTION 'HUELLAS_USER_NOT_FOUND'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'HUELLAS_OWNER_PROTECTED'; END IF;
  IF actor.role <> 'owner' AND target.role <> 'user' THEN RAISE EXCEPTION 'HUELLAS_FORBIDDEN'; END IF;
  IF p_action NOT IN ('approve','reject','block','reactivate','set_group','grant_admin','revoke_admin','delete_prepare')
    OR p_action IS NULL THEN RAISE EXCEPTION 'HUELLAS_INVALID_ACTION'; END IF;
  IF p_action IN ('grant_admin','revoke_admin','delete_prepare') AND actor.role <> 'owner' THEN RAISE EXCEPTION 'HUELLAS_FORBIDDEN'; END IF;
  IF inserted_count = 1 AND p_version = 0 THEN p_version := target.version; END IF;
  IF target.version <> p_version OR p_version IS NULL THEN RAISE EXCEPTION 'HUELLAS_STALE_USER'; END IF;
  SELECT "emailVerified", email INTO verified, target_email FROM neon_auth."user" WHERE id::text = p_target;
  IF target.deletion_id IS NOT NULL THEN
    IF p_action <> 'delete_prepare' THEN RAISE EXCEPTION 'HUELLAS_DELETION_PENDING'; END IF;
    IF lower(coalesce(p_confirmation,'')) <> lower(target.deletion_email) THEN RAISE EXCEPTION 'HUELLAS_CONFIRMATION_REQUIRED'; END IF;
    RETURN jsonb_build_object('operationId',target.deletion_id,'version',target.version);
  END IF;
  IF target_email IS NULL THEN RAISE EXCEPTION 'HUELLAS_USER_NOT_FOUND'; END IF;
  IF p_action IN ('approve','reactivate','grant_admin') AND verified IS NOT TRUE THEN RAISE EXCEPTION 'HUELLAS_EMAIL_NOT_VERIFIED'; END IF;
  new_status := target.status; new_role := target.role;
  CASE p_action
    WHEN 'approve' THEN
      IF target.status <> 'pending' THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_status := 'approved';
    WHEN 'reject' THEN
      IF target.status <> 'pending' THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_status := 'rejected';
    WHEN 'block' THEN
      IF target.status = 'blocked' THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_status := 'blocked';
    WHEN 'reactivate' THEN
      IF target.status NOT IN ('blocked','rejected') THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_status := 'approved';
    WHEN 'grant_admin' THEN
      IF target.status <> 'approved' OR target.role <> 'user' THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_role := 'admin';
    WHEN 'revoke_admin' THEN
      IF target.role <> 'admin' THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
      new_role := 'user';
    WHEN 'set_group' THEN
      IF p_group NOT IN ('adolescentes','intermedio','grande') OR p_group IS NULL THEN RAISE EXCEPTION 'HUELLAS_INVALID_GROUP'; END IF;
      SELECT study_group INTO old_group FROM public.huellas_user_preferences WHERE user_id = p_target;
      INSERT INTO public.huellas_user_preferences (user_id, study_group) VALUES (p_target,p_group)
        ON CONFLICT (user_id) DO UPDATE SET study_group = excluded.study_group, updated_at = now();
    WHEN 'delete_prepare' THEN
      IF lower(coalesce(p_confirmation,'')) <> lower(target_email) THEN RAISE EXCEPTION 'HUELLAS_CONFIRMATION_REQUIRED'; END IF;
      new_status := 'blocked';
  END CASE;
  UPDATE public.huellas_memberships SET status = new_status, role = new_role,
    reviewed_by = p_actor, reviewed_at = now(), updated_at = now(), version = version + 1,
    deletion_id = CASE WHEN p_action = 'delete_prepare' THEN gen_random_uuid() ELSE deletion_id END,
    deletion_email = CASE WHEN p_action = 'delete_prepare' THEN target_email ELSE deletion_email END
    WHERE user_id = p_target RETURNING * INTO target;
  event_details := CASE WHEN p_action = 'set_group' THEN jsonb_build_object('previousGroup',old_group,'group',p_group)
    ELSE jsonb_build_object('status',new_status,'role',new_role) END;
  INSERT INTO public.huellas_admin_audit (actor_id,action,target_id,details)
    VALUES (p_actor,CASE WHEN p_action = 'delete_prepare' THEN 'delete_requested' ELSE p_action END,p_target,event_details);
  RETURN jsonb_build_object('operationId',target.deletion_id,'version',target.version,'status',target.status,'role',target.role);
END $fn$;

CREATE OR REPLACE FUNCTION public.huellas_finish_delete(p_actor text, p_target text, p_operation uuid, p_success boolean)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE actor public.huellas_memberships%ROWTYPE; target public.huellas_memberships%ROWTYPE;
BEGIN
  PERFORM user_id FROM public.huellas_memberships WHERE user_id IN (p_actor,p_target) ORDER BY user_id FOR UPDATE;
  SELECT * INTO actor FROM public.huellas_memberships WHERE user_id = p_actor;
  IF actor.role IS DISTINCT FROM 'owner' OR actor.status IS DISTINCT FROM 'approved'
    OR NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = p_actor AND "emailVerified" IS TRUE) THEN RAISE EXCEPTION 'HUELLAS_FORBIDDEN'; END IF;
  SELECT * INTO target FROM public.huellas_memberships WHERE user_id = p_target;
  IF NOT FOUND OR target.deletion_id IS DISTINCT FROM p_operation OR p_operation IS NULL THEN RAISE EXCEPTION 'HUELLAS_STALE_USER'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'HUELLAS_OWNER_PROTECTED'; END IF;
  IF p_success AND EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = p_target) THEN RAISE EXCEPTION 'HUELLAS_DELETE_INCOMPLETE'; END IF;
  INSERT INTO public.huellas_admin_audit (actor_id,action,target_id)
    VALUES (p_actor,CASE WHEN p_success THEN 'delete' ELSE 'delete_failed' END,p_target);
  IF p_success THEN
    DELETE FROM public.huellas_user_preferences WHERE user_id = p_target;
    DELETE FROM public.huellas_access WHERE user_id = p_target;
    DELETE FROM public.huellas_memberships WHERE user_id = p_target;
  END IF;
END $fn$;

ALTER TABLE public.huellas_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huellas_admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huellas_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.huellas_memberships, public.huellas_admin_audit, public.huellas_rate_limits FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.huellas_admin_audit_id_seq FROM PUBLIC;
REVOKE ALL ON FUNCTION public.huellas_protect_owner(), public.huellas_consume_limit(text,integer,integer),
  public.huellas_set_own_group(text,text), public.huellas_admin_action(text,text,text,integer,text,text),
  public.huellas_finish_delete(text,text,uuid,boolean) FROM PUBLIC;
COMMIT;
