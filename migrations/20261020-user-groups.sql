-- Ejecutar en la base y rama de DATABASE_URL, con el mismo rol propietario.
-- Solo crea una tabla propia; no modifica Neon Auth, cuentas ni contenidos.
BEGIN;
CREATE TABLE IF NOT EXISTS public.huellas_user_preferences (
  user_id text PRIMARY KEY,
  study_group text NOT NULL CHECK (study_group IN ('adolescentes', 'intermedio', 'grande')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS huellas_user_preferences_group_idx
  ON public.huellas_user_preferences (study_group);
ALTER TABLE public.huellas_user_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.huellas_user_preferences FROM PUBLIC;
-- Sin políticas de acceso directo desde el navegador. El servidor utiliza el rol propietario,
-- valida la sesión y usa exclusivamente su user_id al consultar o guardar preferencias.
COMMIT;
