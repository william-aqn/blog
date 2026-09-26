---
layout: post
title: "Скрипт развёртки Family messenger в Proxmox"
description: "Контейнер одной командой"
tags: ai proxmox lxc caddy
---

# Скрипт развёртки Family messenger в Proxmox

А теперь нужно ещё ленивее разворачивать в Proxmox [семейный мессенджер](/2026/09/10/family-messenger.html). Запускается на хосте:

```sh
curl -fsSL https://raw.githubusercontent.com/william-aqn/family-messenger-e2e/main/deploy/proxmox.sh | sh
```

Создаёт непривилегированный LXC на Debian 13 (шаблон качает сам, если на хосте его нет), внутри зовёт уже существующий `deploy/install.sh` и печатает адрес и первый инвайт.

## Настройки

Всё переопределяется через окружение, запуск может быть полностью неинтерактивным.

По умолчанию `DOMAIN=auto` берёт адрес контейнера, и Caddy выдаёт сертификат локального CA: браузер один раз предупредит, а Flutter-приложению нужен настоящий домен с публичным сертификатом.

Скрипт: [deploy/proxmox.sh](https://github.com/william-aqn/family-messenger-e2e/blob/main/deploy/proxmox.sh)

*Скрипт написан с помощью Claude Opus 5 (Claude Code)*
