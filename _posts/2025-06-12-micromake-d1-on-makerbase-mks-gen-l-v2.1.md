---
layout: post
title: "Оживляем 3D принтер Micromake D1"
description: "MKS Gen L V2.1"
tags: micromake 3d firmware marlin2
---

# Оживляем 3D принтер Micromake D1
## Micromake D1 → MKS Gen L V2.1

В какой то момент вышел из строя БП и потянул за собой основную плату принтера [Makeboard Mini 2.1.2](/assets/blog/micromake_d1/makeboard_mini_2.1.2.webp)

Нашёл что то похожее:

![MKS Gen L V2.1](/assets/blog/micromake_d1/mks_gen_l_v2.1.webp)

## Подобрал распиновку

| Function           | [Makeboard Mini 2.1.2](/assets/blog/micromake_d1/makeboard_mini_2.1.2.webp) | [MKS Gen L V2.1](/assets/blog/micromake_d1/mks_gen_l_v2.1.webp)           |
|:-------------------|:---------------------|:-------------------------|
| X‑STEP / DIR / EN  | 54 / 55 / 38         | X.STEP / X.DIR / X.EN    |
| Y‑STEP / DIR / EN  | 60 / 61 / 56         | Y.STEP / Y.DIR / Y.EN    |
| Z‑STEP / DIR / EN  | 46 / 48 / 62         | Z.STEP / Z.DIR / Z.EN    |
| E0‑STEP / DIR / EN | 26 / 28 / 24         | E0.STEP / E0.DIR / E0.EN |
| X‑MAX              | pin 2 (E4)           | X+ JST                   |
| Y‑MAX              | pin 15 (J0)          | Y+ JST                   |
| Z‑MAX              | pin 19 (D2)          | Z+ JST                   |
| Z‑MIN / Probe      | pin 18 (D3)          | Z‑ JST                   |
| Heater‑0           | D10                  | HE0 screw                |
| Bed Heater         | D8                   | BED screw                |
| Thermistor‑0 / Bed | A13 / A14            | TH0 / THB                |
| Fan 0 (model)      | D9                   | FAN screw                |
| Fan 1 (hot‑end)    | D7                   | MOSFET D                 |
| VIN                | XT‑30                | 2‑pin 12–24 V in         |

По сути у меня была голая плата [Makerbase MKS Gen L V2.1](https://github.com/makerbase-mks/MKS-GEN_L/wiki/MKS_GEN_L_V2), и просто направляющие с движками, экструдер с двумя обдувами и стол с подогревом.

![Micromake D1 with MKS Gen L V2.1](/assets/blog/micromake_d1/d1-upgrade.jpg)

Нужно как то оживлять. За основу взял конфиг от случайной дельты и начал экспериментировать. Отладил кучу моментов, теперь принтер печатал, парковался, измерял Z ось и практически соблюдал масштаб деталей.

Выложил наработки в репозиторий Марлина [pull/1146](https://github.com/MarlinFirmware/Configurations/pull/1146) и там основной мэинтейнер подсказал корректировки геометрии!

С новыми вводными, довёл прошивку до ума, и теперь в основном репозитории Марлина есть прошивка для **Micromake-D1** [examples/delta/Micromake-D1/MKS-Gen-L-V2.1](https://github.com/MarlinFirmware/Configurations/tree/import-2.1.x/config/examples/delta/Micromake-D1)

---

## Первый запуск:
```gcode
M502  ; load defaults
M500  ; save
G28   ; home
G33   ; auto‑calibrate
M303 E0 S200 C8 ; PID calibration
```
**Работает!**