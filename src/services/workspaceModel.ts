import type { Page, Task, Workspace } from "../types";

export const FILE_LIMIT = 10 * 1024 * 1024;
export const TOTAL_LIMIT = 50 * 1024 * 1024;
export const BACKUP_LIMIT = 256 * 1024 * 1024;
export interface Backup { format: "smart-time-workspace"; version: 1; workspace: Workspace; files: { id: string; bytes: number[] }[] }
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid workspace record.");
  return value as RecordValue;
}
function string(value: unknown, max: number): asserts value is string {
  if (typeof value !== "string" || new TextEncoder().encode(value).length > max) throw new Error("Invalid or oversized text field.");
}
function collection(value: unknown): RecordValue[] {
  if (!Array.isArray(value) || value.length > 20_000) throw new Error("Invalid workspace collection.");
  return value.map(record);
}
export function validateWorkspace(value: unknown): Workspace {
  const w = record(value);
  if (w.schemaVersion !== 1 || !Number.isSafeInteger(w.revision) || Number(w.revision) < 0) throw new Error("Unsupported workspace version or revision.");
  const clients = collection(w.clients), projects = collection(w.projects), pages = collection(w.pages), tasks = collection(w.tasks), attachments = collection(w.attachments);
  const allIds = new Set<string>();
  for (const item of [...clients, ...projects, ...pages, ...tasks, ...attachments]) {
    string(item.id, 128);
    if (!/^[a-zA-Z0-9_-]+$/.test(item.id) || allIds.has(item.id)) throw new Error("Invalid or duplicate record ID.");
    allIds.add(item.id);
    if (item.tags !== undefined && (!Array.isArray(item.tags) || item.tags.length > 64)) throw new Error("Invalid tags.");
    for (const tag of (item.tags ?? []) as unknown[]) { string(tag, 240); if (!tag.trim()) throw new Error("Empty tag."); }
  }
  const clientIds = new Set(clients.map(c => c.id)), projectIds = new Set(projects.map(p => p.id)), pageIds = new Set(pages.map(p => p.id));
  const reference = (item: RecordValue, key: string, ids: Set<unknown>) => {
    if (item[key] != null && !ids.has(item[key])) throw new Error(`Missing ${key} reference.`);
  };
  for (const c of clients) string(c.name, 300);
  for (const p of projects) { string(p.name, 300); reference(p, "clientId", clientIds); }
  for (const p of pages) {
    string(p.title, 1000); string(p.content, 2 * 1024 * 1024); string(p.icon, 100); string(p.updatedAt, 100);
    if (!["work", "personal", "ideas", "meeting"].includes(String(p.category))) throw new Error("Invalid note category.");
    if (p.deletedAt != null) string(p.deletedAt, 100);
    reference(p, "projectId", projectIds);
  }
  for (const t of tasks) {
    string(t.title, 1000); string(t.date, 30); string(t.category, 100);
    if (!Number.isSafeInteger(t.durationSeconds) || Number(t.durationSeconds) < 0 || typeof t.targetMinutes !== "number" || !Number.isFinite(t.targetMinutes) || t.targetMinutes < 0 || t.targetMinutes > 100_000 || typeof t.completed !== "boolean" || !["low", "medium", "high"].includes(String(t.priority))) throw new Error("Invalid task.");
    reference(t, "projectId", projectIds);
  }
  let total = 0;
  for (const f of attachments) {
    string(f.name, 500); string(f.mimeType, 200); string(f.createdAt, 100);
    if (!Number.isSafeInteger(f.size) || Number(f.size) < 0 || Number(f.size) > FILE_LIMIT) throw new Error("Files must be 10 MiB or smaller.");
    total += Number(f.size); reference(f, "pageId", pageIds); reference(f, "projectId", projectIds);
  }
  if (total > TOTAL_LIMIT || new TextEncoder().encode(JSON.stringify(w)).length > 32 * 1024 * 1024) throw new Error("Workspace storage limit exceeded.");
  return value as Workspace;
}
export function emptyWorkspace(pages: Page[] = [], tasks: Task[] = []): Workspace {
  return validateWorkspace({ schemaVersion: 1, revision: 0, clients: [], projects: [], pages, tasks, attachments: [] });
}
export function validateBackup(value: unknown): Backup {
  const b = record(value);
  if (b.format !== "smart-time-workspace" || b.version !== 1) throw new Error("This is not a supported Smart Time backup.");
  const w = validateWorkspace(b.workspace);
  if (!Array.isArray(b.files) || b.files.length !== w.attachments.length) throw new Error("Backup attachments are missing.");
  const seen = new Set<string>();
  for (const entry of b.files) {
    const f = record(entry), meta = w.attachments.find(a => a.id === f.id);
    if (!meta || seen.has(meta.id) || !Array.isArray(f.bytes) || f.bytes.length !== meta.size) throw new Error("Backup attachment mismatch.");
    for (const byte of f.bytes) if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new Error("Invalid attachment bytes.");
    seen.add(meta.id);
  }
  return value as Backup;
}
export function parseTags(input: string): string[] {
  const tags = [...new Set(input.split(/[,،\n]/).map(s => s.trim().replace(/^#+/, "")).filter(Boolean))];
  if (tags.length > 64 || tags.some(t => new TextEncoder().encode(t).length > 240)) throw new Error("Use up to 64 tags, each under 240 bytes.");
  return tags;
}
export function belongsToProject(w: Workspace, projectId: string | null | undefined, clientId: string, selectedProject: string): boolean {
  return (!selectedProject || projectId === selectedProject) && (!clientId || w.projects.some(p => p.id === projectId && p.clientId === clientId));
}
