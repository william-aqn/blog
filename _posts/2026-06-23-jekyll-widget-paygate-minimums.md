---
layout: post
title: "Jekyll виджет: Минимальные суммы выплат PayGate"
description: "Живая таблица минимумов по сетям и монетам"
tags: jekyll widget paygate crypto javascript
---

# Jekyll виджет: Минимальные суммы выплат PayGate

Ещё один виджет в коллекцию. Минимальная сумма выплаты зависит от сети и монеты (minimum order amount varies per blockchain network and coin) - держать такую таблицу руками бессмысленно, значения плавают вместе с курсом.

Решение - живая таблица: данные тянутся с API [PayGate](https://paygate.to/) прямо в браузере, поэтому всегда актуальны.

{% raw %}
```liquid
{% include paygate-minimums.html wallets="5" %}
```
{% endraw %}

{% include paygate-minimums.html %}

*Виджет создан с помощью Claude Opus 4.8 (Ultracode)*
