use crate::error::AppError;
use crate::project;

#[tauri::command]
pub fn read_markdown(path: String) -> Result<String, String> {
    log::info!("read_markdown: {}", path);
    std::fs::read_to_string(&path).map_err(|e| {
        AppError::IoError(format!("{}: {}", path, e)).to_string()
    })
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    log::info!("write_file: {}", path);
    std::fs::write(&path, &content).map_err(|e| {
        AppError::IoError(format!("{}: {}", path, e)).to_string()
    })
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| {
        AppError::IoError(format!("{}: {}", path, e)).to_string()
    })
}

#[tauri::command]
pub fn get_project_root() -> Result<String, String> {
    let root = project::find_project_root().map_err(|e| e.to_string())?;
    let root_str = root.to_string_lossy().to_string();
    log::info!("project root: {}", root_str);
    Ok(root_str)
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to reveal: {}", e)).to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to reveal: {}", e)).to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        // xdg-open opens the parent directory
        let parent = std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/"));
        std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to reveal: {}", e)).to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_editor(path: String) -> Result<(), String> {
    log::info!("open_in_editor: {}", path);
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open editor: {}", e)).to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open editor: {}", e)).to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open editor: {}", e)).to_string())?;
    }
    Ok(())
}
