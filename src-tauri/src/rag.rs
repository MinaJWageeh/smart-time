use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    hash::{Hash, Hasher},
    sync::{LazyLock, Mutex},
    time::Duration,
};

const EMBEDDING_MODEL: &str = "all-minilm";
const CHUNK_CHARS: usize = 900;
const CHUNK_OVERLAP: usize = 120;
const EMBEDDING_BATCH_SIZE: usize = 64;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSnippet {
    pub id: String,
    pub title: String,
    pub content: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RAGSearchResult {
    pub note_id: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
}

#[derive(Clone)]
struct CachedChunk {
    text: String,
    vector: Vec<f32>,
}

#[derive(Clone)]
struct CachedNote {
    fingerprint: u64,
    chunks: Vec<CachedChunk>,
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

static EMBED_CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .timeout(Duration::from_secs(180))
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .expect("valid Ollama embedding HTTP client")
});
static NOTE_CACHE: LazyLock<Mutex<HashMap<String, CachedNote>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// Search workspace notes with Ollama embeddings, caching vectors until note content changes.
pub async fn search_notes(
    query: &str,
    notes: &[NoteSnippet],
    max_results: usize,
    endpoint: &str,
) -> Result<Vec<RAGSearchResult>, String> {
    let query = query.trim();
    if query.is_empty() || notes.is_empty() {
        return Ok(vec![]);
    }

    let query_vectors = embed_texts(endpoint, vec![query.to_owned()]).await?;
    let query_vector = query_vectors
        .into_iter()
        .next()
        .ok_or("Ollama returned no query embedding")?;

    let fingerprints: HashMap<&str, u64> = notes
        .iter()
        .map(|note| (note.id.as_str(), fingerprint(note)))
        .collect();
    {
        let active_ids: std::collections::HashSet<&str> = notes.iter().map(|note| note.id.as_str()).collect();
        NOTE_CACHE
            .lock()
            .map_err(|_| "RAG embedding cache is unavailable")?
            .retain(|id, _| active_ids.contains(id.as_str()));
    }
    let stale_notes: Vec<&NoteSnippet> = {
        let cache = NOTE_CACHE
            .lock()
            .map_err(|_| "RAG embedding cache is unavailable")?;
        notes
            .iter()
            .filter(|note| {
                cache
                    .get(&note.id)
                    .is_none_or(|cached| cached.fingerprint != fingerprints[note.id.as_str()])
            })
            .collect()
    };

    if !stale_notes.is_empty() {
        let mut pending = Vec::new();
        let mut chunk_map = Vec::new();
        for note in stale_notes {
            for chunk in chunk_text(&note.content) {
                pending.push(format!("{}\n{}", note.title, chunk));
                chunk_map.push((note.id.clone(), chunk));
            }
        }

        let mut embedded: HashMap<String, Vec<CachedChunk>> = HashMap::new();
        for start in (0..pending.len()).step_by(EMBEDDING_BATCH_SIZE) {
            let end = (start + EMBEDDING_BATCH_SIZE).min(pending.len());
            let vectors = embed_texts(endpoint, pending[start..end].to_vec()).await?;
            if vectors.len() != end - start {
                return Err("Ollama returned an incomplete embedding batch".into());
            }
            for (mapping, vector) in chunk_map[start..end].iter().zip(vectors) {
                embedded
                    .entry(mapping.0.clone())
                    .or_default()
                    .push(CachedChunk {
                        text: mapping.1.clone(),
                        vector,
                    });
            }
        }

        let mut cache = NOTE_CACHE
            .lock()
            .map_err(|_| "RAG embedding cache is unavailable")?;
        for note in notes {
            let chunks = embedded.remove(&note.id).unwrap_or_default();
            cache.insert(
                note.id.clone(),
                CachedNote {
                    fingerprint: fingerprints[note.id.as_str()],
                    chunks,
                },
            );
        }
    }

    let cache = NOTE_CACHE
        .lock()
        .map_err(|_| "RAG embedding cache is unavailable")?;
    let mut results: Vec<RAGSearchResult> = notes
        .iter()
        .filter_map(|note| {
            let cached = cache.get(&note.id)?;
            let (snippet, score) = cached
                .chunks
                .iter()
                .map(|chunk| (chunk.text.as_str(), cosine_similarity(&query_vector, &chunk.vector)))
                .max_by(|a, b| a.1.total_cmp(&b.1))?;
            (score > 0.05).then(|| RAGSearchResult {
                note_id: note.id.clone(),
                title: note.title.clone(),
                snippet: snippet.to_owned(),
                score,
            })
        })
        .collect();
    results.sort_by(|a, b| b.score.total_cmp(&a.score));
    results.truncate(max_results.clamp(1, 10));
    Ok(results)
}

async fn embed_texts(endpoint: &str, input: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
    let url = format!("{}/api/embed", endpoint.trim_end_matches('/'));
    let response = EMBED_CLIENT
        .post(&url)
        .json(&serde_json::json!({
            "model": EMBEDDING_MODEL,
            "input": input,
            "keep_alive": "10m"
        }))
        .send()
        .await
        .map_err(|error| format!("Could not reach Ollama embeddings at {url}: {error}"))?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Ollama embedding model '{EMBEDDING_MODEL}' failed ({status}): {body}"
        ));
    }
    response
        .json::<EmbedResponse>()
        .await
        .map(|data| data.embeddings)
        .map_err(|error| format!("Invalid Ollama embedding response: {error}"))
}

fn fingerprint(note: &NoteSnippet) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    note.title.hash(&mut hasher);
    note.content.hash(&mut hasher);
    hasher.finish()
}

fn chunk_text(content: &str) -> Vec<String> {
    let chars: Vec<char> = content.chars().collect();
    if chars.is_empty() {
        return vec![String::new()];
    }
    let stride = CHUNK_CHARS - CHUNK_OVERLAP;
    (0..chars.len())
        .step_by(stride)
        .map(|start| chars[start..(start + CHUNK_CHARS).min(chars.len())].iter().collect())
        .collect()
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
    if left.len() != right.len() || left.is_empty() {
        return 0.0;
    }
    let (mut dot, mut left_norm, mut right_norm) = (0.0, 0.0, 0.0);
    for (a, b) in left.iter().zip(right) {
        dot += a * b;
        left_norm += a * a;
        right_norm += b * b;
    }
    let denominator = left_norm.sqrt() * right_norm.sqrt();
    if denominator == 0.0 { 0.0 } else { dot / denominator }
}
