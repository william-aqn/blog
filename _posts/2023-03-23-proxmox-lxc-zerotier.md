---
layout: post
title: "Настраиваем zerotier в lxc контейнере proxmox"
description: "2 строчки в конфиг"
tags: proxmox zerotier
---
For LXC to work : Enabling tun by default when starting a CT image to get zerotier working :

on proxmox host Edit this file "/etc/pve/lxc/ctxxx.conf" with these 2 lines which enabled me to get zerotier working on the container, and connect to my zerotier network. After adding the lines, I simply rebooted the ct.

lxc.cgroup.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net dev/net none bind,create=dir