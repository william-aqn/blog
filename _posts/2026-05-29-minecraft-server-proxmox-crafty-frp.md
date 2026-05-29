---
layout: post
title: "Домашний Minecraft сервер"
description: "Поднимаем и пробрасываем в глобал"
tags: minecraft proxmox crafty frp nginx
---

# Домашний Minecraft сервер
Игровые сервера - штуки прожорливые, арендовать мощный VPS - дорого, а дома на **мини-пк**, на базе процессора **N150** с **12Gb** оперативной памяти можно много чего развернуть!

Есть прекрасный готовый **LXC контейнер** для **Minecraft** в **Proxmox** - [Crafty Controller](https://community-scripts.org/scripts/crafty-controller)

Установка в 2 клика, консоль управления, плагины закидываются через встроенный файловый менеджер.
![crafty-panel](/assets/blog/minecraft/crafty-panel.png)

Но нам нужно теперь играть по сети - схема простая:
```
Игрок → VPS → frp-туннель → Proxmox дома → Crafty → Minecraft
```

## 1. VPS
Теперь пробрасываем всё это дело в глобал через собственный дешёвый VPS на [FirstVDS](https://firstvds.ru/?from=494216), тариф **«Разгон»** ~250 ₽/мес (_Промокод на скидку: **`648494216`**_)

_Для пет проектов и шлюза во внешний мир - более чем достаточно._


## 2. frp-сервер (на VPS)
1. Качаем [frp](https://github.com/fatedier/frp/releases) под Linux
2. Заполняем [frps.toml](/assets/blog/minecraft/gate-server.frps.toml)
3. Создаём юнит для автозапуска [frps.service](/assets/blog/minecraft/gate-server.frps.service)

Не забываем открыть порты и запустить frps
```sh
ufw allow 7000,25565,80/tcp
ufw reload
systemctl daemon-reload
systemctl enable --now frps
systemctl status frps
```

## 3. frp-клиент (в контейнере, рядом с Crafty)
1. Качаем [frp](https://github.com/fatedier/frp/releases) под Linux
2. Заполняем [frpc.toml](/assets/blog/minecraft/home-server.frpc.toml)
3. Создаём юнит для автозапуска [frpc.service](/assets/blog/minecraft/home-server.frpc.toml)
```sh
systemctl daemon-reload
systemctl enable --now frpc
systemctl status frpc
```

## 3.1. nginx для проброса статуса сервера (опционально в контейнере, рядом с Crafty)
Crafty отдаёт статус по своему API (`https://127.0.0.1:8443/api/v2/servers/status`).
Заворачиваем его в аккуратный `/status` с коротким кэшем.

Создаём конфиг для nginx [crafty-status.conf](/assets/blog/minecraft/home-server.nginx.cfg)
```sh
mkdir -p /var/cache/nginx/crafty
nginx -t
systemctl restart nginx
```

## 4. Пробуем подключиться к ip на VPS
![mc](/assets/blog/minecraft/mc.png)

## 5. Играем!