---
layout: post
title: "Double VPN или шифруемся грамотно"
description: никаких докеров и certbotoв
tags: vpn
---
# Дабл впн или шифруемся грамотно (никаких докеров и certbotoв)

## Точка входа Cloudflare, точка выхода - ваша vps

*За основу брал мануал <https://bernd32.blogspot.com/2022/03/shadowsocksv2ray-tls.html>*

1. Покупаем любой домен, или используем свой (если уже есть)
    * Чтобы получить домен бесплатно, регаем .tk здесь – <https://www.freenom.com/ru/index.html>

2. Регистрируемся в Cloudflare и привязываем туда созданный домен
    * Ждём несколько часов, пока DNS-записи обновятся.
    * Зайдём в **Firewall** Cloudflare и изменим **security level** на **essentially off**

3. Разворачиваем на нашей VPS-ке shadowsocks
    * Все команды выполняются под рутом. `sudo su -` наше всё

4. В зависимости от провайдера vps и установленной машины - открываем порты 80 и 443
    * Если у вас **Oracle** или **Amazon** - порты открыть дополнительно надо в **панели управления самого хостера**.

5. Устанавливаем nginx `apt install nginx` (если ubuntu)
    * Удаляем дефолтный конфиг: `rm /etc/nginx/sites-available/default && sudo rm /etc/nginx/sites-enabled/default`

6. Cоздаем root-директорию, в которой будут находиться файлы нашего сайта `sudo mkdir /var/www/<домен>`
    * Создаем там файл **index.html**
`nano /var/www/<домен>/index.html`
и записываем туда что угодно, например

    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello world</title>
    </head>
    <body>
    <h1>Hello world</h1>
    </body>
    </html>
    ```

7. Забираем SSL сертификат и приватный ключ у Cloudflare для нашего домена (**SSL/TLS**->**Origin Server**) и сохраняем в `/nginx/ssl/<домен>/public.key и /nginx/ssl/<домен>/private.key`
    * Внимание! **Он валидный ТОЛЬКО с Cloudflare**. Нужен что бы nginx хорошо себя вёл.
    * Генерируем на нашем сервере `openssl dhparam -out /etc/nginx/ssl/dhparam.pem 4096`

8. В настройках своего домена на Cloudflare, в разделе **SSL/TLS** ставим **Full(strict)**.

9. Создаем конфиг для нашего сайта:
`nano /etc/nginx/sites-available/<домен>`

    * Вставляем (и не забываем вставить свой домен вместо <домен>):

    ```nginx
    server {
        server_name <домен>;

        root /var/www/<домен>;
        index index.html;

        location / {
                try_files $uri $uri/ =404;
        }

        location /bdsm {
            proxy_redirect off;
            proxy_http_version 1.1;
            proxy_pass http://localhost:8008;
            proxy_set_header Host $http_host;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        listen [::]:443 ssl ipv6only=on;
        listen 443 ssl; 
        ssl_certificate /nginx/ssl/<домен>/public.key;
        ssl_certificate_key /nginx/ssl/<домен>/private.key;
        ssl_session_cache shared:le_nginx_SSL:10m;
        ssl_session_timeout 1440m;
        ssl_session_tickets off;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_prefer_server_ciphers off;
        ssl_dhparam /etc/nginx/ssl/dhparam.pem;

        ssl_ciphers "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384";
    }

    server {
        if ($host = <домен>) {
            return 301 https://$host$request_uri;
        } 

        listen 80;
        listen [::]:80;

        server_name <домен>;
        return 404;
    }

    ```

10. Включаем сайт:
`ln -s /etc/nginx/sites-available/<домен> /etc/nginx/sites-enabled/`

    * Рестартим nginx:
`systemctl restart nginx`

    * Вставляем в адресную строку браузера наш домен и проверяем, что всё работает

11. Устанавливаем shadowsocks (Если у вас x64):
*Если у вас arm64 см пункт 13*

    * Создаем папку под бинарники сс:
`mkdir /etc/ss-go`

    * Качаем бинарник сс с гитхаба:
`wget https://github.com/shadowsocks/go-shadowsocks2/releases/download/v0.1.5/shadowsocks2-linux.gz`

    * Распакуем архив сс-го:
`gzip -d shadowsocks2-linux.gz`

    * Переносим и переименуем бинарник:
`mv shadowsocks2-linux /etc/ss-go/ss-go`

    * Делаем бинарник исполняемым:
`chmod +x /etc/ss-go/ss-go`

    * Повышаем права сс и позволяем ему занимать привилегированные порты:
`setcap "cap_net_bind_service=+eip" /etc/ss-go/ss-go`

12. Устанавливаем v2ray плагин:

    * Cкачиваем плагин (вместо v1.3.1/v2ray-plugin-linux-amd64-v1.3.1.tar.gz может быть что-то другое, последняя версия лежит тут <https://github.com/shadowsocks/v2ray-plugin/releases/latest>)
`wget https://github.com/shadowsocks/v2ray-plugin/releases/download/v1.3.1/v2ray-plugin-linux-amd64-v1.3.1.tar.gz`

    * Разархивируем сам плагин, тут опять же может быть другой файл в зависимости от скачиваемой версии:
`tar -xf v2ray-plugin-linux-amd64-v1.3.1.tar.gz`

    * Переносим и переименуем плагин:
`mv v2ray-plugin_linux_amd64 /etc/ss-go/v2ray-plugin`

    * Даем возможность v2ray-плагину занимать привилегированные порты:
`setcap "cap_net_bind_service=+eip" /etc/ss-go/v2ray-plugin`

    * Вставляем следующее (вместо <пароль> нужно придумать пароль):
`nano /etc/systemd/system/ss-v2ray.service`

    ```bash
    [Unit]
    Description=Go-shadowsocks2 with V2RAY-websocket obfuscation
    After=network.target
    
    [Service]
    Type=simple
    User=nobody
    Group=nogroup
    LimitNOFILE=51200
    ExecStart=/etc/ss-go/ss-go -s localhost:8008 -password <пароль> -cipher AEAD_CHACHA20_POLY1305 -plugin /etc/ss-go/v2ray-plugin -plugin-opts "server;loglevel=none;path=/bdsm"

    [Install]
    WantedBy=multi-user.target
    ```

    * Сохраняем ctrl + o, закрываем ctrl + x

    * Включаем сервис:
`systemctl enable ss-v2ray.service`

13. Устанавливаем shadowsocks (Если у вас arm64):
    * Качаем rust версию
`wget https://github.com/shadowsocks/shadowsocks-rust/releases/download/v1.14.3/shadowsocks-v1.14.3.aarch64-unknown-linux-gnu.tar.xz`
    * Берём оттуда ssserver
`mv ssserver /etc/ss-go/ss-go`

    * Делаем бинарник исполняемым:
`chmod +x /etc/ss-go/ss-go`

    * Повышаем права сс и позволяем ему занимать привилегированные порты:
`setcap "cap_net_bind_service=+eip" /etc/ss-go/ss-go`

    * Делаем конфиг
`nano /etc/ss-go/shadowsocks-rust.json`

    ```json
    {
    "server": "127.0.0.1",
    "server_port": 8008,
    "password": "пароль",
    "timeout": 120,
    "method": "chacha20-ietf-poly1305",
    "no_delay": true,
    "fast_open": true,
    "reuse_port": true,
    "workers": 1,
    "ipv6_first": false,
    "nameserver": "1.1.1.1",
    "mode": "tcp_and_udp",
    "plugin": "/etc/ss-go/v2ray-plugin",
    "plugin_opts": "server;loglevel=none;path=/bdsm"
    }
    ```

    * Меняем в
`nano /etc/systemd/system/ss-v2ray.service`

`ExecStart=/etc/ss-go/ss-go -c /etc/ss-go/shadowsocks-rust.json`

## Настраиваем клиент под windows

* Качаем последнюю версию клиента shadowsocks с гитхаба – <https://github.com/shadowsocks/shadowsocks-windows/releases> и устанавливаем.

* Качаем последнюю версию плагина v2ray: <https://github.com/shadowsocks/v2ray-plugin/releases>

* Файлик v2ray-plugin_windows_amd64.exe кидаем в одну с папку с исполняемым файлом ss-клиента Shadowsocks.exe

* В конфиге клиента прописываем

```text
server addr - <домен>
server port - 443
password - <пароль>
encryption - chacha20-ietf-poly1305
plugin program - v2ray-plugin_windows_amd64.exe
plugin options - tls;host=<домен>;path=/bdsm
proxy port - локальный порт куда будем направлять браузер (по дефолту 1080, можно не трогать)
```

## Клиент под android

1. Устанавливаем <https://play.google.com/store/apps/details?id=com.github.shadowsocks>
2. +v2ray <https://play.google.com/store/apps/details?id=com.github.shadowsocks.plugin.v2ray>
