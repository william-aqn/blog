---
layout: post
title: "Запускаем Angry Birds на новой версии Android"
description: "INSTALL_FAILED_DEPRECATED_SDK_VERSION, targetSdk 24 и немного байткода"
tags: android apk angry-birds patch ai
---

# Запускаем Angry Birds на новой версии Android

Нашлась антология **Angry Birds**: двадцать APK 2012–2015 годов, от Classic и Rio до Space, Star Wars и Stella. Закидываю на планшет с **Android 15**, а ставиться не хочет ни одна:

![install-error](/assets/blog/angry-birds-android15/install-error.webp)

```
INSTALL_FAILED_DEPRECATED_SDK_VERSION: App package must target at least SDK version 24, but found 18
```

## Почему не ставится

В манифесте каждого APK записан `targetSdkVersion`, то есть версия Android, под которую приложение собирали. Начиная с Android 14 старьё просто не пускают:

* **Android 14**: targetSdk не ниже **23**
* **Android 15**: targetSdk не ниже **24**

У Rovio почти везде стоит **18** (Android 4.3), у Seasons и Star Wars II 21, у Go! вообще 16. С самими файлами всё в порядке.

## Способ 1. Честный: adb

У Android есть официальная лазейка для разработчиков:

```bash
adb install --bypass-low-target-sdk-block Angry_Birds_v.5.0.2.apk
```

Нужны ПК, USB-отладка и [platform-tools](https://developer.android.com/tools/releases/platform-tools). APK ставится как есть, с родной подписью и targetSdk 18, поэтому и работает так же, как на старых устройствах. Если компьютер под рукой, это лучший вариант.

## Способ 2. Поднять targetSdk до 24

Без компьютера остаётся патчить APK. В бинарном `AndroidManifest.xml` это **один байт**: `0x12` → `0x18`. Переподписал, и можно ставить.

Но вместе с новым targetSdk приложение получает все изменения поведения Android 4.4–7.0, от которых система его раньше берегла. Поэтому, прежде чем раздавать файлы, отправил **Claude** разбирать байткод всех двадцати APK. Четыре агента искали проблемы по категориям, ещё четыре пытались их опровергнуть, а последний потом придирчиво проверил сами патчи. Дошло до того, что они расшифровали Lua-скрипты игры, чтобы понять, в какой момент инициализируется магазин.

Что нашлось:

### 1. Магазин Google Play роняет игру

С target 21 `bindService()` с неявным Intent бросает `IllegalArgumentException: Service Intent must be explicit`. Rovio подключает Google Play billing ровно так, в фоновом потоке и без `try/catch`. Платёжный модуль создаёт нативный движок при старте, так что Classic падала бы при первом возврате в игру: после Home, рекламы или напоминания о бустерах.

Самое смешное, что Rovio сама наступила на эти грабли. В Seasons и Star Wars II, где target подняли до 21, в этом методе появилась одна строчка: `setPackage("com.android.vending")`. Её и добавляем.

Добавить код в DEX без пересборки нельзя, места в методе ровно столько, сколько было. Зато в его начале нашёлся отладочный лог `bindToService()` длиной ровно 5 кодовых единиц. Это столько же, сколько занимают `const-string` и `invoke-virtual` вместе:

```diff
- const-string v0, 'bindToService()'
- invoke-static {v0}, ...GooglePlayPaymentProvider;->log(Ljava/lang/String;)V
  iget-object v0, v3, ...GooglePlayPaymentProvider;->c:Landroid/app/Activity;
  new-instance v1, Landroid/content/Intent;
  const-string v2, 'com.android.vending.billing.InAppBillingService.BIND'
  invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
+ const-string v2, 'com.android.vending'
+ invoke-virtual {v1, v2}, Landroid/content/Intent;->setPackage(Ljava/lang/String;)Landroid/content/Intent;
  const/4 v2, 1
  invoke-virtual {v0, v1, v3, v2}, Landroid/app/Activity;->bindService(...)Z
```

В Go! и Transformers метод короче и лишнего места нет. Там `bindToIabService()` просто возвращает `false`: игра считает, что Google Play на устройстве нет, а этот случай она обрабатывать умеет. Покупки в давно снятых с продажи играх всё равно не работают.

### 2. Разрешения в рантайме (Android 6)

С target 23 опасные разрешения больше не выдаются при установке. Classic это не задевает: все обращения к `READ_PHONE_STATE` либо проверяют разрешение, либо ловят исключение. А вот в **Space** рекламный SDK Burstly смотрит, объявлено ли разрешение в *манифесте*, а не выдано ли оно на самом деле. Потом он зовёт `getDeviceId()` и получает `SecurityException` прямо в UI-потоке. На планшетах с SIM-модулем игра падает, как только создаётся первый рекламный баннер. Патч: вместо вызова подставляем `null`, ровно то, что Android 10+ и так вернул бы.

### 3. file:// в «Поделиться» (Android 7)

В **Stella** кнопка «поделиться скриншотом» отдаёт картинку через `file://` и получает `FileUriExposedException`. Убрал вложение из Intent: окно «Поделиться» откроется, но без картинки. Это лучше, чем вылет.

### 4. Мод, который убивает сам себя

`Star Wars II Unlimited Credits` от aiwu в 15 местах сверяет свою подпись с подписью модера и при несовпадении делает `killProcess`. После переподписи игра закрывалась бы прямо на заставке. Все 15 проверок одинаковые, их первая инструкция заменена на `return-void`.

### 5. То, что просто деградирует

* Vungle и Unity Ads без доступа к файлам не стартуют или не кешируют видео. Реклама давно мертва, но если хочется, выдайте «Файлы и медиа» в настройках приложения.
* Сканер Telepods в Star Wars II, Stella, Go! и Transformers работает только после разрешения «Камера».
* Иконки уведомлений стали белым силуэтом, напоминания могут приходить с опозданием.
* Рекламные окна открываются в светлой теме вместо тёмной.

## Чем патчил

На компьютере не нашлось ни Java, ни apktool, ни Android SDK. Были Python и OpenSSL из Git for Windows, поэтому всё написано с нуля:

* правка `targetSdkVersion` прямо в бинарном `AndroidManifest.xml`;
* маленький дизассемблер Dalvik;
* точечные патчи байткода того же размера. Каждый сначала сверяет, что метод выглядит ровно так, как при анализе. После записи метод заново дизассемблируется и проверяются границы try-блоков и переходов. В конце пересчитываются adler32 и SHA-1 в заголовке DEX;
* сборка ZIP с выравниванием, как у zipalign, и подпись v1 + v2 через OpenSSL;
* отдельный верификатор: CRC всех файлов, сравнение с оригиналом, проверка подписей v1/v2 и того, что в DEX изменились только задуманные методы.

Скрипты: [apk-android15-patcher.zip](/assets/blog/angry-birds-android15/apk-android15-patcher.zip). Запуск на всю папку:

```bash
python -I patch_all.py "Angry BIRDS (антология)" "Angry BIRDS (антология)\Android 15"
```

## Что ещё может помешать

* **Только 32-битные библиотеки.** У всех игр есть `armeabi`, `armeabi-v7a` и `x86`, но нет `arm64-v8a`. Если процессор планшета не умеет 32-битный режим (например, Dimensity 9300), установка закончится ошибкой `INSTALL_FAILED_NO_MATCHING_ABIS`, и тут уже ничего не поможет.
* **Другая подпись.** Если оригинал уже стоит, сначала удалите его. Вход через Facebook и Google Play Games не заработает, но они и так давно мертвы.
* **Предупреждение** «Приложение создано для более старой версии Android» при первом запуске: жмём ОК.
* **OBB** для Go!, Transformers и Epic нужно положить в `Android/obb/<пакет>/`. С самого планшета туда уже не пускают, проще скопировать с ПК по кабелю.

*Байткод разбирал и патчи писал Claude Opus 5.5 (Claude Code)*
