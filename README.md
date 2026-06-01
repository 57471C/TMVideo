# TMVideo

[![Version](https://img.shields.io/badge/version-0.2.1-brightgreen)](https://github.com/57471C/TMVideo/blob/main/LICENSE)

## Overview

[cite_start]TMVideo (Time Media Video) is a lightweight, high-performance native Windows media player and video annotation tool[cite: 1153]. [cite_start]Built with a Vanilla JavaScript frontend and a Tauri Rust backend, it bypasses standard browser memory limits to open massive 4K production videos instantly without lagging[cite: 1156, 1253]. [cite_start]It is specifically designed for rapid chapter bookmarking, timeline review, and automated batch processing[cite: 1168, 1902].

## Core Features

* [cite_start]**Advanced Playback Controls**: Features custom Tailwind-styled overlay controls and a speed slider supporting up to 8x playback[cite: 1157]. [cite_start]Includes keyboard-first hotkeys for immediate control using the Spacebar and Left/Right arrows[cite: 1157].
* [cite_start]**Timeline Bookmarking**: Utilizes a streamlined data grid displaying Timestamp, Note/Description, and a Jump-To action icon[cite: 1159]. [cite_start]Injects visual tick-marks directly onto the timeline slider for quick chapter navigation[cite: 1158].
* [cite_start]**Batch Processing Queue**: Holds queued media tasks (e.g., trimming, compressing) for automated batch execution[cite: 1168, 1169]. [cite_start]Uses Tauri's Command API to execute FFmpeg sidecar commands in the background one video at a time[cite: 1170].
* [cite_start]**`.tmv` Project Files**: Registers the distinct `.tmv` (Time Media Video) extension to prevent routing conflicts with other software[cite: 1164, 1165]. [cite_start]Acts as an Edit Decision List (EDL) formatted in JSON to instantly reload saved video annotations[cite: 1167].

## Tech Stack & Architecture

* [cite_start]**Frontend Engine**: Vanilla JavaScript utilizing direct DOM manipulation, styled completely with compiled Tailwind CSS[cite: 1239, 1240].
* [cite_start]**Desktop Wrapper**: Tauri (Rust-based engine) utilizing the `convertFileSrc` asset protocol and HTTP Range Requests for zero-latency local video streaming[cite: 1155, 1242, 1253].
* [cite_start]**Video Processing**: Leverages the "Static" Windows build of `ffmpeg.exe` (~80MB) integrated as a native Tauri sidecar to handle heavy-duty media rendering[cite: 1171, 1254].

## Installation & Setup

1. **Clone the repository.**
2. **Install node dependencies**:
   ```bash
   npm install
   ```

## Changelog

### v0.1.0
* Initial migration to TMVideo, downgrading version from 0.6.2 to 0.1.0 to reflect the new direction as a media player and annotation tool.