export type TabType = "editor" | "timer" | "calendar" | "ai-hub" | "workspace";

export interface Page {
  id: string;
  title: string;
  icon: string;
  content: string;
  updatedAt: string;
  category: "work" | "personal" | "ideas" | "meeting";
  projectId?: string | null;
  tags?: string[];
  deletedAt?: string | null;
}

export interface Task {
  projectId?: string | null;
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  durationSeconds: number;
  targetMinutes: number;
  completed: boolean;
  priority: "low" | "medium" | "high";
  category: string;
}

export interface Client { id: string; name: string }
export interface Project { id: string; name: string; clientId?: string | null }
export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  pageId?: string | null;
  projectId?: string | null;
  tags: string[];
}
export interface Workspace {
  schemaVersion: 1;
  revision: number;
  clients: Client[];
  projects: Project[];
  pages: Page[];
  tasks: Task[];
  attachments: Attachment[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs?: number;
  costUsd?: number;
  model?: string;
  ragSources?: Array<{ title: string; snippet: string }>;
}

export interface AIProviderConfig {
  provider: "ollama" | "lmstudio" | "jan" | "openai" | "gemini";
  endpoint: string;
  apiKey: string;
  model: string;
  enableRAG: boolean;
}

export interface ProviderStatus {
  provider: string;
  online: boolean;
  models: string[];
  message: string;
}
