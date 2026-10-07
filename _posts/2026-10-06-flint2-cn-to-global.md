---
layout: post
title: "Flint 2 (GL-MT6000): переключение CN → Global"
description: "Как сменить региональный код CN на US у GL.iNet Flint 2"
tags: glinet flint2 openwrt guide
---

# Flint 2 (GL-MT6000): переключение CN → Global

Инструкция для китайской версии **GL.iNet Flint 2 / GL-MT6000**. Под переключением в Global здесь понимается смена регионального кода `CN` на `US`. Сама прошивка при этом не переустанавливается.

## Подключаемся по SSH

Логин - **root**, пароль - **пароль администратора веб-панели**.

## Проверяем регион

Команды ниже предназначены для **MT6000 с заводской разметкой**.

```sh
dd if=/dev/mmcblk0p2 bs=1 skip=136 count=2 2>/dev/null | hexdump -C
```

Ожидаем `43 4e` и `CN` справа. Если уже написано `US`, менять ничего не нужно. При другом результате или ошибке к записи не переходим.

## Меняем CN на US

```sh
echo -n "US" | dd of=/dev/mmcblk0p2 bs=1 seek=136 conv=notrunc
sync
reboot
```

Раздел и смещение для MT6000 также приведены в [инструкции проекта gl-country](https://github.com/wifiway123/gl-country/blob/main/README.md)
