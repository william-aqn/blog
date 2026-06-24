---
layout: post
title: "Jekyll виджет: Генератор QR-кодов"
description: "Расширяем возможности блога"
tags: jekyll widget qr javascript
---

# Jekyll виджет: Генератор QR-кодов

Понадобился мне генератор qr кодов. Сказано - сделано!
В основе [qr-code-styling](https://github.com/kozakdenys/qr-code-styling)

{% raw %}
```liquid
{% include qr.html data="https://x-crm.in" style="dots" size="200" %}
```
{% endraw %}

{% include qr.html data="https://x-crm.in" style="dots" size="200" %}

Нужен интерактивный qr генератор с настройками и скачиванием изображения? -> [UI для генератора QR-кодов](/2026/06/24/qr-code-generator-ui.html)

*Виджет создан с помощью Claude Opus 4.8 (Ultracode)*