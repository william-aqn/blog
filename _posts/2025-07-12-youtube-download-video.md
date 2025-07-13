---
layout: post
title: "Скачать видео с youtube"
description: "yt-dlp + ffmpeg"
tags: ffmpeg ytdlp
---

# Скачать видео с youtube

Батник для скачивания видео в лучшем качестве по id с помощью [yt-dlp](https://github.com/yt-dlp/yt-dlp) и [ffmpeg](https://www.gyan.dev/ffmpeg/builds/#release-builds)
```bat
@echo off
REM Requirements: yt-dlp.exe and ffmpeg.exe (either in the same folder or in your PATH)
color 0c
chcp 65001
echo ==== YouTube Downloader (yt-dlp) ====
set /p VID=Enter the YouTube video ID (the part after "v="): 

if "%VID%"=="" (
    echo [ERROR] No ID entered. Exiting...
    pause
    exit /b
)

REM Download best video + best audio and merge to MP4
yt-dlp.exe ^
  -f "bestvideo+bestaudio/best" ^
  --merge-output-format mp4 ^
  --embed-metadata --embed-thumbnail ^
  -o "%%(title)s.%%(ext)s" ^
  "https://www.youtube.com/watch?v=%VID%"

echo ---
echo Download finished.

REM Open File Explorer in the current directory
start "" "%cd%"

echo Press any key to close.
pause

```

Или обёрткой над **ytdlp** с помощью [VDL - Video Downloader](https://github.com/engatec/vdl) или [ytdlp-interface](https://github.com/ErrorFlynn/ytdlp-interface)
