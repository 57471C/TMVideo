
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

#[tauri::command]
async fn join_and_compress_videos(
    app_handle: tauri::AppHandle,
    video_paths: Vec<String>,
    output_file_name: String,
) -> Result<String, String> {
    let app_handle_clone = app_handle.clone();
    let video_paths_clone = video_paths.clone();
    let output_file_name_clone = output_file_name.clone();

    tokio::task::spawn_blocking(move || {
        use std::env;
        use std::io::Write;
        use std::path::Path;
        use std::time::{SystemTime, UNIX_EPOCH};

        if video_paths_clone.is_empty() {
            return Err("No video paths provided.".to_string());
        }

        // Step 1: Resolve Absolute Paths
        let first_video_path = Path::new(&video_paths_clone[0]);
        let base_dir = first_video_path
            .parent()
            .ok_or_else(|| "Failed to get parent directory".to_string())?;

        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis();
        let temp_dir = env::temp_dir();
        let list_path = temp_dir.join(format!("concat_list_{}.txt", unique_id));
        let intermediate_path = temp_dir.join(format!("intermediate_{}.mp4", unique_id));
        let temp_final_path = temp_dir.join(format!("temp_final_{}.mp4", unique_id));
        let final_path = base_dir.join(&output_file_name_clone);

        let list_path_str = list_path.to_str().ok_or("Invalid list path")?;
        let intermediate_path_str = intermediate_path.to_str().ok_or("Invalid intermediate path")?;
        let temp_final_path_str = temp_final_path.to_str().ok_or("Invalid temp final path")?;
        let final_path_str = final_path.to_str().ok_or("Invalid final path")?;

        // Step 2: Pre-Flight Extension Match
        let mut all_same_extension = true;
        let first_ext = first_video_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        for path in &video_paths_clone {
            let ext = Path::new(path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext != first_ext {
                all_same_extension = false;
                break;
            }
        }

        let mut list_file = std::fs::File::create(&list_path).map_err(|e| e.to_string())?;
        for path in &video_paths_clone {
            let safe_path = path.replace("\\", "/");
            writeln!(list_file, "file '{}'", safe_path).map_err(|e| e.to_string())?;
        }
        list_file.sync_all().map_err(|e| e.to_string())?;

        let mut lossless_success = false;

        if all_same_extension {
            let ffmpeg_sidecar = app_handle_clone
                .shell()
                .sidecar("ffmpeg")
                .map_err(|e| e.to_string())?
                .args([
                    "-y", "-f", "concat", "-safe", "0", "-i", list_path_str, "-c", "copy",
                    intermediate_path_str,
                ]);

            let output = tauri::async_runtime::block_on(ffmpeg_sidecar.output())
                .map_err(|e| e.to_string())?;
            if output.status.success() {
                lossless_success = true;
            }
        }

        // Step 3: Fallback Mixed Media Mode
        if !lossless_success {
            let mut args = vec!["-y".to_string()];
            let mut filter_complex = String::new();
            let n = video_paths_clone.len();

            for (i, path) in video_paths_clone.iter().enumerate() {
                args.push("-i".to_string());
                args.push(path.to_string());
                filter_complex.push_str(&format!("[{}:v][{}:a]", i, i));
            }
            filter_complex.push_str(&format!("concat=n={}:v=1:a=1[v][a]", n));

            args.push("-filter_complex".to_string());
            args.push(filter_complex);
            args.push("-map".to_string());
            args.push("[v]".to_string());
            args.push("-map".to_string());
            args.push("[a]".to_string());
            args.push(intermediate_path_str.to_string());

            let ffmpeg_sidecar = app_handle_clone
                .shell()
                .sidecar("ffmpeg")
                .map_err(|e| e.to_string())?
                .args(args);
            let output = tauri::async_runtime::block_on(ffmpeg_sidecar.output())
                .map_err(|e| e.to_string())?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let _ = std::fs::remove_file(&list_path);
                let _ = std::fs::remove_file(&intermediate_path);
                return Err(format!("Filtergraph fallback failed: {}", stderr));
            }
        }

        // Step 4: Final Compression Step
        let compression_args = vec![
            "-y", "-i", intermediate_path_str, "-c:v", "libx264", "-crf", "23", "-preset",
            "medium", "-c:a", "aac", "-b:a", "128k", temp_final_path_str,
        ];

        let ffmpeg_sidecar = app_handle_clone
            .shell()
            .sidecar("ffmpeg")
            .map_err(|e| e.to_string())?
            .args(compression_args);

        let output = tauri::async_runtime::block_on(ffmpeg_sidecar.output())
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let _ = std::fs::remove_file(&list_path);
            let _ = std::fs::remove_file(&intermediate_path);
            let _ = std::fs::remove_file(&temp_final_path);
            return Err(format!("Final compression failed: {}", stderr));
        }

        // Step 5: Cleanup and Return (with Cross-Drive LINK Support)
        std::fs::copy(&temp_final_path, &final_path)
            .map_err(|e| format!("Failed to copy file across drives: {}", e))?;

        let concat_list_str = list_path.to_string_lossy().to_string();
        let concat_list_path = Path::new(&concat_list_str);
        if concat_list_path.exists() {
            if let Err(e) = std::fs::remove_file(concat_list_path) {
                println!("Non-fatal warning: failed to delete temp list: {}", e);
            }
        }

        if intermediate_path.exists() {
            let _ = std::fs::remove_file(&intermediate_path);
        }
        if temp_final_path.exists() {
            let _ = std::fs::remove_file(&temp_final_path);
        }

        Ok(final_path_str.to_string())
    })
    .await
    .map_err(|e| format!("Task panicked: {}", e))?
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
        resolve_subtitles,
        join_and_compress_videos
        ]) 
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
