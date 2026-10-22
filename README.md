# The Oracle — MTG Deck Analyzer

Unofficial Magic: The Gathering deck analyzer and Commander assistant powered by Scryfall card data.

## What is included

- Landing screen
- Decklist parser
- Scryfall batch card lookup
- Mana curve chart
- Pips vs sources chart, with a recommended source threshold per color
- Color identity chart
- Card type breakdown
- Estimated USD price
- Commander legality checker
- Commander deck-building assistant tab, with archetype, win-plan, and role-coverage reads
- Live Commander Spellbook combo lookup, including "one card away" near-miss combos
- Local bracket estimate and a predicted win-turn readout
- Searchable, section-jumpable decklist preview
- Shareable decklist links and a recent-decks history (stored locally in your browser)
- Card image previews on hover

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite gives you, usually `http://localhost:5173`.

## Build for hosting

```bash
npm run build
```

The production build will be created in the `dist` folder.

## Deploy to AWS Amplify

1. Push this project to GitHub.
2. Open AWS Amplify.
3. Choose **Deploy an app**.
4. Connect your GitHub repo.
5. Use these default build settings:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

## Fan content note

This website is unofficial Fan Content. It is not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. Card data, images, prices, and legality information are provided by Scryfall. Combo data is provided by Commander Spellbook.
