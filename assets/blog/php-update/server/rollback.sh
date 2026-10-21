#!/bin/bash
# Roll PHP back to the RPMs in <dir> (e.g. remi 8.2.20 saved by test/smoke-test.sh) and fully restart Apache / FPM.
# Only files whose package is installed are used.
set -uo pipefail
DIR=$(cd "${1:?usage: rollback.sh <dir with the previous php rpms>}" && pwd)
FILES=()
for f in "$DIR"/*.rpm; do
  n=$(rpm -qp --nosignature --qf '%{NAME}' "$f" 2>/dev/null) || continue
  rpm -q "$n" >/dev/null 2>&1 && FILES+=("$f")
done
[ ${#FILES[@]} -gt 0 ] || { echo "no rpms for installed packages in $DIR" >&2; exit 1; }
rpm -Uvh --oldpackage "${FILES[@]}" || exit 1
systemctl restart httpd
for u in httpd-scale php-fpm; do
  if systemctl is-active --quiet "$u"; then systemctl restart "$u"; fi
done
php -v | head -1
