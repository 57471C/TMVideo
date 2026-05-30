# TimeStudy

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/57471C/TimeStudy/actions)
[![Version](https://img.shields.io/badge/version-0.6.2-brightgreen)](https://github.com/57471C/TimeStudy/blob/main/LICENSE)


## Features

- **Video Playback**: Load and control video files with play, pause, seek, speed (0.5x–8x), and volume adjustments.
- **Zoom Controls**: Marquee-based video zoom with reset functionality.
- **Task Management**: Add, edit, split, and delete Operations and Tasks with Value-Added (VA), Non-Value-Added (NVA), and Waste (W) statuses.
- **Charting**: Visualize task durations with Gantt, column, and pie charts, customizable by time format (MM:SS:MS, ms, decimal minutes).
- **Multi-Trial Kaizen**: Duplicate and compare multiple trials within a single project to visualize process improvements over time.
- **Comparison Dashboard**: Full-screen dashboard comparing Value-Add breakdown, estimated capacity (Units per Shift), and Labor Cost per Unit across trials.
- **Takt Time**: Set and visualize takt time for process optimization.
- **Dark/Light Mode**: Toggle between themes for improved usability.

## Usage

1. **Load Video**: Click “Load” or the placeholder to select a video file.
2. **Configure Project**: Open the Settings (Gear) menu to set Hourly Rate, Shift Length, and Efficiency.
3. **Add Operations/Tasks**: Use “Add Operation” and “Add Task” buttons to log process steps.
4. **Analyze Data**: View the inline Gantt/Column charts, or create a new Trial via the header dropdown to analyze improvements.
5. **Compare Trials**: Click "Compare Trials" to view the full-screen Kaizen dashboard.
6. **Save/Load**: Use “Save Project” to `.tsp` file (JSON).
7. **Export**: Use "Export" to save data as CSV or XLSX formats.
8. **Toggle Format**: Switch between MM:SS:MS, milliseconds, or decimal minutes.
9. **Dark Mode**: Click the sun/moon icon to toggle themes.

## Version 0.6.2 Updates
- **Tetris Input Event and Focus Blurring**: Implemented blurring of active button focus on Tetris game start and blocked keyboard propagation on game controls (arrows/spacebar). This prevents spacebar inputs (hard drops) from triggering close/cancel buttons in the HTML `<dialog>` modal.
- **Secret Game Flags and Flow Controls**: Added standard `isSecretGame` flag routing in the add operation routines to properly close the modal, cleanup event listeners, and stop game loops without dropping back into standard video editing controls.
- **Kaizen Dashboard and Layout Polish**: Standardized close transitions for the trim video modal on both error and abort paths. Added dark-mode `color-scheme` support and custom rounded scrollbars for premium UX.
- **Media Row Actions Update**: Reverted the video editing action button from custom overlays to a clean, standard video camera icon to maximize interface simplicity.

## Version 0.6.1 Updates
- **Trim Modal Transition Fix**: Restructured the modal closing and UI reset sequence to prevent WebView2 rendering race conditions on close. Opacity and scale transition classes are now only reapplied when the modal is opened.
- **Cancel and Error Close Animations**: Standardized close transition animations across all closing actions (success, cancel, and error blocks) for a premium, consistent user experience.
- **Tetris Control Input Propagation Blocking**: Added event blocking (`preventDefault()` and `stopPropagation()`) for Tetris game keys (arrow keys and spacebar). This resolves the issue where pressing the spacebar (hard drop) clicked focused elements like the close/cancel button and closed the modal.
- **Secret Game Exit Handling**: Implemented a global `window.cleanupTetris` hook that successfully stops the game loop and removes window keydown listeners. Updated the boss key (`"B"`) and game over screen in the secret game to close the modal directly and return to the main app, instead of falling back to the video trimming layout.

## Version 0.6.0 Updates
- **Rust-Side FFmpeg Execution**: Shifted FFmpeg process spawning and standard stream consumption from guest JavaScript to Rust host backend. This completely bypasses the WebView IPC stream buffer limitations, eliminating Windows-specific deadlocks during high-framerate processing.
- **Event-Driven Progress Listening**: Modified frontend to listen for `ffmpeg-stderr` events emitted from the Rust backend for progress percentage calculations, ensuring responsive updates to the UI and Tetris difficulty tracking.
- **Improved Abort / Watchdog Integration**: Coordinated frontend UI triggers (abort button and progress watchdog) with backend-managed process termination (`abort_ffmpeg`) to guarantee clean sidecar cleanup and avoid resource lockups.
- **Sidecar Name Resolution Fix**: Corrected Rust sidecar name parameter from `"binaries/ffmpeg"` to `"ffmpeg"`. This resolves the path resolution failure (`os error 3`) on Windows.
- **Progress Estimation Fix**: Switched to parsing only `out_time_us` for progress calculations. This prevents the progress bar from immediately jumping to 100% due to a known FFmpeg bug where `out_time_ms` outputs microsecond values instead of millisecond values, causing incorrect scale factor division.
- **UX & Modal Polish**: Switched the success toast notification message to "Video completed.", shortened the post-trim modal close delay from 600ms to 200ms, and corrected the Tetris active check from `style.display` to `!classList.contains("hidden")` to ensure the modal closes properly in normal mode.

## Version 0.5.6 Updates
- **FFmpeg Kill Permission**: Added `shell:allow-kill` to Tauri capabilities. Previously, clicking Cancel left zombie FFmpeg processes running that held a file lock on the output file — causing every subsequent encode to stall at ~10–12% with an I/O error. Cancel now properly terminates the process.
- **Progress Watchdog**: Added a 30-second watchdog timer that auto-aborts and kills FFmpeg if no progress is received. The watchdog resets on every `out_time_ms` tick and fires with a user-friendly error message if the encode stalls for any reason (file lock, codec hang, I/O error, etc.).

## Version 0.5.5 Updates
- **FFmpeg Progress Pipeline Rewrite**: Switched from parsing FFmpeg's human-readable `stderr` stats (which use `\r` carriage-return overwriting and intermittently stalled on Windows due to pipe buffer deadlock) to the machine-readable `-progress pipe:1` flag. Progress data is now emitted to `stdout` as newline-delimited `key=value` pairs (`out_time_ms`), which the Tauri IPC bridge flushes reliably on every line. Eliminates the intermittent freeze at ~10–12% during compressed encodes.
- **Capabilities Cleanup**: Removed the invalid `shell:allow-execute` permission block from `default.json` (not a valid Tauri v2 identifier). Only `shell:allow-spawn` is required for sidecar execution.

## Version 0.5.4 Updates
- **Tetris Easter Egg**: Added a playable Tetris clone easter egg inside the video processing modal triggered by double-clicking the progress bar. Features dynamic difficulty (garbage lines on FFmpeg progress), a "Boss Key" (panic toggle via B key), high score tracking, and custom overlay actions on complete.

## Version 0.5.3 Updates
- **Charts update**: font size changes to make it readble if there are a lot of Tasks.
- **Project Exporting**: Corrected the formatting of CSV export. Added XLSX export and formatting.
- **Table Scrolling**: The table header row and Operations rows are now "sticky" when vertical scrolling.

## Version 0.5.2 Updates
- **Lean/Labour Grouping Mode**: Introduced a new toggle in the table header to switch charts between Lean analysis (VA/NVA/W) and Labour code grouping.
- **UI/UX Refinements**: Added operation start-time tick marks to the timeline seekbar and enabled scroll-sticky headers for video and operations tables.
- **Tauri & State Fixes**: Upgraded Tauri save/load integration, resolved horizontal window panning issues, and corrected takt time/process limits logic.

## Version 0.5.1 Updates
- **Performance Optimizations**: Switched real-time inputs to `change` events, drastically reducing chart re-renders and eliminating UI freezing.
- **Tailwind v4 Upgrade**: Updated codebase to utilize modern Tailwind v4 syntax and dynamic spacing scales.
- **Developer Experience**: Configured workspace settings to prevent Language Server out-of-memory crashes from minified and auto-generated files.

## Version 0.5.0 Updates
- **UI Overhaul**: Purged legacy custom CSS in favor of standard Tailwind CSS utility classes.
- **Optimized Layouts**: Adjusted chart dimensions and compressed table row heights to improve information density and readability.

## Version 0.4.7 Updates
- **UI Enhancements**: Implemented borderless action icons across task rows for a cleaner appearance.
- **Inline Assignment**: Replaced modals with contextual inline dropdown menus for assigning Part Numbers and Labour Codes, now fully supporting quantity inputs.

## Version 0.4.6 Updates
- **Native App Enhancements**: Switched native Save/Load behaviors to Tauri Core Invoke commands for reliable app-specific behavior.
- **File Overwrite Support**: Added `window.showSaveFilePicker` for seamless file overwriting in browsers, acting like a true desktop app.
- **Clean State Initialization**: Apps now always open to an "Untitled Project" instead of auto-loading cache.
- **Safe Prompts**: Added robust confirmation checks to prevent accidental data loss when closing windows, starting new projects, or loading new videos.

## Version 0.4.5 Updates
- **UI Cleanup**: Reorganized the Operations Panel and moved file management tools (Save/Load/New) to the top header.
- **Auto-Complete**: Added dynamic auto-complete suggestions for Operation and Task names based on prior entries.
- **Keyboard Shortcuts**: Implemented shortcuts (`1`-`8`, `` ` ``) for quickly adjusting playback speeds.
- **Accessibility**: Improved touch targets for Trial management buttons.

## Version 0.4.4 Updates
- **Multi-Trial Support**: Added the ability to create, duplicate, and seamlessly switch between multiple trials within a single project.
- **Kaizen Comparison Dashboard**: Introduced a dedicated analytics dashboard to compare metrics across trials.
- **Video Blob Caching**: Switching trials automatically caches and restores video streams without requiring manual file re-linking.
- **Settings**: Added "Units per Cycle" and "Project Comments" to the Settings panel.
- **Cleanup**: Removed legacy XLSX and Excel handling dependencies.

## Project Structure


## Contributing

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
3. Commit changes:
   ```bash
   git commit -m "Add your feature"
   ```
4. Push and open a pull request:
   ```bash
   git push origin feature/your-feature
   ```

## Native Video Processing Setup (FFmpeg Sidecar)

For the desktop app's native video trimming/compression feature to work, you must bundle the FFmpeg binary as a Tauri sidecar:
1. Create a `src-tauri/binaries/` folder if it does not exist.
2. Download the FFmpeg executable for your target platform.
3. Rename and place the executable in the `src-tauri/binaries/` folder according to Tauri's target triple naming convention (e.g. `ffmpeg-x86_64-pc-windows-msvc.exe` on Windows).

## License

MIT License (see `LICENSE` file, if applicable).

## Contact

For questions, contact the repository owner via GitHub.
