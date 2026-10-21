export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function configuration() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL?.replace(/\/+$/, '');
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;
  const site = process.env.HUELLAS_SITE_URL || 'https://estudiobiblicoadolecentes.vercel.app';
  let auth, origin;
  try { auth = new URL(baseUrl); origin = new URL(site); } catch { /* Report only configuration status, never secrets. */ }
  if (!auth || auth.protocol !== 'https:' || auth.username || auth.password || !cookieSecret || cookieSecret.length < 32 || !origin ||
      (origin.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(origin.hostname))) {
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'El acceso está en preparación. Volvé a intentar en unos minutos.');
  }
  return { baseUrl, cookieSecret, origin: origin.origin, sameSite: 'lax', sessionDataTtl: 60 };
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: {
    'Cache-Control': 'private, no-store, max-age=0',
    'Vercel-CDN-Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders,
  } });
}

export function guard(request, config, methods) {
  if (!methods.includes(request.method)) throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
  const origin = request.headers.get('origin');
  if ((origin && origin !== config.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new HttpError(403, 'INVALID_ORIGIN', 'La solicitud no está permitida.');
  }
  if (request.method !== 'GET' && origin !== config.origin) throw new HttpError(403, 'INVALID_ORIGIN', 'La solicitud no está permitida.');
}

export async function bodyJSON(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'JSON_REQUIRED', 'La solicitud debe enviarse como JSON.');
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 16384) throw new HttpError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
  let data;
  try { data = JSON.parse(raw); } catch { throw new HttpError(400, 'INVALID_JSON', 'Revisá los datos e intentá nuevamente.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'INVALID_JSON', 'Revisá los datos e intentá nuevamente.');
  return data;
}

// Used by Vercel's Node functions and the local development server.
export async function fromNode(req, config) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (value === undefined || /^(host|connection|content-length|transfer-encoding|authorization)$/i.test(name) || /^(x-neon-|x-huellas-)/i.test(name)) continue;
    headers.set(name, Array.isArray(value) ? value.join('; ') : value);
  }
  const clientIp = process.env.VERCEL === '1' ? String(req.headers?.['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unavailable').split(',')[0].trim() : req.socket?.remoteAddress || 'unavailable';
  headers.set('x-huellas-client-ip', clientIp.slice(0,128));
  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    if (req.body !== undefined) body = Buffer.isBuffer(req.body) ? req.body : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    else {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 16384) throw new HttpError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
        chunks.push(Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }
    if (Buffer.byteLength(body || '') > 16384) throw new HttpError(413, 'BODY_TOO_LARGE', 'La solicitud es demasiado grande.');
  }
  const url = new URL(req.url || '/', config.origin);
  if (url.origin !== config.origin) throw new HttpError(400, 'INVALID_URL', 'Dirección no válida.');
  return new Request(url, { method: req.method || 'GET', headers, ...(body === undefined ? {} : { body, duplex: 'half' }) });
}

export async function toNode(res, response) {
  res.statusCode = response.status;
  for (const [key, value] of response.headers) {
    if (key !== 'set-cookie' && !['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(key)) res.setHeader(key, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('Set-Cookie', cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function nodeHandler(handler) {
  return async (req, res) => {
    try { const config = configuration(); await toNode(res, await handler(await fromNode(req, config), config)); }
    catch (error) {
      if (!(error instanceof HttpError)) console.error('Huellas API:', error.code || error.name || 'Error');
      await toNode(res, json({ code: error instanceof HttpError ? error.code : 'SERVICE_UNAVAILABLE',
        message: error instanceof HttpError ? error.message : 'No pudimos completar la solicitud. Intentá nuevamente.' }, error instanceof HttpError ? error.status : 503));
    }
  };
}
