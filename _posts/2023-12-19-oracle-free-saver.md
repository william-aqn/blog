---
layout: post
title: "Создаём активность на серверах Oracle free tier"
description: "Защищаем инстанс от отключения"
tags: nodejs cpu
---
# Создаём активность на серверах Oracle free tier

Надо как то защитить сервер на Oracle, что бы инстанс не отключали из за новой политики 
[Oracle Reclamation of Idle Compute Instances](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

```
Idle Always Free compute instances may be reclaimed by Oracle. Oracle will deem virtual machine and bare metal compute instances as idle if, during a 7-day period, the following are true:

    CPU utilization for the 95th percentile is less than 20%
    Network utilization is less than 20%
    Memory utilization is less than 20% (applies to A1 shapes only)
```

Хотят нагрузку на cpu - делаем: [cpu.js](https://github.com/william-aqn/blog/blob/main/assets/blog/oracle/cpu.js)
```js
import Cpu from "./cpu.js";
new Cpu(20);
```
![htop](/assets/blog/oracle/oracle-node.png)


