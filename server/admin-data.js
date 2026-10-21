import { database } from './access.js';
import { databaseError } from './memberships.js';

export async function overview() {
  const sql = database();
  const rows = await sql`/* huellas:overview */ SELECT count(*)::int AS total,
    count(*) FILTER (WHERE coalesce(m.status,'pending') = 'pending')::int AS pending,
    count(*) FILTER (WHERE m.status = 'approved')::int AS approved,
    count(*) FILTER (WHERE m.status = 'rejected')::int AS rejected,
    count(*) FILTER (WHERE m.status = 'blocked')::int AS blocked,
    count(*) FILTER (WHERE u."createdAt" >= now() - interval '7 days')::int AS new7,
    count(*) FILTER (WHERE u."createdAt" >= now() - interval '30 days')::int AS new30,
    count(*) FILTER (WHERE p.study_group = 'adolescentes')::int AS adolescentes,
    count(*) FILTER (WHERE p.study_group = 'intermedio')::int AS intermedio,
    count(*) FILTER (WHERE p.study_group = 'grande')::int AS grande,
    count(*) FILTER (WHERE p.study_group IS NULL)::int AS unassigned
    FROM neon_auth."user" u LEFT JOIN public.huellas_memberships m ON m.user_id = u.id::text
    LEFT JOIN public.huellas_user_preferences p ON p.user_id = u.id::text`;
  return rows[0];
}
export async function audit(before = null) {
  const sql = database();
  const rows = await sql`/* huellas:audit */ SELECT a.id::text, a.actor_id, a.target_id, a.action, a.created_at, a.details,
    coalesce(actor_profile.full_name,actor.name) AS actor_name, coalesce(target_profile.full_name,target.name) AS target_name
    FROM public.huellas_admin_audit a
    LEFT JOIN neon_auth."user" actor ON actor.id::text = a.actor_id
    LEFT JOIN neon_auth."user" target ON target.id::text = a.target_id
    LEFT JOIN public.huellas_memberships actor_profile ON actor_profile.user_id = a.actor_id
    LEFT JOIN public.huellas_memberships target_profile ON target_profile.user_id = a.target_id
    WHERE (${before}::bigint IS NULL OR a.id < ${before}::bigint)
    ORDER BY a.id DESC LIMIT 51`;
  return { entries: rows.slice(0,50), next: rows.length > 50 ? String(rows[49].id) : null };
}
export async function mutate(actorId, targetId, action, version, group = null, confirmation = null) {
  const sql = database();
  try {
    const rows = await sql`/* huellas:action */ SELECT public.huellas_admin_action(${actorId},${targetId},${action},${version},${group},${confirmation}) AS result`;
    return rows[0].result;
  } catch (error) { throw databaseError(error); }
}
export async function finishDelete(actorId, targetId, operationId, success) {
  const sql = database();
  try { await sql`/* huellas:finish-delete */ SELECT public.huellas_finish_delete(${actorId},${targetId},${operationId}::uuid,${success})`; }
  catch (error) { throw databaseError(error); }
}
export async function identityExists(userId) {
  const sql=database();
  const rows=await sql`/* huellas:identity-exists */ SELECT EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text = ${userId}) AS present`;
  return rows[0]?.present !== false;
}
