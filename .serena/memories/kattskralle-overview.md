# Kattskrälle Overview
- **Purpose**: A Chrome/Chromium extension that brings QoL features to Flashback forums (ignore users, infinite scroll, thread chat, link search, previews, drafts, TS highlighting, etc.).
- **Tech stack**: Manifest v3 Chrome extension using plain JavaScript (`content.js`, `main.js`, `service-worker.js`), a single HTML popup (`index.html`), companion CSS (`style.css`), and assets under `icons/` and `images/`.
- **Structure cues**: Content script injects into Flashback threads (`content.js`), background logic lives in the service worker, UI+settings live in the popup and CSS; assets and documentation (screenshots) sit in `icons/` and `images/`.
- **Permissions**: Uses Chrome permissions `storage`, `activeTab`, and `scripting` per `manifest.json`, so contributors should be mindful adding new permissions.
