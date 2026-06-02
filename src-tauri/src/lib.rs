
use std::sync::Mutex;
use tauri::Manager;
use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[derive(Default)]
pub struct FfmpegState(pub Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[tauri::command]
fn get_startup_file() -> Option<String> {
    std::env::args()
        .skip(1)
        .map(|arg| arg.trim_matches('"').to_string())
        .find(|arg| arg.to_lowercase().ends_with(".tmv"))
}

#[tauri::command]
fn get_launch_argument() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 {
        let arg = &args[1];
        if !arg.starts_with("--") {
            return Some(arg.trim_matches('"').to_string());
        }
    }
    None
}

#[tauri::command]
async fn run_ffmpeg(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, FfmpegState>,
    args: Vec<String>,
) -> Result<String, String> {
    // 1. Check if there is already a running process
    {
        let guard = state.0.lock().unwrap();
        if guard.is_some() {
            return Err("FFmpeg process is already running.".to_string());
        }
    }

    // 2. Create sidecar command
    let sidecar_cmd = app_handle
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args(args);

    // 3. Spawn child
    let (mut rx, child) = sidecar_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn FFmpeg sidecar: {}", e))?;

    // 4. Store child in state
    {
        let mut guard = state.0.lock().unwrap();
        *guard = Some(child);
    }

    // 5. Read output in a background task
    let app_clone = app_handle.clone();
    let stderr_logs = std::sync::Arc::new(Mutex::new(Vec::new()));
    let stderr_logs_clone = stderr_logs.clone();

    let join_handle = tauri::async_runtime::spawn(async move {
        let mut exit_code = None;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    let _ = app_clone.emit("ffmpeg-stdout", line);
                }
                CommandEvent::Stderr(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes).to_string();
                    // Store in log buffer
                    {
                        let mut logs = stderr_logs_clone.lock().unwrap();
                        logs.push(line.clone());
                        if logs.len() > 100 {
                            logs.remove(0);
                        }
                    }
                    // Emit progress or raw logs to JS
                    let _ = app_clone.emit("ffmpeg-stderr", line);
                }
                CommandEvent::Terminated(payload) => {
                    exit_code = payload.code;
                    break;
                }
                _ => {}
            }
        }

        // Clear child from state
        let state = app_clone.state::<FfmpegState>();
        {
            let mut guard = state.0.lock().unwrap();
            *guard = None;
        }

        exit_code
    });

    // Wait for the process to complete or fail
    let exit_code = join_handle.await
        .map_err(|e| format!("Background thread panicked: {}", e))?;

    match exit_code {
        Some(0) => Ok("Success".to_string()),
        Some(code) => {
            let logs = stderr_logs.lock().unwrap().join("\n");
            Err(format!("FFmpeg failed with exit status code {}.\n\nLogs:\n{}", code, logs))
        }
        None => {
            Err("FFmpeg process ended unexpectedly or was terminated by signal.".to_string())
        }
    }
}

#[tauri::command]
async fn abort_ffmpeg(state: tauri::State<'_, FfmpegState>) -> Result<(), String> {
    let mut guard = state.0.lock().unwrap();
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
    Ok(())
}

// Triggering a recompile to pick up new icons

#[tauri::command]
async fn generate_auto_captions(app_handle: tauri::AppHandle, video_path: String) -> Result<String, String> {
    // Clone the handles for the blocking task
    let app_handle_clone = app_handle.clone();
    let video_path_clone = video_path.clone();

    tokio::task::spawn_blocking(move || {
        use std::path::Path;
        use std::env;
        use std::time::{SystemTime, UNIX_EPOCH};

        // --- Path Setup ---
        let video_p = Path::new(&video_path_clone);
        let base_dir = video_p.parent().ok_or_else(|| "Failed to get video parent directory".to_string())?;
        let file_stem = video_p.file_stem().and_then(|s| s.to_str()).ok_or_else(|| "Failed to get video file stem".to_string())?;
        
        let unique_id = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
        let temp_wav_filename = format!("{}_{}.wav", file_stem, unique_id);
        let temp_wav_path = env::temp_dir().join(&temp_wav_filename);
        let temp_wav_str = temp_wav_path.to_str().ok_or_else(|| "Invalid temp WAV path".to_string())?;

        let final_vtt_path = base_dir.join(format!("{}.vtt", file_stem));
        let final_vtt_str = final_vtt_path.to_str().ok_or_else(|| "Invalid final VTT path".to_string())?.to_string();

        // --- Model Path Resolution ---
        let model_path = app_handle_clone
            .path()
            .resolve("models/ggml-base.en.bin", tauri::path::BaseDirectory::Resource)
            .map_err(|e| format!("Failed to resolve model path: {}", e))?;
        let model_path_str = model_path.to_str().ok_or_else(|| "Invalid model path string".to_string())?;

        // --- Step 1: Extract WAV with FFmpeg ---
        let ffmpeg_sidecar = app_handle_clone.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
        let ffmpeg_output = std::process::Command::new(ffmpeg_sidecar.path())
            .args(["-y", "-i", &video_path_clone, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", temp_wav_str])
            .output()
            .map_err(|e| format!("FFmpeg execution failed: {}", e))?;

        if !ffmpeg_output.status.success() {
            let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
            let _ = std::fs::remove_file(&temp_wav_path);
            return Err(format!("FFmpeg failed to extract audio: {}", stderr));
        }

        // --- Step 2: Transcribe with Whisper ---
        let whisper_sidecar = app_handle_clone.shell().sidecar("whisper").map_err(|e| e.to_string())?;
        let whisper_output = std::process::Command::new(whisper_sidecar.path())
            .args(["-m", model_path_str, "-f", temp_wav_str, "-ovtt", "-nt"]) // -nt for no timestamps in console
            .output()
            .map_err(|e| format!("Whisper execution failed: {}", e))?;

        let whisper_vtt_output_path = env::temp_dir().join(format!("{}.vtt", temp_wav_filename));
        let _ = std::fs::remove_file(&temp_wav_path);

        if !whisper_output.status.success() {
            let stderr = String::from_utf8_lossy(&whisper_output.stderr);
            let _ = std::fs::remove_file(&whisper_vtt_output_path);
            return Err(format!("Whisper transcription failed: {}", stderr));
        }

        std::fs::rename(&whisper_vtt_output_path, &final_vtt_path).map_err(|e| format!("Failed to move VTT file: {}", e))?;

        Ok(final_vtt_str)
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
}

#[tauri::command]
async fn resolve_subtitles(app_handle: tauri::AppHandle, video_path: String) -> Result<Option<String>, String> {
    use std::path::Path;

    let v_path = Path::new(&video_path);
    let base_dir = v_path.parent().unwrap_or(Path::new(""));
    let base_name = v_path.file_stem().unwrap_or_default().to_str().unwrap_or("video");
    
    let vtt_path = base_dir.join(format!("{}.vtt", base_name));
    let srt_path = base_dir.join(format!("{}.srt", base_name));

    // 1. Check if .vtt exists
    if vtt_path.exists() {
        return Ok(Some(vtt_path.to_string_lossy().into_owned()));
    }

    // 2. Check if .srt exists and convert
    if srt_path.exists() {
        let srt_str = srt_path.to_string_lossy().into_owned();
        let vtt_str = vtt_path.to_string_lossy().into_owned();

        let sidecar = app_handle.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
        let output = sidecar.args(["-y", "-i", &srt_str, &vtt_str]).output().await.map_err(|e| e.to_string())?;

        if output.status.success() {
            return Ok(Some(vtt_str));
        }
    }

    // 3. Extract embedded soft-subtitles
    let vtt_str = vtt_path.to_string_lossy().into_owned();
    let sidecar = app_handle.shell().sidecar("ffmpeg").map_err(|e| e.to_string())?;
    let output = sidecar.args(["-y", "-i", &video_path, "-map", "0:s:0", &vtt_str]).output().await.map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(Some(vtt_str))
    } else {
        let _ = std::fs::remove_file(&vtt_path);
        Ok(None)
    }
}

// ---------------------------------------------------------------------------
// Bundle commands — save / load .tmvz project packages
// ---------------------------------------------------------------------------

/// Payload emitted to JS on the "package-progress" event.
#[derive(Clone, serde::Serialize)]
struct PackageProgressPayload {
    step: String,
    percent: u32,
    message: String,
    current: u32,
    total: u32,
}

/// Save the current project state and all referenced video files into a single
/// .tmvz archive (ZIP under the hood).
///
/// Heavy zip/IO work is offloaded to Tokio's blocking thread pool so the Tauri
/// executor is never stalled. Progress events are emitted on "package-progress".
///
/// * `project_json` — the full serialised project state
/// * `video_paths`  — absolute paths to every video file to bundle
/// * `output_path`  — destination path for the .tmvz archive
#[tauri::command]
async fn save_tspz_bundle(
    app_handle: tauri::AppHandle,
    project_json: String,
    video_paths: Vec<String>,
    output_path: String,
) -> Result<(), String> {
    let app = app_handle.clone();

    let emit = move |step: &str, percent: u32, message: &str, current: u32, total: u32| {
        let _ = app.emit("package-progress", PackageProgressPayload {
            step: step.to_string(),
            percent,
            message: message.to_string(),
            current,
            total,
        });
    };

    emit("start", 0, "Creating archive…", 0, 0);

    let app2 = app_handle.clone();
    let total = video_paths.len() as u32;

    tokio::task::spawn_blocking(move || {
        use std::fs::File;
        use std::io::Write;
        use zip::write::SimpleFileOptions;

        let emit_b = |step: &str, percent: u32, message: &str, current: u32, total: u32| {
            let _ = app2.emit("package-progress", PackageProgressPayload {
                step: step.to_string(),
                percent,
                message: message.to_string(),
                current,
                total,
            });
        };

        let dest = File::create(&output_path)
            .map_err(|e| format!("Cannot create archive: {e}"))?;
        let mut zip = zip::ZipWriter::new(dest);
        let opts = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);

        // --- project JSON ---
        emit_b("project", 5, "Writing project data…", 0, total);
        zip.start_file("project.tmv", opts)
            .map_err(|e| format!("Cannot start project.tmv: {e}"))?;
        zip.write_all(project_json.as_bytes())
            .map_err(|e| format!("Cannot write project JSON: {e}"))?;

        // --- video files ---
        for (i, path_str) in video_paths.iter().enumerate() {
            let current = (i + 1) as u32;
            let src_path = std::path::Path::new(path_str);
            let entry_name = src_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("video.mp4")
                .to_string();

            // Scale progress: videos occupy 10%–95% of the bar
            let pct = 10 + ((i as f64 / total.max(1) as f64) * 85.0) as u32;
            emit_b(
                "video",
                pct,
                &format!("Packing {} ({}/{})", entry_name, current, total),
                current,
                total,
            );

            let mut src_file = File::open(src_path)
                .map_err(|e| format!("Cannot open '{}': {e}", path_str))?;
            zip.start_file(&entry_name, opts)
                .map_err(|e| format!("Cannot start entry '{}': {e}", entry_name))?;
            std::io::copy(&mut src_file, &mut zip)
                .map_err(|e| format!("Cannot copy '{}' into archive: {e}", entry_name))?;
        }

        emit_b("finalising", 97, "Finalising archive…", total, total);
        zip.finish()
            .map_err(|e| format!("Cannot finalise archive: {e}"))?;
        emit_b("done", 100, "Package complete!", total, total);

        Ok::<(), String>(())
    })
    .await
    .map_err(|e| format!("Blocking task panicked: {e}"))??;

    Ok(())
}

/// Result returned to the JavaScript caller after extracting a bundle.
#[derive(serde::Serialize)]
pub struct LoadBundleResult {
    pub project_json: String,
    pub video_paths: Vec<String>,
}

/// Open a .tmvz archive, extract its contents to the OS temp directory, and
/// return the project JSON plus absolute paths of any extracted video files.
///
/// Extraction is offloaded to Tokio's blocking thread pool. Progress events
/// are emitted on "package-progress".
#[tauri::command]
async fn load_tspz_bundle(
    app_handle: tauri::AppHandle,
    bundle_path: String,
) -> Result<LoadBundleResult, String> {
    let app = app_handle.clone();

    tokio::task::spawn_blocking(move || {
        use std::fs::File;
        use std::io::Read;

        let emit = |step: &str, percent: u32, message: &str, current: u32, total: u32| {
            let _ = app.emit("package-progress", PackageProgressPayload {
                step: step.to_string(),
                percent,
                message: message.to_string(),
                current,
                total,
            });
        };

        emit("start", 0, "Opening archive…", 0, 0);

        let file = File::open(&bundle_path)
            .map_err(|e| format!("Cannot open bundle '{}': {e}", bundle_path))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Cannot read ZIP: {e}"))?;

        let total = archive.len() as u32;

        // Unique extraction directory
        let extract_dir = std::env::temp_dir().join(format!(
            "tmvideo_bundle_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&extract_dir)
            .map_err(|e| format!("Cannot create temp dir: {e}"))?;

        let mut project_json = String::new();
        let mut video_paths: Vec<String> = Vec::new();

        const VIDEO_EXTS: &[&str] =
            &["mp4", "mkv", "avi", "mov", "webm", "mpg", "mpeg", "m4v", "flv"];

        for i in 0..archive.len() {
            let mut entry = archive
                .by_index(i)
                .map_err(|e| format!("Cannot read entry {i}: {e}"))?;

            let name = entry.name().to_string();
            let out_path = extract_dir.join(&name);
            let current = (i + 1) as u32;
            let pct = ((i as f64 / total.max(1) as f64) * 95.0) as u32;

            emit(
                "extract",
                pct,
                &format!("Extracting {} ({}/{})", name, current, total),
                current,
                total,
            );

            if entry.is_dir() {
                std::fs::create_dir_all(&out_path)
                    .map_err(|e| format!("Cannot create dir '{name}': {e}"))?;
                continue;
            }

            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Cannot read entry '{name}': {e}"))?;

            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Cannot create parent dir: {e}"))?;
            }
            std::fs::write(&out_path, &buf)
                .map_err(|e| format!("Cannot write '{name}': {e}"))?;

            let lower = name.to_lowercase();
            if lower == "project.tmv" {
                project_json = String::from_utf8(buf)
                    .map_err(|e| format!("project.tmv is not valid UTF-8: {e}"))?;
            } else {
                let ext = std::path::Path::new(&lower)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                if VIDEO_EXTS.contains(&ext) {
                    video_paths.push(
                        out_path
                            .to_str()
                            .map(|s| s.to_string())
                            .ok_or_else(|| format!("Non-UTF-8 path for '{name}'"))?,
                    );
                }
            }
        }

        if project_json.is_empty() {
            return Err("Archive does not contain a project.tmv file.".to_string());
        }

        emit("done", 100, "Extraction complete!", total, total);

        Ok::<LoadBundleResult, String>(LoadBundleResult {
            project_json,
            video_paths,
        })
    })
    .await
    .map_err(|e| format!("Blocking task panicked: {e}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(FfmpegState(Mutex::new(None)))
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
     // Add this line to register your new commands:
    .invoke_handler(tauri::generate_handler![
        get_startup_file, 
        get_launch_argument, 
        run_ffmpeg, abort_ffmpeg,
        save_tspz_bundle,
        load_tspz_bundle,
        resolve_subtitles
        ]) 
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
