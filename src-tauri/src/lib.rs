use std::path::Path;
use tauri::Manager;

const DEFAULT_CHARACTERS_JSON: &str = include_str!("../default-characters.json");
const DEFAULT_ITEMS_JSON: &str = include_str!("../default-items.json");
const DEFAULT_SPELLS_JSON: &str = include_str!("../default-spells.json");
const LEGACY_CHARACTERS_DE_JSON: &str = include_str!("../legacy-default-characters-de.json");
const LEGACY_ITEMS_DE_JSON: &str = include_str!("../legacy-default-items-de.json");
const LEGACY_SPELLS_DE_JSON: &str = include_str!("../legacy-default-spells-de.json");

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

fn value_identity(value: &serde_json::Value) -> Option<String> {
    value
        .get("id")
        .and_then(serde_json::Value::as_str)
        .map(|id| format!("id:{id}"))
        .or_else(|| {
            value
                .get("name")
                .and_then(serde_json::Value::as_str)
                .map(|name| format!("name:{name}"))
        })
        .or_else(|| {
            value
                .get("details")
                .and_then(|details| details.get("name"))
                .and_then(serde_json::Value::as_str)
                .map(|name| format!("character:{name}"))
        })
}

fn migrate_matching_defaults(
    current: &mut serde_json::Value,
    legacy: &serde_json::Value,
    defaults: &serde_json::Value,
) -> bool {
    if current == legacy {
        *current = defaults.clone();
        return true;
    }

    match (current, legacy, defaults) {
        (
            serde_json::Value::Object(current),
            serde_json::Value::Object(legacy),
            serde_json::Value::Object(defaults),
        ) => {
            let mut changed = false;
            for (key, legacy_value) in legacy {
                if let (Some(current_value), Some(default_value)) =
                    (current.get_mut(key), defaults.get(key))
                {
                    changed |=
                        migrate_matching_defaults(current_value, legacy_value, default_value);
                }
            }
            changed
        }
        (
            serde_json::Value::Array(current),
            serde_json::Value::Array(legacy),
            serde_json::Value::Array(defaults),
        ) => {
            let mut changed = false;
            for (index, current_value) in current.iter_mut().enumerate() {
                let legacy_index = value_identity(current_value)
                    .and_then(|identity| {
                        legacy
                            .iter()
                            .position(|value| value_identity(value).as_ref() == Some(&identity))
                    })
                    .or_else(|| {
                        (value_identity(current_value).is_none() && index < legacy.len())
                            .then_some(index)
                    });
                let Some(legacy_index) = legacy_index else {
                    continue;
                };
                let Some(default_value) = defaults.get(legacy_index) else {
                    continue;
                };
                changed |=
                    migrate_matching_defaults(current_value, &legacy[legacy_index], default_value);
            }
            changed
        }
        _ => false,
    }
}

fn migrate_embedded_defaults(
    current: &mut serde_json::Value,
    legacy: &[serde_json::Value],
    defaults: &[serde_json::Value],
) -> bool {
    let mut changed = false;
    if let Some(identity) = value_identity(current) {
        if let Some(index) = legacy
            .iter()
            .position(|value| value_identity(value).as_ref() == Some(&identity))
        {
            if let Some(default) = defaults.get(index) {
                changed |= migrate_matching_defaults(current, &legacy[index], default);
            }
        }
    }

    match current {
        serde_json::Value::Object(fields) => {
            for value in fields.values_mut() {
                changed |= migrate_embedded_defaults(value, legacy, defaults);
            }
        }
        serde_json::Value::Array(values) => {
            for value in values {
                changed |= migrate_embedded_defaults(value, legacy, defaults);
            }
        }
        _ => {}
    }
    changed
}

fn migrate_embedded_json(path: &Path, legacy_json: &str, default_json: &str) -> Result<String, String> {
    let contents = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut current: serde_json::Value =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;
    let legacy: Vec<serde_json::Value> =
        serde_json::from_str(legacy_json).map_err(|error| error.to_string())?;
    let defaults: Vec<serde_json::Value> =
        serde_json::from_str(default_json).map_err(|error| error.to_string())?;
    if migrate_embedded_defaults(&mut current, &legacy, &defaults) {
        let migrated = serde_json::to_string_pretty(&current).map_err(|error| error.to_string())?;
        std::fs::write(path, &migrated).map_err(|error| error.to_string())?;
        Ok(migrated)
    } else {
        Ok(contents)
    }
}

fn read_or_migrate_json(
    path: &Path,
    legacy_json: &str,
    default_json: &str,
) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => {
            let mut current: serde_json::Value =
                serde_json::from_str(&contents).map_err(|error| error.to_string())?;
            let legacy: serde_json::Value =
                serde_json::from_str(legacy_json).map_err(|error| error.to_string())?;
            let defaults: serde_json::Value =
                serde_json::from_str(default_json).map_err(|error| error.to_string())?;
            if migrate_matching_defaults(&mut current, &legacy, &defaults) {
                let migrated =
                    serde_json::to_string_pretty(&current).map_err(|error| error.to_string())?;
                std::fs::write(path, &migrated).map_err(|error| error.to_string())?;
                Ok(migrated)
            } else {
                Ok(contents)
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            read_or_create_json(path, default_json)
        }
        Err(error) => Err(error.to_string()),
    }
}

fn app_data_file(app: &tauri::AppHandle, filename: &str) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join(filename))
}

#[tauri::command]
fn load_characters(app: tauri::AppHandle) -> Result<String, String> {
    let path = app_data_file(&app, "characters.json")?;
    let _ = read_or_migrate_json(&path, LEGACY_CHARACTERS_DE_JSON, DEFAULT_CHARACTERS_JSON)?;
    let _ = migrate_embedded_json(&path, LEGACY_ITEMS_DE_JSON, DEFAULT_ITEMS_JSON)?;
    migrate_embedded_json(&path, LEGACY_SPELLS_DE_JSON, DEFAULT_SPELLS_JSON)
}

#[tauri::command]
fn load_items(app: tauri::AppHandle) -> Result<String, String> {
    read_or_migrate_json(
        &app_data_file(&app, "items.json")?,
        LEGACY_ITEMS_DE_JSON,
        DEFAULT_ITEMS_JSON,
    )
}

#[tauri::command]
fn load_spells(app: tauri::AppHandle) -> Result<String, String> {
    read_or_migrate_json(
        &app_data_file(&app, "spells.json")?,
        LEGACY_SPELLS_DE_JSON,
        DEFAULT_SPELLS_JSON,
    )
}

#[tauri::command]
fn save_characters(app: tauri::AppHandle, characters_json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&characters_json)
        .map_err(|error| format!("Invalid characters JSON: {error}"))?;
    std::fs::write(app_data_file(&app, "characters.json")?, characters_json)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_items(app: tauri::AppHandle, items_json: String) -> Result<(), String> {
    serde_json::from_str::<Vec<serde_json::Value>>(&items_json)
        .map_err(|error| format!("Invalid items JSON: {error}"))?;
    std::fs::write(app_data_file(&app, "items.json")?, items_json).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_spells(app: tauri::AppHandle, spells_json: String) -> Result<(), String> {
    serde_json::from_str::<Vec<serde_json::Value>>(&spells_json)
        .map_err(|error| format!("Invalid spells JSON: {error}"))?;
    std::fs::write(app_data_file(&app, "spells.json")?, spells_json).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_characters,
            save_characters,
            load_items,
            save_items,
            load_spells,
            save_spells
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{
        migrate_embedded_defaults, migrate_matching_defaults, read_or_create_json,
        DEFAULT_CHARACTERS_JSON, DEFAULT_ITEMS_JSON, DEFAULT_SPELLS_JSON,
        LEGACY_CHARACTERS_DE_JSON, LEGACY_ITEMS_DE_JSON, LEGACY_SPELLS_DE_JSON,
    };
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

    #[test]
    fn default_spells_are_valid_json_array() {
        let spells: Vec<serde_json::Value> =
            serde_json::from_str(DEFAULT_SPELLS_JSON).expect("parse default spells");
        assert!(!spells.is_empty());
    }

    #[test]
    fn migrates_only_unchanged_builtin_text_and_preserves_custom_data() {
        let mut current: serde_json::Value =
            serde_json::from_str(LEGACY_ITEMS_DE_JSON).expect("parse legacy items");
        let legacy = current.clone();
        let defaults: serde_json::Value =
            serde_json::from_str(DEFAULT_ITEMS_JSON).expect("parse default items");

        current[0]["description"] = serde_json::Value::String("My custom weapon text".into());
        current
            .as_array_mut()
            .expect("items array")
            .push(serde_json::json!({
                "id": "homebrew-1",
                "name": "Mein Homebrew",
                "description": "Bleibt unverändert"
            }));

        assert!(migrate_matching_defaults(&mut current, &legacy, &defaults));
        assert_eq!(current[0]["name"], "Longsword");
        assert_eq!(current[0]["itemType"], "Weapon");
        assert_eq!(current[0]["description"], "My custom weapon text");
        assert_eq!(current[4]["name"], "Mein Homebrew");
        assert_eq!(current[4]["description"], "Bleibt unverändert");
    }

    #[test]
    fn migrates_spell_and_character_seeds_without_resetting_progress() {
        let mut spells: serde_json::Value =
            serde_json::from_str(LEGACY_SPELLS_DE_JSON).expect("parse legacy spells");
        let legacy_spells = spells.clone();
        let default_spells: serde_json::Value =
            serde_json::from_str(DEFAULT_SPELLS_JSON).expect("parse default spells");
        assert!(migrate_matching_defaults(
            &mut spells,
            &legacy_spells,
            &default_spells
        ));
        assert_eq!(spells[0]["name"], "Arcane Spark");
        assert_eq!(spells[0]["classes"], "Wizard, Warlock");

        let mut characters: serde_json::Value =
            serde_json::from_str(LEGACY_CHARACTERS_DE_JSON).expect("parse legacy characters");
        let legacy_characters = characters.clone();
        let default_characters: serde_json::Value =
            serde_json::from_str(DEFAULT_CHARACTERS_JSON).expect("parse default characters");
        characters[0]["details"]["level"] = serde_json::json!(4);
        assert!(migrate_matching_defaults(
            &mut characters,
            &legacy_characters,
            &default_characters
        ));
        assert_eq!(characters[0]["details"]["level"], 4);
        assert_eq!(characters[0]["inventory"]["items"][0]["name"], "Spellbook");
        assert_eq!(characters[0]["spells"]["known"][0]["name"], "Magic Missile");
    }

    #[test]
    fn migrates_builtin_catalog_items_inside_existing_character_inventories() {
        let legacy_items: Vec<serde_json::Value> =
            serde_json::from_str(LEGACY_ITEMS_DE_JSON).expect("parse legacy items");
        let default_items: Vec<serde_json::Value> =
            serde_json::from_str(DEFAULT_ITEMS_JSON).expect("parse default items");
        let mut character = serde_json::json!({
            "inventory": {
                "items": [
                    {"id":"longsword","name":"Langschwert","itemType":"Waffe","description":"Eine vielseitige Klingenwaffe mit gerader, zweischneidiger Klinge.","quantity":2,"weight":3},
                    {"id":"homebrew-1","name":"Eigenes Item","description":"Eigene Beschreibung"}
                ]
            }
        });

        assert!(migrate_embedded_defaults(
            &mut character,
            &legacy_items,
            &default_items
        ));
        assert_eq!(character["inventory"]["items"][0]["name"], "Longsword");
        assert_eq!(character["inventory"]["items"][0]["quantity"], 2);
        assert_eq!(character["inventory"]["items"][1]["name"], "Eigenes Item");
    }
}
