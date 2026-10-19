use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{collections::HashSet, path::Path, sync::Mutex};

const FILE_LIMIT: usize = 10 * 1024 * 1024;
const TOTAL_LIMIT: usize = 50 * 1024 * 1024;
pub struct WorkspaceStore(pub Mutex<Connection>);

#[derive(Serialize, Deserialize)]
pub struct FileRecord {
    pub id: String,
    pub bytes: Vec<u8>,
}

impl WorkspaceStore {
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(error)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))
            .map_err(error)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
            CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL, revision INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, bytes BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS recovery (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);").map_err(error)?;
        Ok(Self(Mutex::new(conn)))
    }
}
fn error(e: impl std::fmt::Display) -> String {
    format!("Workspace storage: {e}")
}
fn text<'a>(item: &'a Value, key: &str, max: usize) -> Result<&'a str, String> {
    item[key]
        .as_str()
        .filter(|s| s.len() <= max)
        .ok_or_else(|| format!("Invalid {key}"))
}
fn id(item: &Value) -> Result<&str, String> {
    let value = text(item, "id", 128)?;
    if value.is_empty()
        || !value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err("Invalid record ID".into());
    }
    Ok(value)
}
fn array<'a>(v: &'a Value, key: &str) -> Result<&'a Vec<Value>, String> {
    v[key]
        .as_array()
        .filter(|a| a.len() <= 20_000)
        .ok_or_else(|| format!("Invalid {key} collection"))
}
fn tags(v: &Value) -> Result<(), String> {
    if let Some(values) = v.get("tags") {
        let values = values
            .as_array()
            .filter(|a| a.len() <= 64)
            .ok_or("Invalid tags")?;
        if values.iter().any(|s| {
            s.as_str()
                .is_none_or(|s| s.trim().is_empty() || s.len() > 240)
        }) {
            return Err("Invalid tag".into());
        }
    }
    Ok(())
}
fn reference(v: &Value, key: &str, ids: &HashSet<String>) -> Result<(), String> {
    if let Some(value) = v.get(key).filter(|v| !v.is_null()) {
        if !value.as_str().is_some_and(|s| ids.contains(s)) {
            return Err(format!("Unknown {key}"));
        }
    }
    Ok(())
}
pub fn validate(v: &Value) -> Result<(), String> {
    if v["schemaVersion"] != 1
        || v["revision"]
            .as_u64()
            .is_none_or(|n| n > 9_007_199_254_740_991)
    {
        return Err("Unsupported workspace version or revision".into());
    }
    let mut ids = HashSet::new();
    for collection in ["clients", "projects", "pages", "tasks", "attachments"] {
        for record in array(v, collection)? {
            if !ids.insert(id(record)?.to_string()) {
                return Err("Duplicate record ID".into());
            }
            tags(record)?;
        }
    }
    let clients = array(v, "clients")?
        .iter()
        .map(|v| id(v).unwrap().to_string())
        .collect();
    let projects = array(v, "projects")?
        .iter()
        .map(|v| id(v).unwrap().to_string())
        .collect();
    let pages = array(v, "pages")?
        .iter()
        .map(|v| id(v).unwrap().to_string())
        .collect();
    for client in array(v, "clients")? {
        text(client, "name", 300)?;
    }
    for project in array(v, "projects")? {
        text(project, "name", 300)?;
        reference(project, "clientId", &clients)?;
    }
    for page in array(v, "pages")? {
        text(page, "title", 1000)?;
        text(page, "content", 2 * 1024 * 1024)?;
        text(page, "icon", 100)?;
        text(page, "updatedAt", 100)?;
        if !["work", "personal", "ideas", "meeting"].contains(&text(page, "category", 30)?) {
            return Err("Invalid note category".into());
        }
        reference(page, "projectId", &projects)?;
        if page
            .get("deletedAt")
            .is_some_and(|v| !v.is_null() && !v.is_string())
        {
            return Err("Invalid trash timestamp".into());
        }
    }
    for task in array(v, "tasks")? {
        text(task, "title", 1000)?;
        text(task, "date", 30)?;
        text(task, "category", 100)?;
        if task["durationSeconds"].as_u64().is_none()
            || task["targetMinutes"]
                .as_f64()
                .is_none_or(|n| !(0.0..=100_000.0).contains(&n))
            || !task["completed"].is_boolean()
            || !["low", "medium", "high"].contains(&text(task, "priority", 20)?)
        {
            return Err("Invalid task".into());
        }
        reference(task, "projectId", &projects)?;
    }
    let mut total: u64 = 0;
    for file in array(v, "attachments")? {
        text(file, "name", 500)?;
        text(file, "mimeType", 200)?;
        text(file, "createdAt", 100)?;
        reference(file, "pageId", &pages)?;
        reference(file, "projectId", &projects)?;
        let size = file["size"]
            .as_u64()
            .filter(|n| *n <= FILE_LIMIT as u64)
            .ok_or("Attachment exceeds 10 MiB")?;
        total = total.checked_add(size).ok_or("Attachment size overflow")?;
    }
    if total > TOTAL_LIMIT as u64 || v.to_string().len() > 32 * 1024 * 1024 {
        return Err("Workspace exceeds storage limits".into());
    }
    Ok(())
}
fn load(conn: &Connection) -> Result<Option<Value>, String> {
    let data: Option<String> = conn
        .query_row("SELECT data FROM workspace WHERE id=1", [], |r| r.get(0))
        .optional()
        .map_err(error)?;
    data.map(|s| serde_json::from_str(&s).map_err(error))
        .transpose()
}
fn save(conn: &mut Connection, mut workspace: Value) -> Result<Value, String> {
    validate(&workspace)?;
    let tx = conn.transaction().map_err(error)?;
    let revision: i64 = tx
        .query_row("SELECT revision FROM workspace WHERE id=1", [], |r| {
            r.get(0)
        })
        .optional()
        .map_err(error)?
        .unwrap_or(0);
    if workspace["revision"].as_i64() != Some(revision) {
        return Err("This workspace changed in another window. Reload before editing.".into());
    }
    for file in array(&workspace, "attachments")? {
        let size: Option<i64> = tx
            .query_row(
                "SELECT length(bytes) FROM attachments WHERE id=?1",
                [id(file)?],
                |r| r.get(0),
            )
            .optional()
            .map_err(error)?;
        if size != file["size"].as_i64() {
            return Err("Attachment is missing or damaged".into());
        }
    }
    workspace["revision"] = json!(revision + 1);
    tx.execute("INSERT INTO workspace VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=excluded.revision", params![workspace.to_string(), revision + 1]).map_err(error)?;
    tx.commit().map_err(error)?;
    Ok(workspace)
}
fn export(conn: &Connection) -> Result<String, String> {
    let tx = conn.unchecked_transaction().map_err(error)?;
    let backup = export_snapshot(&tx)?;
    tx.commit().map_err(error)?;
    Ok(backup)
}
fn export_snapshot(conn: &Connection) -> Result<String, String> {
    let workspace = load(conn)?.ok_or("No workspace to export")?;
    let mut files = Vec::new();
    for file in array(&workspace, "attachments")? {
        let bytes: Vec<u8> = conn
            .query_row(
                "SELECT bytes FROM attachments WHERE id=?1",
                [id(file)?],
                |r| r.get(0),
            )
            .map_err(error)?;
        files.push(FileRecord {
            id: id(file)?.into(),
            bytes,
        });
    }
    serde_json::to_string(&json!({"format":"smart-time-workspace", "version":1, "workspace":workspace, "files":files})).map_err(error)
}

#[cfg(not(test))]
#[tauri::command]
pub async fn load_workspace(
    store: tauri::State<'_, WorkspaceStore>,
) -> Result<Option<Value>, String> {
    load(&*store.0.lock().map_err(error)?)
}
#[cfg(not(test))]
#[tauri::command]
pub async fn save_workspace(
    store: tauri::State<'_, WorkspaceStore>,
    workspace: Value,
) -> Result<Value, String> {
    save(&mut *store.0.lock().map_err(error)?, workspace)
}
#[cfg(not(test))]
#[tauri::command]
pub async fn put_workspace_file(
    store: tauri::State<'_, WorkspaceStore>,
    file_id: String,
    bytes: Vec<u8>,
) -> Result<(), String> {
    id(&json!({"id":file_id}))?;
    if bytes.len() > FILE_LIMIT {
        return Err("Files must be 10 MiB or smaller".into());
    }
    let mut conn = store.0.lock().map_err(error)?;
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(error)?;
    let total: i64 = tx
        .query_row(
            "SELECT coalesce(sum(length(bytes)),0) FROM attachments",
            [],
            |r| r.get(0),
        )
        .map_err(error)?;
    if total + bytes.len() as i64 > TOTAL_LIMIT as i64 {
        return Err("Attachment storage limit is 50 MiB".into());
    }
    tx.execute(
        "INSERT INTO attachments VALUES(?1,?2)",
        params![file_id, bytes],
    )
    .map_err(error)?;
    tx.commit().map_err(error)?;
    Ok(())
}
#[cfg(not(test))]
#[tauri::command]
pub async fn read_workspace_file(
    store: tauri::State<'_, WorkspaceStore>,
    file_id: String,
) -> Result<Vec<u8>, String> {
    let conn = store.0.lock().map_err(error)?;
    conn.query_row(
        "SELECT bytes FROM attachments WHERE id=?1",
        [file_id],
        |r| r.get(0),
    )
    .map_err(error)
}
#[cfg(not(test))]
#[tauri::command]
pub async fn export_workspace(store: tauri::State<'_, WorkspaceStore>) -> Result<String, String> {
    export(&*store.0.lock().map_err(error)?)
}
#[cfg(not(test))]
#[tauri::command]
pub async fn restore_workspace(
    store: tauri::State<'_, WorkspaceStore>,
    backup: String,
) -> Result<Value, String> {
    restore_from_backup(&mut *store.0.lock().map_err(error)?, &backup)
}
fn restore_from_backup(conn: &mut Connection, backup: &str) -> Result<Value, String> {
    if backup.len() > 256 * 1024 * 1024 {
        return Err("Backup is too large".into());
    }
    let parsed: Value = serde_json::from_str(backup).map_err(error)?;
    if parsed["format"] != "smart-time-workspace" || parsed["version"] != 1 {
        return Err("Unsupported backup format".into());
    }
    let mut workspace = parsed["workspace"].clone();
    validate(&workspace)?;
    let files: Vec<FileRecord> = serde_json::from_value(parsed["files"].clone()).map_err(error)?;
    let metadata = array(&workspace, "attachments")?;
    let mut seen = HashSet::new();
    if files.len() != metadata.len() {
        return Err("Backup file count mismatch".into());
    }
    for file in &files {
        if !seen.insert(&file.id)
            || !metadata
                .iter()
                .any(|m| m["id"] == file.id && m["size"].as_u64() == Some(file.bytes.len() as u64))
        {
            return Err("Backup file mismatch".into());
        }
    }
    let tx = conn
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(error)?;
    let previous = load(&tx)?.map(|_| export_snapshot(&tx)).transpose()?;
    let revision = load(&tx)?.and_then(|v| v["revision"].as_i64()).unwrap_or(0);
    workspace["revision"] = json!(revision + 1);
    if let Some(previous) = previous {
        tx.execute("INSERT OR REPLACE INTO recovery VALUES(1,?1)", [previous])
            .map_err(error)?;
    }
    tx.execute("DELETE FROM attachments", []).map_err(error)?;
    for file in files {
        tx.execute(
            "INSERT INTO attachments VALUES(?1,?2)",
            params![file.id, file.bytes],
        )
        .map_err(error)?;
    }
    tx.execute(
        "INSERT OR REPLACE INTO workspace VALUES(1,?1,?2)",
        params![workspace.to_string(), revision + 1],
    )
    .map_err(error)?;
    tx.commit().map_err(error)?;
    Ok(workspace)
}
#[cfg(not(test))]
#[tauri::command]
pub async fn workspace_recovery(
    store: tauri::State<'_, WorkspaceStore>,
) -> Result<Option<String>, String> {
    store
        .0
        .lock()
        .map_err(error)?
        .query_row("SELECT data FROM recovery WHERE id=1", [], |r| r.get(0))
        .optional()
        .map_err(error)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn empty() -> Value {
        json!({"schemaVersion":1,"revision":0,"clients":[],"projects":[],"pages":[],"tasks":[],"attachments":[]})
    }
    #[test]
    fn invalid_reference_and_duplicate_ids_are_rejected() {
        let mut v = empty();
        v["projects"] = json!([{"id":"p1","name":"Website","clientId":"missing"}]);
        assert!(validate(&v).is_err());
        v["clients"] = json!([{"id":"p1","name":"Client"}]);
        assert!(validate(&v).is_err());
    }
    #[test]
    fn failed_save_does_not_replace_existing_workspace() {
        let store = WorkspaceStore::open(Path::new(":memory:")).unwrap();
        let mut conn = store.0.lock().unwrap();
        let saved = save(&mut conn, empty()).unwrap();
        assert_eq!(saved["revision"], 1);
        assert!(save(&mut conn, empty()).is_err());
        assert_eq!(load(&conn).unwrap().unwrap(), saved);
    }
    #[test]
    fn attachment_content_is_preserved_in_portable_export() {
        let store = WorkspaceStore::open(Path::new(":memory:")).unwrap();
        let mut conn = store.0.lock().unwrap();
        let mut v = empty();
        v["attachments"] = json!([{"id":"f1","name":"contract.txt","mimeType":"text/plain","size":3,"tags":[],"createdAt":"2026-10-18"}]);
        assert!(save(&mut conn, v.clone()).is_err());
        conn.execute("INSERT INTO attachments VALUES('f1',?1)", [vec![1u8, 2, 3]])
            .unwrap();
        save(&mut conn, v).unwrap();
        let backup: Value = serde_json::from_str(&export(&conn).unwrap()).unwrap();
        assert_eq!(backup["files"][0]["bytes"], json!([1, 2, 3]));
    }
    #[test]
    fn malformed_restore_keeps_the_existing_state_and_files() {
        let store = WorkspaceStore::open(Path::new(":memory:")).unwrap();
        let mut conn = store.0.lock().unwrap();
        let before = save(&mut conn, empty()).unwrap();
        let backup = json!({"format":"smart-time-workspace","version":1,"workspace":empty(),"files":[{"id":"missing","bytes":[1,2]}]});
        assert!(restore_from_backup(&mut conn, &backup.to_string()).is_err());
        assert_eq!(load(&conn).unwrap().unwrap(), before);
    }
    #[test]
    fn successful_restore_retains_a_recoverable_previous_workspace() {
        let store = WorkspaceStore::open(Path::new(":memory:")).unwrap();
        let mut conn = store.0.lock().unwrap();
        let mut old = empty();
        old["clients"] = json!([{"id":"old","name":"Original client"}]);
        save(&mut conn, old).unwrap();
        let backup =
            json!({"format":"smart-time-workspace","version":1,"workspace":empty(),"files":[]});
        let restored = restore_from_backup(&mut conn, &backup.to_string()).unwrap();
        assert_eq!(restored["revision"], 2);
        let recovery: String = conn
            .query_row("SELECT data FROM recovery WHERE id=1", [], |r| r.get(0))
            .unwrap();
        restore_from_backup(&mut conn, &recovery).unwrap();
        assert_eq!(
            load(&conn).unwrap().unwrap()["clients"][0]["name"],
            "Original client"
        );
    }
    #[test]
    fn database_survives_closing_and_reopening() {
        let path = std::env::temp_dir().join(format!(
            "smart-time-storage-{}-{}.sqlite3",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        {
            let store = WorkspaceStore::open(&path).unwrap();
            let mut conn = store.0.lock().unwrap();
            let mut state = empty();
            state["clients"] = json!([{"id":"client","name":"Persistent client"}]);
            save(&mut conn, state).unwrap();
        }
        {
            let store = WorkspaceStore::open(&path).unwrap();
            assert_eq!(
                load(&store.0.lock().unwrap()).unwrap().unwrap()["clients"][0]["name"],
                "Persistent client"
            );
        }
        std::fs::remove_file(path).unwrap();
    }
}
