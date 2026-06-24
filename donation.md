---
layout: hacker
title: "Crimson.Lab / Поддержать проект"
description: "Поддержать проект — Boosty и USDT (TRC-20)"
permalink: /donation.html
canonical_url: https://x-crm.in/donation.html
---
<link rel="stylesheet" href="{{ '/assets/css/hacker/donation.css?v=' | append: site.github.build_revision | relative_url }}" />

# Поддержать проект

Блог существует без рекламы и трекеров. Если материалы оказались полезны — проект можно поддержать. Средства идут на хостинг, домен и оборудование для новых статей.

<div class="donation">
  <div class="donation__item">
    <span class="donation__label">Boosty</span>
    <a class="donation__link" href="https://boosty.to/dcrm/donate" target="_blank" rel="noopener noreferrer">boosty.to/dcrm/donate</a>
  </div>

  <div class="donation__item">
    <span class="donation__label">USDT · TRC-20</span>
    <div class="donation__usdt">
      <div class="donation__address">
        <code id="usdt-trc20" class="donation__code">TC9MSnePyR6MBfSGU6WRCNEmCa5iyzmWUr</code>
        <button type="button" class="donation__copy" data-copy-target="usdt-trc20" data-copy-label="Копировать" data-copied-label="Скопировано">Копировать</button>
      </div>
      {% include qr.html data="TC9MSnePyR6MBfSGU6WRCNEmCa5iyzmWUr" logo="/assets/images/usdt-logo.svg" size="200" %}
    </div>
  </div>
</div>

<script src="{{ '/assets/js/donation.js?v=' | append: site.github.build_revision | relative_url }}"></script>
