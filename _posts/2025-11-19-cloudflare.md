---
layout: post
title: "Что случилось с cloudflare"
description: "Технические подробности"
tags: cloudflare fail
---

# Что случилось с cloudflare
> Модифицировали выборку и забыли в условии указать конкретную БД

## Пробема 1
Они не меняли выборку и условия, они поменяли настройки прав. И запрос, который раньше возвращал данные только от одной БД, стал возвращать от нескольких БД. То есть, раньше все нормально работало и без условия, а после изменения настроек прав - тот же самый запрос, который раньше нормально работал, стал выдавать больше данных, что привело к проблемам.

![error_cloudflare](/assets/blog/cloudflare/cloudflare-downtime-tanos.webp)

## Проблема 2
Созданный файл на основе данных из БД распространился по всем узлам кластера, обрабатывающего входные запросы.

Вместо корректной обработки превышения и использования старой версии файла с уведомлением мониторинга, обработчик аварийно завершал работу из-за использования в Rust метода [unwrap()](https://doc.rust-lang.org/std/result/enum.Result.html#method.unwrap) для Result в состоянии [Ok](https://doc.rust-lang.org/std/result/enum.Result.html#variant.Ok). При ошибке unwrap() вызывает [panic!](https://doc.rust-lang.org/std/macro.panic.html), что допустимо в отладке, но [недопустимо](https://levelup.gitconnected.com/rust-never-use-unwrap-in-production-c123b311f620) в продакшене.

![code_error_cloudflare](/assets/blog/cloudflare/code.webp)


![error_cloudflare](/assets/blog/cloudflare/cloudflare-broke-mcdonalds.webp)