use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{async_runtime::spawn, Manager, RunEvent};

struct BackendProcess(Mutex<Option<Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app
          .handle()
          .plugin(
            tauri_plugin_log::Builder::default()
              .level(log::LevelFilter::Info)
              .build(),
          )?;
      }

      app.manage(BackendProcess(Mutex::new(None)));
      let handle = app.handle();

      spawn(async move {
        let script = handle
          .path_resolver()
          .resolve_resource("server/main.py")
          .unwrap_or_else(|| "../server/main.py".into());

        if let Ok(child) = Command::new("python").arg(script).spawn() {
          handle
            .state::<BackendProcess>()
            .0
            .lock()
            .unwrap()
            .replace(child);
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
