import { neon } from '@neondatabase/serverless';
import { HttpError } from './http.js';
import { groupById } from '../groups.js';

export function database() {
  if (!process.env.DATABASE_URL) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'El acceso está en preparación. Volvé a intentar en unos minutos.');
  return neon(process.env.DATABASE_URL);
}

export async function recordAccess(userId) {
  const sql = database();
  await sql`INSERT INTO public.huellas_access (user_id) VALUES (${userId})
    ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now()`;
}

export async function registeredUsers(offset = 0, group = '', filters = {}) {
  if (group && group !== 'unassigned' && !groupById(group)) throw new HttpError(400, 'INVALID_GROUP', 'El filtro de grupo no es válido.');
  const { status = '', role = '', search = '', sort = 'registered_desc' } = filters;
  if (status && !['pending','approved','rejected','blocked'].includes(status)) throw new HttpError(400,'INVALID_FILTER','El estado no es válido.');
  if (role && !['owner','admin','user'].includes(role)) throw new HttpError(400,'INVALID_FILTER','El rol no es válido.');
  if (!['registered_desc','registered_asc','last_seen_desc','last_seen_asc'].includes(sort)) throw new HttpError(400,'INVALID_SORT','El orden no es válido.');
  if (search.length > 160) throw new HttpError(400,'INVALID_SEARCH','La búsqueda es demasiado larga.');
  const sql = database();
  const rows = await sql`/* huellas:users */ SELECT coalesce(u.id::text,m.user_id) AS id,
    coalesce(m.full_name,u.name,'Eliminación pendiente') AS name, coalesce(u.email,m.deletion_email) AS email,
    u."emailVerified" IS TRUE AS "emailVerified", coalesce(u."createdAt",m.created_at) AS "createdAt",
    a.first_seen_at, a.last_seen_at, p.study_group, coalesce(m.status,'pending') AS status,
    coalesce(m.role,'user') AS role, coalesce(m.version,0) AS version,
    m.deletion_id IS NOT NULL AS "deletionPending",
    (m.name_confirmed_at IS NULL AND EXISTS (SELECT 1 FROM neon_auth."account" ga WHERE ga."userId"::text = u.id::text AND ga."providerId" = 'google')) AS "needsNameConfirmation",
    count(*) OVER () AS total
    FROM neon_auth."user" u FULL OUTER JOIN public.huellas_memberships m ON m.user_id = u.id::text
    LEFT JOIN public.huellas_access a ON a.user_id = coalesce(u.id::text,m.user_id)
    LEFT JOIN public.huellas_user_preferences p ON p.user_id = coalesce(u.id::text,m.user_id)
    WHERE (u.id IS NOT NULL OR m.deletion_id IS NOT NULL)
      AND (${group}::text = '' OR p.study_group = ${group} OR (${group}::text = 'unassigned' AND p.study_group IS NULL))
      AND (${status}::text = '' OR coalesce(m.status,'pending') = ${status})
      AND (${role}::text = '' OR coalesce(m.role,'user') = ${role})
      AND (${search}::text = '' OR position(lower(${search}) in lower(coalesce(m.full_name,u.name,'') || ' ' || coalesce(u.email,m.deletion_email,''))) > 0)
    ORDER BY CASE WHEN ${sort} = 'registered_desc' THEN coalesce(u."createdAt",m.created_at) END DESC NULLS LAST,
      CASE WHEN ${sort} = 'registered_asc' THEN coalesce(u."createdAt",m.created_at) END ASC NULLS LAST,
      CASE WHEN ${sort} = 'last_seen_desc' THEN a.last_seen_at END DESC NULLS LAST,
      CASE WHEN ${sort} = 'last_seen_asc' THEN a.last_seen_at END ASC NULLS LAST,
      coalesce(u.id::text,m.user_id) DESC LIMIT 51 OFFSET ${offset}`;
  return { users: rows.slice(0,50), hasMore: rows.length > 50, total: Number(rows[0]?.total || 0), offset };
}
