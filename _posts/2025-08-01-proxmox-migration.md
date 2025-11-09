---
layout: post
title: "Перенос контейнеров Proxmox на другой Proxmox"
description: "И выгрузка бэкапов в облако B2"
tags: proxmox rclone
---

# Перенос контейнеров Proxmox VE на другой Proxmox

1. Установить свежую версию Proxmox и [PVE Post Install](https://community-scripts.github.io/ProxmoxVE/scripts?id=post-pve-install)

2. Сначала сделать бэкапы, они располагаются в директории
`/var/lib/vz/dump/`

3. Перенести бэкапы на новый proxmox в аналогичную директорию

4. Обратить внимание на **идентификаторы** виртуальных машин (обычно **100**, **101**, ...) и ключ **-storage**. 
   Если явно не указать хранилище **local-lvm**, машина будет восстановлена в хранилище **local**

5. Восстановить **LXC** контейнеры через команду
```sh
pct restore 102 /var/lib/vz/dump/vzdump-lxc-102-2025_08_01-17_46_12.zst -storage local-lvm
```

6. Восстановить **QEMU** виртуальные машины через команду
```sh
qmrestore /var/lib/vz/dump/vzdump-qemu-100-2025_08_01-18_07_50.vma.zst 100 -storage local-lvm
```

7. Не забыть настроить создание бэкапов и выгрузку их в облако, например в [b2](https://www.backblaze.com/cloud-storage)

8. Создать конфиг для rclone:b2
```sh
mkdir -p /root/.config/rclone
nano /root/.config/rclone/rclone.conf

[b2]
type = b2
account = 00************000000000*
key = *00************************
hard_delete = true
```

9. Создать скрипт для выгрузки в b2 бэкапов
```sh
nano backup.sh
chmod +x backup.sh

#!/bin/bash
rclone sync /var/lib/vz/dump/ b2:proxmoxbk
```

10. Добавить в крон запуск скрипта
```sh
crontab -e
0 23 * * * /bin/bash /root/backup.sh >/dev/null 2>&1
```

11.  Проверить настройки оборудования и мапинг USB устройств

12.  Отключить виртуальные машины на старом **Proxmox** и включить на новом **Proxmox**

13.  Запустить вручную **backup.sh** и **удостовериться**, что бэкапы в **облаке b2**