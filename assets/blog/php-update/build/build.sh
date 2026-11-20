#!/bin/bash
# Rebuild remi's PHP 8.2 source package for CentOS 7. Runs inside the image from build/Dockerfile.
# Output: /out/RPMS/x86_64/*.rpm (+SHA256SUMS), /out/SRPMS/*.src.rpm, /out/build.log
# Env: PHP_VERSION, DIST
set -euo pipefail

BUNDLED_VERSION=8.2.36
BUNDLED_SRPM_SHA256=68350727c85bfe5fb07c416a8a78779f9c72d39ce1bc1208c93b1db6cf40b5ba
VER=${PHP_VERSION:-$BUNDLED_VERSION}
DIST=${DIST:-.el7.local}
SRPM=php-$VER-1.remi.src.rpm
TOP=/root/rpmbuild
OUT=/out
mkdir -p "$TOP/SOURCES" "$TOP/SPECS" "$OUT" /tmp/srpm

echo "== fetch $SRPM"
cd /tmp/srpm
curl -fsSL --retry 5 -o "$SRPM" "https://rpms.remirepo.net/SRPMS/$SRPM"
# Pin the complete source package (including Remi's patches) for the published build.
if [[ $VER == "$BUNDLED_VERSION" ]]; then
  echo "$BUNDLED_SRPM_SHA256  $SRPM" | sha256sum -c -
fi

# EL7 rpm 4.11 cannot install this SRPM (RichDependencies). Extract it with rpm2cpio
# and independently verify the PHP tarball against the checksum published on php.net.
rpm2cpio "$SRPM" | cpio -idm --quiet
rm -f "$SRPM"
SHA256=$(curl -fsSL "https://www.php.net/releases/index.php?json&version=$VER" \
  | python -c 'import json,sys; print([s["sha256"] for s in json.load(sys.stdin)["source"] if s["filename"].endswith(".tar.xz")][0])')
echo "$SHA256  php-$VER.tar.xz" | sha256sum -c -

SPEC=$(ls *.spec)
cp -a /tmp/srpm/. "$TOP/SOURCES/"
mv "$TOP/SOURCES/$SPEC" "$TOP/SPECS/$SPEC"
S=$TOP/SPECS/$SPEC

echo "== adapt $SPEC for EL7"
# 1) Remi builds php-intl with ICU 78 (74 in the October spec); EL7 provides ICU 73.
sed -ri '/^BuildRequires: pkgconfig\(icu-/ s/>= (74|78)$/>= 73/' "$S"
# EL7 lacks openpgpverify. Keep source verification in %prep on direct SRPM rebuilds.
sed -i -e 's/^BuildRequires: openpgpverify$/BuildRequires: coreutils/' \
  -e "/^%{?openpgpverify:/a echo '$SHA256  %{SOURCE0}' | sha256sum -c -" "$S"
# 2) OpenSSL 1.0.2: ASN1_STRING_get0_data() shim for ext/openssl/xp_ssl.c
cp /build/php-8.2.35-openssl102.patch "$TOP/SOURCES/"
grep -q '^Patch303:' "$S" || sed -i '/^Patch302:/a Patch303: php-8.2.35-openssl102.patch' "$S"
grep -q '^%patch -P303 ' "$S" || sed -i '/^%patch -P302 /a %patch -P303 -p1 -b .openssl102' "$S"

echo "== build deps"
yum-builddep -y -q "$S"

echo "== rpmbuild (NTS + ZTS like remi's el7 packages, regression tests skipped)"
START=$(date +%s)
if ! rpmbuild -ba --without tests --define "dist $DIST" "$S" > "$OUT/build.log" 2>&1; then
  tail -n 60 "$OUT/build.log"
  exit 1
fi
echo "built in $(( ($(date +%s) - START) / 60 )) min"
if grep -q 'implicit declaration of function' "$OUT/build.log"; then
  echo "WARNING: implicit declarations in build.log (missing OpenSSL/library API?):"
  grep 'implicit declaration of function' "$OUT/build.log" | sort -u | head
fi

rm -rf "$OUT/RPMS" "$OUT/SRPMS"
cp -a "$TOP/RPMS" "$TOP/SRPMS" "$OUT/"
(cd "$OUT/RPMS/x86_64" && sha256sum *.rpm > SHA256SUMS)
ls "$OUT/RPMS/x86_64" "$OUT/SRPMS"
