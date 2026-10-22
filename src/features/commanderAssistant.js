import { COMMANDER_CATEGORY_TARGETS } from "../constants/mtg.js";
import { classifyCommanderRole } from "./cardRoles.js";
import { DANGER, SUCCESS, WARN } from "../styles/theme.js";
import { getCardColors, sortColorIdentity } from "../utils/cardUtils.js";

function slugifyEdhrecName(name = "") {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getEdhrecCardUrl(card) {
  const slug = slugifyEdhrecName(card?.name || "");
  return slug ? `https://edhrec.com/cards/${slug}` : "https://edhrec.com/cards";
}

export function getEdhrecCommanderUrl(commanderCard) {
  const slug = slugifyEdhrecName(commanderCard?.name || "");
  return slug ? `https://edhrec.com/commanders/${slug}` : "https://edhrec.com/commanders";
}

export function getEdhrecRecsUrl() {
  return "https://edhrec.com/recs";
}

function getCommanderFilter(commanderCard) {
  const ci = sortColorIdentity(getCardColors(commanderCard)).join("").toLowerCase();
  return commanderCard ? `commander:${ci || "c"}` : "format:commander";
}

export function getScryfallQueryForCategory(categoryKey, commanderCard) {
  const commanderFilter = getCommanderFilter(commanderCard);
  const queries = {
    "Ramp": `${commanderFilter} format:commander (oracle:"add {" or oracle:"add one mana" or oracle:"create a treasure" or oracle:"treasure token" or (oracle:"search your library" oracle:"land card") or oracle:"play an additional land" or oracle:"spells you cast cost" or name:"Sol Ring" or name:"Arcane Signet") -type:land -oracle:"its controller may search" -oracle:"that player may search" -oracle:"target player may search"`,
    "Card Draw": `${commanderFilter} format:commander (oracle:"draw a card" or oracle:"draw cards" or oracle:"draw two cards" or oracle:investigate or oracle:clue) -type:land -oracle:add -oracle:"search your library"`,
    "Targeted Removal": `${commanderFilter} format:commander (oracle:"destroy target creature" or oracle:"destroy target artifact" or oracle:"destroy target enchantment" or oracle:"destroy target permanent" or oracle:"exile target creature" or oracle:"exile target artifact" or oracle:"exile target enchantment" or oracle:"exile target permanent" or oracle:"counter target spell" or oracle:"counter target activated" or oracle:"counter target triggered" or oracle:"return target creature" or oracle:"return target nonland permanent" or oracle:"damage to any target" or oracle:"damage to target creature" or oracle:"target opponent sacrifices") -oracle:"from your graveyard" -oracle:"from a graveyard"`,
    "Board Wipes": `${commanderFilter} format:commander (oracle:"destroy all creatures" or oracle:"exile all creatures" or oracle:"destroy all artifacts" or oracle:"exile all artifacts" or oracle:"destroy all enchantments" or oracle:"exile all enchantments" or oracle:"destroy all nonland permanents" or oracle:"each creature gets -" or oracle:"damage to each creature" or oracle:"each player sacrifices")`,
    "Protection": `${commanderFilter} format:commander (oracle:hexproof or oracle:indestructible or oracle:"phase out" or oracle:"protection from" or oracle:"can't be countered")`,
    "Graveyard Recursion": `${commanderFilter} format:commander (oracle:"from your graveyard to your hand" or oracle:"from your graveyard to the battlefield" or oracle:"from your graveyard onto the battlefield" or oracle:"cast target instant or sorcery card from your graveyard" or oracle:"you may play lands from your graveyard" or oracle:flashback or oracle:escape)`,
    "Win Conditions": `${commanderFilter} format:commander (oracle:"you win the game" or oracle:"each opponent loses" or oracle:"deals damage to each opponent" or oracle:"whenever" oracle:"each opponent" or oracle:"create" oracle:"token" oracle:"for each") -type:land`,
    "Lands": `${commanderFilter} format:commander type:land -type:basic`,
  };

  return queries[categoryKey] || `${commanderFilter} format:commander`;
}

export function getCommanderUrlForCategory(categoryKey, commanderCard) {
  const base = "https://scryfall.com/search?q=";
  return `${base}${encodeURIComponent(`${getScryfallQueryForCategory(categoryKey, commanderCard)} order:edhrec`)}`;
}

export async function fetchCommanderCategorySuggestions(analysis, categoryKey, limit = 4) {
  if (!analysis?.commanderCard) return [];

  const query = getScryfallQueryForCategory(categoryKey, analysis.commanderCard);
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=edhrec`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Suggestion lookup failed: ${res.status}`);

  const data = await res.json();
  const deckNames = new Set([
    ...(analysis.cardList || []).map(({ card }) => card?.name),
    ...(analysis.sideboardCardList || []).map(({ card }) => card?.name),
  ].filter(Boolean).map(name => name.toLowerCase()));

  return (data.data || [])
    .filter(card => !deckNames.has(card.name.toLowerCase()))
    .slice(0, limit);
}

export function buildCommanderAssistant(analysis) {
  if (!analysis?.cardList?.length) return null;

  const counts = Object.fromEntries(COMMANDER_CATEGORY_TARGETS.map(category => [category.key, 0]));
  const examples = Object.fromEntries(COMMANDER_CATEGORY_TARGETS.map(category => [category.key, []]));

  for (const { qty, card } of analysis.cardList) {
    const roles = classifyCommanderRole(card);
    roles.forEach(role => {
      counts[role] += qty;
      if (examples[role].length < 5) examples[role].push({ qty, card });
    });
  }

  return COMMANDER_CATEGORY_TARGETS.map(category => {
    const count = counts[category.key] || 0;
    let status = "Needs attention";
    let tone = DANGER;
    if (category.optional && count === 0) { status = "Contextual"; tone = WARN; }
    else if (count >= category.good) { status = "Strong"; tone = SUCCESS; }
    else if (count >= category.min) { status = category.optional ? "Present" : "Playable"; tone = WARN; }

    return {
      ...category,
      count,
      status,
      tone,
      examples: examples[category.key] || [],
      searchUrl: getCommanderUrlForCategory(category.key, analysis.commanderCard),
      edhrecCommanderUrl: getEdhrecCommanderUrl(analysis.commanderCard),
      edhrecRecsUrl: getEdhrecRecsUrl(),
      wantsSuggestions: count < category.min,
    };
  });
}
