mod commands;
mod error;
mod project;
mod protocol;

use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::Manager;

fn build_menu(app: &tauri::App) -> Result<Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    // Populate Open Recent from recent.json
    let mut recent_submenu = SubmenuBuilder::new(app, "Open Recent");
    let recent_files = commands::recent::get_recent_files();
    if recent_files.is_empty() {
        recent_submenu = recent_submenu.item(
            &MenuItemBuilder::with_id("no-recent", "No Recent Files").enabled(false).build(app)?
        );
    } else {
        for path in &recent_files {
            let label = path.split('/').last().unwrap_or(path);
            let id = format!("recent:{}", path);
            recent_submenu = recent_submenu.item(
                &MenuItemBuilder::with_id(id, label).build(app)?
            );
        }
    }

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("open", "Open...").accelerator("CmdOrCtrl+O").build(app)?)
        .item(&recent_submenu.build()?)
        .separator()
        .item(&MenuItemBuilder::with_id("close-tab", "Close Tab").accelerator("CmdOrCtrl+W").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("export-pdf", "Export PDF...").accelerator("CmdOrCtrl+Shift+E").build(app)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("grid", "Grid Overview").accelerator("CmdOrCtrl+G").build(app)?)
        .item(&MenuItemBuilder::with_id("presenter", "Presenter Mode").accelerator("CmdOrCtrl+P").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("fullscreen", "Fullscreen").accelerator("F").build(app)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .close_window()
        .separator()
        .fullscreen()
        .build()?;

    // macOS: first submenu is always the app menu
    let app_menu = SubmenuBuilder::new(app, "StellarDeck")
        .about(None)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let menu = Menu::with_items(app, &[
        &app_menu,
        &file_menu,
        &edit_menu,
        &view_menu,
        &window_menu,
    ])?;
    Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .register_uri_scheme_protocol("localfile", |_ctx, request| {
            protocol::serve_local_file(request)
        });

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Build and set native menu
            let menu = build_menu(app).expect("failed to build menu");
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let window = app.get_webview_window("main").unwrap();
            match event.id().as_ref() {
                "open" => {
                    let _ = window.eval("document.getElementById('btn-grid')?.classList.remove('active'); if (window._openFileDialog) window._openFileDialog(); else document.getElementById('welcome-open')?.click();");
                }
                "close-tab" => {
                    let _ = window.eval("if (window.closeCurrentTab) window.closeCurrentTab();");
                }
                "export-pdf" => {
                    let _ = window.eval("document.getElementById('btn-export')?.click();");
                }
                "grid" => {
                    let _ = window.eval("document.getElementById('btn-grid')?.dispatchEvent(new MouseEvent('click', {bubbles:true}));");
                }
                "presenter" => {
                    let _ = window.eval("if (window._openPresenter) window._openPresenter();");
                }
                "fullscreen" => {
                    let _ = window.eval("document.getElementById('btn-play')?.click();");
                }
                id if id.starts_with("recent:") => {
                    let path = &id["recent:".len()..];
                    let js = format!(
                        "if (window._loadFileFromMenu) window._loadFileFromMenu('{}');",
                        path.replace('\'', "\\'")
                    );
                    let _ = window.eval(&js);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::files::read_markdown,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::get_project_root,
            commands::files::open_in_editor,
            commands::files::reveal_in_finder,
            commands::recent::get_recent_files,
            commands::recent::add_recent_file,
            commands::window::toggle_fullscreen,
            commands::window::open_file_dialog,
            commands::window::open_presenter_window,
            commands::export::export_pdf,
            commands::watcher::watch_file,
            commands::watcher::unwatch_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
