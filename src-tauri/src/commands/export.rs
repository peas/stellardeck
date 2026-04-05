use crate::error::AppError;
use crate::project;

fn find_chrome_path() -> String {
    #[cfg(target_os = "macos")]
    {
        let paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() { return p.to_string(); }
        }
        paths[0].to_string()
    }
    #[cfg(target_os = "windows")]
    {
        let paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for p in &paths {
            if std::path::Path::new(p).exists() { return p.to_string(); }
        }
        paths[0].to_string()
    }
    #[cfg(target_os = "linux")]
    {
        let paths = ["google-chrome", "chromium-browser", "chromium"];
        for p in &paths {
            if std::process::Command::new("which").arg(p).output().map(|o| o.status.success()).unwrap_or(false) {
                return p.to_string();
            }
        }
        paths[0].to_string()
    }
}

#[tauri::command]
pub async fn export_pdf(
    app: tauri::AppHandle,
    md_path: String,
    theme: Option<String>,
    scheme: Option<String>,
) -> Result<String, String> {
    let md = std::path::Path::new(&md_path);
    if !md.exists() {
        return Err(AppError::FileNotFound(md_path).to_string());
    }

    let pdf_path = md.with_extension("pdf").to_string_lossy().to_string();
    let project_root = project::find_project_root().map_err(|e| e.to_string())?;

    // Relative path for the viewer URL
    let relative = md
        .strip_prefix(&project_root)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| md_path.clone());

    let mut viewer_url = format!(
        "http://127.0.0.1:3031/viewer.html?file={}&print",
        relative
    );
    if let Some(t) = &theme {
        viewer_url.push_str(&format!("&theme={}", t));
    }
    if let Some(s) = &scheme {
        viewer_url.push_str(&format!("&scheme={}", s));
    }
    log::info!("export_pdf: {} → {}", viewer_url, pdf_path);

    // Ensure npx is found — add platform-specific paths
    let path_env = std::env::var("PATH").unwrap_or_default();
    let full_path = if cfg!(target_os = "macos") {
        format!("/opt/homebrew/bin:/usr/local/bin:{}", path_env)
    } else if cfg!(target_os = "windows") {
        format!("C:\\Program Files\\nodejs;{}", path_env)
    } else {
        path_env.clone()
    };

    // Chrome path per platform
    let chrome_path = find_chrome_path();
    log::info!("exporting via decktape...");
    let mut child = std::process::Command::new("npx")
        .args([
            "decktape",
            "reveal",
            "--size",
            "1707x960",
            "--pause",
            "300",
            "--load-pause",
            "2000",
            "--chrome-path",
            &chrome_path,
            &viewer_url,
            &pdf_path,
        ])
        .env("PATH", &full_path)
        .current_dir(&project_root)
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| AppError::ExportFailed(format!("Failed to run decktape: {}", e)).to_string())?;

    // Read stdout and split on \r or \n (decktape uses \r for in-place progress on stdout)
    if let Some(stdout) = child.stdout.take() {
        use std::io::Read;
        use tauri::Emitter;
        let mut buf = Vec::new();
        let mut byte = [0u8; 1];
        let mut reader = std::io::BufReader::new(stdout);
        loop {
            match reader.read(&mut byte) {
                Ok(0) => break, // EOF
                Ok(_) => {
                    if byte[0] == b'\r' || byte[0] == b'\n' {
                        if !buf.is_empty() {
                            let line = String::from_utf8_lossy(&buf).to_string();
                            buf.clear();
                            // Emit preparation phases as "prep:N/4"
                            if line.starts_with("Loading page ")
                                && !line.contains("finished")
                            {
                                let _ =
                                    app.emit("pdf-progress", "prep:1/4".to_string());
                            } else if line.contains("finished with status") {
                                let _ =
                                    app.emit("pdf-progress", "prep:2/4".to_string());
                            } else if line.contains("plugin activated") {
                                let _ =
                                    app.emit("pdf-progress", "prep:3/4".to_string());
                            } else if line.starts_with("Printing slide") {
                                let _ =
                                    app.emit("pdf-progress", "prep:4/4".to_string());
                            }
                            // Parse "Printing slide #/N      (M/total) ..."
                            if let Some(paren_start) = line.find('(') {
                                if let Some(paren_end) = line.find(')') {
                                    let inside = &line[paren_start + 1..paren_end];
                                    if let Some(slash) = inside.find('/') {
                                        let current = inside[..slash].trim();
                                        let total = inside[slash + 1..].trim();
                                        log::info!("slide {}/{}", current, total);
                                        let _ = app.emit(
                                            "pdf-progress",
                                            format!("{}/{}", current, total),
                                        );
                                    }
                                }
                            }
                        }
                    } else {
                        buf.push(byte[0]);
                    }
                }
                Err(_) => break,
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| AppError::ExportFailed(format!("Process failed: {}", e)).to_string())?;
    if !status.success() {
        return Err(AppError::ExportFailed("PDF export failed".to_string()).to_string());
    }

    log::info!("PDF exported: {}", pdf_path);
    Ok(pdf_path)
}
