---
layout: post
title: "Обновляем 3D принтер Micromake D1"
description: "MKS Gen L V2.1"
tags: micromake 3d firmware marlin2
---

# Обновляем 3D принтер Micromake D1
## Micromake D1 → MKS Gen L V2.1
## Marlin 2.1.3-b3 configuration & wiring guide

* **Board**: [Makerbase MKS Gen L V2.1](https://github.com/makerbase-mks/MKS-GEN_L/wiki/MKS_GEN_L_V2)  
* **Firmware tag**: [`2.1.3-b3`](https://github.com/MarlinFirmware/Marlin/releases/tag/2.1.3-b3)
* **Display**: RepRapDiscount Smart Controller (LCD 2004, 20 × 4)
* **Drivers**: TMC2209 @ 1⁄16 µ‑step (UART mode)
* **Features**: heated bed & hot‑end, fixed Z‑probe button, dual fans
* **Aliexpress**: [Makerbase original MKS GEN L V2.1 3D printer control card 8bit motherboard tmc2209](https://aliexpress.com/item/32971035497.html?sku_id=10000014398959319&spm=a2g2w.productlist.search_results.2.2793456fORRHET)
---


## 1 · What’s in this files
* [Configuration.h](/assets/blog/micromake_d1/Configuration.h) & [Configuration_adv.h](/assets/blog/micromake_d1/Configuration_adv.h) already tuned for Micromake D1 geometry.
* English 20×4 LCD presets.
* Smart auto‑fan on MOSFET D.
* EEPROM, SD‑card, auto‑delta‑calibration G33 ready.

## 2 · Pin correspondence (old board → new)

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

---

## 3 · After flashing:
```gcode
M502  ; load defaults
M500  ; save
G28   ; home
G33   ; auto‑calibrate
M303 E0 S200 C8 ; PID calibration
```
![Micromake D1 with MKS Gen L V2.1](/assets/blog/micromake_d1/d1-upgrade.jpg)

p.s The BEEEPER is very loud >_<