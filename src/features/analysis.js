import { MTG_COLOR_INFO } from "../constants/mtg.js";
import {
  allowsExtraCopies,
  colorPips,
  formatColorIdentity,
  getCardColors,
  getCardType,
  isBasicLand,
  isSubset,
  normalizeCardName,
  sortColorIdentity,
} from "../utils/cardUtils.js";

function buildCommanderLegality(parsed, cardMap, commanderName, commanderCard, totalCards) {
  const report = {
    enabled: Boolean(commanderName?.trim()),
    commanderName,
    commanderCard,
    status: "Not checked",
    issues: [],
    notes: [],
    commanderColors: getCardColors(commanderCard),
  };

  if (!report.enabled) {
    report.notes.push("Enter a commander name to check Commander legality and color identity.");
    return report;
  }

  if (!commanderCard) {
    report.status = "Commander not found";
    report.issues.push(`Commander not found on Scryfall: ${commanderName}`);
    return report;
  }

  const commanderLegality = commanderCard.legalities?.commander;
  if (commanderLegality !== "legal") {
    report.issues.push(`${commanderCard.name} is marked as ${commanderLegality || "unknown"} in Commander.`);
  }

  const commanderColors = getCardColors(commanderCard);
  const namesSeen = new Map();
  const commanderAliases = [
    commanderName,
    commanderCard.name,
    ...(commanderCard.card_faces || []).map(face => face.name),
  ].map(normalizeCardName);
  const commanderInDeck = parsed.some(({ name }) => commanderAliases.includes(normalizeCardName(name)));
  const expectedTotal = commanderInDeck ? totalCards : totalCards + 1;

  if (expectedTotal !== 100) {
    report.issues.push(`Commander decks should total 100 cards including the commander. This list currently totals ${expectedTotal}.`);
  }

  for (const { qty, name } of parsed) {
    const card = cardMap[normalizeCardName(name)];
    if (!card) continue;

    const key = normalizeCardName(card.name);
    namesSeen.set(key, (namesSeen.get(key) || 0) + qty);

    const legality = card.legalities?.commander;
    if (legality !== "legal") {
      report.issues.push(`${card.name} is marked as ${legality || "unknown"} in Commander.`);
    }

    const cardColors = getCardColors(card);
    if (!isSubset(cardColors, commanderColors)) {
      report.issues.push(`${card.name} has color identity ${formatColorIdentity(cardColors)}, which is outside ${commanderCard.name}'s color identity ${formatColorIdentity(commanderColors)}.`);
    }
  }

  for (const { qty, name } of parsed) {
    const card = cardMap[normalizeCardName(name)];
    if (!card) continue;
    const totalQty = namesSeen.get(normalizeCardName(card.name)) || 0;
    if (totalQty > 1 && !isBasicLand(card) && !allowsExtraCopies(card)) {
      report.issues.push(`${card.name} appears ${totalQty} times. Commander is singleton except basic lands and specific card-text exceptions.`);
      namesSeen.set(normalizeCardName(card.name), -999);
    }
  }

  if (report.issues.length === 0) {
    report.status = "Commander legal based on Scryfall data";
    report.notes.push(`All checked cards fit ${commanderCard.name}'s ${formatColorIdentity(commanderColors)} color identity.`);
  } else {
    report.status = "Needs review";
  }

  return report;
}

export function buildAnalysis(parsed, cardMap, commanderName = "") {
  const mainParsed = parsed.filter(({ board }) => board !== "sideboard");
  const sideboardParsed = parsed.filter(({ board }) => board === "sideboard");
  const listedMainCount = mainParsed.reduce((sum, { qty }) => sum + qty, 0);
  const commanderNameTrimmed = commanderName.trim();
  const commanderCard = commanderNameTrimmed ? cardMap[normalizeCardName(commanderNameTrimmed)] : null;
  const commanderAliases = [
    commanderNameTrimmed,
    commanderCard?.name,
    ...(commanderCard?.card_faces || []).map(face => face.name),
  ].filter(Boolean).map(normalizeCardName);
  const commanderInDeck = Boolean(commanderNameTrimmed) && mainParsed.some(({ name }) => {
    return commanderAliases.includes(normalizeCardName(name));
  });
  const hasSeparateCommander = Boolean(commanderNameTrimmed) && !commanderInDeck;
  const totalCards = listedMainCount + (hasSeparateCommander ? 1 : 0);
  let matchedCards = 0, totalMV = 0, nonLandCount = 0, totalPrice = 0;
  const curve = Array(8).fill(0);
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  const colorGroups = {};
  const types = {};
  const cardList = [];
  const sideboardCardList = [];
  const missing = [];

  const addCardToAnalysis = ({ qty, card, role = "main" }) => {
    cardList.push({ qty, card, role });
    matchedCards += qty;

    const type = getCardType(card.type_line);
    types[type] = (types[type] || 0) + qty;

    const ci = getCardColors(card);
    if (ci.length === 0) colors.C += qty;
    else ci.forEach(color => { if (color in colors) colors[color] += qty; });

    const identityColors = sortColorIdentity(ci);
    const identityKey = colorPips(identityColors);
    if (!colorGroups[identityKey]) {
      colorGroups[identityKey] = {
        key: identityKey,
        label: formatColorIdentity(identityColors),
        colors: identityColors,
        count: 0,
        examples: [],
      };
    }
    colorGroups[identityKey].count += qty;
    if (colorGroups[identityKey].examples.length < 4) {
      colorGroups[identityKey].examples.push({ qty, card });
    }

    if (type !== "Land") {
      const mv = card.cmc || 0;
      curve[Math.min(7, Math.floor(mv))] += qty;
      totalMV += mv * qty;
      nonLandCount += qty;
    }

    const price = parseFloat(card.prices?.usd || 0);
    if (price > 0) totalPrice += price * qty;
  };

  if (hasSeparateCommander) {
    if (commanderCard) addCardToAnalysis({ qty: 1, card: commanderCard, role: "commander" });
    else missing.push({ name: commanderNameTrimmed, board: "commander" });
  }

  for (const { qty, name } of mainParsed) {
    const card = cardMap[normalizeCardName(name)];
    if (!card) { missing.push({ name, board: "main" }); continue; }

    const role = commanderAliases.includes(normalizeCardName(card.name)) ? "commander" : "main";
    addCardToAnalysis({ qty, card, role });
  }

  for (const { qty, name } of sideboardParsed) {
    const card = cardMap[normalizeCardName(name)];
    if (!card) { missing.push({ name, board: "sideboard" }); continue; }
    sideboardCardList.push({ qty, card });
  }

  const avgMV = nonLandCount > 0 ? (totalMV / nonLandCount).toFixed(2) : null;
  const landCount = types.Land || 0;
  const commanderReport = buildCommanderLegality(mainParsed, cardMap, commanderName, commanderCard, listedMainCount);
  const isCmd = Boolean(commanderName.trim()) || totalCards >= 98 && totalCards <= 101;

  const missingTotal = totalCards - matchedCards;
  const warnings = [];
  if (missingTotal > 0) {
    warnings.push(`${missingTotal} ${missingTotal === 1 ? "card is" : "cards are"} included in the deck total but could not be matched on Scryfall, so charts, prices, and legality checks may be incomplete.`);
  }
  if (landCount === 0)
    warnings.push("No lands detected - are they missing from your list?");
  else if (isCmd && landCount < 34)
    warnings.push(`Low land count for Commander: ${landCount} lands (recommend 36-38)`);
  else if (!isCmd && totalCards <= 65 && landCount < 20)
    warnings.push(`Low land count: ${landCount} (recommend 22-24 for 60-card decks)`);
  if (!isCmd && totalCards > 0 && totalCards < 60)
    warnings.push(`Only ${totalCards} cards in mainboard - most formats require 60+`);
  if (avgMV && parseFloat(avgMV) > 4 && !isCmd)
    warnings.push(`High average mana value (${avgMV}) - deck may be too slow`);

  const manaCurveData = curve.map((count, index) => ({ mv: index === 7 ? "7+" : String(index), count }));
  const colorData = Object.entries(colors)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ name: MTG_COLOR_INFO[key].label, value, hex: MTG_COLOR_INFO[key].hex, key }));
  const colorGroupData = Object.values(colorGroups)
    .map(group => ({ ...group, pct: totalCards ? Math.round((group.count / totalCards) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const typeData = Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, pct: totalCards ? Math.round((count / totalCards) * 100) : 0 }));
  if (missingTotal > 0) {
    typeData.push({ type: "Unmatched", count: missingTotal, pct: Math.round((missingTotal / totalCards) * 100) });
  }
  const mostExpensive = [...cardList]
    .sort((a, b) => parseFloat(b.card.prices?.usd || 0) - parseFloat(a.card.prices?.usd || 0))
    .slice(0, 5);

  return {
    totalCards,
    avgMV,
    totalPrice: totalPrice.toFixed(2),
    manaCurveData,
    colorData,
    colorGroupData,
    typeData,
    landCount,
    isCmd,
    warnings,
    mostExpensive,
    missing,
    cardList,
    sideboardCardList,
    commanderCard,
    commanderName,
    commanderReport,
  };
}
