---
layout: post
title: "Jekyll виджет: STL 3D Viewer"
description: "интерактивная 3D модель"
tags: jekyll widget stl 3d
---

# Jekyll виджет: STL 3D Viewer

Для просмотра STL моделей прямо в посте с вращением, зумом и touch-управлением. Используется **Three.js r170** через CDN — никаких npm, build-шагов и зависимостей.

Модель автоматически центрируется, камера подгоняется под размер. Поддерживается несколько viewer на одной странице — каждый `include` создаёт независимый экземпляр.

Файлы:
 * [_includes/stl-viewer.html](https://github.com/william-aqn/blog/blob/master/_includes/stl-viewer.html)
 * [assets/js/stl-viewer.js](https://github.com/william-aqn/blog/blob/master/assets/js/stl-viewer.js)
 * [assets/css/hacker/stl-viewer.scss](https://github.com/william-aqn/blog/blob/master/assets/css/hacker/stl-viewer.scss)

**Использование в посте:**

{% raw %}
```
{% include stl-viewer.html model="/assets/blog/model.stl" %}
```
{% endraw %}

*Виджет создан с помощью Claude 4.6*
