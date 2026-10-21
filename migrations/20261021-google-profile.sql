-- Misma base, rama y rol propietario de DATABASE_URL. Ejecutar después de la migración de aprobaciones.
-- Solo se alteran tablas y funciones propias de Huellas. Neon Auth se consulta en modo lectura.
BEGIN;
ALTER TABLE public.huellas_memberships ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.huellas_memberships ADD COLUMN IF NOT EXISTS name_confirmed_at timestamptz;
DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.huellas_memberships'::regclass AND conname='huellas_confirmed_name') THEN
    ALTER TABLE public.huellas_memberships ADD CONSTRAINT huellas_confirmed_name CHECK (
      (full_name IS NULL AND name_confirmed_at IS NULL) OR
      (full_name IS NOT NULL AND name_confirmed_at IS NOT NULL AND char_length(full_name) BETWEEN 3 AND 100));
  END IF;
END $check$;

CREATE OR REPLACE FUNCTION public.huellas_confirm_name(p_user text,p_name text)
RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,public AS $fn$
DECLARE member public.huellas_memberships%ROWTYPE;
BEGIN
  SELECT * INTO member FROM public.huellas_memberships WHERE user_id=p_user FOR UPDATE;
  IF NOT FOUND OR member.status NOT IN ('pending','approved') OR member.deletion_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text=p_user AND "emailVerified" IS TRUE)
    OR NOT EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text=p_user AND "providerId"='google') THEN
    RAISE EXCEPTION 'HUELLAS_ACCESS_DENIED';
  END IF;
  IF member.name_confirmed_at IS NOT NULL THEN
    IF member.full_name IS DISTINCT FROM p_name THEN RAISE EXCEPTION 'HUELLAS_PROFILE_CONFIRMED'; END IF;
    RETURN;
  END IF;
  IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'HUELLAS_INVALID_ACTION'; END IF;
  UPDATE public.huellas_memberships SET full_name=p_name,name_confirmed_at=now(),updated_at=now(),version=version+1 WHERE user_id=p_user;
END $fn$;

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
  IF actor.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text=p_actor AND "providerId"='google') THEN RAISE EXCEPTION 'HUELLAS_PROFILE_REQUIRED'; END IF;
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
  IF p_action IN ('approve','grant_admin') AND target.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text=p_target AND "providerId"='google') THEN RAISE EXCEPTION 'HUELLAS_PROFILE_REQUIRED'; END IF;
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
      -- A blocked/rejected applicant who never confirmed their Google name returns
      -- to onboarding and review; ordinary reactivation still preserves approval.
      IF target.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text=p_target AND "providerId"='google') THEN new_status := 'pending'; END IF;
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

REVOKE ALL ON FUNCTION public.huellas_confirm_name(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.huellas_admin_action(text,text,text,integer,text,text) FROM PUBLIC;
COMMIT;
