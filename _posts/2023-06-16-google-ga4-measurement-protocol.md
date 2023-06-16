---
layout: post
title: "Пробрасываем сессию пользователя в Google Tag Manager"
description: "Через Measurement Protocol"
tags: coding
---
# Пробрасываем сессию пользователя в Google Tag Manager через Measurement Protocol
0. За основу берём [эту статью](https://trackingchef.com/google-analytics/how-to-add-session-id-to-ga4-measurement-protocol-events/)
1. Собираем данные с фронта в **base64** строку, что бы **cloudflare** не блокировал этот набор данных.

```js
function getCookieByPrefix(prefix) {
    let cookies = document.cookie.split(';');
    let searchKey = '';
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.startsWith(prefix)) {
        let keyValue = cookie.split('=');
        let value = keyValue[0];
        if(value){
            searchKey = value;
        }
      }
    }
    return searchKey;
}

function getSessionData(id) {
	let regex = new RegExp(id + "=GS\\d\\.\\d\\.(.+?)(?:;|$)");
	const match = document.cookie.match(regex);
	const parts = match?.[1].split(".");

	if (!parts) {
		window.setTimeout(() => getSessionData(id), 200);
		return;
	}

	return parts.shift();
}

let trueSession_id = ''
let dataG4 = '';
let encoded = '';
try {
    if(!trueSession_id){
        let searchKeyBycookie = getCookieByPrefix('_ga_');
        trueSession_id = getSessionData(searchKeyBycookie) || '';
    }
    dataG4 = {
        "cid": gaGlobal?.vid,
        "sid": trueSession_id,
        'ul':  navigator.language || navigator.userLanguage,
        'sr':  screen.width + 'x' + screen.height,
        'uaa': google_tag_data?.uach?.architecture,
        'uab': parseInt(google_tag_data?.uach?.bitness),
        'uafvl': google_tag_data?.uach?.fullVersionList.map(({ brand, version }) => `${brand};${version}`).join('| '),
        'uap': google_tag_data?.uach?.platform,
        'uapv': google_tag_data?.uach?.platformVersion,
        'cu': window.cur_currency || 'USD',
        'dl': document.location.href,
        'dr': document.referrer || '',
        'dt': document.title,
        'en': 'purchase',
    };
    encoded = Base64.encode(JSON.stringify(dataG4))
    
} catch(e){
    console.warn(e);
}

```

1. На бэке сохраняем эти данные в доп.поле к заказу
2. Для отправки используем библиотеку [php-ga4](https://github.com/aawnu/php-ga4)
3. В итоге должен получиться вот такой набор данных, который отправляется на endpoint `https://www.google-analytics.com/mp/collect?measurement_id=G-0*********&api_secret=*********************`
   * **session_id** должен быть числом (т.е. без кавычек в json)

```json
{
  "non_personalized_ads": false,
  "client_id": "601471748.1686739658",
  "user_properties": {
    "uafvl": {
      "value": "Not.A/Brand;8.0.0.0| Chromium;114.0.5735.60| Google Chrome;114.0.5735.60"
    },
    "uap": {
      "value": "Android"
    },
    "uapv": {
      "value": "8.1.0"
    }
  },
  "events": [
    {
      "name": "purchase",
      "params": {
        "language": "pt-BR",
        "page_location": "https://site.com/",
        "page_referrer": "android-app://org.telegram.messenger/",
        "page_title": "Заголовок страницы",
        "screen_resolution": "360x640",
        "session_id": 1686739658,
        "engagement_time_msec": "1000",
        "currency": "USD",
        "transaction_id": 12399321,
        "value": 45.54,
        "affiliation": "User",
        "coupon": "",
        "shipping": 0,
        "tax": 0,
        "items": [
          {
            "item_id": "123456",
            "item_name": "Название товара",
            "currency": "USD",
            "item_category": "Категория товара",
            "price": 45.54,
            "quantity": 1
          }
        ]
      }
    }
  ]
}
```
