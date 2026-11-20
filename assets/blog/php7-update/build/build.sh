#!/bin/bash
# Rebuild Remi's PHP 7.4 (EOL) source package with security backports for CentOS 7.
# Runs inside the image from build/Dockerfile.
# Output: /out/RPMS/x86_64/*.rpm (+SHA256SUMS), /out/SRPMS/*.src.rpm, /out/build.log
# Env: REMI_RELEASE, DIST,
#      RUN_TESTS (default 1: the spec runs the PHP test suite, ~2 min, failures do not stop the build; 0 skips it)
set -euo pipefail

VER=7.4.33
BUNDLED_RELEASE=32
BUNDLED_SRPM_SHA256=d83c7594bd237705b2080f3097917237af87b95cbd2ac40056183802fd9aad1e
REL=${REMI_RELEASE:-$BUNDLED_RELEASE}
DIST=${DIST:-.el7.local}
SRPM=php-$VER-$REL.remi.src.rpm
TOP=/root/rpmbuild
OUT=/out
mkdir -p "$TOP/SOURCES" "$TOP/SPECS" "$OUT" /tmp/srpm

echo "== fetch $SRPM"
cd /tmp/srpm
curl -fsSL --retry 5 -o "$SRPM" "https://rpms.remirepo.net/SRPMS/$SRPM"
# Pin the complete source package (including Remi's patches) for the published build.
if [[ $REL == "$BUNDLED_RELEASE" ]]; then
  echo "$BUNDLED_SRPM_SHA256  $SRPM" | sha256sum -c -
fi
CHANGELOG=$(rpm -qp --nosignature --changelog "$SRPM" 2>/dev/null)
sed -n '1,3p' <<< "$CHANGELOG"
grep -q 'CVE-2026-109618' <<< "$CHANGELOG" || { echo "ERROR: $SRPM changelog does not mention CVE-2026-109618"; exit 1; }

# EL7 rpm 4.11 cannot install this SRPM (RichDependencies). Extract it with rpm2cpio
# and independently verify the PHP tarball against the checksum published on php.net.
rpm2cpio "$SRPM" | cpio -idm --quiet
rm -f "$SRPM"
SHA256=$(curl -fsSL "https://www.php.net/releases/index.php?json&version=$VER" \
  | python -c 'import json,sys; print([s["sha256"] for s in json.load(sys.stdin)["source"] if s["filename"].endswith(".tar.xz")][0])')
echo "$SHA256  php-$VER.tar.xz" | sha256sum -c -
# Remi regrouped its backports by upstream version starting with release 32.
if [[ "$REL" == 31 ]]; then
  BACKPORTS=(php-7.4-cve-2026-109618.patch)
else
  BACKPORTS=(php-from-8.2.35-to-7.4.patch php-from-8.2.36-to-7.4.patch)
fi
for patch in "${BACKPORTS[@]}"; do
  [[ -s "$patch" ]] || { echo "ERROR: missing Remi backport $patch" >&2; exit 1; }
done

SPEC=$(ls *.spec)
cp -a /tmp/srpm/. "$TOP/SOURCES/"
mv "$TOP/SOURCES/$SPEC" "$TOP/SPECS/$SPEC"
S=$TOP/SPECS/$SPEC

echo "== adapt $SPEC for EL7"
# 1) Remi builds php-intl with ICU 78 (74 in the October spec); EL7 provides ICU 73.
sed -ri '/^BuildRequires: pkgconfig\(icu-/ s/>= (74|78)$/>= 73/' "$S"
# 2) fix the always-true ICU 74 check of php-7.4.33-icu.patch (configure would demand C++17, absent in gcc 4.8)
cp /build/php-7.4.33-icu-check.patch "$TOP/SOURCES/"
grep -q '^Patch304:' "$S" || sed -i '/^Patch303:/a Patch304: php-7.4.33-icu-check.patch' "$S"
grep -q '^%patch -P304 ' "$S" || sed -i '/^%patch -P303 /a %patch -P304 -p1 -b .icucheck' "$S"

echo "== build deps"
yum-builddep -y -q "$S"

ARGS=(--define "dist $DIST")
NOTE="PHP test suite included"
if [ "${RUN_TESTS:-1}" != 1 ]; then ARGS+=(--define 'runselftest 0'); NOTE="PHP test suite skipped"; fi
echo "== rpmbuild (NTS + ZTS like remi's el7 packages, $NOTE)"
START=$(date +%s)
if ! rpmbuild -ba "${ARGS[@]}" "$S" > "$OUT/build.log" 2>&1; then
  tail -n 60 "$OUT/build.log"
  exit 1
fi
echo "built in $(( ($(date +%s) - START) / 60 )) min"
grep -E '^(Tests failed|Tests passed)' "$OUT/build.log" || true
grep -A12 '^FAILED TEST SUMMARY' "$OUT/build.log" | grep '\[' || true
if grep -q 'implicit declaration of function' "$OUT/build.log"; then
  echo "WARNING: implicit declarations in build.log (missing OpenSSL/library API?):"
  grep 'implicit declaration of function' "$OUT/build.log" | sort -u | head || true
fi

rm -rf "$OUT/RPMS" "$OUT/SRPMS"
cp -a "$TOP/RPMS" "$TOP/SRPMS" "$OUT/"
(cd "$OUT/RPMS/x86_64" && sha256sum *.rpm > SHA256SUMS)
ls "$OUT/RPMS/x86_64" "$OUT/SRPMS"
