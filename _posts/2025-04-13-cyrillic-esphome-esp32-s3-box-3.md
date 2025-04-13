---
layout: post
title: "Русификация Espressif ESP32-S3-BOX-3"
description: "Кириллические символы на дисплее"
tags: esphome s3box voice
---

# Русификация Espressif ESP32-S3-BOX-3

При установке обычной прошивки для [ESP32-S3-BOX-3](https://aliexpress.com/wholesale?SearchText=Espressif+ESP32-S3-BOX-3&g=y&page=1) - покажет нам квадратики вместо букв. Чтобы исправить этот момент - смотрим - [прошивку](https://github.com/search?q=repo%3Aesphome%2Fwake-word-voice-assistants%20font_request&type=code), находим места **font_request** и **font_response**. 

Там "*по умолчанию*" установлен шрифт [Figtree](https://fonts.google.com/specimen/Figtree), а в нём **нет** кириллицы.

Найдём какой нибудь шрифт **с поддержкой киррилицы**, например [Roboto](https://fonts.google.com/specimen/Roboto)

В итоге получится вот так
```yaml
substitutions:
  name: esp32-s3-box-3-123456
  friendly_name: s3voice
packages:
  esphome.voice-assistant: github://esphome/firmware/wake-word-voice-assistant/esp32-s3-box-3.yaml@main
esphome:
  name: ${name}
  name_add_mac_suffix: false
  friendly_name: ${friendly_name}
api:
  encryption:
    key: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX


wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password

font:
  - id: !extend font_request
    file:
      type: gfonts
      family: Roboto
      weight: 300
    glyphsets:
      - GF_Latin_Core
      - GF_Cyrillic_Core
  - id: !extend font_response
    file:
      type: gfonts
      family: Roboto
      weight: 300
    glyphsets:
      - GF_Latin_Core
      - GF_Cyrillic_Core
```
![RUS-ESP32-S3-BOX-3](/assets/blog/esp-s3/RUS-ESP32-S3-BOX-3.webp)