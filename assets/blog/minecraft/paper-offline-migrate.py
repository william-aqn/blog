#!/usr/bin/env python3
"""Перенос игровых UUID Paper из online- в offline-режим на отдельной копии."""
import argparse
from collections import Counter, defaultdict
from contextlib import ExitStack, contextmanager, redirect_stdout
import csv
import errno
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import struct
import subprocess
import sys
import tempfile
import uuid
import zlib


class Problem(Exception):
    """Понятная оператору причина остановки."""


NAME = re.compile(r"[A-Za-z0-9_]{1,16}")
LISTS = ("usercache.json", "ops.json", "whitelist.json", "banned-players.json")
PLAYER_DIRS = {"playerdata": (".dat", ".dat_old"), "players/data": (".dat", ".dat_old"),
               "stats": (".json",), "players/stats": (".json",),
               "advancements": (".json",), "players/advancements": (".json",)}
ESS = Path("plugins/Essentials")
LP = Path("plugins/LuckPerms")
SECTOR = 4096
REGION = re.compile(r"r\.(-?\d+)\.(-?\d+)\.mca")


def parse_id(value):
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError) as e:
        raise Problem(f"Некорректный UUID {value!r}") from e


def offline(name):
    digest = hashlib.md5(("OfflinePlayer:" + name).encode("utf-8"), usedforsecurity=False)
    return uuid.UUID(bytes=digest.digest(), version=3)


def yaml_module():
    try:
        import yaml
        return yaml
    except ImportError as e:
        raise Problem("Для EssentialsX/LuckPerms установите PyYAML (python3-yaml).") from e


def load_yaml(path):
    yaml = yaml_module()
    try:
        data = yaml.safe_load(path.read_bytes()) or {}
    except yaml.YAMLError as e:
        raise Problem(f"Не удалось прочитать YAML в {path}") from e
    if not isinstance(data, dict):
        raise Problem(f"Ожидался раздел YAML в {path}")
    return data


def read_list(path):
    if not path.exists():
        return []
    rows = json.loads(path.read_bytes())
    if not isinstance(rows, list) or not all(isinstance(row, dict) for row in rows):
        raise Problem(f"Ожидался массив записей в {path}")
    return rows


def checked_name(name):
    if not isinstance(name, str) or not NAME.fullmatch(name):
        raise Problem(f"Нужен точный игровой ник Java Edition, получено {name!r}")
    return name


def manual_names(path):
    result = {}
    if path:
        with path.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            if reader.fieldnames != ["name", "online_uuid"]:
                raise Problem("Первая строка CSV должна быть name,online_uuid")
            for row in reader:
                if None in row:
                    raise Problem(f"Лишний столбец в строке {reader.line_num}")
                ident, name = parse_id(row["online_uuid"]), checked_name(row["name"])
                if ident in result:
                    raise Problem(f"Повтор UUID {ident} в CSV")
                result[ident] = name
    return result


def find_worlds(root, extra):
    markers = ("playerdata", "players/data", "region", "dimensions", "DIM-1", "DIM1")
    roots = {p for p in root.iterdir() if p.is_dir() and
             ((p / "level.dat").is_file() or any((p / marker).is_dir() for marker in markers))}
    for arg in extra:
        p = (root / arg).resolve()
        if Path(arg).is_absolute() or p == root or root not in p.parents or not p.is_dir():
            raise Problem(f"--world должен указывать на каталог мира внутри сервера: {arg}")
        roots.add(p)
    if not roots:
        raise Problem("Миры не найдены. Для своего world-container укажите --world путь/к/миру.")
    if any(parent in roots for p in roots for parent in p.parents):
        raise Problem("Вложенные друг в друга --world привели бы к повторной обработке.")
    return sorted(p.relative_to(root) for p in roots)


def walk_error(error):
    raise error


def check_tree(root):
    for base, dirs, files in os.walk(root, onerror=walk_error):
        for name in dirs + files:
            p = Path(base, name)
            if p.is_symlink() or not (p.is_dir() or p.is_file()):
                raise Problem(f"Особый файл или символьная ссылка {p}. Подготовьте автономную копию с обычными файлами.")


def lock_worlds(stack, root, worlds):
    for world in worlds:
        p = root / world / "session.lock"
        if p.exists():
            stream = stack.enter_context(p.open("rb"))
            try:
                fcntl.lockf(stream, fcntl.LOCK_SH | fcntl.LOCK_NB)
            except OSError as e:
                if e.errno in (errno.EAGAIN, errno.EACCES):
                    raise Problem(f"Paper держит блокировку {p}. Остановите сервер в Crafty.") from e
                raise


def lock_directory(stack, directory, exclusive):
    fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    stack.callback(os.close, fd)
    try:
        fcntl.flock(fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
    except BlockingIOError as e:
        raise Problem(f"Другая операция мигратора использует {directory}") from e
    if not os.path.samestat(os.fstat(fd), directory.stat()):
        raise Problem(f"Каталог {directory} успели поменять. Повторите команду.")


RENAME_NOREPLACE, RENAME_EXCHANGE = 1, 2


def rename_directory(source, destination, flag):
    import ctypes
    libc = ctypes.CDLL(None, use_errno=True)
    if not hasattr(libc, "renameat2"):
        raise Problem("Для атомарной операции с каталогами нужна Linux libc с renameat2.")
    at_fdcwd = -100
    if libc.renameat2(at_fdcwd, os.fsencode(source), at_fdcwd, os.fsencode(destination), flag):
        raise OSError(ctypes.get_errno(), os.strerror(ctypes.get_errno()), str(destination))


def swap_servers(root, other, extra_worlds):
    if root == other or root in other.parents or other in root.parents:
        raise Problem("Для обмена нужны два отдельных непересекающихся каталога.")
    with ExitStack() as stack:
        for path in sorted((root, other)):
            if not (path / "server.properties").is_file():
                raise Problem(f"В {path} отсутствует server.properties")
            lock_directory(stack, path, exclusive=True)
            lock_worlds(stack, path, find_worlds(path, extra_worlds))
        # Linux renameat2(RENAME_EXCHANGE) меняет оба имени одним вызовом.
        try:
            rename_directory(root, other, RENAME_EXCHANGE)
        except OSError as e:
            raise Problem(f"Ядро отказало в обмене каталогов ({e.strerror}). Проверьте права и поддержку RENAME_EXCHANGE на общей файловой системе.") from e
    print(f"Каталоги обменяны: {root} <-> {other}")


def profile_files(root, worlds):
    dirs = [(root / world / sub, suffixes) for world in worlds for sub, suffixes in PLAYER_DIRS.items()]
    dirs.append((root / ESS / "userdata", (".yml",)))
    files = []
    for directory, suffixes in dirs:
        if directory.is_dir():
            for path in sorted(directory.iterdir()):
                if path.is_file() and path.suffix in suffixes:
                    ident = parse_id(path.stem)
                    if path.stem != str(ident):
                        raise Problem(f"Приведите имя файла к каноническому UUID: {path}")
                    files.append((path, ident))
    return files


class Players:
    def __init__(self, root, profiles, manual):
        candidates = defaultdict(set)
        for filename in LISTS:
            for row in read_list(root / filename):
                ident = parse_id(row.get("uuid"))
                if ident not in manual:
                    candidates[ident].add(checked_name(row.get("name")))
        for path, ident in profiles:
            if path.suffix == ".yml" and ident not in manual:
                name = load_yaml(path).get("last-account-name")
                if name:
                    candidates[ident].add(checked_name(name))
        # Bukkit сохраняет регистр в player.dat. Используем его как запасной
        # источник, когда кэш истёк; имя в файле .dat предпочтительнее .dat_old.
        for path, ident in sorted(profiles, key=lambda item: item[0].suffix == ".dat_old"):
            if ident not in candidates and ident not in manual and path.suffix in (".dat", ".dat_old"):
                raw, _ = read_nbt(path)
                reader = Nbt(raw, {}, ident)
                reader.run()
                if reader.last_name:
                    candidates[ident].add(checked_name(reader.last_name))
        candidates.update({key: {name} for key, name in manual.items()})
        self.names, self.ids, by_name = {}, {}, {}
        for ident, names in candidates.items():
            if len(names) != 1:
                raise Problem(f"{ident}: несколько вариантов ника {sorted(names)}. Уточните актуальный ник в --map.")
            name, = names
            target = offline(name)
            if ident != target and ident.version != 4:
                raise Problem(f"{name}: UUID {ident} не похож на лицензионный и не совпадает с offline-UUID этого ника. Проверьте регистр и схему прокси.")
            spelling = by_name.setdefault(name.lower(), name)
            if spelling != name:
                raise Problem(f"Ники {spelling!r} и {name!r} различаются только регистром. Сверьте владельцев и --map.")
            self.names[ident] = name
            if ident != target:
                self.ids[ident] = target
        if len(set(self.ids.values())) != len(self.ids):
            raise Problem("Несколько лицензионных UUID претендуют на один ник. Сверьте реальные имена в --map.")
        self.known = set(self.names) | set(self.ids.values())
        self.require({ident for _, ident in profiles}, "профили на диске")

    def require(self, ids, where):
        missing = sorted(set(ids) - self.known)
        if missing:
            raise Problem(f"{where}: не хватает точных ников для UUID " + ", ".join(map(str, missing)) + ". Добавьте их в --map.")


def migrate_lists(root, players, write, counts):
    for filename in LISTS:
        path = root / filename
        rows = read_list(path)
        out = {}
        for row in rows:
            ident = parse_id(row["uuid"])
            target = players.ids.get(ident, ident)
            updated = dict(row)
            if ident in players.ids:
                updated.update(uuid=str(target), name=players.names[ident])
            prior = out.get(target)
            if prior is not None:
                if filename == "usercache.json":
                    if updated.get("expiresOn", "") <= prior.get("expiresOn", ""):
                        continue
                elif updated != prior:
                    raise Problem(f"{filename}: две разные записи для {target}. Согласуйте их на рабочей копии.")
            out[target] = updated
        if list(out.values()) != rows:
            counts[filename] += 1
            if write:
                path.write_text(json.dumps(list(out.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# Читаем структуру Java NBT, меняем только 16 байт UUID либо его текст.
# Содержимое остальных тегов (включая modified UTF-8 в книгах) сохраняется побайтно.
TAG_SIZE = {1: 1, 2: 2, 3: 4, 4: 8, 5: 4, 6: 8}
ARRAY_SIZE = {7: 1, 11: 4, 12: 8}
SKIN_TAGS = {b"profile", b"skullowner", b"gameprofile", b"playerprofile", b"ownerprofile"}
UUID_STRINGS = {b"uuid", b"id", b"owner", b"owneruuid", b"thrower", b"lovecause", b"source",
                b"target", b"trusted", b"trusteduuids", b"angryat", b"conversionplayer", b"player",
                b"players", b"heroesofthevillage", b"entity", b"killer", b"leash", b"attach"}


def tag_key(name):
    return name.lower().rsplit(b":", 1)[-1].replace(b"_", b"")


class Nbt:
    def __init__(self, raw, identities, expected):
        self.data, self.pos, self.ids = bytearray(raw), 0, identities
        self.expected, self.changes = expected, 0
        self.last_name = None

    def take(self, size):
        start = self.pos
        self.pos += size
        if size < 0 or self.pos > len(self.data):
            raise Problem("Повреждённая длина тега NBT")
        return start

    def string(self):
        size = struct.unpack_from(">H", self.data, self.take(2))[0]
        start = self.take(size)
        return bytes(self.data[start:self.pos])

    def length(self):
        return struct.unpack_from(">i", self.data, self.take(4))[0]

    def replacement(self, value, profile_id):
        if profile_id and self.expected and value != self.expected.bytes:
            raise Problem(f"UUID внутри player.dat расходится с именем файла {self.expected}")
        return self.ids.get(value)

    def payload(self, kind, name, protected, root=False, profile_id=False, bukkit=False):
        key = tag_key(name)
        protected = protected or key in SKIN_TAGS
        if kind in TAG_SIZE:
            self.take(TAG_SIZE[kind])
        elif kind in ARRAY_SIZE:
            length = self.length() * ARRAY_SIZE[kind]
            start = self.take(length)
            if not protected and kind in (11, 12) and length == 16:
                new = self.replacement(bytes(self.data[start:self.pos]), profile_id)
                if new:
                    self.data[start:self.pos] = new
                    self.changes += 1
        elif kind == 8:
            value = self.string()
            if not protected and key in UUID_STRINGS and len(value) == 36:
                try:
                    uid = uuid.UUID(value.decode("ascii"))
                except (UnicodeError, ValueError):
                    return
                new = self.replacement(uid.bytes, profile_id)
                if new:
                    self.data[self.pos - 36:self.pos] = str(uuid.UUID(bytes=new)).encode()
                    self.changes += 1
        elif kind == 9:
            element = self.data[self.take(1)]
            count = self.length()
            if count > len(self.data) - self.pos:
                raise Problem("Повреждённая длина списка NBT")
            if element in TAG_SIZE:
                self.take(max(count, 0) * TAG_SIZE[element])
            else:
                for _ in range(count):
                    self.payload(element, name, protected)
        elif kind == 10:
            halves = {}
            while True:
                child = self.data[self.take(1)]
                if child == 0:
                    break
                label = self.string()
                if bukkit and child == 8 and label == b"lastKnownName":
                    self.last_name = self.string().decode("utf-8")
                    continue
                if child == 4 and label.endswith((b"Most", b"Least")):
                    halves[label] = self.pos
                self.payload(child, label, protected, profile_id=root and label == b"UUID",
                             bukkit=root and label == b"bukkit")
            if not protected:
                for label, msb in halves.items():
                    low = halves.get(label[:-4] + b"Least") if label.endswith(b"Most") else None
                    if low is not None:
                        old = bytes(self.data[msb:msb+8] + self.data[low:low+8])
                        new = self.replacement(old, root and label == b"UUIDMost")
                        if new:
                            self.data[msb:msb+8], self.data[low:low+8] = new[:8], new[8:]
                            self.changes += 1
        else:
            raise Problem(f"Неизвестный тип тега NBT {kind}")

    def run(self):
        if self.data[self.take(1)] != 10:
            raise Problem("Ожидался корневой TAG_Compound")
        self.string()
        self.payload(10, b"", False, root=True)
        if self.pos != len(self.data):
            raise Problem("Лишние байты после NBT")
        return bytes(self.data), self.changes


class References:
    def __init__(self, players):
        self.ids = {a.bytes: b.bytes for a, b in players.ids.items()}
        needles = [s for u in players.ids for s in (u.bytes[:8], str(u).encode())]
        self.pattern = re.compile(b"|".join(map(re.escape, needles)), re.IGNORECASE) if needles else None

    def patch(self, raw, expected=None):
        if expected is None and (self.pattern is None or not self.pattern.search(raw)):
            return raw, 0
        return Nbt(raw, self.ids, expected).run()


def read_nbt(path):
    data = path.read_bytes()
    compressed = data.startswith(b"\x1f\x8b")
    raw = gzip.decompress(data) if compressed else data
    return raw, compressed


def nbt_file(path, refs, expected, write, counts):
    raw, compressed = read_nbt(path)
    patched, count = refs.patch(raw, expected)
    if count:
        counts["ссылок NBT в отдельных файлах"] += count
        if write:
            path.write_bytes(gzip.compress(patched, mtime=0) if compressed else patched)


def essentials_yaml(path, refs, write, counts):
    # Берём координаты скалярных значений из YAML, сохраняя комментарии и формат файла.
    yaml = yaml_module()
    raw = path.read_bytes()
    if not refs.pattern or not refs.pattern.search(raw):
        return
    text = raw.decode("utf-8")
    edits, seen = [], set()
    def visit(node):
        if node is None or id(node) in seen:
            return
        seen.add(id(node))
        if isinstance(node, yaml.ScalarNode):
            if node.tag == "tag:yaml.org,2002:str" and len(node.value) == 36:
                try:
                    uid = uuid.UUID(node.value)
                except ValueError:
                    return
                if uid.bytes in refs.ids:
                    start, end = node.start_mark.index, node.end_mark.index
                    old = text[start:end]
                    if old.count(node.value) != 1:
                        raise Problem(f"Необычная запись UUID в {path}")
                    edits.append((start, end, old.replace(node.value, str(uuid.UUID(bytes=refs.ids[uid.bytes])))))
        elif isinstance(node, yaml.MappingNode):
            for key, value in node.value:
                visit(key)
                visit(value)
        else:
            for item in node.value:
                visit(item)
    visit(yaml.compose(text))
    if edits:
        counts["ссылок в EssentialsX YAML"] += len(edits)
        if write:
            for start, end, value in sorted(edits, reverse=True):
                text = text[:start] + value + text[end:]
            path.write_bytes(text.encode("utf-8"))


def migrate_profiles(files, players, refs, prefer, write, counts):
    moves = {path: path.with_name(str(players.ids[ident]) + path.suffix)
             for path, ident in files if ident in players.ids}
    overwritten = set()
    for path, ident in files:
        dest = moves.get(path)
        if dest and dest.exists():
            name = players.names[ident]
            if name not in prefer:
                raise Problem(f"Существуют обе версии {path} и {dest}. Для выбора online-профиля укажите --prefer-online {name}.")
            overwritten.add(dest)
            print(f"  {name}: выбран online-файл для {dest.name} ({dest.parent.name})")
    for path, ident in files:
        if path in overwritten:
            continue
        try:
            if path.suffix in (".dat", ".dat_old"):
                nbt_file(path, refs, ident, write, counts)
            elif path.suffix == ".yml":
                essentials_yaml(path, refs, write, counts)
            else:
                json.loads(path.read_bytes())
            if path in moves:
                counts["файлов профилей переименовано"] += 1
                if write:
                    path.replace(moves[path])
        except (ValueError, OSError, Problem) as e:
            raise Problem(f"{path}: {e}") from e


def essentials_cache(root, players, write, counts):
    for filename in ("uuids.bin", "usermap.bin"):
        path = root / ESS / filename
        if not path.exists():
            continue
        data, out, pos, seen = path.read_bytes(), bytearray(), 0, set()
        while pos < len(data):
            if filename == "usermap.bin":  # DataOutputStream.writeUTF(name), затем два long.
                size = int.from_bytes(data[pos:pos+2], "big") + 2
                out.extend(data[pos:pos+size])
                pos += size
            if pos + 16 > len(data):
                raise Problem(f"Оборванная запись {path}")
            ident = uuid.UUID(bytes=data[pos:pos+16])
            players.require([ident], filename)
            target = players.ids.get(ident, ident)
            if filename == "usermap.bin" or target not in seen:
                out.extend(target.bytes)
            seen.add(target)
            pos += 16
        if out != data:
            counts[filename] += 1
            if write:
                path.write_bytes(out)


def decode_chunk(codec, payload):
    if codec == 1:
        return gzip.decompress(payload)
    if codec == 2:
        return zlib.decompress(payload)
    if codec == 3:
        return payload
    if codec != 4:
        raise Problem(f"Неизвестный формат сжатия MCA {codec}")
    try:
        import lz4.block
        import xxhash
    except ImportError as e:
        raise Problem("Для LZ4-регионов установите python3-lz4 и python3-xxhash.") from e
    out, pos = bytearray(), 0
    while pos + 21 <= len(payload) and payload[pos:pos+8] == b"LZ4Block":
        token, packed, size, checksum = struct.unpack_from("<BIII", payload, pos+8)
        pos += 21
        method = token & 0xf0
        if method not in (0x10, 0x20) or size > 1 << (10 + (token & 15)) or pos + packed > len(payload):
            break
        if size == packed == 0:
            if pos == len(payload) and checksum == 0:
                return bytes(out)
            break
        block = payload[pos:pos+packed]
        pos += packed
        if method == 0x20:
            block = lz4.block.decompress(block, uncompressed_size=size)
        if len(block) != size or xxhash.xxh32(block, seed=0x9747b28c).intdigest() & 0x0fffffff != checksum:
            break
        out.extend(block)
    raise Problem("Повреждён поток LZ4Block")


def region_file(path, refs, write, counts):
    match = REGION.fullmatch(path.name)
    if not match:
        raise Problem(f"Нестандартное имя региона {path}")
    rx, rz = map(int, match.groups())
    data = bytearray(path.read_bytes())
    if len(data) < 2 * SECTOR or len(data) % SECTOR:
        raise Problem("Повреждён размер файла региона")
    # Валидируем таблицу секторов до изменения первого чанка.
    used, chunks = {0, 1}, []
    for i in range(SECTOR // 4):
        slot = int.from_bytes(data[4*i:4*i+4], "big")
        if not slot:
            continue
        start, capacity = slot >> 8, slot & 255
        sectors = range(start, start + capacity)
        if capacity == 0 or (start+capacity)*SECTOR > len(data) or not used.isdisjoint(sectors):
            raise Problem(f"Недопустимые или перекрывающиеся секторы в записи {i}")
        used.update(sectors)
        chunks.append((i, start, capacity))
    changed = False
    for i, start, capacity in chunks:
        pos = start * SECTOR
        size, codec = struct.unpack_from(">IB", data, pos)
        if size < 1 or size + 4 > capacity * SECTOR:
            raise Problem(f"Недопустимая длина чанка в записи {i}")
        sidecar = path.with_name(f"c.{rx*32+i%32}.{rz*32+i//32}.mcc")
        external = bool(codec & 128)
        if external and size != 1:
            raise Problem(f"Недопустимая ссылка на {sidecar.name}")
        payload = sidecar.read_bytes() if external else bytes(data[pos+5:pos+4+size])
        raw = decode_chunk(codec & 127, payload)
        new, hits = refs.patch(raw)
        if not hits:
            continue
        counts["ссылок NBT в чанках"] += hits
        changed = True
        if not write:
            continue
        # Кодек указывается в каждой записи. Paper читает deflate независимо от
        # настройки сжатия новых чанков. Не перепаковываем неизменённые чанки.
        packed = zlib.compress(new)
        record = struct.pack(">IB", 1 + len(packed), 2) + packed
        need = (len(record) + SECTOR - 1) // SECTOR
        if external or need > 255:
            if not external and sidecar.exists():
                raise Problem(f"При расширении чанка занят путь {sidecar}")
            sidecar.write_bytes(packed)
            if not external:
                shutil.copymode(path, sidecar)
                if os.geteuid() == 0:
                    meta = path.stat()
                    os.chown(sidecar, meta.st_uid, meta.st_gid)
            record = struct.pack(">IB", 1, 128 | 2)
        elif need > capacity:
            start, capacity = len(data) // SECTOR, need
            if start >= 1 << 24:
                raise Problem("Превышен адресуемый размер региона MCA")
            pos = len(data)
            struct.pack_into(">I", data, 4*i, start << 8 | capacity)
        data[pos:pos+capacity*SECTOR] = record.ljust(capacity * SECTOR, b"\0")
    if changed:
        counts["изменённых регионов MCA"] += 1
        if write:
            path.write_bytes(data)


def world_data(root, worlds, refs, write, counts):
    for world in worlds:
        top = root / world
        print(f"  Мир {world}: проверяю регионы и данные измерений…", flush=True)
        for base, dirs, files in os.walk(top, onerror=walk_error):
            directory = Path(base)
            rel = directory.relative_to(top)
            if not rel.parts:
                dirs[:] = [d for d in dirs if d in ("region", "entities", "poi", "data", "dimensions") or d.startswith("DIM")]
            for name in sorted(files):
                p = directory / name
                try:
                    if directory.name in ("region", "entities", "poi") and name.endswith(".mca"):
                        region_file(p, refs, write, counts)
                    elif directory.name in ("region", "entities", "poi") and (name.endswith((".mcr", ".linear")) or ".oversized" in name):
                        raise Problem("Нужна конвертация старого или нестандартного формата региона в Anvil")
                    elif (directory == top and name in ("level.dat", "level.dat_old")) or ("data" in rel.parts and name.endswith(".dat")):
                        nbt_file(p, refs, None, write, counts)
                except (ValueError, OSError, EOFError, zlib.error, struct.error, Problem) as e:
                    raise Problem(f"{p.relative_to(root)}: {e}") from e


LP_TABLES = ("luckperms_players", "luckperms_user_permissions")
LP_QUERY = """
SELECT LOWER(uuid) AS uid, 'luckperms_players' AS tab, COUNT(*) AS n,
       primary_group AS grp, username AS nick
FROM luckperms_players GROUP BY LOWER(uuid), primary_group, username
UNION ALL
SELECT LOWER(uuid), 'luckperms_user_permissions', COUNT(*), '', ''
FROM luckperms_user_permissions GROUP BY LOWER(uuid)
"""


def lp_plan(rows, players, prefer, counts):
    rows = list(rows)
    before = {(parse_id(ident), table): int(n) for ident, table, n, _, _ in rows}
    used = {ident for ident, _ in before}
    cache_only = set()
    for ident, table, _, group, nick in rows:
        uid = parse_id(ident)
        if (uid not in players.known and table == LP_TABLES[0] and group == "default"
                and (uid, LP_TABLES[1]) not in before):
            cache_only.add(uid)
            print(f"  LuckPerms: только кэш имени {nick!r} ({uid}), прав нет. Для переноса укажите точный ник в --map.")
    players.require(used - cache_only, "LuckPerms")
    expected, statements = before.copy(), []
    for old in sorted(used.intersection(players.ids)):
        new = players.ids[old]
        if new in used and players.names[old] not in prefer:
            raise Problem(f"LuckPerms: записи есть у обоих UUID. Проверьте права и выберите профиль через --prefer-online {players.names[old]}.")
        for table in LP_TABLES:
            if (new, table) in before:
                statements.append(f"DELETE FROM {table} WHERE LOWER(uuid)='{new}'")
                del expected[new, table]
            if (old, table) in before:
                expected[new, table] = expected.pop((old, table))
                counts["записей LuckPerms"] += expected[new, table]
                statements.append(f"UPDATE {table} SET uuid='{new}' WHERE LOWER(uuid)='{old}'")
    return statements, expected


def verify_lp(rows, expected):
    actual = {(parse_id(ident), table): int(n) for ident, table, n, _, _ in rows}
    if actual != expected:
        raise Problem("Проверка количества игроков и записей прав LuckPerms после переноса не прошла")


def h2_run(driver, work, sql):
    script = work / "commands.sql"
    script.write_text(sql, encoding="utf-8")
    result = subprocess.run(["java", "-cp", str(driver), "org.h2.tools.RunScript",
                             "-url", "jdbc:h2:./perm;IFEXISTS=TRUE", "-user", "", "-password", "",
                             "-script", str(script)], cwd=work, capture_output=True, text=True)
    if result.returncode:
        detail = result.stderr.strip() or result.stdout.strip() or f"код {result.returncode}"
        raise Problem("H2 отказался выполнить запрос: " + detail.splitlines()[0])


def h2_rows(driver, work):
    query = LP_QUERY.replace("'", "''")
    h2_run(driver, work, f"CALL CSVWRITE('rows.csv', '{query}');")
    with (work / "rows.csv").open(encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        next(reader)
        return list(reader)


def luckperms(root, players, prefer, write, counts, driver_arg):
    folder = root / LP
    if not folder.exists():
        return
    config = load_yaml(folder / "config.yml")
    method = str(config.get("storage-method", "h2")).lower()
    if (config.get("split-storage") or {}).get("enabled") or method not in ("h2", "sqlite"):
        raise Problem(f"LuckPerms использует {method} или split-storage. Нужен отдельный перенос этого хранилища.")
    with tempfile.TemporaryDirectory(prefix="paper-lp-") as name:
        work = Path(name).resolve()
        if method == "sqlite":
            original = folder / "luckperms-sqlite.db"
            tmp = work / "perm.db"
            shutil.copyfile(original, tmp)
            for suffix in ("-wal", "-journal"):
                sidecar = Path(str(original) + suffix)
                if sidecar.is_file():
                    shutil.copyfile(sidecar, str(tmp) + suffix)
            with ExitStack() as stack:
                db = sqlite3.connect(tmp)
                stack.callback(db.close)
                db.execute("PRAGMA journal_mode=DELETE")
                if db.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                    raise Problem("LuckPerms SQLite: quick_check сообщил об ошибке")
                sql, expected = lp_plan(db.execute(LP_QUERY), players, prefer, counts)
                if sql:
                    with db:
                        for statement in sql:
                            db.execute(statement)
                        verify_lp(db.execute(LP_QUERY), expected)
        else:
            original = folder / "luckperms-h2-v2.mv.db"
            if not original.exists():
                original = folder / "luckperms-h2.mv.db"
            drivers = [driver_arg] if driver_arg else sorted((folder / "libs").glob("h2-driver-*.jar"))
            if len(drivers) != 1 or not drivers[0].is_file():
                raise Problem("Укажите JDBC JAR от установленной версии LuckPerms через --h2-jar.")
            tmp = work / "perm.mv.db"
            shutil.copyfile(original, tmp)
            sql, expected = lp_plan(h2_rows(drivers[0], work), players, prefer, counts)
            if sql:
                h2_run(drivers[0], work, "SET AUTOCOMMIT FALSE;\n" + ";\n".join(sql) + ";\nCOMMIT;")
                verify_lp(h2_rows(drivers[0], work), expected)
        if sql and write:
            shutil.copyfile(tmp, original)
            if method == "sqlite":
                for suffix in ("-wal", "-shm", "-journal"):
                    Path(str(original) + suffix).unlink(missing_ok=True)


def migrate(root, worlds, manual, prefer, write, driver):
    profiles = profile_files(root, worlds)
    players = Players(root, profiles, manual)
    unknown = prefer - set(players.names.values())
    if unknown:
        raise Problem("Не найдены ники из --prefer-online: " + ", ".join(sorted(unknown)))
    print(f"Игроков с online-UUID: {len(players.ids)}", flush=True)
    for ident, target in sorted(players.ids.items(), key=lambda pair: players.names[pair[0]]):
        print(f"  {players.names[ident]}  {ident} -> {target}")
    plugin_dir = root / "plugins"
    if plugin_dir.is_dir():
        others = sorted(p.name for p in plugin_dir.iterdir() if p.is_dir() and p.name not in ("AuthMe", "Essentials", "LuckPerms"))
        if others:
            print("Другие каталоги плагинов (проверьте данные отдельно): " + ", ".join(others))
    counts = Counter()
    refs = References(players)
    migrate_profiles(profiles, players, refs, prefer, write, counts)
    migrate_lists(root, players, write, counts)
    essentials_cache(root, players, write, counts)
    luckperms(root, players, prefer, write, counts, driver)
    world_data(root, worlds, refs, write, counts)
    for item, count in sorted(counts.items()):
        print(f"  {item}: {count}")
    if not counts:
        print("Совпадающих исходных UUID в поддерживаемых данных нет. Изменений не требуется.")
    return players, counts


@contextmanager
def staged_copy(root, output):
    if output == root or root in output.parents or not output.parent.is_dir():
        raise Problem("--output должен быть новым каталогом вне сервера, внутри существующего родителя.")
    if os.path.lexists(output):
        raise Problem(f"Путь уже занят: {output}")
    with tempfile.TemporaryDirectory(dir=output.parent, prefix=".paper-migrate-") as name:
        stage = Path(name) / "server"
        # cp работает в отдельном процессе: чтение session.lock не снимает
        # POSIX-блокировку родителя. Полная копия, отдельные inode от источника.
        subprocess.run(["cp", "-a", "--reflink=auto", "--no-preserve=links", "--", str(root), str(stage)], check=True)
        yield stage
        rename_directory(stage, output, RENAME_NOREPLACE)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", required=True, type=Path, help="корень остановленного сервера с server.properties")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="показать план, режим по умолчанию")
    modes.add_argument("--output", type=Path, help="создать готовую копию по новому пути")
    modes.add_argument("--swap-with", type=Path, help="поменять местами два остановленных сервера, повторить для отката")
    parser.add_argument("--map", type=Path, help="CSV с заголовком name,online_uuid")
    parser.add_argument("--prefer-online", action="append", default=[], metavar="НИК", help="при конфликте выбрать online-профиль этого игрока, можно повторять")
    parser.add_argument("--world", action="append", default=[], help="дополнительный мир относительно --server, можно повторять")
    parser.add_argument("--h2-jar", type=Path, help="JDBC-драйвер H2 от вашей версии LuckPerms")
    args = parser.parse_args()
    root = args.server.resolve(strict=True)
    if not (root / "server.properties").is_file():
        raise Problem(f"В {root} нет server.properties")
    if args.swap_with:
        if args.server.is_symlink() or args.swap_with.is_symlink():
            raise Problem("Для обмена укажите настоящие каталоги без символьных ссылок.")
        if args.map or args.prefer_online or args.h2_jar:
            raise Problem("При --swap-with нужны только пути к серверам и, при необходимости, --world.")
        swap_servers(root, args.swap_with.resolve(strict=True), args.world)
        return
    manual = manual_names(args.map)
    driver = args.h2_jar.resolve(strict=True) if args.h2_jar else None
    with ExitStack() as stack:
        lock_directory(stack, root, exclusive=False)
        check_tree(root)
        worlds = find_worlds(root, args.world)
        lock_worlds(stack, root, worlds)
        target = root
        if args.output:
            # Сохраняем последний компонент как есть, включая битую ссылку.
            out = args.output.absolute()
            out = out.parent.resolve(strict=True) / out.name
            target = stack.enter_context(staged_copy(root, out))
        players, counts = migrate(target, worlds, manual, set(args.prefer_online), bool(args.output), driver)
        if args.output and counts:
            print("Сверяю готовую копию с исходной таблицей UUID…", flush=True)
            original_ids = {ident: players.names[ident] for ident in players.ids}
            with open(os.devnull, "w") as silent, redirect_stdout(silent):
                _, pending = migrate(target, worlds, {**manual, **original_ids}, set(), False, driver)
            if pending:
                raise Problem(f"В итоговой копии остались изменения для переноса: {dict(pending)}")
    if args.output:
        print(f"Готовая копия: {out}\nИсходный сервер: {root}")
    else:
        print("Проверка завершена. Для создания копии повторите команду с --output вместо --check.")


if __name__ == "__main__":
    try:
        main()
    except (Problem, OSError, ValueError, EOFError, subprocess.SubprocessError, sqlite3.Error, struct.error, RecursionError) as exc:
        sys.exit(f"Перенос остановлен: {exc}")
