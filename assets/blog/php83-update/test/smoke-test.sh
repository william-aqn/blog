#!/bin/bash
# Smoke test in a clean container from build/Dockerfile: rebuild the server's PHP 8.3 state (remi 8.3.x for EL7 + PECL
# + httpd + optionally the server's own php configs), upgrade it to the freshly built RPMs exactly like on the server.
#   docker run --rm -v "$PWD/out:/out" -v "$PWD/test:/test:ro" [-v "$PWD/prod-php-conf.tgz:/prod-php-conf.tgz:ro"] \
#     [-v "$PWD/server-modules:/server-modules:ro"] [-e CORE="..."] [-e PECL="..."] --entrypoint bash php83-el7-build /test/smoke-test.sh
# CORE: php core subpackages installed on the server (rpm -qa 'php*' whose source rpm is php-8.3.*)
# PECL: the other php* packages; exact versions (name-version-release) pin the server's builds.
#       yum silently skips versions gone from the repo: copy such modules (*.so) from the server into /server-modules.
# OLD / NEW: version-release of the server's php and of the build; REPO: remi repo of the branch.
# Also saves the old RPMs for rollback into /out/rollback.
set -euo pipefail
CORE=${CORE:-php php-bcmath php-cli php-common php-fpm php-gd php-intl php-mbstring php-mysqlnd php-opcache php-pdo php-process php-soap php-sodium php-xml}
PECL=${PECL:-php-pecl-apcu php-pecl-redis6 php-pecl-memcached php-pecl-imagick-im6 php-pecl-zip php-pecl-igbinary php-pecl-msgpack php-pecl-mcrypt}
OLD=${OLD:-8.3.8-1.el7.remi}
NEW=${NEW:-8.3.36-1.el7.local}
REPO=${REPO:-remi-php83}
RPMS=/out/RPMS/x86_64

echo "== server-like install: php $OLD + $PECL"
sed -i "/^\[$REPO\]/,/^\[/ s/^enabled=0/enabled=1/" "/etc/yum.repos.d/$REPO.repo"
yum -y -q install httpd $(for p in $CORE; do echo "$p-$OLD"; done) $PECL
echo "installed: $(rpm -qa 'php*' | sort | tr '\n' ' ')"

if [ -d /server-modules ]; then
  echo "== modules copied from the server"
  for so in /server-modules/*.so; do
    cp -a "$so" /usr/lib64/php/modules/
    for lib in $(ldd "/usr/lib64/php/modules/$(basename "$so")" | awk '/not found/ {print $1}'); do
      yum -y -q install "$lib()(64bit)"
    done
    echo "$(basename "$so") $(sha256sum "$so" | cut -c1-16)"
  done
fi

if [ -f /prod-php-conf.tgz ]; then
  echo "== overlay the server's php configs"
  mkdir -p /prodconf && tar xzf /prod-php-conf.tgz -C /prodconf
  cp -a /prodconf/etc/php.ini /etc/php.ini
  rm -rf /etc/php.d && cp -a /prodconf/etc/php.d /etc/php.d
  if [ -d /prodconf/etc/httpd ]; then cp -a /prodconf/etc/httpd/. /etc/httpd/; fi
  if [ -d /prodconf/etc/php-fpm.d ]; then rm -rf /etc/php-fpm.d && cp -a /prodconf/etc/php-fpm.d /etc/php-fpm.d; fi
  for d in $(php -r 'echo ini_get("session.save_path"), " ", ini_get("upload_tmp_dir");' 2>/dev/null); do
    mkdir -p "$d" && chmod 1777 "$d"
  done
fi
php -m > /tmp/m-before.txt 2>&1
ls -1 /etc/php.d > /tmp/phpd-before.txt
if grep -q 'Warning' /tmp/m-before.txt; then echo "NOTE: startup warnings already before the upgrade:"; grep 'Warning' /tmp/m-before.txt; fi

echo "== rollback set -> /out/rollback"
mkdir -p /out/rollback
yumdownloader -q --destdir=/out/rollback $(for p in $CORE; do echo "$p-$OLD"; done)
(cd /out/rollback && sha256sum *.rpm > SHA256SUMS)

echo "== upgrade to $NEW"
NEWFILES=$(for p in $CORE; do echo "$RPMS/$p-$NEW.x86_64.rpm"; done)
rpm -Uvh --test $NEWFILES
rpm -Uvh $NEWFILES
php -v | head -1
php -m > /tmp/m-after.txt 2>&1
if diff /tmp/m-before.txt /tmp/m-after.txt; then echo "OK: module list unchanged"; else echo "FAIL: module list changed"; exit 1; fi
ls -1 /etc/php.d | diff /tmp/phpd-before.txt - && echo "OK: /etc/php.d unchanged"
if command -v php-fpm >/dev/null; then
  php-fpm -v | head -1
  php-fpm -t 2>&1 | tail -1
fi

echo "== mod_php"
httpd -t
httpd -k start
sleep 2
printf '%s\n' '<?php echo PHP_VERSION, " ", PHP_SAPI, " ", implode(",", get_loaded_extensions()), "\n";' > /var/www/html/t.php
curl -s http://127.0.0.1/t.php
grep -E 'PHP (Warning|Fatal error|Parse error|Notice)|segfault|exit signal' /var/log/httpd/error_log || echo "OK: no PHP errors in httpd error_log"
httpd -k stop
echo "SMOKE OK"
