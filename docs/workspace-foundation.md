# Workspace foundation — 2026-10-18

## Approved scope
Personal work and client projects. Keep Tauri/Rust and the existing editor, drawing, timer, calendar and AI. Deliver clients, projects, note/file tags, filtering, persistent storage and portable backup/restore before introducing a block editor or collaboration.

## Design
Rust owns a SQLite database in the application data directory. A versioned workspace document is saved transactionally with optimistic revision checks. File bytes live in a separate SQLite table, addressed only by generated IDs; user filenames never become filesystem paths. Browser preview uses IndexedDB and clearly identifies its storage mode. Both adapters expose the same interface. Files are capped at 10 MiB each and 50 MiB total. Portable backups include file bytes and exclude AI credentials. Restore validates structure, relationships and sizes before replacing anything, and preserves the previous workspace as a recovery backup.

Legacy `st_pages` and `st_tasks` are imported only when the new store is empty, validated before writing, and retained unchanged as recovery copies. Failed reads must never produce a writable empty workspace. Autosaves are serialized; errors remain visible with a retry action. A stale revision cannot overwrite another window's changes.

Desktop close requests flush queued changes before closing; failed saves keep the window open. Backup creation uses a consistent database snapshot; restore and recovery are committed together under a write transaction. The 256 MiB portable backup limit accommodates JSON byte-array expansion of the attachment budget.

Notes and file metadata share tags, project ownership and search filters. Personal notes may have no project. Projects optionally belong to a client. Permanent deletion is outside this slice; existing page deletion becomes recoverable trash. Secrets are session-only in this slice and removed from the legacy AI configuration after reading; a native credential vault is a separate deliverable. AI workspace retrieval defaults off and excludes deleted notes. No PDF extraction, semantic embeddings, block editor, collaboration, or performance claims are included.

## Execution and verification
1. Add storage contract tests for invalid/dangling records, legacy migration, stale writes and portable recovery.
2. Implement Rust SQLite storage and attachment operations; prove persistence and revision checks with isolated temporary databases.
3. Implement the browser adapter, serialized persistence hook and backup validation.
4. Add the client/project workspace, searchable notes/files, metadata editor and trash/restore.
5. Integrate with existing pages/tasks; repair duplicate timer display and disable unsafe AI HTTP fallback on native errors.
6. Run Rust tests, TypeScript/build checks and browser flows: client → project → note → tags → file → reload → backup → restore; verify malformed backups leave existing data intact.

## Verification record

- Six Rust storage integration tests: validation, atomic stale-write rejection, attachment bytes, invalid restore preservation, recovery round-trip, and reopening a database.
- Six Node tests: invalid references/IDs, Arabic tags, backup byte validation, client filters, malformed legacy input, and local calendar dates.
- Browser main flow: client/project creation, note tags, note file upload, reload persistence, filters, file tags, exported byte contents, trash recovery, restore and invalid backup rejection.
- Browser edge flow: legacy migration and source retention, non-persistence of credentials, stale-tab protection and damaged legacy input preservation.
- Desktop executable built with bundled frontend, launched independently, and inspected with REA: SQLite mode and saved state observed. External model inference is not part of these tests.
- Desktop close was exercised on the built executable after correcting the explicit destroy permission; the application exited successfully after the close handler completed.

## Review availability
Kluster automatic review and dependency validation are unavailable in this session. No claim of Kluster verification may be made. Perform direct review and report this limitation separately from executed tests.
