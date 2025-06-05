---
layout: post
title: "Получить из Google Tag Manager - client_id, session_id, gclid"
description: "gtag.js"
tags: google js tgm
---

# Получить из Google Tag Manager (GTM) - client_id, session_id, gclid

Есть несколько способов как это сделать:

1. Используя [gtag.js](https://developers.google.com/tag-platform/gtagjs) (его нужно подключать отдельно, в комплекте с гугл аналитикой не идёт)
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=TAG_ID"></script>
<script>
  const gTagId = 'TAG_ID';
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', gTagId);
	gtag('get', gTagId, 'client_id', function(e) { console.log("GTM client_id", e); });
	gtag('get', gTagId, 'session_id', function(e) { console.log("GTM session_id", e); });
	gtag('get', gTagId, 'gclid', function(e) { console.log("GTM gclid", e); });
</script>
```

2. Использовать шаблон внутри Google Tag Manager - [GTAG GET API](https://www.simoahava.com/custom-templates/gtag-get-api/)

3. Парсить куки
```js
/**
 * Разбирает cookie вида _ga или _ga_G-XXXX и возвращает именованный объект
 * @param {string} cookieValue – строковое содержимое cookie
 */
function parseGaCookie(cookieValue = "") {
  const res = { cookie_content: String(cookieValue) };

  const onlyVal = part => (part && part.length > 1 ? part.slice(1) : undefined);
  const nowSec = Math.round(Date.now() / 1000);

  if (cookieValue.startsWith("GS2.1")) {
    // формат GA4 (GS2.1.*)
    const info = (cookieValue.split(".")[2] || "");
    const parts = info.split("$");

    const pick = prefix => onlyVal(parts.find(p => p.startsWith(prefix)));

    const ts = pick("t");
    Object.assign(res, {
      session_id:      pick("s"),
      session_number:  pick("o"),
      session_engaged: pick("g"),
      user_id_hash:    pick("h"),
      timestamp:       ts,
      duration:        ts ? nowSec - Number(ts) : undefined
    });

  } else {
    // старый Universal Analytics формат
    const parts = cookieValue.split(".");
    const ts = parts[5];

    Object.assign(res, {
      session_id:     parts[2],
      session_number: parts[3],
      timestamp:      ts,
      duration:       ts ? nowSec - Number(ts) : undefined
    });
  }

  return res;
}
```