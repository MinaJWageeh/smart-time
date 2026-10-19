import { useEffect, useRef, useState } from "react";
import type { Page, Task, Workspace } from "../types";
import { emptyWorkspace, validateWorkspace, type Backup } from "../services/workspaceModel";
import { workspaceStore } from "../services/workspaceStore";
import { isTauri } from "@tauri-apps/api/core";

let initialization: Promise<Workspace> | undefined;
function initialize(pages: Page[], tasks: Task[]) {
  return initialization ??= (async () => {
    const stored = await workspaceStore.load(); if (stored) return stored;
    const oldPages = localStorage.getItem("st_pages"), oldTasks = localStorage.getItem("st_tasks");
    const migrated = emptyWorkspace(oldPages ? JSON.parse(oldPages) : pages, oldTasks ? JSON.parse(oldTasks) : tasks);
    return workspaceStore.save(migrated);
  })().finally(() => { initialization = undefined; });
}
export function useWorkspace(initialPages: Page[], initialTasks: Task[]) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Loading workspace…");
  const current = useRef<Workspace | null>(null);
  const revision = useRef(0);
  const saved = useRef<Workspace | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const writing = useRef(false);
  const accept = (w: Workspace) => { current.current = w; revision.current = w.revision; saved.current = w; setWorkspace(w); };
  useEffect(() => {
    mounted.current = true;
    initialize(initialPages, initialTasks).then(w => { if (mounted.current) { accept(w); setStatus("Saved locally"); } }).catch(e => { if (mounted.current) setError(String(e)); });
    return () => { mounted.current = false; };
  }, []);
  const update = (change: (w: Workspace) => Workspace) => {
    if (!current.current || writing.current) return;
    const next = validateWorkspace(change(current.current));
    current.current = next; setWorkspace(next); setStatus("Unsaved changes");
  };
  const flush = async () => {
    const run = queue.current.catch(() => {}).then(async () => {
      const snapshot = current.current;
      if (!snapshot || snapshot === saved.current) return;
      if (mounted.current) setStatus("Saving…");
      try {
        const stored = await workspaceStore.save({ ...snapshot, revision: revision.current });
        revision.current = stored.revision; saved.current = snapshot;
        if (mounted.current) { setError(""); setStatus(current.current === snapshot ? "Saved locally" : "Unsaved changes"); }
      } catch (e) { if (mounted.current) { setError(String(e)); setStatus("Not saved"); } throw e; }
    });
    queue.current = run; return run;
  };
  useEffect(() => {
    if (!workspace || workspace === saved.current) return;
    const timer = setTimeout(() => { void flush().catch(() => {}); }, 400);
    return () => clearTimeout(timer);
  }, [workspace]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (current.current !== saved.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let closing = false;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const window = getCurrentWindow();
      const cleanup = await window.onCloseRequested(async event => {
        event.preventDefault();
        if (closing) return;
        closing = true; writing.current = true;
        try { await flush(); await window.destroy(); }
        catch (e) { closing = false; writing.current = false; setError(`Could not close safely: ${String(e)}`); }
      });
      if (disposed) cleanup(); else unlisten = cleanup;
    }).catch(e => setError(`Close protection unavailable: ${String(e)}`));
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const restore = async (backup: Backup) => {
    writing.current = true;
    try { await flush(); const next = await workspaceStore.restore(backup); accept(next); setError(""); setStatus("Restored and saved locally"); }
    finally { writing.current = false; }
  };
  return { workspace, update, error, status, flush, restore, mode: workspaceStore.mode,
    setPages: (change: Page[] | ((p: Page[]) => Page[])) => update(w => ({ ...w, pages: typeof change === "function" ? change(w.pages) : change })),
    setTasks: (change: Task[] | ((t: Task[]) => Task[])) => update(w => ({ ...w, tasks: typeof change === "function" ? change(w.tasks) : change })),
  };
}
