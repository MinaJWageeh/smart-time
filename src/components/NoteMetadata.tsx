import { useEffect, useRef, useState } from "react";
import { Paperclip, Tag } from "lucide-react";
import type { Attachment, Page, Workspace } from "../types";
import { FILE_LIMIT, TOTAL_LIMIT, parseTags, validateWorkspace } from "../services/workspaceModel";
import { workspaceStore } from "../services/workspaceStore";

export function NoteMetadata({ page, workspace, onUpdate, update, flush, status }: {
  page: Page; workspace: Workspace; onUpdate: (page: Page) => void;
  update: (change: (w: Workspace) => Workspace) => void; flush: () => Promise<void>; status: string;
}) {
  const [tags, setTags] = useState((page.tags ?? []).join(", "));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setTags((page.tags ?? []).join(", ")); setError(""); }, [page.id, JSON.stringify(page.tags)]);
  const saveTags = () => { try { onUpdate({ ...page, tags: parseTags(tags) }); setError(""); } catch (e) { setError(String(e)); } };
  const addFile = async (file?: File) => {
    if (!file) return; setBusy(true); setError("");
    try {
      if (file.size > FILE_LIMIT || workspace.attachments.reduce((n, f) => n + f.size, 0) + file.size > TOTAL_LIMIT) throw new Error("Files: 10 MB each, 50 MB total.");
      const meta: Attachment = { id: crypto.randomUUID(), name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString(), pageId: page.id, projectId: page.projectId ?? null, tags: page.tags ?? [] };
      validateWorkspace({ ...workspace, attachments: [...workspace.attachments, meta] }); await flush();
      await workspaceStore.putFile(meta.id, new Uint8Array(await file.arrayBuffer()));
      update(w => ({ ...w, attachments: [...w.attachments, meta] })); await flush();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const linked = workspace.attachments.filter(f => f.pageId === page.id);
  return <><div className="note-metadata"><label>Project<select aria-label="Note project" value={page.projectId ?? ""} onChange={e => onUpdate({ ...page, projectId: e.target.value || null })}><option value="">Personal</option>{workspace.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label><Tag size={12} />Tags<input aria-label="Note tags" value={tags} onChange={e => setTags(e.target.value)} onBlur={saveTags} onKeyDown={e => { if (e.key === "Enter") { saveTags(); e.currentTarget.blur(); } }} placeholder="design, عقد, urgent" dir="auto" /></label><button className="ws-button" disabled={busy} onClick={() => input.current?.click()}><Paperclip size={13} />{busy ? "Adding…" : `Attach file${linked.length ? ` (${linked.length})` : ""}`}</button><span className="ws-save">{status}</span><input ref={input} type="file" hidden aria-label="Attach file to note" onChange={e => { void addFile(e.target.files?.[0]); e.target.value = ""; }} /></div>
    {linked.length > 0 && <div className="note-metadata">{linked.map(f => <button className="ws-button" key={f.id} onClick={() => { void (async () => { try { const bytes = await workspaceStore.readFile(f.id); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" })); const a = document.createElement("a"); a.href = url; a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000); } catch (e) { setError(String(e)); } })(); }}><Paperclip size={12} />{f.name}</button>)}</div>}
    {error && <div className="workspace-alert" role="alert">{error}</div>}</>;
}
