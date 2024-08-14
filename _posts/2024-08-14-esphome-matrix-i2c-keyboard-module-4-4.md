---
layout: post
title: "Подключаем сенсорную I2C 4*4 клавиатуру к esphome"
description: "Matrix keyboard module V3.0"
tags: esphome nodemcu
---

# Как подключить сенсорную i2c 4*4 клавиатуру к esphome

Основной компонент - [Erriez TTP229](https://esphome.io/components/binary_sensor/ttp229.html)

**Важно!** По умолчанию ttp229_lsf пытается подключится по адресу **0x57**, но у нас оказался **0x65**
```log
[I][i2c.arduino:096]: Results from i2c bus scan:
[I][i2c.arduino:102]: Found i2c device at address 0x65
[C][ttp229_lsf:019]: ttp229: 
[C][ttp229_lsf:020]:     Address: 0x57 
[E][ttp229_lsf:023]: Communication with TTP229 failed! 
[E][component:082]:     Component ttp229_lsf is marked FAILED
```
Устанавливаем принудительно адрес **0x65**
```yaml
i2c:
  - scan: true
ttp229_lsf:
  - address: 0x65

binary_sensor:
  - platform: ttp229_lsf
    name: Button_0
    channel: 0
```
## Номера каналов на клавиатуре

| Col1 | Col2 | Col3 | Col4 |
|:---|:---|:---|:---|
| 7  | 3  | 15 | 11 |
| 6  | 2  | 14 | 10 |
| 5  | 1  | 13 | 9  |
| 4  | 0  | 12 | 8  |

### Купить можно на Aliexpress [Matrix keyboard module V3.0](https://aliexpress.ru/item/1005003658190273.html?spm=a2g2w.chat.0.0.277e4aa6mYCxM2&sku_id=12000026683379344) *~250 руб.*
![Matrix keyboard module V3.0](/assets/blog/nodemcu/ttp229_lsf_4_4.png)