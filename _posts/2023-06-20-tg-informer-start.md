---
layout: post
title: "Запущен бот в Telegram"
description: "Может найти ключи для nod32"
tags: coding nodejs
---
# Запущен бот в Telegram

## [@xcrminfo_bot](https://t.me/xcrminfo_bot)
Оживил старый функционал по сбору ключей для **nod32**, теперь уже на **nodejs** с использованием **headless** браузера chrome

## Основные команды
* /who - Информация о id чата и id пользователя
* /nod - Ключи для nod32 (если найдутся, *запрос в гугле - ключи для nod32 и смотрим выдачу*)

## Немного технических подробностей

Нашёл [способ обходить проверку cloudflare](https://www.zenrows.com/blog/bypass-cloudflare-nodejs#how-to-bypass-cloudflare-in-nodejs-using-puppeteer-stealth), но хром жрёт как не в себя оперативку. Отключаем скрипты слежения и всю медиа что есть на страницах. Авторизуемся где нибудь и парсим контент.

Не забываем установить **chrome**
```sh
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install ./google-chrome-stable_current_amd64.deb
```

```js
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import AdblockerPlugin from 'puppeteer-extra-plugin-adblocker'
import ResBlockPlugin from 'puppeteer-extra-plugin-block-resources'

class Nod {
    constructor() {
        puppeteer.use(StealthPlugin())
        puppeteer.use(AdblockerPlugin({ blockTrackers: true }))
        puppeteer.use(ResBlockPlugin({ blockedTypes: new Set(['image', 'stylesheet', 'media', 'font']) }))
    }

    parse() {
        let keys = [];
        const browser = await puppeteer.launch({
            executablePath: "/usr/bin/google-chrome-stable",
            args: ["--enable-features=NetworkService", "--no-sandbox"],
            ignoreHTTPSErrors: true,
            headless: "new"
        });
        // const browser = await puppeteer.launch({ headless: false })

        try {
            const page = await browser.newPage()
            // Открываем страницу
            await page.goto('https://', { timeout: 60000 });
            
            // Авторизуемся где нибудь
            await page.$eval('input[name=vb_login_username]', (el, login) => { el.value = login }, 'Логин какой нибудь');
            await page.$eval('input[name=vb_login_password]', (el, pwd) => { el.value = pwd }, 'Пароль какой нибудь');
            await page.click('input.button[type=submit]');
            await page.waitForNavigation();

            // Находим посты
            let messages = await page.$x("//*[contains(@id,'post_message_')]");
            for (let message of messages) {
                let text = await message.evaluate(element => element.innerHTML);
                // Находим ключи в постах
                let k = text.match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/gm);
                if (k) {
                    keys.push(...k);
                }
            }
        } catch (e) {
            console.log(e);
        } finally {
            await browser.close();
        }
        return keys;
    } 
export default Nod;
```