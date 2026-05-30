
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
        .find(|arg| arg.to_lowercase().ends_with(".tsp"))
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
    .invoke_handler(tauri::generate_handler![get_startup_file, run_ffmpeg, abort_ffmpeg]) 
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
