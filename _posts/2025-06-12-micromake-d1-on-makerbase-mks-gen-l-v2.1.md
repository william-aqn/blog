---
layout: post
title: "Обновляем 3D принтер Micromake D1"
description: "MKS Gen L V2.1"
tags: micromake 3d firmware
---

# Micromake D1 → MKS Gen L V2.1
## Marlin 2.1.2.5 configuration & wiring guide
==========================================

* **Board**: [Makerbase MKS Gen L V2.1](https://github.com/makerbase-mks/MKS-GEN_L/wiki/MKS_GEN_L_V2)  
* **Firmware tag**: [`2.1.2.5`](https://github.com/MarlinFirmware/Marlin/releases/tag/2.1.2.5)
* **Display**: RepRapDiscount Smart Controller (LCD 2004, 20 × 4)
* **Drivers**: TMC2209 @ 1⁄16 µ‑step (UART mode)
* **Features**: heated bed & hot‑end, fixed Z‑probe button, dual fans
* **Aliexpress**: [Makerbase original MKS GEN L V2.1 3D printer control card 8bit motherboard tmc2209](https://aliexpress.ru/item/32971035497.html?sku_id=10000014398959319&spm=a2g2w.productlist.search_results.2.2793456fORRHET)
---

## 1 · What’s in this files
* [Configuration.h](/assets/blog/micromake_d1/Configuration.h) & [Configuration_adv.h](/assets/blog/micromake_d1/Configuration_adv.h) already tuned for Micromake D1 geometry.  
* English 20×4 LCD presets.  
* Safe temperature limits (270 °C hot‑end / 120 °C bed).  
* Smart auto‑fan on MOSFET D.  
* Updated motion limits for faster homing (100 mm/s).  
* EEPROM, SD‑card, auto‑delta‑calibration G33 ready.

---

## 2 · Key changes by block
### ⚙️ Board & Drivers
```cpp
#define MOTHERBOARD BOARD_MKS_GEN_L_V21
#define BAUDRATE    115200
#define X_DRIVER_TYPE  Y_DRIVER_TYPE  Z_DRIVER_TYPE  E0_DRIVER_TYPE  TMC2209
```

### 🔥 Thermals
```cpp
#define HEATER_0_MAXTEMP 270
#define BED_MAXTEMP     120
```

### 🔺 Delta kinematics
```cpp
#define DELTA
  #define DELTA_HOME_TO_SAFE_ZONE
  #define DELTA_AUTO_CALIBRATION
  #define DELTA_PRINTABLE_RADIUS  90.0
  #define DELTA_MAX_RADIUS        96.0
  #define DELTA_DIAGONAL_ROD     217.0
  #define DELTA_HEIGHT          300.00
```

### 🏁 Endstops
```cpp
#define USE_XMAX_PLUG
#define USE_YMAX_PLUG
#define USE_ZMAX_PLUG
#define USE_ZMIN_PLUG
#define Z_MIN_ENDSTOP_INVERTING        true
#define Z_MIN_PROBE_ENDSTOP_INVERTING  true
```

### 🚀 Motion
```cpp
#define DEFAULT_AXIS_STEPS_PER_UNIT { 80, 80, 80, 500 }
#define DEFAULT_MAX_FEEDRATE        { 300, 300, 300, 25 }
#define DEFAULT_MAX_ACCELERATION    { 1000, 1000, 1000, 3000 }
#define DEFAULT_JERK               10.0
```

### 🌡️ Probe
```cpp
#define FIX_MOUNTED_PROBE
#define NOZZLE_TO_PROBE_OFFSET { 0, 0, 23 }
```

### 💾 LCD / SD / EEPROM
```cpp
#define REPRAP_DISCOUNT_SMART_CONTROLLER
#define DISPLAY_CHARSET_HD44780 WESTERN
#define SDSUPPORT
#define EEPROM_SETTINGS
```

### 🌬️ Fans
```cpp
#define FAN_SOFT_PWM
#define FAN_MIN_PWM 50
#define FAN_MAX_PWM 255
#define FAN1_PIN 7                 // MOSFET D
#define E0_AUTO_FAN_PIN FAN1_PIN   // on > 50 °C
#define NUM_M106_FANS 2
```

---

## 3 · Pin correspondence (old board → new)
| Function | [Makeboard Mini 2.1.2](/assets/blog/micromake_d1/makeboard_mini_2.1.2.webp) | [MKS Gen L V2.1](/assets/blog/micromake_d1/mks_gen_l_v2.1.webp) |
|----------|----------------------|----------------|
| X‑STEP / DIR / EN | 54 / 55 / 38 | X.STEP / X.DIR / X.EN |
| Y‑STEP / DIR / EN | 60 / 61 / 56 | Y.STEP / Y.DIR / Y.EN |
| Z‑STEP / DIR / EN | 46 / 48 / 62 | Z.STEP / Z.DIR / Z.EN |
| E0‑STEP / DIR / EN | 26 / 28 / 24 | E0.STEP / E0.DIR / E0.EN |
| X‑MAX | pin 2 (E4) | X+ JST |
| Y‑MAX | pin 15 (J0) | Y+ JST |
| Z‑MAX | pin 19 (D2) | Z+ JST |
| Z‑MIN / Probe | pin 18 (D3) | Z‑ JST |
| Heater‑0 | D10 | HE0 screw |
| Bed Heater | D8 | BED screw |
| Thermistor‑0 / Bed | A13 / A14 | TH0 / THB |
| Fan 0 (model) | D9 | FAN screw |
| Fan 1 (hot‑end) | D7 | MOSFET D |
| VIN | XT‑30 | 2‑pin 12–24 V in |

---

## 4 · After flashing:
```gcode
M502  ; load defaults
M500  ; save
G28   ; home
G33   ; auto‑calibrate
```

Happy printing!  
