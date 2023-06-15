---
layout: post
title: "Подключаем детектор углекислого газа Даджет к Home Assistant"
description: "ZyAura ZGm053U CO2 & Temperature Monitor через ESPHome"
tags: homeassistant esphome diy
---
# Подключаем детектор углекислого газа Даджет к Home Assistant (ZyAura ZGm053U CO2 & Temperature Monitor) через ESPHome

https://esphome.io/components/sensor/zyaura.html

В наличии был esp01 который идеально подходит к пинам на плате

И программатор pl2303, которому нужны специальные [драйвера](/assets/blog/co2/Prolific%20PL2303%20driver%20v3.3.2.102%20(2008-24-09)%20Win8_x64_x86.7z), иначе не запустится

## Подключаем для прошивки по схеме **pl2303 esp01**

* 3.3V -> VDD+CH_EN
* TXD -> RXD
* RXD -> TXD
* GND -> GND+GPIO_00
![Пины](/assets/blog/co2/pl2303_esp01_connect.png)

В Home Assistant создаём прошивку и заливаем на esp через Chrome браузер
[yaml](/assets/blog/co2/co2.yaml)

Дальше отключаем GPIO_00 от GND, подключаем к co2 выводам esp01 (пока питание берём от pl2303)
В логе появляются данные
![Источник питания](/assets/blog/co2/co2_esp01.png)


Теперь надо отпаять гребёнку от esp01 и поместить esp01 непосредственно на пины co2
Питание 3.3V надо где то взять... 
![Источник питания](/assets/blog/co2/co2_esp01_debug.png)

## TODO:
 * Найти питание