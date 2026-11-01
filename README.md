# blog
Материалы тут [https://x-crm.in/](/_posts/)

## Спойлер с паролем

### Весь пост под паролем

В front matter добавить поле `password`:

```yaml
---
layout: post
title: "Секретная статья"
password: secret123
---
Контент статьи...
```

Виден только заголовок и форма ввода пароля. Контент появляется после ввода правильного пароля.

### Отдельный блок внутри поста

Обернуть контент в `<div class="spoiler">` с атрибутом `data-password`:

```html
Обычный текст поста...

<div class="spoiler" data-password="hackme">
Скрытый контент блока
</div>

Продолжение обычного текста...
```

Каждый блок имеет свой пароль и свою форму ввода.

## llms.txt

[`/llms.txt`](https://x-crm.in/llms.txt) ([формат llmstxt.org](https://llmstxt.org/)) - список избранных статей для ИИ-ассистентов и агентов.

Статья попадает туда, если в front matter есть `llms: true`. Пояснение к ссылке берётся из `description`, а если для ИИ нужно другое (например, подзаголовок шуточный) - из `llms_description`:

```yaml
---
layout: post
title: "Название статьи"
description: "Шуточный подзаголовок"
llms: true
llms_description: "О чём статья на самом деле: что настраиваем, на чём и чем проверяем"
---
```

Скрытые статьи (`hidden: true`) в llms.txt не попадают, даже с `llms: true`.

## Пометка «при участии ИИ»

В front matter добавить поле `ai`:

```yaml
---
layout: post
title: "Статья"
ai: true
---
```

Рядом с датой появится шестигранник, по наведению или тапу - подсказка «Подготовлено при участии ИИ, проверено автором». Такой же значок появится на карточке статьи на главной и в списке /blog, а в `<head>` - машиночитаемая метка: `<meta name="ai-disclosure">` и `digitalSourceType` в JSON-LD. Тексты и значения - в `_data/ai_mark.yml`.

## Дата обновления

После заметной правки статьи (не опечатки) добавить в front matter поле `last_modified_at`:

```yaml
---
layout: post
title: "Статья"
last_modified_at: 2026-11-01
---
```

Дата попадёт в `dateModified` (JSON-LD) и в `lastmod` статьи в sitemap.xml - поисковики узнают, что статью стоит переобойти. Без поля обе даты равны дате публикации.

## Картинка превью

Ссылки на сайт в Telegram, VK и соцсетях показываются с картинкой [`/assets/images/og/default.jpg`](https://x-crm.in/assets/images/og/default.jpg) (1200×630, консоль с баннером CRIMSON). Она задана всем страницам в `defaults` в `_config.yml` и попадает в `og:image`, `twitter:image` и JSON-LD.

Своя картинка у статьи - поле `image` в front matter, путь строкой:

```yaml
---
layout: post
title: "Статья"
image: /assets/blog/статья/cover.jpg
---
```

Лучше 1200×630 и не тяжелее 300 КБ - WhatsApp может не показать картинку тяжелее. Блоком с `width`, `height` или `alt` не указывать: jekyll-seo-tag 2.8 запишет её в JSON-LD с типом `imageObject`, которого нет в schema.org.

Telegram запоминает превью ссылки: чтобы обновить его у уже отправленной ссылки, отправьте её боту `@WebpageBot`.

## IndexNow

После пуша в `main`, в котором менялись статьи (`_posts`), GitHub Actions ([`.github/workflows/indexnow.yml`](.github/workflows/indexnow.yml)) ждёт, пока GitHub Pages выкатит сайт, и отправляет в [IndexNow](https://www.indexnow.org/) адреса добавленных, изменённых и удалённых статей, а с ними главную и /blog. Яндекс, Bing и другие поисковики IndexNow приходят на эти страницы раньше, чем сами нашли бы их в sitemap.xml. Скрытые статьи (`hidden: true`) не отправляются. Google в IndexNow не участвует.

Ручной запуск (Actions → IndexNow → Run workflow) отправляет все адреса из sitemap.xml.

Ключ - файл `625fb6db8a34ee31728c826cce0ad2bf.txt` в корне сайта (имя и содержимое совпадают): по нему поисковики проверяют, что адреса прислал владелец сайта. Без него запросы не примут.
