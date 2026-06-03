// HTTPS+CORS прокси к http://amc.x-crm.in. Один воркер на app.x-crm.in:
//   /status        → статус Minecraft (JSON, кэш)
//   всё остальное  → BlueMap-карта (корневые ассеты) для встраивания фоном
// _config.yml: amc_proxy_base (статус) и bluemap_url (фон, тот же корень воркера).
const UPSTREAM = 'http://amc.x-crm.in';            // :80 — статус (Crafty через nginx)
const BLUEMAP = 'http://amc.x-crm.in:8100';        // BlueMap (порт 8100 → VPS:8100 через frp)
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

    // BlueMap — всё остальное (его ассеты корневые: /, /assets, /maps, /settings.json …)
    const init = { method: request.method, headers: request.headers, redirect: 'manual' };
    // Ассеты с хэшем в имени иммутабельны — кэшируем на edge Cloudflare (не тянем ~1 МБ JS через frp каждый раз)
    if (request.method === 'GET' && url.pathname.startsWith('/assets/')) {
      init.cf = { cacheEverything: true, cacheTtl: 86400 };
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
    const map = await fetch(BLUEMAP + url.pathname + url.search, init);
    const resp = new Response(map.body, map);
    resp.headers.delete('X-Frame-Options');               // чтобы карта встраивалась в <iframe>
    resp.headers.set('Content-Security-Policy', "frame-ancestors 'self' https://x-crm.in https://*.x-crm.in");
    return resp;
  }
};