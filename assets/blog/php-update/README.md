# PHP 8.2.35 на CentOS 7: закрываем CVE-2026-109618 и CVE-2026-109619 без обновления Bitrix

21 октября 2026 года PHP выпустил 8.5.12, 8.4.27, 8.3.36 и 8.2.35. Эти релизы закрывают две критичные уязвимости (CVSS 4.0 — 9.2), которые дают удалённое выполнение кода без авторизации. Под CentOS 7 готовых пакетов нет: remi заморозил репозиторий EL7 на 8.2.20 ещё в июне 2024-го.

Ниже рассказано, как мы за вечер пересобрали PHP 8.2.35 под CentOS 7 из исходного пакета remi, проверили его на копии боевого сервера и поставили на прод. Простой составил 4.5 секунды. Все скрипты лежат рядом и проверены, их можно повторить у себя.

## Коротко

- **Bitrix обновлять не нужно.** Переход 8.2.20 → 8.2.35 — патч-релиз внутри ветки 8.2 с тем же API модулей (`20220829`). Bitrix и PECL-расширения (apcu, memcache, geoip, zip и т. д.) работают без пересборки.
- remi в день релиза выложил исходный пакет `php-8.2.35-1.remi.src.rpm`. Он собирается на CentOS 7 с двумя правками: ICU 73 вместо 74 (нужен только для `php-intl`) и одной строкой совместимости с OpenSSL 1.0.2.
- После обновления mod_php нужен **полный** рестарт Apache. Graceful-перезагрузка перечитывает `php.ini`, но оставляет в памяти старый `libphp.so`.
- Пока нового PHP нет, помогут временные меры: выключить `session.upload_progress` и урезать размер тела запроса. Полной защиты они не дают.

## Что за уязвимости

| CVE | Advisory | Суть |
|---|---|---|
| CVE-2026-109618 | [GHSA-w8hw-w9fx-j79w](https://github.com/php/php-src/security/advisories/GHSA-w8hw-w9fx-j79w) | RCE через порчу состояния при нехватке памяти (OOM) |
| CVE-2026-109619 | [GHSA-6wmf-4rv5-p3rp](https://github.com/php/php-src/security/advisories/GHSA-6wmf-4rv5-p3rp) | RCE через «зависшее» глобальное состояние между запросами |

- Затронуты все версии до 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12. Релизов для 8.1 и старше не будет. Для 7.4, 8.0 и 8.1 опубликованы только минимальные бэкпорты в исходниках, в ветках `PHP-x.y-CVE-2026-109618-109619` репозитория php-src.
- Уязвимы все SAPI, которые обслуживают веб: mod_php, FPM, CGI, FrankenPHP, LiteSpeed. Для **Apache + mod_php** эксплуатация подтверждена, причём срабатывает она ещё до запуска кода приложения.
- В advisory прямо сказано, что полностью проблему закрывает только обновление, а обходные настройки лишь снижают риск.

Первоисточник: [анонс на php.net](https://www.php.net/archive/2026.php#2026-10-21-5).

## Исходная ситуация

| | |
|---|---|
| ОС | CentOS 7.9 (поддержка закончилась 30.06.2024) |
| Окружение | BitrixVM 7.5 |
| Веб | nginx → Apache 2.4.6 prefork + mod_php, рядом `httpd-scale` (панель BitrixVM) |
| PHP | 8.2.20 из `remi-php82`, последняя сборка remi для EL7 |
| OpenSSL | 1.0.2k, системный |
| Bitrix | 24.x, обновлять нельзя |

Обновление Bitrix здесь и не требуется: он уже работает на PHP 8.2. Мешает только то, что для CentOS 7 никто больше не собирает пакеты.

## Шаг 0. Временные меры (5 минут)

Скрипт [`server/mitigate.sh`](server/mitigate.sh) делает следующее:

- Добавляет в `/etc/php.d/z_bx_custom.ini` (BitrixVM подключает этот файл последним) строку `session.upload_progress.enabled = Off`. Это закрывает один из подтверждённых путей CVE-2026-109619. Bitrix эту функцию не использует. Мы проверили поиском по ядру и `local/`: совпадение в модуле `clouds` — просто id DOM-элемента.
- Снижает `post_max_size` / `upload_max_filesize` с 1024M до 64M/60M, а `client_max_body_size` в nginx — до 64m. Перед этим посмотрите, какого размера файлы реально загружают ваши пользователи.
- Делает бэкапы в `/root/php-cve-backup-*`, запускает `nginx -t` и `apachectl -t`, затем reload. Для смены `php.ini` у mod_php хватает graceful-перезагрузки.

```bash
LIMIT_MB=64 bash server/mitigate.sh
```

`memory_limit=-1`, главную меру из advisory против CVE-2026-109618, мы сознательно не включали. На сервере MySQL занимал 150+ ГБ при отсутствии swap. Запрос без лимита памяти доведёт до OOM-killer, а тот, скорее всего, выберет mysqld. Если всё же включать, то только вместе с лимитом памяти на cgroup httpd и `oom_score_adj` для mysqld.

## Шаг 1. Собираем RPM под CentOS 7 (Docker, ~10 минут)

В [`build/`](build/) лежат:

- `Dockerfile` — CentOS 7 с репозиториями vault.centos.org, архивом EPEL 7 и remi EL7. Отпечатки ключей EPEL и remi зашиты.
- `build.sh` — скачивает SRPM, сверяет исходник с php.net, правит spec, ставит зависимости и собирает.
- `php-8.2.35-openssl102.patch` — патч совместимости с OpenSSL 1.0.2.
- `php82.spec.diff` — все наши изменения spec относительно remi: 3 правки.

```bash
docker build -t php82-el7-build build/
```

```bash
docker run --rm -v "$PWD/out:/out" php82-el7-build
```

Результат появится в `out/RPMS/x86_64/` (33 пакета плюс `SHA256SUMS`), `out/SRPMS/php-8.2.35-1.el7.local.src.rpm` и `out/build.log`. На 8 vCPU установка зависимостей заняла около 4 минут, сборка — около 6, регрессионные тесты пропущены. Другую версию можно собрать так: `-e PHP_VERSION=8.2.36`. Патч OpenSSL тогда может уже не понадобиться или не наложиться.

> Если `docker` смотрит на удалённый демон (`DOCKER_HOST` или `docker context`), `-v` с локальным путём смонтирует пустую папку на удалённой машине. Тогда запускайте контейнер без `--rm` и забирайте результат командой `docker cp <container>:/out ./out`.

### Грабли при сборке

1. **Зеркала CentOS 7 мертвы.** Базовые репозитории берём с `vault.centos.org/7.9.2009`, EPEL 7 — из `dl.fedoraproject.org/pub/archive/epel/7`. Ключа EPEL в архиве нет, он лежит в `pub/epel/RPM-GPG-KEY-EPEL-7`. Отпечаток сверяем: `91E9 7D7C 4A5E 96F1 7F3E 888F 6A2F AEA2 352C 64E5`.
2. **SRPM remi собран на Fedora.** В его заголовке есть `rpmlib(RichDependencies)`, и `rpm -i` на CentOS 7 отказывается его ставить. Распаковываем через `rpm2cpio`, и `rpmbuild` разбирает spec заново, уже под EL7. В spec remi ветки `%if 0%{?rhel} == 7` по-прежнему есть: встроенный pcre2, системный gcc 4.8.5, без devtoolset.
3. **Подпись SRPM rpm 4.11 проверить не может** («not an OpenPGP signature»). Поэтому `build.sh` сверяет главное — архив `php-8.2.35.tar.xz` — с sha256, который php.net публикует для релиза.
4. **ICU.** Spec требует ICU ≥ 74, а в remi EL7 максимум `libicu73`. Снижаем требование до 73. Это касается только `php-intl`.
5. **OpenSSL 1.0.2.** Сборка падает в `ext/openssl/xp_ssl.c` с ошибкой `subscripted value is neither array nor pointer nor vector`. В 8.2.35 этот файл вызывает `ASN1_STRING_get0_data()`, а она появилась только в OpenSSL 1.1. В соседнем `openssl.c` у PHP есть замена для старого OpenSSL, а в `xp_ssl.c` её забыли. Наш патч — одна строка `#define` внутри уже существующего блока `#if PHP_OPENSSL_API_VERSION < 0x10100`. После сборки мы проверили, что в логе нет ни одного «implicit declaration of function». Ещё проверили, что все 336 функций OpenSSL, которые используют `libphp.so` и `php`, экспортирует системный `libssl.so.10` / `libcrypto.so.10`.
6. **ZTS собираем тоже**, как в пакетах remi для el7, чтобы списки файлов в пакетах совпадали со старыми.

## Шаг 2. Проверка на копии сервера

Скрипт [`test/smoke-test.sh`](test/smoke-test.sh) поднимает в чистом контейнере тот же PHP 8.2.20 из remi, те же PECL-пакеты и httpd, что на сервере. Сверху кладёт **ваши** `php.ini` и `php.d/`. Затем обновляет всё до собранных пакетов ровно так же, как это будет на сервере, сравнивает `php -m` и открывает страницу через mod_php. Заодно он сохраняет пакеты 8.2.20 для отката в `out/rollback/`.

Снимаем конфиги с сервера:

```bash
ssh root@SERVER "tar czf - /etc/php.ini /etc/php.d /etc/httpd/conf.d/php.conf /etc/httpd/conf.modules.d/20-php.conf" > prod-php-conf.tgz
```

Списки пакетов для переменных `CORE` и `PECL` берём из вывода `rpm -qa 'php*'` на сервере. В `CORE` идут подпакеты с исходным пакетом `php-8.2.*`, в `PECL` — всё остальное:

```bash
docker run --rm -v "$PWD/out:/out" -v "$PWD/test:/test:ro" -v "$PWD/prod-php-conf.tgz:/prod-php-conf.tgz:ro" -e CORE="php php-bcmath php-cli php-common php-gd php-ldap php-mbstring php-mysqlnd php-opcache php-pdo php-process php-pspell php-sodium php-xml" -e PECL="php-pecl-apcu php-pecl-geoip php-pecl-mcrypt php-pecl-memcache php-pecl-rrd php-pecl-runkit7 php-pecl-xdebug3 php-pecl-zip php-pear php-zipstream" --entrypoint bash php82-el7-build /test/smoke-test.sh
```

У нас список модулей до и после совпал один в один. mod_php ответил `8.2.35 apache2handler`, в `error_log` ошибок PHP нет, в `/etc/php.d` новые файлы не появились.

## Шаг 3. Установка на сервер

Копируем на сервер нужные RPM вместе с `SHA256SUMS`, пакеты для отката и скрипты из `server/`:

```bash
scp -r out/RPMS/x86_64 out/rollback server root@SERVER:/root/php-8.2.35/
```

```bash
ssh root@SERVER "cd /root/php-8.2.35 && bash server/install.sh x86_64"
```

[`server/install.sh`](server/install.sh) делает следующее:

1. Определяет, какие подпакеты PHP установлены: всё, что собрано из исходного пакета `php-8.2.*`. pecl и pear не трогает, у них тот же API.
2. Сверяет sha256 ровно тех файлов, которые будет ставить.
3. Проверяет `PrivateTmp` у `httpd.service`. Если он включён, рестарт создаст новый `/tmp`, и файловые сессии PHP пропадут. В BitrixVM он выключен дроп-ином `custom.conf`, сессии лежат в `/tmp/php_sessions`.
4. Снимает состояние «до»: `php -m`, список `php.d`, md5 конфигов, `rpm -qa 'php*'`.
5. Выполняет `rpm -Uvh --test`, потом `rpm -Uvh`. Конфиги помечены `%config(noreplace)`: ваши `php.ini` и `php.d` остаются на месте, новые версии ложатся рядом как `.rpmnew`. Если список модулей изменился, скрипт останавливается **до** рестарта: Apache в этот момент ещё работает на старом коде из памяти.
6. Убивает воркеры старше часа и делает **полный** `systemctl restart httpd`, а затем `httpd-scale` и php-fpm, если они есть.
7. Проверяет, что ни один процесс не держит старый код: в `/proc/*/maps` не должно остаться `libphp.so;…` или `(deleted)`. Затем дёргает локальный Apache (`CHECK_URL`, по умолчанию `http://127.0.0.1:8888/`, как в BitrixVM) и показывает хвост `error_log`.

### Почему именно полный рестарт

Graceful-перезагрузка (`systemctl reload httpd`) заново инициализирует PHP и перечитывает `php.ini`, но **не меняет загруженный `libphp.so`**. Библиотека остаётся в памяти мастера, и новые воркеры наследуют старый код.

Мы увидели это вживую. Панель BitrixVM `httpd-scale` с сентября 2024 года работала на библиотеке **PHP 8.1**: файл давно заменили на 8.2, но в памяти процесса он остался как `libphp.so;66d725d6 (deleted)`. При каждом reload она писала в лог `Module compiled with module API=20220829, PHP compiled with module API=20210902`. После обновления это проверяется так:

```bash
grep -lE 'libphp\.so(;| \(deleted\))' /proc/[0-9]*/maps
```

### Почему перед рестартом убиваем старые воркеры

В systemd-юните CentOS 7 стоит `ExecStop=/bin/kill -WINCH`, то есть graceful-stop: Apache ждёт, пока каждый воркер допишет свой запрос. У нас два воркера висели в `poll()` по 81 и 89 дней. Без `kill` рестарт ждал бы их до `TimeoutStopSec` (90 секунд), и всё это время сайт не отвечал бы. С `kill` основной Apache перезапустился за 4.5 секунды, `httpd-scale` — за 1.2.

### Результат на проде

- 14 пакетов обновлены. Модули, `php.d` и конфиги остались прежними.
- Ни один из 238 процессов httpd не держит старый код. Оба Apache загрузили `libphp.so` из пакета `php-8.2.35-1.el7.local`.
- Ответов 502 не было. Доля 5xx в логе nginx: 2.03% до и 1.74% после. PHP Fatal — ноль.
- Файловые сессии (около 73 тысяч) пережили рестарт, пользователей не разлогинило.

## Откат

```bash
bash /root/php-8.2.35/server/rollback.sh /root/php-8.2.35/rollback
```

Скрипт ставит `rpm -Uvh --oldpackage` для тех пакетов из папки, которые установлены, и полностью перезапускает Apache. Пакеты 8.2.20 сохраняет `smoke-test.sh`. Ещё их можно скачать из remi-php82 для EL7: репозиторий заморожен, но работает.

## Что дальше

- Это временное решение. Ядро, OpenSSL и Apache в CentOS 7 тоже больше не получают исправлений. Переезд на Alma или Rocky 9 с BitrixVM 9 обновления Bitrix не требует: он уже работает на PHP 8.2.
- `session.upload_progress` лучше оставить выключенным и после обновления. Advisory советует так делать, если функция не нужна.
- Следующие релизы 8.2 (поддержка ветки до 31.12.2026) собираются тем же комплектом: `-e PHP_VERSION=…`.
- Для PHP 7.4, 8.0 и 8.1 релизов не будет, только бэкпорты в исходниках. Это отдельная история.

## Состав комплекта

| Файл | Что это |
|---|---|
| `build/Dockerfile` | окружение сборки: CentOS 7, vault, архив EPEL 7, remi EL7, зашитые отпечатки ключей |
| `build/build.sh` | SRPM → сверка с php.net → правки spec → `yum-builddep` → `rpmbuild` |
| `build/vault.repo` | репозитории CentOS 7.9 (vault) и EPEL 7 (archive) |
| `build/php-8.2.35-openssl102.patch` | совместимость `xp_ssl.c` с OpenSSL 1.0.2 |
| `build/php82.spec.diff` | все изменения spec относительно remi |
| `test/smoke-test.sh` | копия сервера в контейнере → обновление → сравнение, плюс пакеты для отката |
| `server/mitigate.sh` | временные меры до обновления |
| `server/install.sh` | установка: проверки, снимок, `rpm -Uvh`, полный рестарт, проверка памяти процессов |
| `server/rollback.sh` | откат на предыдущие RPM |
| `rpms/x86_64/` | наши собранные пакеты `*-8.2.35-1.el7.local` (32 штуки без debuginfo) плюс `SHA256SUMS` |
| `rpms/php-8.2.35-1.el7.local.src.rpm` | пересобранный под EL7 SRPM: `rpmbuild --rebuild` на CentOS 7 без возни с rpm2cpio |

Пакеты в `rpms/` взяты из той же сборки, что стоит у нас на проде: 14 из них установлены там, sha256 совпадают. Если не хотите доверять чужим бинарникам, соберите сами: сборка воспроизводится командой `docker run` из шага 1.
