# amc-proxy (Cloudflare Worker)

HTTPS+CORS прокси к HTTP-эндпоинту `http://amc.x-crm.in`, чтобы страница `/minecraft-server`
(сайт x-crm.in работает по HTTPS) могла без mixed content получать статус и файл клиента.

- **Развёрнут на:** https://app.x-crm.in
- **Маршруты:**
  - `GET /status`   → проксирует `http://amc.x-crm.in/status` (JSON, кэш 10 c)
  - всё остальное   → проксирует BlueMap (`http://amc.x-crm.in:8100`) для фон-карты
- URL прокси прописан в `_config.yml` → `amc_proxy_base` (статус) и `bluemap_url` (фон, тот же корень воркера).

## Деплой
- Dashboard: Workers & Pages → Create Worker → вставить `amc-proxy.js` → Deploy.
- Или wrangler: `npx wrangler deploy amc-proxy.js --name amc-proxy --compatibility-date 2024-01-01`.

> Каталог `_cloudflare/` начинается с `_`, поэтому Jekyll не копирует его в собранный сайт.
