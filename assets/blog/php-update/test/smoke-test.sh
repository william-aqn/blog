#!/bin/bash
# Smoke test in a clean container from build/Dockerfile: rebuild the server's PHP state (remi 8.2.x + PECL + httpd
# + the server's own php configs), upgrade it to the freshly built RPMs exactly like on the server, compare.
#   docker run --rm -v "$PWD/out:/out" -v "$PWD/test:/test:ro" [-v "$PWD/prod-php-conf.tgz:/prod-php-conf.tgz:ro"] \
#     -e CORE="..." -e PECL="..." --entrypoint bash php82-el7-build /test/smoke-test.sh
# CORE: php core subpackages installed on the server (rpm -qa 'php*' whose source rpm is php-8.2.*)
# PECL: the other php* packages (pecl extensions, pear)
# Also saves the old RPMs for rollback into /out/rollback.
set -euo pipefail
CORE=${CORE:-php php-bcmath php-cli php-common php-gd php-ldap php-mbstring php-mysqlnd php-opcache php-pdo php-process php-pspell php-sodium php-xml}
PECL=${PECL:-php-pecl-apcu php-pecl-memcache php-pecl-zip php-pear}
OLD=${OLD:-8.2.20-1.el7.remi}
NEW=${NEW:-8.2.35-1.el7.local}
RPMS=/out/RPMS/x86_64

echo "== server-like install: php $OLD + $PECL"
sed -i '/^\[remi-php82\]/,/^\[/ s/^enabled=0/enabled=1/' /etc/yum.repos.d/remi-php82.repo
yum -y -q install httpd $(for p in $CORE; do echo "$p-$OLD"; done) $PECL

if [ -f /prod-php-conf.tgz ]; then
  echo "== overlay the server's php configs"
  mkdir -p /prodconf && tar xzf /prod-php-conf.tgz -C /prodconf
  cp -a /prodconf/etc/php.ini /etc/php.ini
  rm -rf /etc/php.d && cp -a /prodconf/etc/php.d /etc/php.d
  if [ -d /prodconf/etc/httpd ]; then cp -a /prodconf/etc/httpd/. /etc/httpd/; fi
  for d in $(php -r 'echo ini_get("session.save_path"), " ", ini_get("upload_tmp_dir");' 2>/dev/null); do
    mkdir -p "$d" && chmod 1777 "$d"
  done
fi
php -m > /tmp/m-before.txt 2>&1
ls -1 /etc/php.d > /tmp/phpd-before.txt

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

echo "== mod_php"
httpd -t
httpd -k start
sleep 2
printf '%s\n' '<?php echo PHP_VERSION, " ", PHP_SAPI, " ", implode(",", get_loaded_extensions()), "\n";' > /var/www/html/t.php
curl -s http://127.0.0.1/t.php
grep -iE 'php|segfault' /var/log/httpd/error_log || echo "OK: no PHP errors in httpd error_log"
httpd -k stop
echo "SMOKE OK"
