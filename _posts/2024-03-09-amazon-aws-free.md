---
layout: post
title: "Регистриуем аккаунт на Amazon AWS"
description: "И создаём бесплатный vps на 1 год"
tags: amazon vps
---
# Регистриуем аккаунт на Amazon AWS
1. Первым делом находим сервис для приёма смс - [@sms_activ_3bot](https://t.me/sms_activ_3bot?start=4065333), (можно пополнить баланс через СБП), выбираем сервис **USA amazon**
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
   3. Вводим логин/api ключ от freedns.afraid.org и домен который там получили.
   4. Перезагружаем инстанс, убеждаем что новый ip привязался к поддомену.