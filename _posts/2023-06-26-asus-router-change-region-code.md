---
layout: post
title: "Меняем регион у ASUS роутера"
description: "Разблокируем частоты и увеличиваем мощность"
tags: hack
---
# Меняем регион у ASUS роутера

Что бы нормально работать с санкционными роутерами, нужно поменять его регион.
Первым делом скачиваем прошивку от [merlin](https://www.asuswrt-merlin.net/download) для своей модели роутера.
Включаем доступ по ssh в настройках роутера.
Заходим по ssh и вводим команды


Создаём файл **/jffs/scripts/init-start** в котором будет меняться регион на **US**, можно постаить **#a** - разблокируется вообще всё, но говорят не очень стабильно это.
```sh
nvram set location_code=US
nvram commit
service restart_wireless
```

Далее добавляем этот файл в автозапуск скриптов роутера
```sh
nvram set jffs2_exec=/jffs/scripts/init-start
nvram set jffs2_scripts=1
nvram commit
reboot
```

После перезагрузки проверяем мощность 
```sh
wl txpwr_target_max
> Maximum Tx Power Target (chanspec:0x1908):      24.00  24.00  24.00  24.00
```

И регион 
```sh
nvram get location_code
> US
```

Различные изыскания можно почитать [тут](https://gist.github.com/francoism90/3dede7973354d067c41bff5e54203fe9)