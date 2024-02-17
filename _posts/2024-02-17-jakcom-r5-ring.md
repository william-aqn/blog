---
layout: post
title: "Приручаем 6-в-1 кольцо Jakcom r5 smart ring"
description: "Одно кольцо, что бы открывать всё..."
tags: nfc t5577 ntag216 mifare1k proxmark3 flipperzero
---
# Приручаем 6-в-1 кольцо Jakcom r5 smart ring

Купить можно на [aliexpress](https://aliexpress.ru/item/1005005644883504.html?sku_id=12000034932612948) или на [ozon](https://www.ozon.ru/product/smart-koltso-r5-mozhet-zamenit-6-beskontaktnyh-kart-besprovodnoy-disk-u-podderzhka-komand-624101734/), цены +- одинаковые (~2100 рублей)

Читаем инструкцию, смотрим где располагаются метки
* по бокам 2 метки t5577 (ID) 125 kHz
* I и III это mifare1 (IC) 13.56 MHz
* II и IV это ntag216 (nfc) 13.56 MHz

Находим **2 пароля** для **ID меток**
1. 5469616e
2. 51243648

Выкидываем инструкцию, берём proxmark3/flipperzero и начинаем эксперименты!
У Флиппера актуальная на текущий момент прошивка [unleashed-070e](https://lab.flipper.net/?url=https://unleashedflip.com/fw_extra_apps/flipper-z-f7-update-unlshd-070e.tgz&channel=release-cfw&version=unlshd-070e)

Заходим в раздел **125kHz->Saved->Write and set pass**, вводим один из паролей *(5469616e или 51243648)*, пробуем записать метку.

Для сброса пароля заходим в раздел **125kHz->Extra Actions->Clear T5577 Password**

НО! Если сбросить пароль на 2х метках сразу, то они будут синхронно перезаписываться, что слегка меня смутило, лучше оставить на одной из меток пароль.

## Теперь идём в proxmark3 изучать ID метки
![play](/assets/blog/smart-ring-r5/main.jpg)

Пробуем на боковых метках **lf search**
```
[=] Note: False Positives ARE possible
[=]
[=] Checking for known tags...
[=]
[!] Specify one authentication mode
[-] No known 125/134 kHz tags found!
[=] Couldn't identify a chipset
```

Уточняем метку **lf t5 detect**
```
[!] Could not detect modulation automatically. Try setting it manually with 'lf t55xx config'
```
Добавляем известный пароль из инструкции **lf t5 detect -p 51243648**
```
[=]  Chip type......... T55x7
[=]  Modulation........ ASK
[=]  Bit rate.......... 5 - RF/64
[=]  Inverted.......... No
[=]  Offset............ 33
[=]  Seq. terminator... Yes
[=]  Block0............ 000880E0 (auto detect)
[=]  Downlink mode..... default/fixed bit length
[=]  Password set...... Yes
[=]  Password.......... 51243648
```

Дальше я попробовал сделать wipe... и всё пропало. Ни ответа, ни привета. Флиппер тоже молчит.
Пробую выполнить запись напрямую (через тестовый режим)
```
lf t55 write -b 0 -d 000880E0 -t
lf t55 write -b 0 -d 000880E0 --r0 -t
lf t55 write -b 0 -d 000880E0 --r1 -t
lf t55 write -b 0 -d 000880E0 --r2 -t
lf t55 write -b 0 -d 000880E0 --r3 -t
```
Потом записываем любой id
```
lf em 410x clone --id 0102030405
```
И... тишина. Метка не читается. 

Пробую через флиппер **Clear T5577 Password** и **метка оживает**!

Сразу пробую записать через флиппер ключи - всё записалось.

## Теперь очередь IC меток

Флиппер прекрасно прочитал I и III метки, но не смог записать туда данные - *data management is only possible with initial card*
Как magic эта метка не определяется, uid просто так не перебить. Значит будем записывать через proxmark3.

Пробуем на метке I и III **hf search**
```
[|] Searching for ISO14443-A tag...
[+]  UID: AA BB CC DD
[+] ATQA: 00 04
[+]  SAK: 08 [2]
[+] Possible types:
[+]    MIFARE Classic 1K
[=] proprietary non iso14443-4 card found, RATS not supported
[+] Magic capabilities... Gen 2 / CUID
[+] Magic capabilities... Gen 4 GDM / USCUID ( Magic Auth )
[+] Prng detection....... weak
[+] Valid ISO 14443-A tag found
```
Дальше получаем дампы ключей **hf mf autopwn**, записываем новую метку **hf mf restore --uid 11223344**

Проверяем на флиппере - Всё читается.

## NFC метки
Это ntag216, можно записать [визитку](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

## Габариты кольца
Кольцо просто огромное (Размер L, самый большой)
![play](/assets/blog/smart-ring-r5/size0.jpg)
<!-- ![play](/assets/blog/smart-ring-r5/size1.jpg)
![play](/assets/blog/smart-ring-r5/size2.jpg) -->


