-- Ejecutar después de 20261021-approval-email.sql, con el mismo rol, base y
-- rama de DATABASE_URL. No envía correos ni cambia aprobaciones al ejecutarse.
BEGIN;
CREATE OR REPLACE FUNCTION public.huellas_claim_approval_email(p_actor text, p_target text,
  p_version integer, p_manual boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE actor public.huellas_memberships%ROWTYPE; target public.huellas_memberships%ROWTYPE;
  notification public.huellas_approval_emails%ROWTYPE; verified boolean; address text; full_name text; current_group text;
BEGIN
  PERFORM user_id FROM public.huellas_memberships WHERE user_id IN (p_actor,p_target) ORDER BY user_id FOR UPDATE;
  SELECT * INTO actor FROM public.huellas_memberships WHERE user_id = p_actor;
  IF actor.user_id IS NULL OR actor.status <> 'approved' OR actor.role NOT IN ('owner','admin') OR actor.deletion_id IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id::text = p_actor AND "emailVerified" IS TRUE)
    OR (actor.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text = p_actor AND "providerId" = 'google')) THEN
    RAISE EXCEPTION 'HUELLAS_FORBIDDEN';
  END IF;
  SELECT * INTO target FROM public.huellas_memberships WHERE user_id = p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'HUELLAS_USER_NOT_FOUND'; END IF;
  IF target.role = 'owner' THEN RAISE EXCEPTION 'HUELLAS_OWNER_PROTECTED'; END IF;
  IF actor.role <> 'owner' AND target.role <> 'user' THEN RAISE EXCEPTION 'HUELLAS_FORBIDDEN'; END IF;
  IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'HUELLAS_STALE_USER'; END IF;
  IF target.status <> 'approved' OR target.deletion_id IS NOT NULL THEN RAISE EXCEPTION 'HUELLAS_INVALID_TRANSITION'; END IF;
  SELECT u."emailVerified", u.email, coalesce(target.full_name,u.name), p.study_group
    INTO verified, address, full_name, current_group FROM neon_auth."user" u
    LEFT JOIN public.huellas_user_preferences p ON p.user_id = u.id::text WHERE u.id::text = p_target;
  IF verified IS NOT TRUE OR address IS NULL THEN RAISE EXCEPTION 'HUELLAS_EMAIL_NOT_VERIFIED'; END IF;
  IF target.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" WHERE "userId"::text = p_target AND "providerId" = 'google') THEN
    RAISE EXCEPTION 'HUELLAS_PROFILE_REQUIRED';
  END IF;
  SELECT * INTO notification FROM public.huellas_approval_emails WHERE user_id = p_target
    ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    -- Solo una acción manual crea la bienvenida de una cuenta antigua. El
    -- bloqueo de la cuenta serializa clics simultáneos, incluso de dos admins.
    IF p_manual IS NOT TRUE THEN RETURN jsonb_build_object('status','not_applicable'); END IF;
    INSERT INTO public.huellas_approval_emails (user_id, approval_version)
      VALUES (p_target,p_version) RETURNING * INTO notification;
  END IF;
  -- Un formulario antiguo o una petición repetida tampoco reenvían un éxito.
  -- sent_at conserva la evidencia de un envío previo de esta notificación.
  IF p_manual AND (notification.status = 'sent' OR notification.sent_at IS NOT NULL) THEN
    RETURN jsonb_build_object('status','already_sent');
  END IF;
  IF p_manual IS NOT TRUE AND (notification.status <> 'queued' OR notification.attempts <> 0 OR notification.approval_version <> p_version) THEN
    RETURN jsonb_build_object('status','unchanged');
  END IF;
  IF notification.status = 'sending' AND notification.attempted_at > now() - interval '2 minutes' THEN
    RETURN jsonb_build_object('status','sending');
  END IF;
  IF p_manual AND notification.attempted_at > now() - interval '5 minutes'
    AND notification.error_code IS DISTINCT FROM 'SMTP_NOT_CONFIGURED' THEN
    RETURN jsonb_build_object('status','cooldown');
  END IF;
  UPDATE public.huellas_approval_emails SET status = 'sending', attempts = attempts + 1,
    attempt_id = gen_random_uuid(), attempted_at = now(), attempted_by = p_actor, error_code = NULL,
    recipient_email = address, recipient_name = full_name, study_group = current_group
    WHERE id = notification.id RETURNING * INTO notification;
  RETURN jsonb_build_object('status','claimed','id',notification.id,'attemptId',notification.attempt_id,
    'email',notification.recipient_email,'name',notification.recipient_name,'groupId',notification.study_group);
END $fn$;

REVOKE ALL ON FUNCTION public.huellas_claim_approval_email(text,text,integer,boolean) FROM PUBLIC;
COMMIT;
