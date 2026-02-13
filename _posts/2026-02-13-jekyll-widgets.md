---
layout: post
title: "Jekyll виджеты: YouTube и STL 3D Viewer"
description: "include-компоненты для GitHub Pages"
tags: jekyll widget github-pages
---

# Jekyll виджеты: YouTube и STL 3D Viewer

В Jekyll есть механизм `_includes` — добавить HTML-файл в папку, и дальше вставлять его одной строкой в любой пост.

## YouTube — адаптивный iframe
Файлы:
 * [_includes/youtube.html](https://github.com/william-aqn/blog/blob/master/_includes/youtube.html)
 * [assets/css/hacker/youtube.scss](https://github.com/william-aqn/blog/blob/master/assets/css/hacker/youtube.scss)

**Использование в посте:**

```
{% include youtube.html id="VIDEO_ID" %}
```

## STL 3D Viewer — интерактивная 3D модель

Для просмотра STL моделей прямо в посте с вращением, зумом и touch-управлением. Используется **Three.js r170** через CDN — никаких npm, build-шагов и зависимостей.

Модель автоматически центрируется, камера подгоняется под размер. Поддерживается несколько viewer на одной странице — каждый `include` создаёт независимый экземпляр.

Файлы:
 * [_includes/stl-viewer.html](https://github.com/william-aqn/blog/blob/master/_includes/stl-viewer.html)
 * [assets/js/stl-viewer.js](https://github.com/william-aqn/blog/blob/master/assets/js/stl-viewer.js)
 * [assets/css/hacker/stl-viewer.scss](https://github.com/william-aqn/blog/blob/master/assets/css/hacker/stl-viewer.scss)

**Использование в посте:**

```
{% include stl-viewer.html model="/assets/blog/3d-vent-grille/vent_grille.stl" %}
```

## Как подключить к себе

1. Скопируйте файлы в соответствующие папки вашего Jekyll-проекта
2. SCSS-файлы должны начинаться с `---` (пустой front matter) — Jekyll обработает их в CSS
3. Three.js грузится с CDN через `importmap` — ничего устанавливать не нужно
4. Пути к CSS подстраивайте под свою структуру

*Оба виджета созданы с помощью Claude 4.6*
