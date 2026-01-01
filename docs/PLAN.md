# Kattskrälle – strukturerad planering

## Mål
- Gemensam kodbas för Chrome + Firefox (MV3).
- Modulindelning som separerar content, UI och bakgrund.
- Byggsteg som skapar `dist/chrome` och `dist/firefox`.

## Icke-mål (nu)
- Portera befintliga features.
- Ny design av UI.
- Automatiska tester.

## Milstolpar
### 0. Init (WIP)
- Skapa struktur, manifest per browser och minimal content script.
- Dokumentera porting-strategi och fallback för Firefox SW.

### 1. Grundläggande infrastruktur
- Grundläggande build-flöde och versionering per manifest.
- Gemensamma helpers för storage och messaging.

### 2. Settings + options UI
- Bas-UI i `src/ui/options`.
- Default settings och persistering i storage.

### 3. Featureportering (stegvis)
- Flytta funktioner från gamla `content.js` till `content/features`.
- En feature per fil, styrs av settings.
- Lägg till manuella teststeg per feature.

### 4. QA + release
- Manuell testplan för Chrome + Firefox.
- Release-checklista med versionsbump och changelog.

## Arkitekturprinciper
- `content/core` innehåller delade DOM- och event-helpers.
- `content/features` innehåller isolerade feature-moduler.
- `ui/options` hanterar settings och UI.
- `background` hanterar eventuella bakgrundsflöden och messaging.

## Portingstrategi
- Inventera nuvarande features och gruppera efter beroenden.
- Portera i små inkrement, aktivera med feature flags.
- Dokumentera eventuella skillnader mellan Chrome och Firefox.

## Risker & beslutspunkter
- Firefox MV3 service worker-stabilitet.
- Storage API-skillnader och permissions.
- Prestanda vid stora trådar på Flashback.

## Definition av klart
- Build genererar `dist/chrome` och `dist/firefox` med manifest + content script.
- Extension laddar i båda browsers och loggar på flashback.org.
- Porting.md innehåller status och fallback-anteckningar.
