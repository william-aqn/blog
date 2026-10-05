---
layout: post
title: "AmneziaWG на MikroTik"
description: "Настройка MikroTik и AmneziaWG"
tags: mikrotik amneziawg gpt codex
---

# AmneziaWG на MikroTik

Очередной эксперимент - попробовать GPT-6.1 Sol для настройки Микротика. Не Астра конечно, но на "очень высоком" уровне раздумий - **смог**, потратив всего **3%** недельной **$100** подписки. 

В результате получился скрипт-визард, который установит AWG3 на Микротик [microtik-awg3-installer](https://github.com/william-aqn/microtik-awg3-installer)

_Ридми в репозитории делалось исключительно GPT-6.1 Sol, я ничего не правил - можно посмотреть стилистику сола, как пишет текста._

Есть нюанс - запуск скрипта-визарда должен быть **на компьютере** с Python 3.10+, т.к. на микротике нет курла или ещё чего-либо.

```sh
git clone https://github.com/william-aqn/microtik-awg3-installer.git
cd microtik-awg3-installer
```

Linux/macOS: `bash install.sh`. Windows: `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1`.
