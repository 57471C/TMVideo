# TMVideo: Agent Context & Directives

## Important Context
This project was originally bootstrapped from a template of `https://github.com/57471C/TimeStudy` (an industrial engineering time and motion analysis program). The goal of this repository is to convert that codebase into **TMVideo**, a high-performance, lightweight Windows media player and video annotation tool. 

**CRITICAL RULE:** You must confirm with the Developer before removing legacy features from the TimeStudy template. Always warn the developer if removing a feature might break functionality (e.g., video syncing, timeline tick-marks) or have unintended consequences.

## Core Architecture & Tech Stack
- **Frontend Engine:** Vanilla JavaScript. Do NOT introduce frameworks like React, Vue, or jQuery.
- **Styling:** Compiled Tailwind CSS (utilizing `input.css`, `tailwind.css`, and `styles.css`).
- **Desktop Wrapper:** Tauri (Rust-based engine) compiling into a native Windows `.exe`.
- **Video Handling:** Relies on Tauri's `convertFileSrc` asset protocol and HTTP Range Requests to instantly stream local hardware video files with zero latency.
- **Processing:** Uses a Tauri Sidecar bundling a Static Windows `ffmpeg.exe` binary for video trimming and batch processing.

## Media Player UX & Features (What Stays)
When refactoring, the following legacy elements are critical to the media player and must be preserved:
- The custom Tailwind-styled video overlay controls and hotkeys (Spacebar, Arrows).
- The timeline bookmarking logic (injecting visual tick-marks onto the seek bar).
- The right-hand data grid (repurposed from "Operations" into "Bookmarks/Chapters" with Timestamp and Jump-To action icons).
- The `.tmv` (Time Media Video) file extension routing, which acts as a JSON-based Edit Decision List (EDL) to save and load video bookmarks.

## Global Development Directives
1. **Strict Linting Compliance:** ALL generated JavaScript, HTML, and CSS must strictly pass Biome 2.4 linting and formatting rules. Do not use legacy ESLint or Prettier formatting patterns.
2. **Version Control & Documentation:** Whenever a version number is bumped (upreved) in the project files, you MUST automatically analyze the modifications and update `README.md` to document the latest changes.
3. **Deployment Handoff:** After successfully modifying files, always conclude your response by outputting the exact `git add` and `git commit` terminal commands required to commit the changes to the `main` branch, utilizing conventional commit messaging. 