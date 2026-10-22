import { MTG_COLOR_IDENTITY_NAMES, MTG_COLOR_INFO, MTG_COLOR_ORDER } from "../constants/mtg.js";

export function normalizeCardName(name = "") {
  return name
    .replace(/^SB:\s*/i, "")
    .replace(/\s+\([A-Z0-9]{2,6}\)(?:\s+[A-Z0-9\-★]+)?.*$/i, "")
    .replace(/\s+\[[A-Z0-9]{2,6}#?[A-Z0-9\-★]*\].*$/i, "")
    .replace(/\s+\d+\s*$/i, "")
    .trim()
    .toLowerCase();
}

export function getLookupNames(name = "") {
  const trimmed = name.trim();
  if (!trimmed.includes("//")) return [trimmed];

  return [
    trimmed,
    ...trimmed.split("//").map(face => face.trim()).filter(Boolean),
  ];
}

export function getCardType(typeLine = "") {
  for (const type of ["Land", "Creature", "Planeswalker", "Instant", "Sorcery", "Enchantment", "Artifact", "Battle"]) {
    if (typeLine.includes(type)) return type;
  }
  return "Other";
}

export function getOracleText(card) {
  if (!card) return "";
  if (card.oracle_text) return card.oracle_text;
  if (card.card_faces?.length) return card.card_faces.map(face => face.oracle_text || "").join("\n");
  return "";
}

function shouldProxyScryfallImages() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function localScryfallImageUrl(url) {
  if (!url || !shouldProxyScryfallImages()) return url;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "cards.scryfall.io") return url;
    return `/scryfall-card-image${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function getCardImage(card, size = "normal") {
  if (!card) return null;
  if (card.image_uris?.[size]) return localScryfallImageUrl(card.image_uris[size]);
  if (card.card_faces?.[0]?.image_uris?.[size]) return localScryfallImageUrl(card.card_faces[0].image_uris[size]);
  return null;
}

export function getCardColors(card) {
  return card?.color_identity || [];
}

export function isBasicLand(card) {
  return card?.type_line?.includes("Basic Land");
}

export function allowsExtraCopies(card) {
  const text = getOracleText(card).toLowerCase();
  return (
    text.includes("a deck can have any number of cards named") ||
    text.includes("a deck can have up to seven cards named") ||
    text.includes("a deck can have up to nine cards named")
  );
}

export function isSubset(colors = [], allowed = []) {
  return colors.every(color => allowed.includes(color));
}

export function sortColorIdentity(colors = []) {
  return [...new Set(colors)].sort((a, b) => MTG_COLOR_ORDER.indexOf(a) - MTG_COLOR_ORDER.indexOf(b));
}

export function colorPips(colors = []) {
  const sorted = sortColorIdentity(colors);
  if (!sorted.length) return "C";
  return sorted.join("");
}

export function formatColorIdentity(colors = []) {
  const shorthand = colorPips(colors);
  const identityName = MTG_COLOR_IDENTITY_NAMES[shorthand];
  if (shorthand === "C") return `${identityName} (C)`;

  const names = sortColorIdentity(colors).map(color => MTG_COLOR_INFO[color]?.label || color);
  if (identityName === shorthand) return `${identityName} (${names.join(" / ")})`;
  return identityName
    ? `${identityName} (${names.join(" / ")}, ${shorthand})`
    : `${names.join(" / ")} (${shorthand})`;
}
