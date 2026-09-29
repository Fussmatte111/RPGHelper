use std::path::Path;
use tauri::Manager;

const DEFAULT_CHARACTERS_JSON: &str = include_str!("../default-characters.json");
const DEFAULT_ITEMS_JSON: &str = include_str!("../default-items.json");

fn read_or_create_json(path: &Path, default_json: &str) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            serde_json::from_str::<serde_json::Value>(default_json)
                .map_err(|error| format!("Invalid default JSON: {error}"))?;
            std::fs::write(path, default_json).map_err(|error| error.to_string())?;
            Ok(default_json.to_string())
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
    read_or_create_json(&path, DEFAULT_CHARACTERS_JSON)
}

#[tauri::command]
fn load_items(app: tauri::AppHandle) -> Result<String, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    read_or_create_json(&directory.join("items.json"), DEFAULT_ITEMS_JSON)
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

#[tauri::command]
fn save_items(app: tauri::AppHandle, items_json: String) -> Result<(), String> {
    serde_json::from_str::<Vec<serde_json::Value>>(&items_json)
        .map_err(|error| format!("Invalid items JSON: {error}"))?;

    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    std::fs::write(directory.join("items.json"), items_json)
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_characters,
            save_characters,
            load_items,
            save_items
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{read_or_create_json, DEFAULT_CHARACTERS_JSON, DEFAULT_ITEMS_JSON};
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

        let initial_characters =
            read_or_create_json(&path, DEFAULT_CHARACTERS_JSON).expect("initialize defaults");
        assert_eq!(initial_characters, DEFAULT_CHARACTERS_JSON);
        assert_eq!(
            std::fs::read_to_string(&path).expect("read created file"),
            DEFAULT_CHARACTERS_JSON
        );

        std::fs::write(&path, "[]").expect("write saved character list");
        assert_eq!(
            read_or_create_json(&path, DEFAULT_CHARACTERS_JSON).expect("read saved characters"),
            "[]"
        );

        std::fs::remove_dir_all(directory).expect("remove test directory");
    }

    #[test]
    fn default_items_are_valid_json_array() {
        let items: Vec<serde_json::Value> =
            serde_json::from_str(DEFAULT_ITEMS_JSON).expect("parse default items");
        assert!(!items.is_empty());
    }
}
