---
layout: post
title: "Jekyll виджеты: Расширяем возможности блога"
description: "include-компоненты для GitHub Pages"
tags: jekyll widget github-pages
---

# Jekyll виджеты: Расширяем возможности блога

В Jekyll есть механизм `_includes` — добавить HTML-файл в папку, и дальше вставлять его одной строкой в любой пост.

Виджеты:
 * [YouTube — адаптивный iframe](/2026/02/12/jekyll-widget-youtube.html)
 * [STL 3D Viewer — интерактивная 3D модель](/2026/02/12/jekyll-widget-stl-viewer.html)

## Как подключить к себе

1. Скопируйте файлы в соответствующие папки вашего Jekyll-проекта
2. SCSS-файлы должны начинаться с `---` (пустой front matter) — Jekyll обработает их в CSS
3. Three.js грузится с CDN через `importmap` — ничего устанавливать не нужно
4. Пути к CSS подстраивайте под свою структуру

*Оба виджета созданы с помощью Claude 4.6*
