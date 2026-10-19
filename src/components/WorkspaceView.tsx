import { useRef, useState } from "react";
import { ArrowUpRight, Download, FileText, FolderOpen, Plus, Search, Tag, Trash2, Upload, Users, RotateCcw, Paperclip } from "lucide-react";
import type { Attachment, Page, Workspace } from "../types";
import { BACKUP_LIMIT, FILE_LIMIT, TOTAL_LIMIT, belongsToProject, parseTags, validateBackup, validateWorkspace, type Backup } from "../services/workspaceModel";
import { workspaceStore } from "../services/workspaceStore";
import { searchableNoteText } from "../services/inlineImages";
import "./workspace.css";

interface Props {
  workspace: Workspace;
  update: (change: (w: Workspace) => Workspace) => void;
  flush: () => Promise<void>;
  restore: (backup: Backup) => Promise<void>;
  onOpenPage: (id: string) => void;
  status: string;
  mode: string;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
const sizeLabel = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;

export function WorkspaceView({ workspace: w, update, flush, restore, onOpenPage, status, mode }: Props) {
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [view, setView] = useState<"notes" | "files" | "trash">("notes");
  const [form, setForm] = useState<"client" | "project" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [incoming, setIncoming] = useState<Backup | null>(null);
  const [editingFile, setEditingFile] = useState<Attachment | null>(null);
  const [fileTags, setFileTags] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null), restoreRef = useRef<HTMLInputElement>(null);
  const projects = w.projects.filter(p => !clientId || p.clientId === clientId);
  const allTags = [...new Set([...w.pages.filter(p => !p.deletedAt).flatMap(p => p.tags ?? []), ...w.attachments.flatMap(f => f.tags)])].sort();
  const matches = (title: string, tags: string[], content = "") => (!tag || tags.includes(tag)) && (!query.trim() || `${title}\n${tags.join(" ")}\n${content}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const notes = w.pages.filter(p => (view === "trash" ? !!p.deletedAt : !p.deletedAt) && belongsToProject(w, p.projectId, clientId, projectId) && matches(p.title, p.tags ?? [], searchableNoteText(p.content)));
  const files = w.attachments.filter(f => !w.pages.find(p => p.id === f.pageId)?.deletedAt && belongsToProject(w, f.projectId, clientId, projectId) && matches(f.name, f.tags));
  const currentProject = w.projects.find(p => p.id === projectId), currentClient = w.clients.find(c => c.id === clientId);
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const create = () => {
    if (!name.trim()) return;
    const id = crypto.randomUUID();
    try {
      if (form === "client") { update(s => ({ ...s, clients: [...s.clients, { id, name: name.trim() }] })); setClientId(id); setProjectId(""); }
      else { update(s => ({ ...s, projects: [...s.projects, { id, name: name.trim(), clientId: clientId || null }] })); setProjectId(id); }
      setForm(null); setName("");
    } catch (e) { setError(String(e)); }
  };
  const createNote = () => {
    if (clientId && !projectId) { setError("Choose a project for this client before creating a note, or clear the client filter for a personal note."); return; }
    const page: Page = { id: crypto.randomUUID(), title: "Untitled note", icon: "📄", content: "", category: "work", updatedAt: new Date().toISOString(), projectId: projectId || null, tags: tag ? [tag] : [] };
    update(s => ({ ...s, pages: [page, ...s.pages] })); onOpenPage(page.id);
  };
  const upload = (file?: File) => {
    if (!file) return;
    void act(async () => {
      if (file.size > FILE_LIMIT) throw new Error("Choose a file of 10 MB or less.");
      if (w.attachments.reduce((sum, f) => sum + f.size, 0) + file.size > TOTAL_LIMIT) throw new Error("Workspace attachments are limited to 50 MB.");
      await flush();
      const metadata: Attachment = { id: crypto.randomUUID(), name: file.name, mimeType: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString(), projectId: projectId || null, tags: tag ? [tag] : [] };
      // Validate the prospective metadata before committing any bytes.
      const next = { ...w, attachments: [...w.attachments, metadata] };
      validateWorkspace(next);
      await workspaceStore.putFile(metadata.id, new Uint8Array(await file.arrayBuffer()));
      update(s => ({ ...s, attachments: [...s.attachments, metadata] })); await flush();
      setView("files"); setNotice(`Added ${file.name}`);
    });
  };
  const readBackup = (file?: File) => {
    if (!file) return;
    void act(async () => {
      if (file.size > BACKUP_LIMIT) throw new Error("This backup exceeds the supported size.");
      setIncoming(validateBackup(JSON.parse(await file.text())));
    });
  };
  const confirmRestore = () => { if (!incoming) return; void act(async () => {
    await restore(incoming); setIncoming(null); setClientId(""); setProjectId(""); setTag(""); setQuery(""); setView("notes"); setNotice("Backup restored. Your previous workspace is available under Undo restore.");
  }); };
  return <section className="workspace-view" aria-label="Client workspace">
    <header className="ws-topbar"><span>Workspace <span className="ws-muted">/ {currentClient?.name ?? "Personal & client work"}</span></span><span className="ws-save" role="status"><span className="ws-status-dot" style={{ background: status === "Not saved" ? "#c65b4b" : /^(Saved locally|Restored and saved locally)$/.test(status) ? "#64a185" : "#b99148" }} />{status}</span></header>
    <div className="ws-content">
      <div className="ws-heading"><div><div className="ws-eyebrow"><FolderOpen size={15} /> Your work, connected</div><h1 dir="auto">{currentProject?.name ?? currentClient?.name ?? "Your workspace"}</h1><p>Notes, files and projects. A clear place for every piece of work.</p></div>
        <div className="ws-actions"><button className="ws-button" disabled={busy} onClick={() => { setForm("client"); setName(""); }}><Users size={15} />New client</button><button className="ws-button ws-primary" onClick={createNote}><Plus size={16} />New note</button></div>
      </div>
      <div className="ws-summary"><span><strong>{w.clients.length}</strong> clients</span><span><strong>{w.projects.length}</strong> projects</span><span><strong>{w.pages.filter(p => !p.deletedAt).length}</strong> notes</span><span><strong>{sizeLabel(w.attachments.reduce((n, f) => n + f.size, 0))}</strong> in files</span><span className="ws-storage">{mode}</span></div>
      {(error || notice) && <div className={`ws-message ${error ? "ws-error" : ""}`} role={error ? "alert" : "status"}>{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
      <div className="ws-filters">
        <label className="ws-search"><Search size={17} /><input aria-label="Search workspace" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes, file names or tags…" dir="auto" /><kbd>Search</kbd></label>
        <select aria-label="Filter by client" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(""); }}><option value="">All clients & personal</option>{w.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="Filter by project" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">All projects</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <button className="ws-button" onClick={() => { setForm("project"); setName(""); }}><Plus size={15} />Project</button>
      </div>
      {allTags.length > 0 && <div className="ws-tag-filters"><Tag size={14} /><button className={!tag ? "selected" : ""} onClick={() => setTag("")}>All tags</button>{allTags.map(t => <button dir="auto" key={t} className={tag === t ? "selected" : ""} onClick={() => setTag(tag === t ? "" : t)}>#{t}</button>)}</div>}
      <div className="ws-tabs"><div role="tablist" aria-label="Workspace items">{(["notes", "files", "trash"] as const).map(v => <button role="tab" aria-selected={view === v} key={v} onClick={() => setView(v)}>{v === "notes" ? <FileText size={16} /> : v === "files" ? <Paperclip size={16} /> : <Trash2 size={15} />}{v === "notes" ? "Notes" : v === "files" ? "Files" : "Trash"}</button>)}</div><button className="ws-button" disabled={busy} onClick={() => uploadRef.current?.click()}><Upload size={14} />Add file</button></div>
      <input ref={uploadRef} type="file" aria-label="Upload workspace file" hidden onChange={e => { upload(e.target.files?.[0]); e.target.value = ""; }} />
      <div className="ws-results" aria-live="polite">
        {view !== "files" ? notes.length ? <div className="ws-note-grid">{notes.map(p => <article className="ws-note" key={p.id}>
          <div className="ws-note-top"><span className="ws-note-icon">{p.icon}</span><span className="ws-muted">{w.projects.find(project => project.id === p.projectId)?.name ?? "Personal"}</span></div>
          <button className="ws-note-link" onClick={() => onOpenPage(p.id)}><h2 dir="auto">{p.title || "Untitled note"}</h2><ArrowUpRight size={16} /></button>
          <p dir="auto">{searchableNoteText(p.content).replace(/[#*`>]/g, "").slice(0, 160) || "A fresh page for your next idea."}</p>
          <div className="ws-note-bottom"><div>{(p.tags ?? []).slice(0, 3).map(t => <span className="ws-chip" key={t} dir="auto">#{t}</span>)}</div>{p.deletedAt ? <button className="ws-icon-button" aria-label={`Restore ${p.title}`} onClick={() => update(s => ({ ...s, pages: s.pages.map(n => n.id === p.id ? { ...n, deletedAt: null } : n) }))}><RotateCcw size={15} /></button> : <button className="ws-icon-button" aria-label={`Move ${p.title} to trash`} onClick={() => update(s => ({ ...s, pages: s.pages.map(n => n.id === p.id ? { ...n, deletedAt: new Date().toISOString() } : n) }))}><Trash2 size={15} /></button>}</div>
        </article>)}</div> : <div className="ws-empty"><FileText size={32} /><h2>{view === "trash" ? "Nothing in the trash" : "Make room for your next idea"}</h2><p>{query || tag ? "No matches. Try another search or clear your filters." : view === "trash" ? "Deleted notes can be restored here." : "Create a note, add a client, or organize your first project."}</p>{view === "notes" && <button className="ws-button ws-primary" onClick={createNote}><Plus size={15} />Create a note</button>}</div>
        : files.length ? <div className="ws-file-list">{files.map(f => <article className="ws-file" key={f.id}><div className="ws-file-icon"><Paperclip size={20} /></div><div className="ws-file-info"><strong dir="auto">{f.name}</strong><span>{sizeLabel(f.size)} · {w.projects.find(p => p.id === f.projectId)?.name ?? "Personal"}</span><div>{f.tags.map(t => <span className="ws-chip" key={t}>#{t}</span>)}</div></div><button className="ws-button" onClick={() => { setEditingFile(f); setFileTags(f.tags.join(", ")); }}><Tag size={14} />Organize</button><button className="ws-icon-button" disabled={busy} aria-label={`Download ${f.name}`} onClick={() => void act(async () => { const bytes = await workspaceStore.readFile(f.id); download(new Blob([bytes as BlobPart], { type: "application/octet-stream" }), f.name); })}><Download size={18} /></button></article>)}</div> : <div className="ws-empty"><Paperclip size={32} /><h2>Your files belong with your work</h2><p>Add contracts, briefs, images and references. Up to 10 MB per file, 50 MB total.</p><button className="ws-button" disabled={busy} onClick={() => uploadRef.current?.click()}><Upload size={15} />Choose a file</button></div>}
      </div>
      <footer className="ws-footer"><div><strong>Your data stays yours.</strong><span>Backups include notes, projects, tasks and file contents. API keys are excluded.</span></div><div className="ws-actions"><button className="ws-button" disabled={busy} onClick={() => void act(async () => { await flush(); download(new Blob([await workspaceStore.export()], { type: "application/json" }), `smart-time-backup-${new Date().toISOString().slice(0, 10)}.json`); setNotice("Backup downloaded."); })}><Download size={14} />Back up</button><button className="ws-button" disabled={busy} onClick={() => restoreRef.current?.click()}><Upload size={14} />Restore</button><button className="ws-icon-button" aria-label="Undo last restore" title="Undo last restore" disabled={busy} onClick={() => void act(async () => { const recovery = await workspaceStore.recovery(); if (!recovery) throw new Error("No previous restore to undo."); setIncoming(validateBackup(JSON.parse(recovery))); })}><RotateCcw size={15} /></button></div></footer>
      <input ref={restoreRef} type="file" accept=".json,application/json" aria-label="Choose backup to restore" hidden onChange={e => { readBackup(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
    {(form || incoming || editingFile) && <div className="ws-dialog-backdrop"><div role="dialog" aria-modal="true" aria-labelledby="ws-dialog-title" className="ws-dialog" onKeyDown={e => {
      if (e.key === "Escape" && !busy) { setForm(null); setIncoming(null); setEditingFile(null); }
      if (e.key === "Tab") { const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')); const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }}>
      <h2 id="ws-dialog-title">{incoming ? "Restore this workspace?" : editingFile ? "Organize file" : form === "client" ? "A new client" : "A new project"}</h2>
      {error && <p role="alert">{error}</p>}
      {incoming ? <><p>This replaces your current workspace with {incoming.workspace.pages.length} notes, {incoming.workspace.projects.length} projects and {incoming.files.length} files. A recovery copy of your current workspace will be kept.</p><div className="ws-actions"><button autoFocus className="ws-button" disabled={busy} onClick={() => setIncoming(null)}>Cancel</button><button className="ws-button ws-primary" disabled={busy} onClick={confirmRestore}>{busy ? "Restoring…" : "Restore workspace"}</button></div></>
      : editingFile ? <form onSubmit={e => { e.preventDefault(); try { const tags = parseTags(fileTags); update(s => ({ ...s, attachments: s.attachments.map(f => f.id === editingFile.id ? { ...editingFile, tags } : f) })); setEditingFile(null); } catch (err) { setError(String(err)); } }}><label>File name<input autoFocus required maxLength={150} value={editingFile.name} onChange={e => setEditingFile({ ...editingFile, name: e.target.value })} dir="auto" /></label><label>Project<select value={editingFile.projectId ?? ""} onChange={e => setEditingFile({ ...editingFile, projectId: e.target.value || null, pageId: null })}><option value="">Personal</option>{w.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Tags, separated by commas<input value={fileTags} onChange={e => setFileTags(e.target.value)} dir="auto" /></label><div className="ws-actions"><button className="ws-button" type="button" onClick={() => setEditingFile(null)}>Cancel</button><button className="ws-button ws-primary" type="submit">Save file details</button></div></form>
      : <form onSubmit={e => { e.preventDefault(); create(); }}><p>{form === "client" ? "Keep their projects, notes and files together." : `Organize work for ${currentClient?.name ?? "your personal workspace"}.`}</p><label>{form === "client" ? "Client name" : "Project name"}<input autoFocus required maxLength={75} value={name} onChange={e => setName(e.target.value)} placeholder={form === "client" ? "e.g. Acme Studio" : "e.g. Website redesign"} dir="auto" /></label><div className="ws-actions"><button className="ws-button" type="button" onClick={() => setForm(null)}>Cancel</button><button className="ws-button ws-primary" type="submit">{form === "client" ? "Create client" : "Create project"}</button></div></form>}
    </div></div>}
  </section>;
}
