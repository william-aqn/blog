# Build environment for PHP RPMs on CentOS 7 (EL7):
# CentOS 7.9 from vault.centos.org, EPEL 7 from the Fedora archive, remi EL7 (frozen, still online).
#   docker build -t php82-el7-build build/
#   docker run --rm -v "$PWD/out:/out" php82-el7-build
FROM centos:7

# mirrorlist.centos.org is gone: replace all repo files with vault + EPEL archive
RUN rm -f /etc/yum.repos.d/*.repo
COPY vault.repo /etc/yum.repos.d/vault.repo

# EPEL 7 key is not in the archive tree; take it from pub/epel and pin the fingerprint.
# remi-release requires epel-release, which we replace with vault.repo -> --nodeps; pin remi's EL7 key too.
RUN set -e; \
    curl -fsSL --retry 5 -o /etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-7 https://dl.fedoraproject.org/pub/epel/RPM-GPG-KEY-EPEL-7; \
    fp() { gpg --with-fingerprint --with-colons "$1" 2>/dev/null | awk -F: '/^fpr/{print $10; exit}'; }; \
    [ "$(fp /etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-7)" = 91E97D7C4A5E96F17F3E888F6A2FAEA2352C64E5 ]; \
    rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-7 /etc/pki/rpm-gpg/RPM-GPG-KEY-EPEL-7; \
    curl -fsSL --retry 5 -o /tmp/remi-release-7.rpm https://rpms.remirepo.net/enterprise/remi-release-7.rpm; \
    rpm -ivh --nodeps /tmp/remi-release-7.rpm; \
    [ "$(fp /etc/pki/rpm-gpg/RPM-GPG-KEY-remi)" = 1EE04CCE88A4AE4AA29A5DF5004E6F4700F97F56 ]; \
    rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-remi; \
    sed -i '/^\[remi\]/,/^\[/ s/^enabled=0/enabled=1/' /etc/yum.repos.d/remi.repo; \
    yum -y -q install rpm-build yum-utils gnupg2 which; \
    yum clean all

COPY build.sh php-8.2.35-openssl102.patch /build/
RUN chmod +x /build/build.sh
VOLUME /out
CMD ["/build/build.sh"]
