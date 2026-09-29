use std::path::Path;
use tauri::Manager;

const DEFAULT_CHARACTERS_JSON: &str = include_str!("../default-characters.json");

fn read_or_create_characters(path: &Path) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            serde_json::from_str::<serde_json::Value>(DEFAULT_CHARACTERS_JSON)
                .map_err(|error| format!("Invalid default characters JSON: {error}"))?;
            std::fs::write(path, DEFAULT_CHARACTERS_JSON).map_err(|error| error.to_string())?;
            Ok(DEFAULT_CHARACTERS_JSON.to_string())
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn load_characters(app: tauri::AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let path = directory.join("characters.json");
    read_or_create_characters(&path)
}

#[tauri::command]
fn save_characters(app: tauri::AppHandle, characters_json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&characters_json)
        .map_err(|error| format!("Invalid characters JSON: {error}"))?;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    std::fs::write(directory.join("characters.json"), characters_json)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_characters, save_characters])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{read_or_create_characters, DEFAULT_CHARACTERS_JSON};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn initializes_defaults_once_and_preserves_saved_characters() {
        let unique_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock is before Unix epoch")
            .as_nanos();
        let directory = std::env::temp_dir().join(format!(
            "dnd-tracker-default-characters-{}-{unique_id}",
            std::process::id()
        ));
        std::fs::create_dir_all(&directory).expect("create test directory");
        let path = directory.join("characters.json");

        let initial_characters = read_or_create_characters(&path).expect("initialize defaults");
        assert_eq!(initial_characters, DEFAULT_CHARACTERS_JSON);
        assert_eq!(
            std::fs::read_to_string(&path).expect("read created file"),
            DEFAULT_CHARACTERS_JSON
        );

        std::fs::write(&path, "[]").expect("write saved character list");
        assert_eq!(
            read_or_create_characters(&path).expect("read saved characters"),
            "[]"
        );

        std::fs::remove_dir_all(directory).expect("remove test directory");
    }
}
