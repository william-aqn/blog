---
layout: post
title: "Проектируем 3D модель с ИИ"
description: "Инженерка в scad/stl"
tags: 3d scad stl
---

# Проектируем 3D модель с ИИ
Пришло время проверить, как ИИ может рисовать инженерные 3D модели.

## ТЗ:
 * Шахта: 150×150 мм
 * Общая деталь: 210×210 мм
 * Подключение канала: 150×90 мм
 * Толщина стенки: 3 мм
 * Глубина выступа (collar): 30 мм
 * Отверстия: 4 мм, на расстоянии 15 мм от краёв по углам

## Результат
{% include stl-viewer.html model="/assets/blog/3d-vent-grille/vent_grille.stl" %}

**Claude 4.6** создал [модель stl+scad](/assets/blog/3d-vent-grille/grille_v1.zip) с помощью **Python** - **trimesh + manifold3d**
