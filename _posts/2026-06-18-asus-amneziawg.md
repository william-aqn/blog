---
layout: post
title: "Ютуб на ASUS роутере"
description: "Разграничиваем трафик на роутере"
tags: asuswrt merlin amneziawg
---

# Ютуб на ASUS роутере
Когда часть умного дома и домашние игровые сервера зависят от aws или cloudflare - нужно направить часть трафика через amneziawg 

Для этого пригодится [amtm](https://diversion.ch/amtm.html) если не доступен - [вебархив](https://web.archive.org/web/20260507185957/https://diversion.ch/amtm.html)
```sh
curl -Os https://diversion.ch/amtm/amtm && sh amtm
```

Потом вставить флешку в USB порт роутера, отформатировать в ext4, и выбрать в **amtm** - [Entware](https://github.com/Entware/Entware/wiki/Install-on-Asus-stock-firmware)

Дальше устанавливаем [asuswrt-merlin-amneziawg](https://github.com/william-aqn/asuswrt-merlin-amneziawg)
```sh
curl -sfL https://raw.githubusercontent.com/william-aqn/asuswrt-merlin-amneziawg/main/install-online.sh | sh
```

После перезагружается роутер и в админке уже полноценный UI с возможностью разграничить трафик по различным направлениям.

ps. Пришлось форкнуть [исходный репозиторий](https://github.com/r0otx/asuswrt-merlin-amneziawg/), т.к. там ошибки сразу летят:

Ошибка ERROR: **Cannot create temp directory**
```sh
opkg install coreutils-mktemp
```

Ошибка **ERROR: Invalid H1**
```
Добавить из изменения из PR https://github.com/r0otx/asuswrt-merlin-amneziawg/pull/13/changes
```

На всякий случай сделал зеркало amtm (на 18.06.2026)
```sh
curl -Os https://x-crm.in/assets/blog/asus/amtm/amtm && sh amtm
```

Сообщество для обсуждения в ТГ - https://t.me/asusxray
