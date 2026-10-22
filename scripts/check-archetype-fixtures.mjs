import { buildAnalysis } from "../src/features/analysis.js";
import { buildArchetypeProfile } from "../src/features/archetypes.js";
import { buildCommanderAssistant } from "../src/features/commanderAssistant.js";
import { buildTuningPlan } from "../src/features/tuningPlan.js";
import { buildWinPlan } from "../src/features/winConditions.js";
import { fetchCardsFromScryfall } from "../src/services/scryfall.js";
import { collectLookupEntries } from "../src/utils/deckFormats.js";

const FIXTURES = [
  {
    name: "Jetmir Token Overrun",
    commander: "Jetmir, Nexus of Revels",
    expectedArchetype: "tokens-overrun",
    expectedLane: "token-overrun",
    cards: [
      "Jetmir, Nexus of Revels",
      "Adeline, Resplendent Cathar",
      "Anim Pakal, Thousandth Moon",
      "Hero of Bladehold",
      "Hanweir Garrison",
      "Dragon Fodder",
      "Forth Eorlingas!",
      "March of the Multitudes",
      "Secure the Wastes",
      "Rabble Rousing",
      "Beastmaster Ascension",
      "Champion of Lambholt",
      "King Darien XLVIII",
      "Warleader's Call",
      "Skullclamp",
      "Selfless Spirit",
      "Clever Concealment",
      "Giver of Runes",
      "Sol Ring",
      "Arcane Signet",
      "Command Tower",
    ],
  },
  {
    name: "Atraxa Poison Proliferate",
    commander: "Atraxa, Praetors' Voice",
    expectedArchetype: "poison",
    expectedLane: "poison-proliferate",
    cards: [
      "Atraxa, Praetors' Voice",
      "Blighted Agent",
      "Bloated Contaminator",
      "Ichor Rats",
      "Infectious Inquiry",
      "Prologue to Phyresis",
      "Skrelv's Hive",
      "Tainted Strike",
      "Venerated Rotpriest",
      "Vraska's Fall",
      "Evolution Sage",
      "Ezuri, Stalker of Spheres",
      "Staff of Compleation",
      "Tekuthal, Inquiry Dominus",
      "Tezzeret's Gambit",
      "Vorinclex, Monstrous Raider",
      "Arid Mesa",
      "Marsh Flats",
      "Misty Rainforest",
      "Polluted Delta",
      "Windswept Heath",
      "Command Tower",
    ],
  },
  {
    name: "Winota Stax Snowball",
    commander: "Winota, Joiner of Forces",
    expectedArchetype: "stax-hatebears",
    expectedLane: "stax-snowball",
    cards: [
      "Winota, Joiner of Forces",
      "Archon of Emeria",
      "Aven Mindcensor",
      "Blood Moon",
      "Deafening Silence",
      "Drannith Magistrate",
      "Ethersworn Canonist",
      "Magus of the Moon",
      "Rule of Law",
      "Thalia, Guardian of Thraben",
      "Angrath's Marauders",
      "Auratouched Mage",
      "Blade Historian",
      "Combat Celebrant",
      "Professional Face-Breaker",
      "Recruiter of the Guard",
      "Zealous Conscripts",
      "Goblin Rabblemaster",
      "Ornithopter",
      "Sol Ring",
      "Command Tower",
    ],
  },
  {
    name: "Azula Big Mana Spells",
    commander: "Fire Lord Azula",
    expectedArchetype: null,
    expectedLane: "big-mana-x",
    cards: [
      "Fire Lord Azula",
      "Dark Ritual",
      "Desperate Ritual",
      "Mana Geyser",
      "Storm-Kiln Artist",
      "Baral, Chief of Compliance",
      "Goblin Electromancer",
      "Nightscape Familiar",
      "Sol Ring",
      "Arcane Signet",
      "Fall of the Titans",
      "Electrodominance",
      "Exsanguinate",
      "Crackle with Power",
      "Expansion // Explosion",
      "Increasing Vengeance",
      "Repeated Reverberation",
      "Veyran, Voice of Duality",
      "Guttersnipe",
      "Command Tower",
    ],
  },
];

function toParsed(cards) {
  return cards.map(name => ({ qty: 1, name, board: "main" }));
}

function summarizeCuts(tuningPlan) {
  return (tuningPlan?.cuts || [])
    .slice(0, 5)
    .map(item => item.card?.name)
    .filter(Boolean);
}

async function runFixture(fixture) {
  const parsed = toParsed(fixture.cards);
  const lookupEntries = collectLookupEntries(parsed, fixture.commander);
  const cardMap = await fetchCardsFromScryfall(lookupEntries);
  const analysis = buildAnalysis(parsed, cardMap, fixture.commander);
  const archetypeProfile = buildArchetypeProfile(analysis);
  const winPlan = buildWinPlan(analysis);
  const roleCategories = buildCommanderAssistant(analysis);
  const tuningPlan = buildTuningPlan(analysis, roleCategories, archetypeProfile, winPlan);

  return {
    fixture: fixture.name,
    commander: fixture.commander,
    expectedArchetype: fixture.expectedArchetype,
    actualArchetype: archetypeProfile?.primary?.key || null,
    actualArchetypeLabel: archetypeProfile?.primary?.label || "None",
    expectedLane: fixture.expectedLane,
    actualLane: winPlan?.primary?.key || null,
    actualLaneLabel: winPlan?.primary?.label || "None",
    winConfidence: winPlan?.confidence || "None",
    addNext: (tuningPlan?.adds || []).slice(0, 4).map(item => item.name),
    possibleCuts: summarizeCuts(tuningPlan),
  };
}

const results = [];
for (const fixture of FIXTURES) {
  results.push(await runFixture(fixture));
}

for (const result of results) {
  const archetypeOk = !result.expectedArchetype || result.expectedArchetype === result.actualArchetype;
  const laneOk = !result.expectedLane || result.expectedLane === result.actualLane;
  console.log(`\n${archetypeOk && laneOk ? "PASS" : "CHECK"} ${result.fixture}`);
  console.log(`  Archetype: ${result.actualArchetypeLabel} (${result.actualArchetype})`);
  console.log(`  Win lane:  ${result.actualLaneLabel} (${result.actualLane}, ${result.winConfidence})`);
  console.log(`  Add Next:  ${result.addNext.join(", ") || "None"}`);
  console.log(`  Cuts:      ${result.possibleCuts.join(", ") || "None"}`);
}
