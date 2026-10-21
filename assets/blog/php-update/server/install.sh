#!/bin/bash
# Install rebuilt PHP RPMs on a CentOS 7 server with Apache + mod_php (remi package layout) and fully restart Apache.
# Usage: install.sh <dir with the new *.rpm and SHA256SUMS>
# Env:   CHECK_URL  local Apache URL to probe after the restart (default BitrixVM: http://127.0.0.1:8888/)
#        STUCK_AGE  Apache workers older than this (seconds) are killed before the restart (default 3600)
#        FORCE=1    continue although httpd.service has PrivateTmp=yes
set -uo pipefail
DIR=$(cd "${1:?usage: install.sh <rpm dir>}" && pwd)
CHECK_URL=${CHECK_URL:-http://127.0.0.1:8888/}
STUCK_AGE=${STUCK_AGE:-3600}
STATE=/root/php-update-$(date +%Y%m%d-%H%M%S)
mkdir -p "$STATE"
die() { echo "ERROR: $*" >&2; exit 1; }

# 1. Packages to upgrade: installed subpackages of the php source rpm (pecl/pear stay: same module API)
mapfile -t NAMES < <(rpm -qa --qf '%{NAME} %{SOURCERPM}\n' | awk '$2 ~ /^php-[0-9]/ {print $1}' | sort -u)
[ ${#NAMES[@]} -gt 0 ] || die "no installed packages built from the php source rpm"
FILES=()
for n in "${NAMES[@]}"; do
  f=$(ls "$DIR/$n"-[0-9]*.x86_64.rpm 2>/dev/null | head -1)
  [ -n "$f" ] || die "no rpm for installed package $n in $DIR"
  FILES+=("$f")
done
echo "will upgrade ${#FILES[@]} packages: ${NAMES[*]}"

# 2. Checksums of exactly these files
(cd "$DIR" && for f in "${FILES[@]}"; do
   b=$(basename "$f"); awk -v f="$b" '{n=$2; sub(/^\*/, "", n)} n == f' SHA256SUMS
 done | sha256sum -c --quiet -) || die "checksum mismatch or missing in $DIR/SHA256SUMS"

# 3. Restart pre-flight: a private /tmp is recreated on restart (PHP sessions there would be lost)
PT=$(systemctl show httpd -p PrivateTmp | cut -d= -f2)
[ "$PT" != yes ] || [ "${FORCE:-}" = 1 ] || die "httpd.service has PrivateTmp=yes: check session.save_path, rerun with FORCE=1"

# 4. Snapshot
php -m > "$STATE/m-before.txt" 2>&1
ls -1 /etc/php.d > "$STATE/phpd-before.txt"
md5sum /etc/php.ini /etc/php.d/* > "$STATE/conf-md5-before.txt" 2>/dev/null
rpm -qa 'php*' | sort > "$STATE/rpm-before.txt"
echo "snapshot: $STATE"

# 5. Upgrade (Apache keeps running the old code from memory until the restart)
rpm -Uvh --test "${FILES[@]}" || die "rpm test transaction failed, nothing changed"
rpm -Uvh "${FILES[@]}" || die "rpm -Uvh failed, check: rpm -qa 'php*'"
php -v | head -1
php -m > "$STATE/m-after.txt" 2>&1
diff "$STATE/m-before.txt" "$STATE/m-after.txt" \
  || die "module list changed; Apache NOT restarted (still old code). Investigate or run rollback.sh"
ls -1 /etc/php.d | diff "$STATE/phpd-before.txt" - || echo "WARNING: /etc/php.d listing changed"
md5sum -c --quiet "$STATE/conf-md5-before.txt" || echo "WARNING: config files changed"

# 6. FULL restart. A graceful reload re-reads php.ini but keeps the old libphp.so mapped in the master.
#    graceful-stop (ExecStop = kill -WINCH) waits for every busy worker, so kill workers stuck for hours first.
kill_stuck() {
  local m; m=$(systemctl show "$1" -p MainPID | cut -d= -f2)
  [ -n "$m" ] && [ "$m" != 0 ] || return 0
  for p in $(pgrep -P "$m"); do
    local e; e=$(ps -o etimes= -p "$p" | tr -d ' ')
    if [ -n "$e" ] && [ "$e" -gt "$STUCK_AGE" ]; then kill -9 "$p" && echo "killed $1 worker $p (${e}s old)"; fi
  done
}
kill_stuck httpd
T0=$(date +%s)
systemctl restart httpd || die "httpd did not start, run rollback.sh"
echo "httpd restarted in $(( $(date +%s) - T0 ))s"
for u in httpd-scale php-fpm; do
  if systemctl is-active --quiet "$u"; then kill_stuck "$u"; systemctl restart "$u" && echo "$u restarted"; fi
done

# 7. Checks
sleep 2
STALE=0
for p in $(pgrep -x httpd) $(pgrep -x php-fpm); do
  grep -qE '(libphp\.so|/php/modules/[^ ]+|/usr/sbin/php-fpm)(;[0-9a-f]+| \(deleted\))' "/proc/$p/maps" 2>/dev/null && STALE=$((STALE + 1))
done
echo "processes still running old PHP code: $STALE"
echo "$CHECK_URL -> $(curl -s -m 20 -o /dev/null -w '%{http_code} %{time_total}s' "$CHECK_URL")"
tail -n 5 /var/log/httpd/error_log
echo "state: $STATE; rollback: rollback.sh <dir with the previous rpms>"
[ "$STALE" = 0 ] || die "some processes still map old PHP code"
