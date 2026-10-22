const SHARE_PARAM = "d";
const RECENT_KEY = "oracle-recent-decks";
const RECENT_LIMIT = 10;

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeDeckPayload({ inputText, commanderName, importFormat }) {
  const json = JSON.stringify({ t: inputText || "", c: commanderName || "", f: importFormat || "plain" });
  return toBase64Url(json);
}

export function decodeDeckPayload(encoded) {
  try {
    const data = JSON.parse(fromBase64Url(encoded));
    if (typeof data.t !== "string" || !data.t.trim()) return null;
    return { inputText: data.t, commanderName: data.c || "", importFormat: data.f || "plain" };
  } catch {
    return null;
  }
}

export function buildShareUrl(payload) {
  if (typeof window === "undefined") return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set(SHARE_PARAM, encodeDeckPayload(payload));
  return url.toString();
}

export function readDeckPayloadFromUrl() {
  if (typeof window === "undefined") return null;
  const encoded = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  if (!encoded) return null;
  return decodeDeckPayload(encoded);
}

function deckLabel({ inputText, commanderName }) {
  if (commanderName?.trim()) return commanderName.trim();
  const firstLine = (inputText || "").split("\n").map(line => line.trim()).find(Boolean) || "Untitled deck";
  return firstLine.replace(/^\d+\s*x?\s*/i, "");
}

export function loadRecentDecks() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentDeck({ inputText, commanderName, importFormat, cardCount }) {
  if (typeof window === "undefined" || !inputText?.trim()) return;
  try {
    const existing = loadRecentDecks().filter(entry => entry.inputText !== inputText);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: deckLabel({ inputText, commanderName }),
      inputText,
      commanderName: commanderName || "",
      importFormat: importFormat || "plain",
      cardCount: cardCount || 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...existing].slice(0, RECENT_LIMIT)));
  } catch {
    // localStorage can be unavailable in some private/sandboxed contexts.
  }
}

export function removeRecentDeck(id) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(loadRecentDecks().filter(entry => entry.id !== id)));
  } catch {
    // ignore
  }
}

export function clearRecentDecks() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}
