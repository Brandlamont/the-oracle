import { normalizeCardName } from "../utils/cardUtils.js";

// Commander Spellbook's API only allows CORS from an allowlist of origins (their own
// site plus localhost for local dev), so it works when called directly from the Vite
// dev server but gets silently blocked by the browser on any deployed domain. In
// production, route through our own /api/spellbook-combos serverless proxy instead,
// which calls Spellbook server-to-server where CORS doesn't apply.
const FIND_MY_COMBOS_URL = import.meta.env.DEV
  ? "https://backend.commanderspellbook.com/find-my-combos?groupByCombo=true"
  : "/api/spellbook-combos";

function buildNameMap(analysis) {
  const map = new Map();
  for (const entry of analysis?.cardList || []) {
    if (!entry?.card?.name) continue;
    map.set(normalizeCardName(entry.card.name), entry);
  }
  return map;
}

function toDeckCard(entry) {
  return { card: entry.card.name, quantity: Math.max(1, entry.qty || 1) };
}

function buildDeckPayload(analysis) {
  const main = [];
  const commanders = [];

  for (const entry of analysis?.cardList || []) {
    if (!entry?.card?.name) continue;
    if (entry.role === "commander") commanders.push(toDeckCard(entry));
    else main.push(toDeckCard(entry));
  }

  return { main, commanders };
}

function resolveCombo(variant, nameMap, { allowMissing = false } = {}) {
  const cards = [];
  const missingNames = [];

  for (const use of variant.uses || []) {
    const entry = nameMap.get(normalizeCardName(use.card?.name || ""));
    if (entry) {
      cards.push({ qty: entry.qty, card: entry.card });
    } else if (allowMissing) {
      missingNames.push(use.card?.name || "Unknown card");
    } else {
      return null;
    }
  }

  if (!cards.length) return null;
  if (allowMissing && !missingNames.length) return null;

  return {
    id: variant.id,
    cards,
    missingNames,
    producesNames: (variant.produces || []).map(p => p.feature?.name).filter(Boolean),
    description: variant.description || "",
    notablePrerequisites: variant.notablePrerequisites || "",
    easyPrerequisites: variant.easyPrerequisites || "",
    popularity: variant.popularity || 0,
    prices: variant.prices || null,
    url: `https://commanderspellbook.com/combo/${variant.id}/`,
  };
}

function resolveComboList(variants, nameMap, options) {
  return (variants || [])
    .map(variant => resolveCombo(variant, nameMap, options))
    .filter(Boolean);
}

export async function fetchSpellbookCombos(analysis, { signal } = {}) {
  const payload = buildDeckPayload(analysis);
  if (!payload.main.length && !payload.commanders.length) return null;

  let res;
  try {
    res = await fetch(FIND_MY_COMBOS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const results = json?.results;
  if (!results) return null;

  const nameMap = buildNameMap(analysis);

  return {
    identity: results.identity || "",
    included: resolveComboList(results.included, nameMap),
    almostIncluded: resolveComboList(results.almostIncluded, nameMap, { allowMissing: true }),
  };
}
