// HTTPS+CORS прокси к http://amc.x-crm.in.
// После деплоя URL воркера (https://amc-proxy.<account>.workers.dev) впишите в _config.yml: amc_proxy_base
const UPSTREAM = 'http://amc.x-crm.in';
const ALLOW_ORIGIN = '*';   // статус публичный; при желании сузьте до 'https://x-crm.in'
const STATUS_TTL = 10;      // сек кэширования статуса

function withCors(headers) {
  const h = new Headers(headers);
  h.set('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type');
  return h;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: withCors({}) });

    if (url.pathname === '/status') {
      const up = await fetch(UPSTREAM + '/status', { cf: { cacheTtl: STATUS_TTL } });
      const h = withCors(up.headers);
      h.set('Content-Type', 'application/json; charset=utf-8');
      h.set('Cache-Control', 'public, max-age=' + STATUS_TTL);
      return new Response(await up.text(), { status: up.status, headers: h });
    }

    return new Response('Not found', { status: 404, headers: withCors({}) });
  }
};