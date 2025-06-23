---
layout: post
title: "Изменить функцию в Android apk файле"
description: "return true;"
tags: android apk dex hack
---

# Как изменить функцию в Android apk файле

Для начала нужно достать установленный apk с помощью [APK Extractor](https://4pda.to/forum/index.php?showtopic=645313)

Потом изучаем содержимое apk файла, поможет в этом [jadx](https://github.com/skylot/jadx)

Далее распаковываем apk файл (это zip архив) и находим **classes.dex**

Это уже не просто скомпилированные классы **.class**, а **Dalvik Executable**, который содержит байт-код, скомпилированный из исходного кода Java или Kotlin приложения.

Его нужно декомпилировать с помощью [baksmali](https://github.com/JesusFreke/smali/wiki)

```bash
java -jar baksmali.jar d classes.dex -o smali_out
```

Потом находим нужную функцию, и... она имеет совершенно другой вид.

Например функция **java**
```java
private boolean IsChangeMe() {
  return true;
}
```

А вот так **smali**
```smali
.method private final IsChangeMe()Z
    .registers 2

    const/4 v0, 0x1
    return v0
.end method
```

Но нам не надо писать сложную логику, достаточно **вернуть true**

Теперь пришло время пересобрать classes.dex и запихать его в apk
```bash
java -jar smali.jar a smali_out -o classes.dex
```

Не забыть подписать получившийся apk с помощью [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer)
```bash
java -jar uber-apk-signer.jar --apks patched.apk
```

Осталось переустановить приложение на Android, скорее всего придётся удалить оргинальное приложение, т.к. новая подпись.