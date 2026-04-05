use std::path::PathBuf;

use crate::error::AppError;

/// Walk up from cwd until we find `viewer.html` (project root marker).
pub fn find_project_root() -> Result<PathBuf, AppError> {
    let mut dir = std::env::current_dir()?;
    for _ in 0..5 {
        if dir.join("viewer.html").exists() {
            return Ok(dir);
        }
        dir = dir
            .parent()
            .ok_or(AppError::ProjectRootNotFound)?
            .to_path_buf();
    }
    Err(AppError::ProjectRootNotFound)
}
