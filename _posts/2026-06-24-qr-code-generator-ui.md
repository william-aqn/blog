---
layout: post
title: "UI для генератора QR-кодов"
description: "Интерактивный генератор с настройками и скачиванием"
tags: jekyll widget qr javascript
---

# UI для генератора QR-кодов

Бонусом к [генератору QR-кодов](/2026/06/23/jekyll-widget-qr-code-generator.html) — интерактивный UI. Вводите адрес или текст, выбираете стиль и уровень коррекции, можно добавить SVG/PNG-логотип в центр — и скачать результат в SVG или PNG.

{% raw %}
```liquid
{% include qr-generator.html %}
```
{% endraw %}

{% include qr-generator.html %}

*Виджет создан с помощью Claude Opus 4.8 (Ultracode)*
