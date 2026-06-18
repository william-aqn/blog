# amtm — fork / mirror

This is a **fork (mirror with edits)** of **amtm** — the *Asuswrt-Merlin Terminal Menu*
by **thelonelycoder**.

Original: <https://diversion.ch/amtm/amtm> · docs: <https://diversion.ch/amtm.html>

This mirror exists so that installation keeps working even if the original
`diversion.ch` becomes unavailable.

- **Snapshot:** amtm `6.3` (legacy, released January 31 2026), mirrored on **2026-06-18**
- **Hosted at:** `https://x-crm.in/assets/blog/asus/amtm/`
- **License:** GNU GPL-3.0 (same as the original) — <https://opensource.org/licenses/GPL-3.0>

## Install

```sh
curl -Os https://x-crm.in/assets/blog/asus/amtm/amtm && sh amtm
```

`-O` saves the file as `amtm`, then `sh amtm` runs the installer.

## Changes from upstream

To make the script independent of `diversion.ch`, only minimal edits were made
(the rest of the code is identical to upstream):

1. **Update source `amtmURL`** repointed to this mirror:
   `https://diversion.ch/amtm` → `https://x-crm.in/assets/blog/asus/amtm`.
   This single variable drives both self-update and module downloads.
2. **Added `x-crm.in`** to `shared-amtm-whitelist` (for the Skynet firewall) and
   recomputed the `wl_MD5` checksum.
3. **Pinned LF line endings** (`.gitattributes`): the router keeps an LF copy and
   compares its MD5 against the file fetched over the network — CRLF would cause a
   permanent phantom "MD5 upd" on every run.

Left pointing to `diversion.ch` on purpose: `entware.diversion.ch` (separate
Entware ecosystem), the hidden `beta`/`local` dev branches, attribution comments,
and the changelog link.

## Directory contents

- `amtm` — the menu script itself
- `*.mod` — ~41 installer modules (Diversion, Skynet, WireGuard Session Manager,
  Entware setup, etc.); amtm downloads them when you install the matching script
- `.gitattributes` — LF enforcement

## Updating the mirror

This is a frozen snapshot. Scripts installed through amtm update themselves (via
their own mechanisms), so version drift is low-risk. To refresh the installers,
re-download `amtm` and `*.mod` from `https://diversion.ch/amtm/` and re-apply the
three edits above (remember to recompute `wl_MD5` if the whitelist changes).

---

*All rights to the original amtm belong to thelonelycoder.
Copyright (c) 2016-2066 thelonelycoder. This is an unofficial mirror.*
