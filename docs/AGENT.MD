# Task: Sätt upp CI/CD för Kattskrälle (Chrome + Firefox)

## Mål
Automatisera bygg/test/packetering för ett webbläsartillägg. Två builds (Chrome + Firefox). CI på PR, CD på tags.

## CI (workflow: `.github/workflows/ci.yml`)
Trigger:
- `pull_request` mot `main`
- `push` till `WIP`

Steg:
1) Checkout
2) Setup Node (LTS) + cache (npm/pnpm/yarn beroende på repo)
3) Install deps (låst via lockfile)
4) Lint (eslint) + format-check (prettier --check)
5) Typecheck (`tsc --noEmit`)
6) Build:
   - `dist/chrome`
   - `dist/firefox`
7) Sanity check (script) som verifierar:
   - `dist/chrome/manifest.json` finns
   - `dist/firefox/manifest.json` finns
   - bundlad content script entry finns (enligt manifest)
8) Upload artifacts:
   - `kattskrälle-chrome-dev.zip` (från dist/chrome)
   - `kattskrälle-firefox-dev.zip` (från dist/firefox)

## CD (workflow: `.github/workflows/release.yml`)
Trigger:
- `push` på tags `v*.*.*`

Steg:
1) Checkout
2) Setup Node + install deps
3) Sätt version = tag (t.ex. `v0.1.0` -> `0.1.0`) i:
   - `dist/chrome/manifest.json`
   - `dist/firefox/manifest.json`
   (alternativt i source manifests innan build, beroende på build-pipeline)
4) Build båda targets
5) Paketera:
   - `kattskrälle-chrome-<version>.zip`
   - `kattskrälle-firefox-<version>.zip`
6) Skapa GitHub Release och attach zips
7) Skriv release notes från CHANGELOG.md om den finns, annars auto.

## Noteringar / constraints
- Inga store-uploads (Chrome Web Store / AMO) i första vändan.
- Allt ska funka utan hemligheter (inga secrets krävs för CI).
- Lås node-version i workflow (t.ex. 20.x) och använd cache.

## Definition of Done
- CI kör på PR till main och på push till WIP, och laddar upp zip-artifacts
- Release-workflow kör på tag och skapar GitHub Release med två zip-filer
- Sanity check failar om någon dist saknas eller manifest är trasigt
