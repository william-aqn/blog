---
layout: post
title: "Регистриуем аккаунт на Amazon AWS"
description: "И создаём бесплатный vps на 1 год"
tags: amazon vps
---
# Регистриуем аккаунт на Amazon AWS и создаём бесплатный vps на 1 год
1. Первым делом находим сервис для приёма смс - [@Sms_activ_2bot](https://sms-activate-bot.ru/?start=4065333), (можно пополнить баланс через СБП), вводим название сервиса **amazon**, регион **USA** (~8 рублей за приём смс)
2. Потом находим предоплаченную виртуальную карту на **2$** (можно на plati.market) или [@WantToPayBot](https://t.me/WantToPayBot?start=w18011294--TMPVS)
3. Регистриуемся на [aws.amazon.com](https://aws.amazon.com/ru/)
4. Ждём некоторое время пока завершится модерация
5. Теперь создаём [инстанс EC2](https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:) с образом **Ubuntu** в регионе **us-east** с обязательной пометкой **Free Tier**
6. Открываем в [Security group](https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#SecurityGroups:) входящие порты для инстанса
   * Inbound rules->Edit inbound rules->Add rule
   * Type: `All traffic`
   * Source: `0.0.0.0/0`
7. **Внимание!** После перезагрузки инстанса будет присвоен новый IP адрес!
   1. Получаем бесплатный поддомен на [freedns.afraid.org](https://freedns.afraid.org/)
   2. Устанавливаем [dyndns-client](https://github.com/ddclient/ddclient) клиент `sudo apt install ddclient`
   3. Вводим после установки, в консольном ui ddclient, логин/api ключ от freedns.afraid.org и домен который там получили.
   4. Проверяем настройки **ddclient** `sudo nano /etc/ddclient.conf`
   5. Перезагружаем инстанс, убеждаем что новый ip привязался к поддомену.

p.s. Лимит трафика на месяц - **100 Gb**, если больше - будут списания с привязанной карты.