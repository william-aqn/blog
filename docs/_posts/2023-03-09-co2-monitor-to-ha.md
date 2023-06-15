---
layout: post
title:  "Подключаем детектор углекислого газа Даджет к Home Assistant"
tags: homeassistant esphome diy
---
<!--more-->
Подключаем детектор углекислого газа Даджет к Home Assistant 
(ZyAura ZGm053U CO2 & Temperature Monitor) через ESPHome

https://esphome.io/components/sensor/zyaura.html

В наличии был esp01 который идеально подходит к пинам на плате
И программатор pl2303, которому нужны специальные драйвера[], иначе не запустится
Подключаем для прошивки по схеме
pl2303 esp01
3.3V -> VDD+CH_EN
TXD -> RXD
RXD -> TXD
GND -> GND+GPIO_00
[img]

В Home Assistant создаём прошивку и заливаем на esp через Chrome браузер
[yaml]

Дальше отключаем GPIO_00 от GND, подключаем к co2 выводам esp01 (пока питание берём от pl2303)
В логе появляются данные
[img]

Теперь надо отпаять гребёнку от esp01 и поместить esp01 непосредственно на пины co2
Питание 3.3V взять вот с этого провода
[img]

TODO: