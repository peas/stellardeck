fn recent_files_path() -> std::path::PathBuf {
    // Cross-platform: ~/.config/stellardeck on macOS/Linux, AppData\Roaming\stellardeck on Windows
    dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("stellardeck")
        .join("recent.json")
}

#[tauri::command]
pub fn get_recent_files() -> Vec<String> {
    let path = recent_files_path();
    if !path.exists() {
        return vec![];
    }
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn add_recent_file(file_path: String) -> Result<(), String> {
    let config_path = recent_files_path();
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let mut files: Vec<String> = get_recent_files();
    files.retain(|f| f != &file_path);
    files.insert(0, file_path);
    files.truncate(10);
    std::fs::write(
        &config_path,
        serde_json::to_string_pretty(&files).unwrap(),
    )
    .map_err(|e| e.to_string())
}
