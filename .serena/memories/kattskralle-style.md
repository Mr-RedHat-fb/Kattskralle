# Kattskrälle Style & Conventions
- **JavaScript**: follow the existing pattern of `camelCase` identifiers, explicit `let/const`, semicolons, and 4-space indentation seen in `content.js`. Break long helper blocks into named functions (e.g., `tryTriggerForwardLoad`, `loadSettings`).
- **CSS/HTML**: keep the minimalist popup structure from `index.html` and the compact selectors in `style.css`; use short class names (e.g., `header-flex`, `ignoreraListan`) and avoid adding preprocessing layers.
- **Manifest bumps**: when shipping new functionality bump `manifest.json` `version` field to reflect releases (previous commits used 1.x increments).
- **Documentation**: add matching screenshot assets to `images/` and icons under `icons/` when new UI assets are required; keep README bilingual sections tidy.
