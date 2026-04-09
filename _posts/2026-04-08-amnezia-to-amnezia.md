---
layout: post
title: "Делаем цепочку из AmneziaWG серверов"
description: "В 1 клик"
tags: ai amneziawg sh script
---

# Делаем цепочку из AmneziaWG серверов

Есть интересный протокол передачи данных - [AmneziaWG](https://github.com/amnezia-vpn/amneziawg-go), но для ручной установки - мало скриптов. А тот, который делает цепочку из серверов - нет.

```
                         AmneziaWG tunnel
  Clients --> [ Server A (Amnezia VPN) ] ===========> [ Server B ] --> Internet
                  |           |                            |
                  |           +-- MASQUERADE on awg0       +-- NAT (masquerade)
                  |           +-- source-based routing
                  |
                  +-- SSH / direct access
                      via default gateway
```

Призываем Claude Opus 4.6, и создаём скрипт [Amnezia-to-Amnezia: AWG tunnel between servers](https://github.com/william-aqn/amnezia-to-amnezia) для установки в 1 клик на чистом сервере

* Сборка из исходников
* Поднятие сервера и авто конфигурация
* Создание тоннеля к другому AmneziaWG серверу
* Настройка маршрутизации трафика
* Автозапуск сервера/клиента/тоннеля
* Добавление дополнительных клиентских конфигов
* Вывод конфига в консоль в виде QR кода

