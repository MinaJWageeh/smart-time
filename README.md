# Smart Time

A local desktop workspace for personal work and client projects, built with Rust, Tauri 2, React and TypeScript.

## Available now

- Clients and projects; notes and files assigned to projects.
- Shared tags, note-content/file-name search, client/project/tag filters.
- File uploads and downloads (10 MiB per file, 50 MiB total).
- Recoverable note trash.
- Transactional SQLite on desktop; IndexedDB for browser preview. Their data is separate.
- Legacy st_pages/st_tasks migration only into an empty store. Sources are retained, and damaged data blocks initialization.
- Portable JSON backups with file contents, validated restore and one recovery copy under Undo last restore.
- Existing Markdown editor, drawing board, calendar, focus stopwatch and AI assistant.

## AI and privacy

Ollama, LM Studio and Jan connect to local servers. OpenAI and Gemini are optional cloud providers; Gemini requires desktop mode. AI keys stay in memory for the session and are excluded from saved settings/backups. A native credential vault is future work.

Workspace retrieval defaults off; the side copilot receives the active note explicitly. Desktop retrieval uses Ollama's `all-minilm` embeddings with chunked semantic search and an in-memory cache that refreshes when note content changes. If Ollama or the embedding model is unavailable, browser preview falls back to keyword search. Native AI errors no longer retry through browser HTTP. Remote fonts were removed, and desktop CSP restricts external resources. Workspace data is not encrypted at rest.

## Run and build

From the project directory:

```powershell
npm run tauri dev
# Browser preview:
npm run dev
# Desktop executable, without an installer:
npm run tauri build -- --debug --no-bundle
```

Windows debug executable: src-tauri/target/debug/smart-time.exe. A normal release/installer build uses npm run tauri build.

## Verify

Use Node 22.18+ or another current version supporting TypeScript stripping:

```powershell
node --experimental-strip-types --test tests/workspace.test.mjs
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Rust storage tests run through src-tauri/tests/workspace_storage.rs. GUI library/binary test harnesses are disabled so storage tests do not require loading the windowing runtime.

With the preview running and Playwright CLI available:

```powershell
playwright-cli -s=workspace-test open http://127.0.0.1:1420 --browser chrome
playwright-cli -s=workspace-test run-code --filename tests/workspace-browser.js
playwright-cli -s=workspace-test run-code --filename tests/workspace-edge-browser.js
playwright-cli -s=workspace-test close
```

These flows use synthetic clients/files to cover persistence, attachments, backup contents, restore, trash recovery, malformed imports, legacy migration and stale-tab protection.

## Current boundaries

Attachment search covers names and tags. File-content extraction, PDF preview, semantic search, block editing, relational databases, synchronization and collaboration are later work. Restore requires confirmation and replaces the current workspace, keeping one recovery copy.

Design: [workspace foundation](docs/workspace-foundation.md). Earlier notes: [SMART_TIME_SPECS.md](SMART_TIME_SPECS.md).

Kluster tools were unavailable during this implementation. Tests and direct review must not be described as Kluster verification.
