use std::path::Path;

pub fn serve_local_file(
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let uri = request.uri().to_string();
    let path_str = uri
        .strip_prefix("localfile://localhost")
        .or_else(|| uri.strip_prefix("https://localfile.localhost"))
        .unwrap_or("");
    let decoded = urlencoding::decode(path_str).unwrap_or_default();

    match std::fs::read(decoded.as_ref()) {
        Ok(content) => {
            let ext = Path::new(decoded.as_ref())
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            let mime = match ext {
                "webp" => "image/webp",
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "svg" => "image/svg+xml",
                "mp4" => "video/mp4",
                "webm" => "video/webm",
                _ => "application/octet-stream",
            };
            tauri::http::Response::builder()
                .status(200)
                .header("content-type", mime)
                .header("access-control-allow-origin", "*")
                .body(content)
                .unwrap()
        }
        Err(_) => tauri::http::Response::builder()
            .status(404)
            .body(Vec::new())
            .unwrap(),
    }
}
