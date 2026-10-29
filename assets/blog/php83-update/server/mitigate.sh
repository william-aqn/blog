#!/bin/bash
# Interim measures for CVE-2026-109618 / CVE-2026-109619 until PHP is updated. NOT a fix (see the advisory).
#  - session.upload_progress.enabled = Off   (one of the confirmed paths of CVE-2026-109619)
#  - smaller request bodies: post_max_size / upload_max_filesize in php, client_max_body_size in nginx
# Env: INI (default BitrixVM's /etc/php.d/z_bx_custom.ini — loaded last), NGINX (/etc/nginx/nginx.conf), LIMIT_MB (64)
set -euo pipefail
INI=${INI:-/etc/php.d/z_bx_custom.ini}
NGINX=${NGINX:-/etc/nginx/nginx.conf}
LIMIT_MB=${LIMIT_MB:-64}
BACKUP=/root/php-cve-backup-$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP"
touch "$INI"
cp -a "$INI" "$BACKUP/"
[ -f "$NGINX" ] && cp -a "$NGINX" "$BACKUP/"
echo "backups: $BACKUP"

if ! grep -q 'CVE-2026-109618' "$INI"; then
  cat >> "$INI" <<EOF

; CVE-2026-109618/109619 interim mitigation, $(date +%F)
session.upload_progress.enabled = Off
post_max_size = ${LIMIT_MB}M
upload_max_filesize = $((LIMIT_MB - 4))M
EOF
fi
php -i | grep -E '^(session\.upload_progress\.enabled|post_max_size|upload_max_filesize) '

if command -v nginx >/dev/null && [ -f "$NGINX" ]; then
  sed -i "s/client_max_body_size[[:space:]]*[0-9]*[kKmMgG]\?;/client_max_body_size ${LIMIT_MB}m;/" "$NGINX"
  grep -rn 'client_max_body_size' /etc/nginx/ | grep -v '\.ori' || true
  nginx -t
  systemctl reload nginx
fi

# mod_php re-reads php.ini on a graceful reload (unlike libphp.so itself, see install.sh)
apachectl -t
systemctl reload httpd
if systemctl is-active --quiet httpd-scale; then systemctl reload httpd-scale; fi
if systemctl is-active --quiet php-fpm; then systemctl reload php-fpm; fi
echo "done; rollback: restore files from $BACKUP and reload nginx/httpd"
