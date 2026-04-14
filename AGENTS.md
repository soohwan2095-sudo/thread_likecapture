# AGENTS.md

## Project

- Name: `content-summary-analyzer`
- Stack: Tauri 2 + Rust backend + React 18 + TypeScript + Vite
- Purpose: local desktop app that scans `pdf/png/jpg/jpeg` files from a source folder, runs Gemini-based summary/analysis or demo mode, then saves result PDF + Markdown + JSON metadata into a local archive folder.

## Runtime shape

- `startup.bat` calls `scripts/startup.ps1`
- `scripts/startup.ps1` starts a single Tauri executable:
  - `src-tauri\target\debug\content-summary-analyzer.exe`
- There is no separate long-running backend server outside the Tauri app process.
- Closing the Tauri app closes the Rust backend with it.

## Important folders

- `app/`: React frontend
- `src-tauri/`: Rust backend and Tauri commands
- `data/source-files/`: default input folder
- `data/archive/`: generated outputs
- `docs/`: user docs and Playwright screenshots

## Current UI direction

The UI was simplified away from the previous multi-card dashboard.

Current primary workflow:

1. Enter Gemini API key
2. Run conversion for one file
3. Run conversion for the whole folder
4. Open source/output files
5. Delete DB history so a file can be converted again
6. Quit the app explicitly from the UI

## Recent changes made

### Frontend

- Replaced the previous complex card-heavy screen with a single simplified workbench UI in `app/src/app/App.tsx`
- Added:
  - `Gemini API Key` input
  - `폴더 전체 변환`
  - file-row level `변환`
  - file-row level `다시변환`
  - `결과열기`
  - `원본열기`
  - `이력삭제`
  - `프로그램 종료`
- Kept only a small `고급 설정` section for source folder, archive folder, categories, and model
- Rewrote styles in `app/src/app/App.css` to match the simplified UI

### Backend

- Added DB history delete support:
  - `delete_job_history` Tauri command
  - `Database::delete_job_history`
- Added app quit support:
  - `quit_app` Tauri command
  - uses `app.exit(0)`

### Dependency fix

- Added `@pdf-lib/fontkit` to `package.json` and `package-lock.json`
- Reason: it was being used by the PDF generation code but was not pinned as a real dependency, which caused build failure after npm reinstall/update activity.

## Files changed in this work

- `app/src/app/App.tsx`
- `app/src/app/App.css`
- `app/src/lib/api.ts`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/main.rs`
- `src-tauri/src/storage/mod.rs`
- `package.json`
- `package-lock.json`

Supporting documents/screenshots added:

- `프로젝트_상세_분석.md`
- `UI_간소화_개선_요구사항.md`
- `docs/ui-simplified-playwright.png`
- `docs/ui-simplified-playwright-functional.png`

## Verified state

Build/runtime checks completed:

- `npm run build` -> passed
- `cargo check --manifest-path src-tauri\Cargo.toml` -> passed

Playwright UI checks completed with mocked Tauri invoke layer:

- API key input rendered
- single-file conversion button path triggered
- whole-folder conversion button path triggered
- open-path buttons triggered
- delete-history flow triggered
- quit-app flow triggered

Screenshots saved in `docs/`.

## Notes for next agent

- Browser-only Vite runs do not have real Tauri `invoke`; Playwright verification used a mocked `window.__TAURI_INTERNALS__.invoke`.
- Real backend integration should be tested by launching the Tauri app, not only by opening the Vite page in a browser.
- JS bundle is still large because of PDF-related code; Vite warns about chunk size, but builds are currently successful.
