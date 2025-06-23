---
layout: post
title: "Изменить функцию в apk файле"
description: "return true;"
tags: apk dex hack
---

# Как изменить функцию в apk файле

Для начала распаковываем apk файл (это zip архив) и находим **classes.dex**

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

Но нам ведь не надо писать сложную логику, достаточно **вернуть true**

Теперь пришло время пересобрать classes.dex и запихать его в apk
```bash
java -jar smali.jar a smali_out -o classes.dex
```

Не забыть подписать получившийся apk с помощью [uber-apk-signer](https://github.com/patrickfav/uber-apk-signer)
```bash
java -jar uber-apk-signer.jar --apks patched.apk
```