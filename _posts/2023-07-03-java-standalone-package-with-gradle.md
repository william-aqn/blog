---
layout: post
title: "Как сделать standalone версию java библиотеки"
description: "и получить независимый jar файл"
tags: java gradle github bitbucket
---
# Как сделать standalone версию java библиотеки и получить независимый jar файл

Стараемся **не использовать** сторонние библиотеки, т.к. результат будет измеряться десятками мегабайт, если не сотнями.

Делаем таск в **build.gradle** для java **standalone** приложения.
```gradle
plugins {
    id 'java'
}

group = 'info.x-crm'
version = '0.0.1'

tasks.register('standaloneJar', Jar) {
    archiveFileName = "lib-standalone-${version}.jar"
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    from { configurations.runtimeClasspath.collect { it.isDirectory() ? it : zipTree(it) } }
    with jar
}
```