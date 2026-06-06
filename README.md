# TMVideo

[![Version](https://img.shields.io/badge/version-0.2.6-brightgreen)](https://github.com/57471C/TMVideo/blob/main/LICENSE)

## Overview

TMVideo (Time Media Video) is a lightweight, high-performance native Windows media player and video annotation tool[cite: 1153]. Built with a Vanilla JavaScript frontend and a Tauri Rust backend, it bypasses standard browser memory limits to open massive 4K production videos instantly without lagging[cite: 1156, 1253]. It is specifically designed for rapid chapter bookmarking, timeline review, and automated batch processing[cite: 1168, 1902].

## Core Features

* **Advanced Playback Controls**: Features custom Tailwind-styled overlay controls and a speed slider supporting up to 8x playback[cite: 1157]. Includes keyboard-first hotkeys for immediate control using the Spacebar and Left/Right arrows[cite: 1157].
* **Timeline Bookmarking**: Utilizes a streamlined data grid displaying Timestamp, Note/Description, and a Jump-To action icon[cite: 1159]. Injects visual tick-marks directly onto the timeline slider for quick chapter navigation[cite: 1158].
* **Batch Processing Queue**: Holds queued media tasks (e.g., trimming, compressing) for automated batch execution[cite: 1168, 1169]. Uses Tauri's Command API to execute FFmpeg sidecar commands in the background one video at a time[cite: 1170].
* **`.tmv` Project Files**: Registers the distinct `.tmv` (Time Media Video) extension to prevent routing conflicts with other software[cite: 1164, 1165]. Acts as an Edit Decision List (EDL) formatted in JSON to instantly reload saved video annotations[cite: 1167].
* **Quick View Mode**: TMVideo doubles as a lightweight, native OS media player. When you launch the application by double-clicking a raw video file (e.g., `.mp4`, `.mkv`) directly from your operating system, TMVideo will bypass the editing workspace and launch in **Quick View** mode

## Tech Stack & Architecture

* **Frontend Engine**: Vanilla JavaScript utilizing direct DOM manipulation, styled completely with compiled Tailwind CSS[cite: 1239, 1240].
* **Desktop Wrapper**: Tauri (Rust-based engine) utilizing the `convertFileSrc` asset protocol and HTTP Range Requests for zero-latency local video streaming[cite: 1155, 1242, 1253].
* **Video Processing**: Leverages the "Static" Windows build of `ffmpeg.exe` (~80MB) integrated as a native Tauri sidecar to handle heavy-duty media rendering[cite: 1171, 1254].

## Installation & Setup

1. **Clone the repository.**
2. **Install node dependencies**:
   ```bash
   npm install
   ```

## Changelog

### v0.2.4
* Added: "CC" Closed Captions toggle button with t/T (titles) shortcut key.

### v0.2.3
* Added: "expand player" button to toggle between editing and quick view modes.

### v0.2.2
* Added: Native OS file association for direct launching of `.mp4`, `.mkv`, `.avi`, `.mov`, and `.mpg` files via double-click.
* Added: Background Rust command `get_launch_argument` to catch and parse OS-level file arguments on startup.
* Added: Automatic initialization of blank project states when raw media files are passed from the OS.
* Updated: Installer payload now silently registers TMVideo into the Windows "Open With..." registry for `.tmv` and `.tmvz` project files.

### v0.1.0
* Initial migration to TMVideo, downgrading version from 0.6.2 to 0.1.0 to reflect the new direction as a media player and annotation tool.