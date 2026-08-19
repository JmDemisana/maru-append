# 🧰 Maru Append (Companions, Services & Ecosystem Tools)

> *"Every hero needs their handy utility belt, Senpai! These background tools keep everything running smoothly behind the scenes so you can focus on what matters!"* — **Nanami 💚**

Welcome to **Maru Append**! This repository serves as the central hub for local background servers, sidecar daemons, and system utilities supporting the broader Maru ecosystem.

---

## 🛠️ Included Tools & Services

### 🎥 [`companions/movieplay-companion`](./companions/movieplay-companion) — *MoviePlay Companion Server*
*High-performance local streaming relay & desktop media launcher!*

A lightweight Express-based background daemon running on `http://127.0.0.1:8444`.
- 🧲 **WebTorrent P2P Engine**: Streams video directly from torrent magnet links with sequential byte fetching.
- 🎬 **Native Player Integration**: Launches VLC and MPV directly with custom audio track flags and subtitle attachments.
- ⚡ **FFmpeg Transcoding Relay**: Converts unsupported web video formats on-the-fly into browser-friendly MP4/HLS streams.
- 🎛️ **System Tray Control**: Runs discreetly in your Windows notification tray (`systray2`).

### 🖱️ [`tools/scroll-fix`](./tools/scroll-fix) — *ScrollFix (AHK v2)*
*Debounce script to fix erratic or double-scrolling mouse wheels!*

A single, clean **AutoHotkey v2** script that filters out mouse wheel jitter and accidental reverse-scroll ticks:
- ⏱️ **50ms Threshold**: Eliminates hardware debounce bounceback on worn-out scroll wheels.
- 🎯 **Direction Lock**: Prevents sudden one-tick reverse glitches during fast scrolling.

---

## 🏷️ Release Tags

- `movieplay-companion/vX.Y.Z` → Builds and attaches the standalone Windows `.exe` bundle for MoviePlay Companion.

---

<div align="center">
  <sub>Keeping your setup running smoothly — Nanami 💚</sub>
</div>
