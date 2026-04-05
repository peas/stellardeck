use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum AppError {
    FileNotFound(String),
    IoError(String),
    ProjectRootNotFound,
    ExportFailed(String),
    WatcherError(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FileNotFound(p) => write!(f, "File not found: {}", p),
            Self::IoError(e) => write!(f, "IO error: {}", e),
            Self::ProjectRootNotFound => write!(
                f,
                "Could not find project root (viewer.html not found in parent directories)"
            ),
            Self::ExportFailed(e) => write!(f, "Export failed: {}", e),
            Self::WatcherError(e) => write!(f, "Watcher error: {}", e),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::IoError(e.to_string())
    }
}

impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}
