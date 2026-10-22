import { MTG_COLOR_INFO, MTG_COLOR_ORDER } from "../constants/mtg.js";

function manaCostText(card) {
  if (card?.mana_cost) return card.mana_cost;
  return (card?.card_faces || []).map(face => face.mana_cost || "").join(" ");
}

function countPips(card) {
  const counts = Object.fromEntries(MTG_COLOR_ORDER.map(color => [color, 0]));
  const symbols = manaCostText(card).match(/\{[^}]+\}/g) || [];

  for (const symbol of symbols) {
    for (const color of MTG_COLOR_ORDER) {
      if (symbol.includes(color)) counts[color] += 1;
    }
  }

  return counts;
}

function countSources(card) {
  const counts = Object.fromEntries(MTG_COLOR_ORDER.map(color => [color, 0]));
  for (const color of card?.produced_mana || []) {
    if (color in counts) counts[color] = 1;
  }
  return counts;
}

export function buildManaBaseProfile(analysis) {
  const entries = (analysis?.cardList || []).filter(({ card }) => card);
  if (!entries.length) return null;

  const pips = Object.fromEntries(MTG_COLOR_ORDER.map(color => [color, 0]));
  const sources = Object.fromEntries(MTG_COLOR_ORDER.map(color => [color, 0]));

  for (const { qty, card } of entries) {
    const cardPips = countPips(card);
    const cardSources = countSources(card);
    for (const color of MTG_COLOR_ORDER) {
      pips[color] += cardPips[color] * qty;
      sources[color] += cardSources[color] * qty;
    }
  }

  const totalPips = MTG_COLOR_ORDER.reduce((sum, color) => sum + pips[color], 0);
  if (totalPips === 0) return null;

  // Rough Commander-singleton guidance (loosely following Frank Karsten's mana-source
  // research): a color carrying most of the deck's pips wants ~20 sources, a secondary
  // color wants ~13, and an incidental splash color can get by on ~8.
  const recommendedSources = pipShare => {
    if (pipShare >= 0.4) return 20;
    if (pipShare >= 0.15) return 13;
    return 8;
  };

  const rows = MTG_COLOR_ORDER
    .filter(color => pips[color] > 0 || sources[color] > 0)
    .map(color => {
      const pipShare = totalPips ? pips[color] / totalPips : 0;
      const recommended = recommendedSources(pipShare);
      return {
        key: color,
        label: MTG_COLOR_INFO[color].label,
        hex: MTG_COLOR_INFO[color].hex,
        pips: pips[color],
        sources: sources[color],
        pipShare,
        recommended,
        thin: pips[color] > 0 && sources[color] < recommended,
      };
    });

  return {
    rows,
    totalPips,
    totalSources: MTG_COLOR_ORDER.reduce((sum, color) => sum + sources[color], 0),
    thinColors: rows.filter(row => row.thin).map(row => row.label),
  };
}
