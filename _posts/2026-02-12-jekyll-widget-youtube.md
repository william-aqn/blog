---
layout: post
title: "Jekyll виджет: YouTube"
description: "адаптивный iframe"
tags: jekyll widget youtube
---

# Jekyll виджет: YouTube — адаптивный iframe

Стандартный `<iframe>` от YouTube приходит с фиксированными размерами. На мобильных экранах он вылезает за пределы viewport.

Решение — обёртка с `aspect-ratio` и `max-width`. Контейнер занимает 100% ширины, но не больше 560px. На узких экранах сжимается, пропорции сохраняются.

Файлы:
 * [_includes/youtube.html](https://github.com/william-aqn/blog/blob/master/_includes/youtube.html)
 * [assets/css/hacker/youtube.scss](https://github.com/william-aqn/blog/blob/master/assets/css/hacker/youtube.scss)

## Использование в посте:
{% raw %}
```
{% include youtube.html id="VIDEO_ID" %}
```
{% endraw %}

[Инструкция для подключения](/2026/02/12/jekyll-widgets.html)

*Виджет создан с помощью Claude 4.6*
