import { getLookupNames, normalizeCardName } from "../utils/cardUtils.js";

function mapCardAliases(map, card, aliases = []) {
  if (!card) return;

  const names = [
    card.name,
    ...aliases,
    ...(card.card_faces || []).map(face => face.name),
  ];

  names.filter(Boolean).forEach(name => {
    map[normalizeCardName(name)] = card;
  });
}

function toLookupEntry(entry) {
  if (typeof entry === "string") return { name: entry };
  return entry || {};
}

function identifierKey(identifier) {
  return JSON.stringify(identifier);
}

function buildIdentifiers(entries) {
  const identifiers = [];
  const seen = new Set();

  for (const rawEntry of entries) {
    const entry = toLookupEntry(rawEntry);
    const names = getLookupNames(entry.name || "").filter(Boolean);

    if (entry.setCode && entry.collectorNumber) {
      const identifier = {
        set: entry.setCode.toLowerCase(),
        collector_number: String(entry.collectorNumber),
      };
      const key = identifierKey(identifier);
      if (!seen.has(key)) {
        identifiers.push(identifier);
        seen.add(key);
      }
      continue;
    }

    for (const name of names) {
      const identifier = { name };
      const key = identifierKey(identifier);
      if (!seen.has(key)) {
        identifiers.push(identifier);
        seen.add(key);
      }
    }
  }

  return identifiers;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withScryfallHeaders(options = {}) {
  const headers = { ...(options.headers || {}) };

  if (typeof window === "undefined") {
    headers["User-Agent"] = "TheOracleDeckHelper/0.1";
    headers.Accept = "application/json";
  }

  return { ...options, headers };
}

async function fetchWithRetry(url, options, retries = 2) {
  const requestOptions = withScryfallHeaders(options);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, requestOptions);
    if (res.ok || ![429, 500, 502, 503, 504].includes(res.status) || attempt === retries) return res;
    await wait(400 * (attempt + 1));
  }
  return fetch(url, requestOptions);
}

export async function fetchCardsFromScryfall(entries) {
  const identifiers = buildIdentifiers(entries);
  const map = {};

  for (let i = 0; i < identifiers.length; i += 75) {
    const batch = identifiers.slice(i, i + 75);
    const res = await fetchWithRetry("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers: batch }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Scryfall lookup failed: ${res.status}${body ? ` ${body.slice(0, 240)}` : ""}`);
    }
    const data = await res.json();

    (data.data || []).forEach(card => {
      mapCardAliases(map, card);
    });
  }

  const fallbackNames = [...new Set(entries.flatMap(entry => getLookupNames(toLookupEntry(entry).name || "")))].filter(Boolean);
  const missing = fallbackNames.filter(name => !map[normalizeCardName(name)]);
  for (const name of missing) {
    const res = await fetchWithRetry(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    if (!res.ok) continue;

    const card = await res.json();
    mapCardAliases(map, card, getLookupNames(name));
  }

  return map;
}
