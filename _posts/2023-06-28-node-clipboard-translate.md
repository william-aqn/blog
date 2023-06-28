---
layout: post
title: "Быстро переводим текст в буфере обмена"
description: "ctrl+c, пара секунд, ctrl+v"
tags: coding nodejs
---
# Быстро переводим текст в буфере обмена

Когда нужно перевести очень много мелких фраз на разные языки в уникальных местах файлов - очень муторно переключаться между переводчиком. Пусть само всё переводится в буфере!

Сделал GUI для переводчика и прикрутил на выбор **google-free**, **deepl** и **openapi** с моделью `text-davinci-003`

Пока оптимальный промпт для перевода текста это 
```
Please translate the user message from #from# to #to#. Make the translation sound as natural as possible.
```

Скачать можно тут [node-clipboard-translate](https://github.com/william-aqn/node-clipboard-translate)
