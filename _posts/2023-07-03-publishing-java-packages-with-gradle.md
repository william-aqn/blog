---
layout: post
title: "Публикуем библиотеку на java в maven-central"
description: "gradle и ci/cd"
tags: java gradle github bitbucket
---
# Публикуем библиотеку на java в maven-central

1. Регистрируемся на [issues.sonatype.org](https://issues.sonatype.org/)
2. Создаём тикет 
   * Поле Issue Type = **New Project**
   * Summary = **Краткое название проекта**
   * Group Id = **info.x-crm** (Это ваш артефакт = имя домена наоборот)
   * Project URL = **Ссылка на сайт проекта**
   * SCM url = **Ссылка на репозиторий**
   * Already Synced to Central = **No**
3. Ждём пока робот скажет что делать. Можно сразу [создать TXT запись для домена](https://central.sonatype.org/faq/how-to-set-txt-record/) с номером тикета **OSSRH-XXYYZZ**
4. Скачиваем [gpg4win](https://www.gpg4win.org/download.html) и создаём там приватный ключ, публикуем.
5. Экспортируем ключ в формате ascii-armored (*.asc)
6. Создаём файл **c:\Users\user\.gradle\gradle.properties** [важный момент](https://github.com/gradle/gradle/issues/15718#issuecomment-886246583)

```ini
sonatypeUsername=Логин от issues.sonatype.org
sonatypePassword=Пароль от issues.sonatype.org
signingKeyId=Последние 8 цифр идентификатора ключа (short формат)
signingPassword=Пароль от закрытого ключа
signingKey=-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nСодержимое ключа в одну строку, где все символы новой строки явно обозначены\n-----END PGP PRIVATE KEY BLOCK-----\n
```

7. Основные секции файла **build.gradle** для java приложения. Если в версию добавить слово **SNAPSHOT** - будет публикация в тестовом maven репозитории.

```gradle
plugins {
    id 'java'
    id 'maven-publish'
    id 'signing'
}

group = 'info.x-crm'
version = '0.0.1'

java {
    withJavadocJar()
    withSourcesJar()
}
publishing {
    publications {
        mavenJava(MavenPublication) {
            artifactId = 'код-этой-библиотеки'
            from components.java

            versionMapping {
                usage('java-api') {
                    fromResolutionOf('runtimeClasspath')
                }
                usage('java-runtime') {
                    fromResolutionResult()
                }
            }

            pom {
                name = 'Название проекта'
                description = 'Описание проекта'
                url = 'https://x-crm.info/'
                licenses {
                    license {
                        name.set("The Apache License, Version 2.0")
                        url.set("http://www.apache.org/licenses/LICENSE-2.0.txt")
                    }
                }
                scm {
                    connection = 'scm:git:https://github.com/william-aqn/blog.git'
                    developerConnection = 'scm:git:https://github.com/william-aqn/blog.git'
                    url = 'https://github.com/william-aqn/blog'
                }
            }
        }
    }
    repositories {
        maven {
            def releasesRepoUrl = "https://s01.oss.sonatype.org/service/local/staging/deploy/maven2/"
            def snapshotsRepoUrl = "https://s01.oss.sonatype.org/content/repositories/snapshots/"
            url = version.endsWith('SNAPSHOT') ? snapshotsRepoUrl : releasesRepoUrl
            credentials {
                username = findProperty("sonatypeUsername").toString()
                password = findProperty("sonatypePassword").toString()
            }
        }
    }
}

signing {
    def signingKeyId = findProperty("signingKeyId").toString()
    def signingKey = findProperty("signingKey").toString()
    def signingPassword = findProperty("signingPassword").toString()
    useInMemoryPgpKeys(signingKeyId, signingKey, signingPassword)
    sign publishing.publications.mavenJava
}
```

8. Если что то пошло не так - [тут расшифрованы коды ошибок](https://central.sonatype.org/faq/400-error/#question)
9. Отправляем на релиз [публикацию](https://s01.oss.sonatype.org/) (Нажать close, подождать немного, release)

## Автопубликация библиотеки из репозитория при коммитах
1. Для [Github есть экшен](https://docs.github.com/ru/actions/publishing-packages/publishing-java-packages-with-gradle), заполняем секреты `sonatypeUsername / sonatypePassword / signingKeyId / signingKey / signingPassword`
2. Для **Bitbucket** создаём **base64 строку** из содержимого файла **gradle.properties** и сохраняем в секрет репозитория
3. Создаём файл с пайплайном **bitbucket-pipelines.yml**

```yml
image: gradle:8.0

pipelines:
  default:
    - parallel:
      - step:
          name: Publish
          caches:
            - gradle
          script:
            - echo "$SECRET_BASE64_CONFIG" | base64 -d > ~/.gradle/gradle.properties
            - gradle publish
```

## Рекомендации для библиотеки
* Писать только на чистой java 
* Использовать [JDK 11](https://cfdownload.adobe.com/pub/adobe/coldfusion/java/java11/java11019/jdk-11.0.19_windows-x64_bin.zip) для лучшей совместимости с проектами
* [Сделать standalone версию библиотеки](/2023/07/03/java-standalone-package-with-gradle.html)