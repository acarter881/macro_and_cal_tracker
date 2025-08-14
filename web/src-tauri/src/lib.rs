use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{async_runtime::spawn, Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

struct BackendProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.manage(BackendProcess(Mutex::new(None)));
            let handle = app.handle().clone();

            spawn(async move {
                let script = handle
                    .path()
                    .resolve("server/main.py", tauri::path::BaseDirectory::Resource)
                    .unwrap_or_else(|_| "../server/main.py".into());

                let python_cmd = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python".into());

                if which::which(&python_cmd).is_ok() {
                    match Command::new(python_cmd).arg(script).spawn() {
                        Ok(child) => {
                            handle
                                .state::<BackendProcess>()
                                .0
                                .lock()
                                .unwrap()
                                .replace(child);
                        }
                        Err(err) => {
                            handle
                                .dialog()
                                .message(err.to_string())
                                .title("Failed to start Python")
                                .kind(MessageDialogKind::Error)
                                .show(|_| {});
                        }
                    }
                } else {
                    handle
                        .dialog()
                        .message("Install Python or set the PYTHON_PATH environment variable.")
                        .title("Python not found")
                        .kind(MessageDialogKind::Error)
                        .show(|_| {});
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app.state::<BackendProcess>().0.lock().unwrap().as_mut() {
                    let _ = child.kill();
                }
            }
        });
}
