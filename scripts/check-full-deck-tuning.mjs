import { buildAnalysis } from "../src/features/analysis.js";
import { buildArchetypeProfile } from "../src/features/archetypes.js";
import { buildBracketProfile } from "../src/features/bracketProfile.js";
import { buildCommanderAssistant } from "../src/features/commanderAssistant.js";
import { buildTuningPlan } from "../src/features/tuningPlan.js";
import { buildWinPlan } from "../src/features/winConditions.js";
import { normalizeCardName } from "../src/utils/cardUtils.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const MOXFIELD_API = "https://api2.moxfield.com/v3/decks/all";
const execFileAsync = promisify(execFile);

const FULL_DECK_FIXTURES = [
  {
    name: "Jetmir Token Aggro",
    id: "6mmL1pONN0mwTk2oiLnCSg",
    commander: "Jetmir, Nexus of Revels",
    expectedArchetype: "tokens-overrun",
    expectedLane: "token-overrun",
  },
  {
    name: "Atraxa Poison Proliferate",
    id: "4Bc1fHYDAEKMVn2ylpqH-w",
    commander: "Atraxa, Praetors' Voice",
    expectedArchetype: "poison",
    expectedLane: "poison-proliferate",
  },
  {
    name: "Winota Snowball Stax",
    id: "vreLLzMBwk2e4UoyV7mZUw",
    commander: "Winota, Joiner of Forces",
    expectedArchetype: "stax-hatebears",
    expectedLane: "stax-snowball",
  },
  {
    name: "Meren Graveyard Value",
    id: "hG_UZ_aATESajDaOG5nlDA",
    commander: "Meren of Clan Nel Toth",
    expectedArchetype: "reanimator",
    expectedLane: "graveyard-value",
  },
];

function addCardToMap(cardMap, card, aliases = []) {
  if (!card?.name) return;
  const names = [
    card.name,
    ...aliases,
    ...(card.card_faces || []).map(face => face.name),
  ].filter(Boolean);

  names.forEach(name => {
    cardMap[normalizeCardName(name)] = card;
  });
}

function readBoard(deck, names) {
  const boards = deck?.boards || {};

  for (const name of names) {
    const board = boards[name];
    if (board?.cards) return Object.values(board.cards);
  }

  return [];
}

function toParsed(entries, board, role = "main") {
  return entries
    .filter(entry => entry?.card?.name)
    .filter(entry => !entry.card.isToken)
    .map(entry => ({
      qty: entry.quantity || 1,
      name: entry.card.name,
      board,
      role,
    }));
}

function buildCardMap(entries) {
  const cardMap = {};
  entries.forEach(entry => addCardToMap(cardMap, entry.card));
  return cardMap;
}

function formatList(items, getText, empty = "None") {
  if (!items?.length) return empty;
  return items.map(getText).join("; ");
}

function resultStatus(actual, expected) {
  if (!expected) return "INFO";
  return actual === expected ? "PASS" : "CHECK";
}

function getRoleGaps(roleCategories = []) {
  return roleCategories
    .filter(category => category.key !== "Win Conditions")
    .filter(category => !category.optional && category.count < category.min)
    .map(category => `${category.label} ${category.count}/${category.target}`);
}

async function fetchMoxfieldDeck(id) {
  const url = `${MOXFIELD_API}/${id}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.moxfield.com/",
      "User-Agent": "Mozilla/5.0 TheOracleDeckHelper/0.1",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    try {
      const { stdout } = await execFileAsync("curl.exe", [
        "-L",
        "-H", "User-Agent: Mozilla/5.0 TheOracleDeckHelper/0.1",
        "-H", "Accept: application/json",
        "-H", "Referer: https://www.moxfield.com/",
        url,
      ], { maxBuffer: 16 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch (curlErr) {
      throw new Error(`Moxfield ${id} failed: ${res.status}${body ? ` ${body.slice(0, 160)}` : ""}; curl fallback failed: ${curlErr.message}`);
    }
  }

  return res.json();
}

async function runFixture(fixture) {
  const deck = await fetchMoxfieldDeck(fixture.id);
  const commanderEntries = readBoard(deck, ["commanders", "commander", "commandzone", "commandZone"]);
  const mainEntries = readBoard(deck, ["mainboard", "main"]);
  const sideboardEntries = readBoard(deck, ["sideboard"]);
  const commanderName = commanderEntries[0]?.card?.name || fixture.commander;
  const allEntries = [...commanderEntries, ...mainEntries, ...sideboardEntries];
  const parsed = [
    ...toParsed(commanderEntries, "main", "commander"),
    ...toParsed(mainEntries, "main"),
    ...toParsed(sideboardEntries, "sideboard"),
  ];
  const cardMap = buildCardMap(allEntries);

  const analysis = buildAnalysis(parsed, cardMap, commanderName);
  const archetypeProfile = buildArchetypeProfile(analysis);
  const winPlan = buildWinPlan(analysis);
  const bracket = buildBracketProfile(analysis, archetypeProfile, winPlan);
  const roleCategories = buildCommanderAssistant(analysis) || [];
  const tuningPlan = buildTuningPlan(analysis, roleCategories, archetypeProfile, winPlan);

  const actualArchetype = archetypeProfile?.primary?.key || null;
  const actualLane = winPlan?.primary?.key || null;

  return {
    fixture,
    deckName: deck.name,
    url: deck.publicUrl,
    commanderName,
    analysis,
    archetypeProfile,
    winPlan,
    bracket,
    roleGaps: getRoleGaps(roleCategories),
    tuningPlan,
    archetypeStatus: resultStatus(actualArchetype, fixture.expectedArchetype),
    laneStatus: resultStatus(actualLane, fixture.expectedLane),
  };
}

const results = [];
let failed = false;

for (const fixture of FULL_DECK_FIXTURES) {
  try {
    results.push(await runFixture(fixture));
  } catch (err) {
    failed = true;
    console.error(`\nERROR ${fixture.name}`);
    console.error(`  ${err.message}`);
  }
}

for (const result of results) {
  const {
    fixture,
    deckName,
    url,
    commanderName,
    analysis,
    archetypeProfile,
    winPlan,
    bracket,
    roleGaps,
    tuningPlan,
    archetypeStatus,
    laneStatus,
  } = result;

  console.log(`\n${deckName || fixture.name}`);
  console.log(`  Source: ${url}`);
  console.log(`  Commander: ${commanderName}`);
  console.log(`  Cards: ${analysis.totalCards}, Lands: ${analysis.landCount}, Avg MV: ${analysis.avgMV || "-"}`);
  console.log(`  ${archetypeStatus} Archetype: ${archetypeProfile?.primary?.label || "None"} (${archetypeProfile?.primary?.key || "none"})`);
  console.log(`  ${laneStatus} Win lane:  ${winPlan?.primary?.label || "None"} (${winPlan?.primary?.key || "none"}, ${winPlan?.confidence || "None"})`);
  console.log(`  Bracket: ${bracket?.estimate?.title || "-"} / ${bracket?.estimate?.subtitle || "-"} (${bracket?.estimate?.caveat || "no caveat"})`);
  console.log(`  Role gaps: ${roleGaps.join("; ") || "None"}`);
  console.log(`  Add Next: ${formatList(tuningPlan.adds, item => item.name)}`);
  console.log(`  Keep Core: ${formatList(tuningPlan.keeps.slice(0, 5), item => item.name)}`);
  console.log(`  Review Flex Slots: ${formatList(tuningPlan.cuts, item => `${item.name} - ${item.reason}`)}`);
}

if (failed) process.exitCode = 1;
