use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn open_presenter_window(app: tauri::AppHandle) -> Result<(), String> {
    // If already open, just focus it
    if let Some(win) = app.get_webview_window("presenter") {
        win.set_focus().map_err(|e| e.to_string())?;
        log::info!("presenter window focused");
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "presenter",
        tauri::WebviewUrl::App("presenter.html".into()),
    )
    .title("StellarDeck Presenter")
    .inner_size(1100.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;
    log::info!("presenter window created");
    Ok(())
}

#[tauri::command]
pub fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fs = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fs).map_err(|e| e.to_string())?;
    log::info!("fullscreen: {}", !is_fs);
    Ok(())
}

#[tauri::command]
pub async fn open_file_dialog(
    app: tauri::AppHandle,
    current_dir: Option<String>,
) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app.dialog().file().add_filter("Markdown", &["md"]);
    if let Some(dir) = current_dir {
        builder = builder.set_directory(dir);
    }
    builder.pick_file(move |path| {
        let _ = tx.send(path.map(|f| f.to_string()));
    });
    rx.await.unwrap_or(None)
}
