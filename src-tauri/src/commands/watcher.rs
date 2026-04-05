use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};

use crate::error::AppError;

/// File watcher state — one watcher at a time.
pub static WATCHER: Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>> =
    Mutex::new(None);

#[tauri::command]
pub fn watch_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let watch_path = std::path::PathBuf::from(&path);
    if !watch_path.exists() {
        return Err(AppError::FileNotFound(path).to_string());
    }

    use tauri::Manager;
    let app_handle = app.clone();
    let debouncer = new_debouncer(
        Duration::from_millis(300),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, _>| {
            if let Ok(events) = res {
                for event in &events {
                    if event.kind == DebouncedEventKind::Any {
                        log::info!("file changed: {:?}", event.path);
                        // Directly trigger reload in the WebView
                        if let Some(wv) = app_handle.get_webview_window("main") {
                            let _ = wv.eval("smartReload()");
                        }
                    }
                }
            }
        },
    )
    .map_err(|e| AppError::WatcherError(e.to_string()).to_string())?;

    let mut guard = WATCHER.lock().map_err(|e| e.to_string())?;
    // Stop previous watcher
    *guard = None;
    // Start new watcher
    let mut debouncer = debouncer;
    debouncer
        .watcher()
        .watch(watch_path.as_path(), notify::RecursiveMode::NonRecursive)
        .map_err(|e| AppError::WatcherError(format!("Watch error: {}", e)).to_string())?;
    *guard = Some(debouncer);
    log::info!("watching: {}", path);
    Ok(())
}

#[tauri::command]
pub fn unwatch_file() -> Result<(), String> {
    let mut guard = WATCHER.lock().map_err(|e| e.to_string())?;
    *guard = None;
    log::info!("stopped watching");
    Ok(())
}
