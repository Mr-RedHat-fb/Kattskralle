# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` wires the MV3 extension: it hooks `content.js` into Flashback threads, loads `service-worker.js`, and points the popup at `index.html`/`style.css`.
- Feature logic lives in `content.js` (thread UI tweaks) and shared helpers in `main.js`, while assets sit under `icons/` and `images/`; keep additions close to these files rather than introducing extra directories.

## Build, Test, and Development Commands
- `chrome://extensions` (or `google-chrome --load-extension=/srv/app/Kattskralle`) reloads the unpacked extension—refresh the Flashback tab to exercise the new code.
- `git status`/`git diff` are the main verification steps before committing; use `git log --oneline` to mimic the concise existing commit phrasing.
- There is no build or test tooling; reload Chrome to run and bump `manifest.json`’s `version` for releases.

## Coding Style & Naming Conventions
- JavaScript follows `camelCase` identifiers, explicit `const`/`let`, semicolons, and 4-space indentation as shown in `content.js`; keep helpers focused and descriptive (e.g., `tryTriggerForwardLoad`, `applySettings`).
- CSS uses ID/class selectors (`#ignoreraListan`, `.header-flex`) with the current brace/spacing style; align new selectors with the compact popup layout.
- Preserve the Swedish/English README sections and add new screenshots under `images/` when UI changes occur.

## Testing Guidelines
- Manual testing is the norm: load the extension, toggle popup settings, and browse Flashback threads to verify ignore lists, infinite scroll, thread chat, drafts, and previews.
- Document steps and outcomes in the README or PR description when user-facing behavior changes so reviewers can reproduce them.
- Use Chrome’s dev tools to watch `service-worker.js` console output when tracking background behavior.

## Commit & Pull Request Guidelines
- Keep commits short and descriptive (e.g., “Update README…”); explain the changes in PR descriptions.
- Link related issues when relevant, list manual verification steps, and attach screenshots for UI tweaks.
- Call out touched settings or permissions so reviewers know what to test.

## Security & Configuration Tips
- Keep permissions limited to `storage`, `activeTab`, and `scripting` unless new functionality absolutely requires another scope.
- Use the `chrome.storage` helpers that persist defaults (`ensureDefaultSettings`) and avoid storing extra personal data beyond the ignore list.
