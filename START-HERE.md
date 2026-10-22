# The Oracle - Start Here

This archive contains The Oracle React/Vite application source and project configuration, packaged on October 22, 2026.

## Run locally

1. Install a current Node.js LTS release with npm if needed.
2. Extract the archive and open a terminal inside the `mtg-oracle` folder.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL printed by Vite.

An internet connection is needed for Scryfall card data, card images, and Commander Spellbook combo lookup.

## Included

- `src/`: React components, deck parsing, analysis, archetypes, card roles, mana-base analysis, themes, and external API clients.
- `api/`: the Commander Spellbook serverless proxy used by the production app.
- `scripts/`: local development helpers and validation scripts.
- Package manifest and lockfile, HTML entry point, Vite configuration, hosting configuration, README, and project proposal.

## Build and check

```text
npm run build
npm run check:roles
npm run check:win-plans
npm run check:bracket
```

The production build is written to `dist/`. Production combo lookup calls `/api/spellbook-combos`, so the host must run the included serverless API handler. Serving only the static build does not provide that API endpoint.

Installed dependencies, generated builds, caches, logs, deployment account settings, editor/assistant settings, previous zip files, and separate presentation/artwork materials are excluded. `npm install` restores the dependencies.

See `README.md` for additional project information.
