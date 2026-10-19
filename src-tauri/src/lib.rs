mod ai;
mod rag;
mod workspace;
use tauri::Manager;

use ai::{check_provider, query_ai, ChatRequest, ChatResponse, ProviderStatus};
use rag::{search_notes, NoteSnippet, RAGSearchResult};
use serde::{Deserialize, Serialize};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Smart Time.", name)
}

#[tauri::command]
async fn check_ai_provider(provider: String, endpoint: Option<String>) -> ProviderStatus {
    check_provider(provider, endpoint).await
}

#[tauri::command]
async fn chat_with_ai(request: ChatRequest) -> Result<ChatResponse, String> {
    query_ai(request).await
}

#[tauri::command]
async fn search_workspace_knowledge(query: String, notes: Vec<NoteSnippet>, max_results: Option<usize>, endpoint: Option<String>) -> Result<Vec<RAGSearchResult>, String> {
    let limit = max_results.unwrap_or(4).clamp(1, 10);
    let endpoint = endpoint.filter(|value| !value.trim().is_empty()).unwrap_or_else(|| "http://localhost:11434".into());
    rag::search_notes(&query, &notes, limit, &endpoint).await
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskTimeEntry {
    pub task_title: String,
    pub duration_seconds: u64,
    pub completed: bool,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyReport {
    pub date: String,
    pub total_time_spent_seconds: u64,
    pub formatted_total_time: String,
    pub completed_tasks_count: usize,
    pub total_tasks_count: usize,
    pub entries: Vec<TaskTimeEntry>,
    pub summary_text: String,
}

#[tauri::command]
fn generate_daily_report(date: String, tasks: Vec<TaskTimeEntry>) -> DailyReport {
    let total_seconds: u64 = tasks.iter().map(|t| t.duration_seconds).sum();
    let completed_count = tasks.iter().filter(|t| t.completed).count();
    let total_count = tasks.len();

    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let formatted = if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    };

    let summary = format!(
        "Daily Productivity Summary for {}:\nTotal focused time: {}.\nTasks: {}/{} completed.",
        date, formatted, completed_count, total_count
    );

    DailyReport {
        date,
        total_time_spent_seconds: total_seconds,
        formatted_total_time: formatted,
        completed_tasks_count: completed_count,
        total_tasks_count: total_count,
        entries: tasks,
        summary_text: summary,
    }
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let store = workspace::WorkspaceStore::open(&data_dir.join("workspace.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(store);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_ai_provider,
            chat_with_ai,
            search_workspace_knowledge,
            generate_daily_report
            ,workspace::load_workspace
            ,workspace::save_workspace
            ,workspace::put_workspace_file
            ,workspace::read_workspace_file
            ,workspace::export_workspace
            ,workspace::restore_workspace
            ,workspace::workspace_recovery
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
