---
layout: post
title: "Запускаем расцензуренную Gemma 4 локально"
description: "Ultra-uncensored Gemma 4 (E4B и MoE 26B-A4B): GGUF и Python"
tags: ai llm gemma heretic ollama lmstudio python
---

# Запускаем расцензуренную Gemma 4 локально
Разбираем, как поднять у себя **ultra-uncensored** сборки свежей **Gemma 4** от [llmfan46](https://huggingface.co/llmfan46) — расцензуренные (abliterated) через [Heretic](https://github.com/p-e-w/heretic).
<!--more-->

## Что это за модели
Обе — расцензуренные версии **Gemma 4**, сделаны инструментом [Heretic](https://github.com/p-e-w/heretic) (v1.2.0, метод ARA): он автоматически убирает отказы методом directional ablation — **без дообучения** — минимально меняя саму модель (минимизирует KL-дивергенцию от оригинала). Отказов у обеих — **3/100** против ~100/100 у базовой Gemma. Мультимодальны (текст + картинки/звук), контекст до **128K**, сэмплинг `temperature 1.0, top_p 0.95, top_k 64`.

**[E4B](https://huggingface.co/llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF) — лёгкая и быстрая.** Плотная ~4B, MMLU ~69%. Q4_K_M **5.3 ГБ**: на GPU хватит **6 ГБ VRAM**, заводится и на 8–16 ГБ ОЗУ без видеокарты (мини-ПК, ноут — просто медленнее).
*Для чего:* повседневный ассистент «под рукой» — чат, Q&A, сократить/переписать/перевести текст, простые скрипты, черновики, встройка в приложение. Когда важны скорость и минимум железа.

**[26B-A4B](https://huggingface.co/llmfan46/gemma-4-26B-A4B-it-ultra-uncensored-heretic-GGUF) — умная MoE.** 26B всего, активны лишь ~4B на токен → **заметно умнее** (MMLU ~80%), а генерит со скоростью 4B-модели. Q4_K_M **17.99 ГБ**: влезает в 24 ГБ VRAM с запасом (Q6_K 23.83 — уже нет). Отлично идёт и на **CPU** — держишь ~18 ГБ весов в ОЗУ, считаются только активные ~4B (умная модель без дорогой видеокарты).
*Для чего:* когда нужны мозги — код посложнее, многошаговые инструкции, длинные связные тексты и ролевые истории, рассуждения, разбор документов, вопросы по знаниям.

**Что брать:** есть память (24 ГБ VRAM хватает) → **26B-A4B**, она ощутимо умнее почти без потери скорости. **E4B** — для лёгкого/мобильного/фонового железа.

> **Коротко по запуску.** Просто чат — **GGUF** (LM Studio / Ollama). Картинки или своя тонкая настройка — **Python (transformers)**, Способ 3.

## Способ 1. LM Studio — проще всего
1. Ставим [LM Studio](https://lmstudio.ai/)
2. Открываем модель прямой ссылкой:
   - лёгкая **E4B**: `lmstudio://open_from_hf?model=llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF`
   - умная **26B-A4B**: `lmstudio://open_from_hf?model=llmfan46/gemma-4-26B-A4B-it-ultra-uncensored-heretic-GGUF`
3. Выбираем квант, жмём **Download** → **Load** и чатимся

Кванты и размеры (**E4B** / **26B-A4B**):
```
Q4_K_M    5.34 ГБ / 17.99 ГБ  — оптимум (рекомендую; 26B влезает в 24 ГБ с запасом)
Q5_K_M    5.76 ГБ / 20.33 ГБ  — чуть качественнее (макс., что целиком влезает в 24 ГБ у 26B)
Q6_K      6.22 ГБ / 23.83 ГБ  — почти без потерь (26B целиком уже не входит в 24 ГБ)
Q8_0      8.03 ГБ / 28.05 ГБ  — для 26B мимо 24 ГБ VRAM
BF16     15.1  ГБ / 51.70 ГБ  — без квантизации
```

**Что значат буквы.** Цифра (`Q4`, `Q8`) — это **бит на вес**: меньше = компактнее и быстрее, больше = тяжелее и ближе к оригиналу. `_K` — «умная» квантизация (K-quant: важные веса хранятся точнее), а `_S` / `_M` / `_L` — её вариант по размеру (small / medium / large). Значит `Q4_K_M` = 4-битный K-квант, средний — золотая середина качество/размер. `Q8_0` — 8 бит, почти без потерь; `BF16` — без квантизации, полные веса. Правило: бери **самый крупный квант, что влезает** в память — ниже `Q4` качество заметно проседает.

## Способ 2. Ollama — для терминала и API
Одной командой (Ollama сам стянет GGUF с HuggingFace):
```sh
# лёгкая E4B
ollama run hf.co/llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF:Q4_K_M
# умная MoE 26B-A4B (для 24 ГБ VRAM — Q4_K_M)
ollama run hf.co/llmfan46/gemma-4-26B-A4B-it-ultra-uncensored-heretic-GGUF:Q4_K_M
```

> ⚠️ **`Error: 400` после закачки?** Известный [баг Ollama](https://github.com/ollama/ollama/issues/15447) с многофайловыми GGUF-репозиториями (рядом лежит `mmproj`): блоб скачивается, а регистрация модели падает. Обход — грузим один файл вручную: скачай `*-Q4_K_M.gguf`, создай `Modelfile` со строкой `FROM ./файл.gguf` и `ollama create`. Либо запусти через LM Studio / `llama-server` — они такие репозитории берут без проблем.

Хочешь свои параметры по умолчанию — собираем `Modelfile`:
```
FROM hf.co/llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF:Q4_K_M
SYSTEM "You are a helpful assistant."
PARAMETER temperature 1.0
PARAMETER top_p 0.95
PARAMETER top_k 64
```
```sh
ollama create gemma4-uncensored -f Modelfile
ollama run gemma4-uncensored
```

Или напрямую через llama.cpp:
```sh
llama-server -hf llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF:Q4_K_M
```

> ⚠️ В Ollama из коробки — **только текст**. У сборок есть отдельный vision-проектор `mmproj-BF16.gguf` (картинки через llama.cpp), но в Ollama мультимодальность Gemma 4 пока сырая. Нужны картинки уверенно — см. Способ 3.

## Способ 3. Python / transformers — для мультимодальности
GGUF-сборки выше — текстовые. Нужны картинки/звук **на входе** или своя тонкая настройка — берём safetensors через transformers. `MODEL_ID` = базовая `google/gemma-4-E4B-it` или свой расцензуренный репозиторий (см. Бонус). Текст и картинка отличаются только полем `messages`:
```sh
pip install -U transformers torch accelerate
```
```python
from transformers import AutoProcessor, AutoModelForMultimodalLM

MODEL_ID = "google/gemma-4-E4B-it"
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForMultimodalLM.from_pretrained(MODEL_ID, dtype="auto", device_map="auto")

messages = [{"role": "user", "content": "Напиши шутку про экономию оперативки."}]
# картинка на вход — поменять только messages:
# messages = [{"role": "user", "content": [
#     {"type": "image", "url": "https://example.com/photo.jpg"},
#     {"type": "text", "text": "Что на картинке?"},
# ]}]

inputs = processor.apply_chat_template(
    messages, add_generation_prompt=True, tokenize=True,
    return_dict=True, return_tensors="pt",
).to(model.device)
out = model.generate(**inputs, max_new_tokens=512, temperature=1.0, top_p=0.95, top_k=64)
print(processor.decode(out[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True))
```

> ℹ️ Картинка идёт на **вход** (анализ, картинка→текст). Gemma не *рисует* — для генерации см. посты про [картинки](/2026/06/17/local-uncensored-image-gen-zimage.html) и [видео](/2026/06/17/local-uncensored-video-gen.html).

Нет GPU — пойдёт на CPU (медленнее) или с 4-битной квантизацией `bitsandbytes`.

**Без кода — готовые WebUI:**
- **[text-generation-webui](https://github.com/oobabooga/text-generation-webui)** — всё-в-одном: вводишь `google/gemma-4-E4B-it`, loader **Transformers** → чат в браузере.
- **`transformers serve` + [Open WebUI](https://github.com/open-webui/open-webui)** — OpenAI-совместимый сервер (`pip install -U "transformers[serving]"`, затем `transformers serve` на :8000), цепляешь любой фронт.
- **vLLM** — для скорости: `vllm serve google/gemma-4-E4B-it` (на Windows через WSL2).

## Бонус: сделать свою расцензуренную модель
Heretic ставится в одну строчку и «лечит» почти любую модель сам:
```sh
pip install -U heretic-llm
heretic google/gemma-4-E4B-it
```
Он сам прогонит подбор параметров (на современной GPU модель ~4B — минут 20–30), покажет метрики и предложит сохранить результат локально или залить на HuggingFace. Получившиеся safetensors потом конвертируешь в GGUF через `llama.cpp/convert_hf_to_gguf.py` + `llama-quantize` — и дальше как в Способе 1/2.

## Дисклеймер
Модель намеренно лишена встроенных отказов — вся ответственность за то, что вы у неё спрашиваете и как используете ответы, на вас. Распространяется по лицензии [Gemma](https://ai.google.dev/gemma/docs/gemma_4_license), ограничения Google по запрещённому использованию продолжают действовать.
