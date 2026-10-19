use serde::{Deserialize, Serialize};
use std::sync::LazyLock;
use std::time::Instant;

static CHAT_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("HTTP client configuration is valid")
});
static STATUS_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .expect("HTTP client configuration is valid")
});

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    pub provider: String,          // "ollama" | "lmstudio" | "jan" | "openai" | "gemini" | "claude"
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub context: Option<String>,    // Injected RAG context
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub message: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub latency_ms: u64,
    pub estimated_cost_usd: f64,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProviderStatus {
    pub provider: String,
    pub online: bool,
    pub models: Vec<String>,
    pub message: String,
}

fn estimate_tokens(text: &str) -> u32 {
    // Rough estimate: ~4 chars per token for English, ~2 chars per token for Arabic
    let count = text.chars().count();
    ((count as f64) / 3.0).ceil() as u32
}

pub async fn query_ai(req: ChatRequest) -> Result<ChatResponse, String> {
    let start_time = Instant::now();
    let client = CHAT_CLIENT.clone();

    let mut messages = req.messages.clone();

    // Inject RAG context into system prompt if provided
    if let Some(context) = req.context {
        if !context.trim().is_empty() {
            let rag_prompt = format!(
                "You are Smart Time AI Assistant. Use the following relevant knowledge from the user's workspace notes to answer accurately:\n\n---\n{}\n---\nAnswer clearly and directly. If the context does not contain the answer, state so politely.",
                context
            );
            messages.insert(0, ChatMessage {
                role: "system".to_string(),
                content: rag_prompt,
            });
        }
    }

    match req.provider.as_str() {
        "ollama" => {
            let base_url = req.endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

            let body = serde_json::json!({
                "model": req.model,
                "messages": messages,
                "stream": false
            });

            let resp = client.post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Ollama at {}: {}", url, e))?;

            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                return Err(format!("Ollama error: {}", err_text));
            }

            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let content = json["message"]["content"].as_str().unwrap_or("").to_string();
            let prompt_tokens = json["prompt_eval_count"].as_u64().unwrap_or(0) as u32;
            let completion_tokens = json["eval_count"].as_u64().unwrap_or(0) as u32;
            let total_tokens = if prompt_tokens + completion_tokens > 0 {
                prompt_tokens + completion_tokens
            } else {
                estimate_tokens(&content)
            };

            let latency_ms = start_time.elapsed().as_millis() as u64;

            Ok(ChatResponse {
                message: content,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                latency_ms,
                estimated_cost_usd: 0.0, // Local is 100% free!
                model: req.model,
            })
        }
        "lmstudio" | "jan" => {
            let default_port = if req.provider == "lmstudio" { "1234" } else { "1337" };
            let base_url = req.endpoint.unwrap_or_else(|| format!("http://localhost:{}", default_port));
            let url = format!("{}/v1/chat/completions", base_url.trim_end_matches('/'));

            let body = serde_json::json!({
                "model": req.model,
                "messages": messages,
                "temperature": 0.7
            });

            let resp = client.post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to {} at {}: {}", req.provider, url, e))?;

            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                return Err(format!("{} error: {}", req.provider, err_text));
            }

            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
            let prompt_tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
            let completion_tokens = json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
            let raw_tokens = json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;
            let total_tokens = if raw_tokens > 0 { raw_tokens } else { estimate_tokens(&content) };
            let latency_ms = start_time.elapsed().as_millis() as u64;

            Ok(ChatResponse {
                message: content,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                latency_ms,
                estimated_cost_usd: 0.0, // Local is free!
                model: req.model,
            })
        }
        "openai" => {
            let api_key = req.api_key.ok_or("OpenAI API Key is required")?;
            let url = "https://api.openai.com/v1/chat/completions";

            let body = serde_json::json!({
                "model": req.model,
                "messages": messages,
                "temperature": 0.7
            });

            let resp = client.post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("OpenAI request failed: {}", e))?;

            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                return Err(format!("OpenAI error: {}", err_text));
            }

            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
            let p_tokens = json["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
            let c_tokens = json["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
            let total = json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;

            // Approximate cost for GPT-4o-mini ($0.15/1M input, $0.60/1M output)
            let cost = (p_tokens as f64 * 0.00000015) + (c_tokens as f64 * 0.00000060);
            let latency_ms = start_time.elapsed().as_millis() as u64;

            Ok(ChatResponse {
                message: content,
                prompt_tokens: p_tokens,
                completion_tokens: c_tokens,
                total_tokens: total,
                latency_ms,
                estimated_cost_usd: cost,
                model: req.model,
            })
        }
        "gemini" => {
            let api_key = req.api_key.ok_or("Gemini API Key is required")?;
            let model_name = if req.model.is_empty() { "gemini-2.5-flash" } else { req.model.trim_start_matches("models/") };
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
                model_name
            );

            let system_instruction = messages.iter().filter(|m| m.role == "system")
                .map(|m| m.content.as_str()).collect::<Vec<_>>().join("\n\n");
            let contents: Vec<serde_json::Value> = messages.iter().filter(|m| m.role != "system").map(|m| {
                let role = if m.role == "assistant" { "model" } else { "user" };
                serde_json::json!({
                    "role": role,
                    "parts": [{"text": m.content}]
                })
            }).collect();

            let mut body = serde_json::json!({ "contents": contents });
            if !system_instruction.trim().is_empty() {
                body["systemInstruction"] = serde_json::json!({ "parts": [{ "text": system_instruction }] });
            }

            let resp = client.post(&url)
                .header("x-goog-api-key", api_key)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Gemini request failed: {}", e.without_url()))?;

            if !resp.status().is_success() {
                let err_text = resp.text().await.unwrap_or_default();
                return Err(format!("Gemini API error: {}", err_text));
            }

            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            let content = json["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("").to_string();
            let p_tokens = json["usageMetadata"]["promptTokenCount"].as_u64().unwrap_or(0) as u32;
            let c_tokens = json["usageMetadata"]["candidatesTokenCount"].as_u64().unwrap_or(0) as u32;
            let total = json["usageMetadata"]["totalTokenCount"].as_u64().unwrap_or((p_tokens + c_tokens) as u64) as u32;

            let cost = (p_tokens as f64 * 0.000000075) + (c_tokens as f64 * 0.00000030);
            let latency_ms = start_time.elapsed().as_millis() as u64;

            Ok(ChatResponse {
                message: content,
                prompt_tokens: p_tokens,
                completion_tokens: c_tokens,
                total_tokens: total,
                latency_ms,
                estimated_cost_usd: cost,
                model: req.model,
            })
        }
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

pub async fn check_provider(provider: String, endpoint: Option<String>) -> ProviderStatus {
    let client = STATUS_CLIENT.clone();

    match provider.as_str() {
        "ollama" => {
            let base_url = endpoint.unwrap_or_else(|| "http://localhost:11434".to_string());
            let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let json: serde_json::Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json["models"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    ProviderStatus {
                        provider,
                        online: true,
                        models,
                        message: "Ollama connected successfully".to_string(),
                    }
                }
                _ => ProviderStatus {
                    provider,
                    online: false,
                    models: vec![],
                    message: "Ollama server not reachable at localhost:11434".to_string(),
                },
            }
        }
        "lmstudio" => {
            let base_url = endpoint.unwrap_or_else(|| "http://localhost:1234".to_string());
            let url = format!("{}/v1/models", base_url.trim_end_matches('/'));

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let json: serde_json::Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    ProviderStatus {
                        provider,
                        online: true,
                        models,
                        message: "LM Studio connected successfully".to_string(),
                    }
                }
                _ => ProviderStatus {
                    provider,
                    online: false,
                    models: vec![],
                    message: "LM Studio server not reachable at localhost:1234".to_string(),
                },
            }
        }
        "jan" => {
            let base_url = endpoint.unwrap_or_else(|| "http://localhost:1337".to_string());
            let url = format!("{}/v1/models", base_url.trim_end_matches('/'));

            match client.get(&url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let json: serde_json::Value = resp.json().await.unwrap_or_default();
                    let models: Vec<String> = json["data"]
                        .as_array()
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|m| m["id"].as_str().map(|s| s.to_string()))
                                .collect()
                        })
                        .unwrap_or_default();

                    ProviderStatus {
                        provider,
                        online: true,
                        models,
                        message: "Jan connected successfully".to_string(),
                    }
                }
                _ => ProviderStatus {
                    provider,
                    online: false,
                    models: vec![],
                    message: "Jan server not reachable at localhost:1337".to_string(),
                },
            }
        }
        "openai" => ProviderStatus {
            provider,
            online: true,
            models: vec!["gpt-4o-mini".to_string()],
            message: "OpenAI is ready; add an API key to send a request".to_string(),
        },
        "gemini" => ProviderStatus {
            provider,
            online: true,
            models: vec!["gemini-2.5-flash".to_string()],
            message: "Gemini is ready; add an API key to send a request".to_string(),
        },
        _ => ProviderStatus {
            provider,
            online: false,
            models: vec![],
            message: format!("Unsupported AI provider: {}", provider),
        },
    }
}
