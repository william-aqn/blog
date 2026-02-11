Создавай отдельные файлы со стилями для каждого компонента или страницы.
Не используй магические числа и строки, а используй константы или перечисления.
Придерживайся концепции DRY (Don't Repeat Yourself) и KISS (Keep It Simple, Stupid) при разработке кода.
После завершения задачи, проверяй код на наличие неиспользуемых переменных и удаляй их, если они больше не нужны и не используются в других компонентах.

# Блог x-crm.in — Ключевые знания

## Стек
- Jekyll (GitHub Pages), тема: `pages-themes/hacker@v0.2.0` (remote theme)
- Язык: русский (`lang="ru-RU"`)
- URL сайта: `https://x-crm.in`
- Комментарии: Utterances (repo: `william-aqn/blog`)

## Структура проекта
- `_layouts/` — шаблоны: `hacker.html` (базовый), `blog.html`, `post.html`, `404.html`
- `assets/css/hacker/` — SCSS-стили (отдельный файл на компонент/страницу)
- `assets/js/` — JS-скрипты (`oneko.js` — декоративный кот, `404-suggest.js` — подсветка на 404)
- `_posts/` — статьи в формате `YYYY-MM-DD-slug.md`
- Permalink: дефолтный Jekyll (`/:categories/:year/:month/:day/:title:output_ext`)

## Иерархия layout'ов
- `hacker.html` — корневой: `<head>` (CSS, SEO, favicon), `<body>` (header, `{{ content }}`, oneko.js)
- `blog.html` → hacker — список постов в `#blog_posts`
- `post.html` → hacker — отдельная статья + Utterances
- `404.html` → hacker — список постов в `#blog_post_list` + suggest-скрипт

## Стили
- Главный цвет: `$main-color: #E4C49F` (определён в `styles.scss`)
- Каждый новый компонент/страница — свой SCSS-файл в `assets/css/hacker/`
- Cache-busting: `?v=site.github.build_revision`

## Паттерны JS
- IIFE (`(function() { ... })();`) для изоляции scope
- Скрипты подключаются внизу body или content-блока (DOM уже готов)
- Используется ES5-совместимый синтаксис (var, function, Array.prototype.slice)

## Конфиг (_config.yml)
- `excerpt_separator: <!--more-->`
- Плагины: jekyll-default-layout, jekyll-github-metadata, jekyll-readme-index, jekyll-remote-theme
- Assets из: assets/blog, assets/css, assets/fonts, assets/images, assets/js