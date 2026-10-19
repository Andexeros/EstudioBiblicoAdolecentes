import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';

function database() {
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'El acceso está en preparación. Volvé a intentar en unos minutos.');
  return neon(process.env.DATABASE_URL);
}

export async function recordAccess(userId) {
  const sql = database();
  await sql`INSERT INTO public.huellas_access (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`;
}

export async function registeredUsers(offset = 0) {
  const sql = database();
  const rows = await sql`SELECT u.id, u.name, u.email, u."emailVerified", u."createdAt",
      a.first_seen_at, a.last_seen_at, count(*) OVER () AS total
    FROM neon_auth."user" AS u
    LEFT JOIN public.huellas_access AS a ON a.user_id = u.id::text
    ORDER BY u."createdAt" DESC, u.id DESC LIMIT 51 OFFSET ${offset}`;
  return { users: rows.slice(0, 50), hasMore: rows.length > 50, total: Number(rows[0]?.total || 0), offset };
}
