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

**Claude 4.6** создал модель [stl](/assets/blog/3d-vent-grille/vent_grille.stl)+[scad](/assets/blog/3d-vent-grille/vent_grille.scad) с помощью **Python** - **trimesh + manifold3d**

*И 3D просмотрщик stl файлов для этого поста, так же был создан Claude 4.6*

## Отправляем на печать
{% include youtube.html id="1rk5jzWqHzI" %}