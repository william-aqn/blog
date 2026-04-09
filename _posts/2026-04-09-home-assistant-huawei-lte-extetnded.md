---
layout: post
title: "Приём СМС в Home Assistant через Huawei модем"
description: "Расширяем оригинальное дополнение"
tags: ai ha hacs
---

# Приём СМС в Home Assistant через Huawei модем

У Home Assistant есть интеграция [Huawei LTE](https://www.home-assistant.io/integrations/huawei_lte/) с помощью которой можно сразу подключить любой модем от Huawei

Но что самое интересное - функции приёма/чтения смс - НЕТ. Но в api - это возможно.

Берём Claude Opus 4.6, и расширяем оригинальное дополнение с помощью HACS

* Теперь можно видеть все входящие СМС
* По эвенту запускать автоматизации, или пересылать сообщения по маске в ТГ
* Чистить СМС из памяти устройства

Устанавливаем [Huawei LTE Extended](https://github.com/william-aqn/huawei_lte_extended) через HACS и читаем СМС

![huawei-lte-sms_sensor](/assets/blog/huawei-lte/sms_sensor.png)

