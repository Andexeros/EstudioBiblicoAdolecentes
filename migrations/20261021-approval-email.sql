-- Misma base, rama y rol propietario que DATABASE_URL. Aplicar después de las
-- migraciones de grupos, aprobaciones y perfil de Google. No modifica Neon Auth.
BEGIN;
CREATE TABLE IF NOT EXISTS public.huellas_approval_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.huellas_memberships(user_id) ON DELETE CASCADE,
  approval_version integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','uncertain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  attempt_id uuid,
  attempted_at timestamptz,
  attempted_by text,
  sent_at timestamptz,
  recipient_email text,
  recipient_name text,
  study_group text,
  message_id text,
  error_code text,
  UNIQUE (user_id, approval_version)
);
CREATE INDEX IF NOT EXISTS huellas_approval_emails_user ON public.huellas_approval_emails (user_id, created_at DESC, id DESC);

-- La notificación se registra en la misma transacción que la aprobación.
-- No se recorren ni se notifican las cuentas aprobadas antes de instalar esto.
CREATE OR REPLACE FUNCTION public.huellas_queue_approval_email() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
BEGIN
  INSERT INTO public.huellas_approval_emails (user_id, approval_version)
    VALUES (NEW.user_id, NEW.version) ON CONFLICT (user_id, approval_version) DO NOTHING;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS huellas_queue_approval_email ON public.huellas_memberships;
CREATE TRIGGER huellas_queue_approval_email AFTER UPDATE OF status ON public.huellas_memberships
  FOR EACH ROW WHEN (OLD.status = 'pending' AND NEW.status = 'approved')
  EXECUTE FUNCTION public.huellas_queue_approval_email();

-- El bloqueo serializa los intentos y vuelve a comprobar permisos, versión,
-- estado y correo verificado. Nunca acepta un destinatario desde el navegador.
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
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_applicable'); END IF;
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

CREATE OR REPLACE FUNCTION public.huellas_finish_approval_email(p_id uuid, p_attempt uuid,
  p_status text, p_message text, p_error text) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF p_status NOT IN ('sent','failed','uncertain') OR p_status IS NULL THEN RAISE EXCEPTION 'HUELLAS_INVALID_ACTION'; END IF;
  UPDATE public.huellas_approval_emails SET status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    message_id = CASE WHEN p_status = 'sent' THEN left(p_message,512) ELSE message_id END,
    error_code = left(p_error,64)
    WHERE id = p_id AND attempt_id = p_attempt AND status = 'sending';
  RETURN FOUND;
END $fn$;

ALTER TABLE public.huellas_approval_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.huellas_approval_emails FROM PUBLIC;
REVOKE ALL ON FUNCTION public.huellas_queue_approval_email(),
  public.huellas_claim_approval_email(text,text,integer,boolean),
  public.huellas_finish_approval_email(uuid,uuid,text,text,text) FROM PUBLIC;
COMMIT;
