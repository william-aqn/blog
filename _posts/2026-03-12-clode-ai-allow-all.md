---
layout: post
title: "Разрешаем действия для Claude AI"
description: "Чтобы не доставал запросами"
tags: ai agent
---

# Разрешаем действия для Claude AI

Чтобы агент не доставал запросами на какие то действия, нужно создать файл в корне проекта 
[**/.claude/settings.local.json**](https://github.com/william-aqn/blog/blob/main/.claude/settings.local.json)
 
 С содержимым:
```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Read(*)",
      "Write(*)",
      "WebFetch(*)",
      "WebSearch(*)"
    ]
  }
}
```
p.s Write(*) - можно не разрешать, лучше немного контролировать процесс.