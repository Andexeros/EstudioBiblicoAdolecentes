-- Ejecutar una sola vez en el SQL Editor de Neon, rama production, base neondb.
-- Usuarios y contraseñas siguen administrados por Neon Auth.
CREATE TABLE IF NOT EXISTS public.huellas_access (
  user_id text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.huellas_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.huellas_access FROM PUBLIC;

-- Sin políticas de acceso para el navegador. Solo accede el servidor de Huellas.
