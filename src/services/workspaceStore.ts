import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Workspace } from "../types";
import { validateBackup, validateWorkspace, type Backup } from "./workspaceModel";

const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("Storage transaction failed.")); });
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("smart-time-workspace", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("meta"); r.result.createObjectStore("files"); };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => { database = undefined; reject(r.error); };
    r.onblocked = () => reject(new Error("Close other Smart Time tabs to update storage."));
  });
}
async function browserLoad(): Promise<Workspace | null> {
  const tx = (await db()).transaction("meta", "readonly");
  const value = await request(tx.objectStore("meta").get("workspace"));
  return value ? validateWorkspace(value) : null;
}
async function browserExport(): Promise<Backup> {
  const tx = (await db()).transaction(["meta", "files"], "readonly");
  const workspace = validateWorkspace(await request(tx.objectStore("meta").get("workspace")));
  const files = await Promise.all(workspace.attachments.map(async f => {
    const bytes = await request<Uint8Array | undefined>(tx.objectStore("files").get(f.id));
    if (!bytes || bytes.length !== f.size) throw new Error(`Missing file: ${f.name}`);
    return { id: f.id, bytes: Array.from(bytes) };
  }));
  return { format: "smart-time-workspace", version: 1, workspace, files };
}
export const workspaceStore = {
  mode: isTauri() ? "Desktop · SQLite" : "Browser preview · IndexedDB",
  async load(): Promise<Workspace | null> {
    if (!isTauri()) return browserLoad();
    const value = await invoke<unknown>("load_workspace");
    return value == null ? null : validateWorkspace(value);
  },
  async save(workspace: Workspace): Promise<Workspace> {
    validateWorkspace(workspace);
    if (isTauri()) return validateWorkspace(await invoke("save_workspace", { workspace }));
    const tx = (await db()).transaction(["meta", "files"], "readwrite");
    const done = finished(tx);
    // Attach rejection handling before awaiting requests so aborts cannot be unhandled.
    void done.catch(() => {});
    try {
      const current = await request<Workspace | undefined>(tx.objectStore("meta").get("workspace"));
      if ((current?.revision ?? 0) !== workspace.revision) throw new Error("Workspace changed in another window. Reload before editing.");
      const lengths = await Promise.all(workspace.attachments.map(async f => {
        const bytes = await request<Uint8Array | undefined>(tx.objectStore("files").get(f.id));
        return bytes?.length === f.size;
      }));
      if (lengths.some(ok => !ok)) throw new Error("An attachment is missing or damaged.");
      const saved = { ...workspace, revision: workspace.revision + 1 };
      tx.objectStore("meta").put(saved, "workspace"); await done; return saved;
    } catch (e) { try { tx.abort(); } catch { /* Already aborted. */ } throw e; }
  },
  async putFile(id: string, bytes: Uint8Array): Promise<void> {
    if (isTauri()) { await invoke("put_workspace_file", { fileId: id, bytes: Array.from(bytes) }); return; }
    const tx = (await db()).transaction("files", "readwrite"); const done = finished(tx);
    tx.objectStore("files").add(bytes, id); await done;
  },
  async readFile(id: string): Promise<Uint8Array> {
    if (isTauri()) return Uint8Array.from(await invoke<number[]>("read_workspace_file", { fileId: id }));
    const tx = (await db()).transaction("files");
    const bytes = await request<Uint8Array | undefined>(tx.objectStore("files").get(id));
    if (!bytes) throw new Error("Attachment not found."); return bytes;
  },
  async export(): Promise<string> { return isTauri() ? invoke("export_workspace") : JSON.stringify(await browserExport()); },
  async restore(input: unknown): Promise<Workspace> {
    const backup = validateBackup(input);
    if (isTauri()) return validateWorkspace(await invoke("restore_workspace", { backup: JSON.stringify(backup) }));
    const previous = await browserExport();
    const tx = (await db()).transaction(["meta", "files"], "readwrite"); const done = finished(tx); void done.catch(() => {});
    const current = await request<Workspace>(tx.objectStore("meta").get("workspace"));
    if (current.revision !== previous.workspace.revision) { tx.abort(); throw new Error("Workspace changed during restore. Try again."); }
    const workspace = { ...backup.workspace, revision: current.revision + 1 };
    tx.objectStore("meta").put(JSON.stringify(previous), "recovery");
    tx.objectStore("files").clear();
    for (const f of backup.files) tx.objectStore("files").put(Uint8Array.from(f.bytes), f.id);
    tx.objectStore("meta").put(workspace, "workspace"); await done; return workspace;
  },
  async recovery(): Promise<string | null> {
    if (isTauri()) return invoke("workspace_recovery");
    return (await request<string | undefined>((await db()).transaction("meta").objectStore("meta").get("recovery"))) ?? null;
  },
};
