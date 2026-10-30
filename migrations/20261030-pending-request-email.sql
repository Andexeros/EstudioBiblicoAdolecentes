-- Misma base, rama y rol propietario que DATABASE_URL.
-- Ejecutar después de las migraciones actuales de grupos, aprobación y Google.
-- No modifica Neon Auth, cuentas, preferencias, roles ni aprobaciones.
BEGIN;
CREATE TABLE IF NOT EXISTS public.huellas_pending_request_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE REFERENCES public.huellas_memberships(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','sent','failed','uncertain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempt_id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  applicant_email text NOT NULL,
  applicant_name text NOT NULL,
  study_group text NOT NULL CHECK (study_group IN ('adolescentes','intermedio','grande')),
  message_id text,
  error_code text
);

CREATE OR REPLACE FUNCTION public.huellas_claim_pending_request_email(p_user text) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
DECLARE member public.huellas_memberships%ROWTYPE;
  notification public.huellas_pending_request_emails%ROWTYPE;
  verified boolean; address text; person text; current_group text;
BEGIN
  -- Serialize with group changes, approval, blocking and deletion. The caller
  -- is the private server using the authenticated ID, never a browser SQL role.
  SELECT * INTO member FROM public.huellas_memberships WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND OR member.status <> 'pending' OR member.deletion_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','not_applicable');
  END IF;
  SELECT u."emailVerified", u.email, coalesce(member.full_name,u.name), p.study_group
    INTO verified, address, person, current_group FROM neon_auth."user" u
    LEFT JOIN public.huellas_user_preferences p ON p.user_id = u.id::text WHERE u.id::text = p_user;
  IF verified IS NOT TRUE OR address IS NULL OR person IS NULL OR char_length(btrim(person)) NOT BETWEEN 3 AND 100
    OR current_group IS NULL OR current_group NOT IN ('adolescentes','intermedio','grande')
    OR (member.name_confirmed_at IS NULL AND EXISTS (
      SELECT 1 FROM neon_auth."account" WHERE "userId"::text = p_user AND "providerId" = 'google')) THEN
    RETURN jsonb_build_object('status','not_applicable');
  END IF;
  -- A failed, ambiguous or still-running attempt also occupies this key.
  -- Refreshes, another device and a new group never create a second email.
  INSERT INTO public.huellas_pending_request_emails (user_id,applicant_email,applicant_name,study_group)
    VALUES (p_user,address,person,current_group) ON CONFLICT (user_id) DO NOTHING RETURNING * INTO notification;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unchanged'); END IF;
  RETURN jsonb_build_object('status','claimed','id',notification.id,'attemptId',notification.attempt_id,
    'applicantEmail',notification.applicant_email,'name',notification.applicant_name,'groupId',notification.study_group);
END $fn$;

CREATE OR REPLACE FUNCTION public.huellas_finish_pending_request_email(p_id uuid, p_attempt uuid,
  p_status text, p_message text, p_error text) RETURNS boolean
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('sent','failed','uncertain') THEN RAISE EXCEPTION 'HUELLAS_INVALID_ACTION'; END IF;
  UPDATE public.huellas_pending_request_emails SET status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE NULL END,
    message_id = CASE WHEN p_status = 'sent' THEN left(p_message,512) ELSE NULL END,
    error_code = left(p_error,64)
    WHERE id = p_id AND attempt_id = p_attempt AND status = 'sending';
  RETURN FOUND;
END $fn$;

ALTER TABLE public.huellas_pending_request_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.huellas_pending_request_emails FROM PUBLIC;
REVOKE ALL ON FUNCTION public.huellas_claim_pending_request_email(text),
  public.huellas_finish_pending_request_email(uuid,uuid,text,text,text) FROM PUBLIC;
COMMIT;
