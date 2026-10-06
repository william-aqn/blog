---
layout: post
title: "AmneziaWG+Podkop на Flint 2 (GL-MT6000)"
description: "YouTube, Telegram и немного автоматизации на GL.iNet Flint 2."
tags: glinet flint2 openwrt amneziawg podkop codex
---

# AmneziaWG+Podkop на Flint 2 (GL-MT6000)

После [ASUS]({% post_url 2026-06-18-asus-amneziawg %}) и [MikroTik]({% post_url 2026-10-05-mikrotik-hap-ac2-amneziawg3 %}) добрался до **GL.iNet Flint 2**. Раньше на этом месте полагалось открыть двадцать вкладок, разобраться в версиях пакетов и провести вечер в обнимку с SSH. Теперь техническое задание выглядит примерно так:

> Настрой мне AWG3 на роутере, вот тебе креды.

Есть, правда, небольшое вступительное испытание: чтобы работать с нейронками, сначала нужно выбраться в **нормальный интернет**. А уже потом можно попросить нейронку настроить нормальный интернет на всех остальных устройствах.

Codex проверил прошивку, поднял **AWG 3.1**, прикрутил **Podkop** и проверил туннель. YouTube и Telegram отправляются через AWG3, остальные направления - напрямую. Списками можно управлять в **LuCI → Сервисы → Podkop**. Штатные awg-пакеты GL.iNet остались на месте, AWG3 работает отдельным сервисом.

Из этого получился [flint2-awg3-installer](https://github.com/william-aqn/flint2-awg3-installer) - установщик с запуском одной командой. Проверки совместимости, резервная копия и откат при неудачной настройке прилагаются. Подробности и ограничения теперь живут в репозитории, где им и положено.

Сам Flint 2 - роутер достаточно дорогой: **~ 14 тысяч рублей** - [китайская версия на Ozon](https://www.ozon.ru/product/igrovoy-vysokoskorostnoy-wifi-6-router-gl-inet-gl-mt6000-flint-2-dlya-besprovodnyh-setey-4489304469/). 

Для сравнения на Ozon есть **~33 тысяч рублей** [ASUS RT-BE88U](https://www.ozon.ru/product/besprovodnoy-marshrutizator-asus-rt-be88u-802-11-a-b-g-n-ac-ax-be-2-4-ggts-i-5ggts-usb-3-1-3077136106/). По [характеристикам ASUS](https://www.asus.com/bt/networking-iot-servers/wifi-routers/asus-gaming-routers/rt-be88u/techspec/) он вкуснее: Wi-Fi 7 BE7200, четыре ядра по 2,6 ГГц и 2 ГБ RAM. Портов тоже с запасом: 10G Ethernet, 10G SFP+, четыре по 2,5 Гбит/с и четыре гигабитных. У [Flint 2](https://www.gl-inet.com/products/gl-mt6000/) Wi-Fi 6 AX6000, четыре ядра по 2 ГГц, 1 ГБ RAM, два порта 2,5 Гбит/с и четыре гигабитных.

Для экспериментов удобнее Flint 2: 8 ГБ eMMC против 256 МБ встроенной памяти у RT-BE88U, плюс OpenWrt с пакетами, своими сервисами и свободой настроить маршруты как хочется. На ASUS можно поставить [Asuswrt-Merlin](https://www.asuswrt-merlin.net/), но под связку AWG + Podkop платформа Flint подходит лучше.

А ещё у [Flint 2](https://www.gl-inet.com/products/gl-mt6000/) WireGuard заявлен до 900 Мбит/с и до 680 Мбит/с у [Flint 3](https://www.gl-inet.com/products/gl-be9300/). У третьего свои плюсы - Wi-Fi 7, диапазон 6 ГГц и пять портов 2,5 Гбит/с, но он дороже, и стоит **~20 тысяч рублей**

Про сам Flint - вот видосик:

{% include youtube.html id="q5hEt_8wzFo" %}

А пост пишу просто потому, что пишется. Инструкцию уже можно заменить одной фразой, но традицию писать инструкцию после того, как всё заработало, пока никто не отменял.
