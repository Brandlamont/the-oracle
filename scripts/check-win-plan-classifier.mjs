import { buildWinPlan } from "../src/features/winConditions.js";

function card(name, typeLine, manaCost, oracleText, cmc = 1) {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    type_line: typeLine,
    mana_cost: manaCost,
    oracle_text: oracleText,
    cmc,
    color_identity: [],
  };
}

const stormDeck = {
  commanderName: "Storm Test Commander",
  commanderCard: card("Storm Test Commander", "Legendary Creature", "{1}{U}{B}", "Whenever you cast an instant or sorcery spell, scry 1.", 3),
  landCount: 34,
  cardList: [
    { qty: 1, card: card("Storm Test Commander", "Legendary Creature", "{1}{U}{B}", "Whenever you cast an instant or sorcery spell, scry 1.", 3), role: "commander" },
    { qty: 1, card: card("Tendrils of Agony", "Sorcery", "{2}{B}{B}", "Target player loses 2 life and you gain 2 life.\nStorm", 4) },
    { qty: 1, card: card("Guttersnipe", "Creature", "{2}{R}", "Whenever you cast an instant or sorcery spell, Guttersnipe deals 2 damage to each opponent.", 3) },
    { qty: 1, card: card("Baral, Chief of Compliance", "Legendary Creature", "{1}{U}", "Instant and sorcery spells you cast cost {1} less to cast.", 2) },
    { qty: 1, card: card("Storm-Kiln Artist", "Creature", "{3}{R}", "Whenever you cast or copy an instant or sorcery spell, create a Treasure token.", 4) },
    { qty: 1, card: card("Past in Flames", "Sorcery", "{3}{R}", "Each instant and sorcery card in your graveyard gains flashback until end of turn.", 4) },
    { qty: 1, card: card("Archmage Emeritus", "Creature", "{2}{U}{U}", "Magecraft - Whenever you cast or copy an instant or sorcery spell, draw a card.", 4) },
    { qty: 1, card: card("Dark Ritual", "Instant", "{B}", "Add {B}{B}{B}.", 1) },
    { qty: 1, card: card("Cabal Ritual", "Instant", "{1}{B}", "Add {B}{B}{B}. Threshold - Add {B}{B}{B}{B}{B} instead.", 2) },
    { qty: 1, card: card("Bonus Round", "Sorcery", "{1}{R}{R}", "Until end of turn, whenever a player casts an instant or sorcery spell, that player copies it.", 3) },
    { qty: 1, card: card("Reiterate", "Instant", "{1}{R}{R}", "Copy target instant or sorcery spell. Buyback {3}.", 3) },
  ],
};

const xDeck = {
  commanderName: "X Test Commander",
  commanderCard: card("X Test Commander", "Legendary Creature", "{U}{B}{R}", "Instant and sorcery spells you cast cost {1} less to cast.", 3),
  landCount: 35,
  cardList: [
    { qty: 1, card: card("X Test Commander", "Legendary Creature", "{U}{B}{R}", "Instant and sorcery spells you cast cost {1} less to cast.", 3), role: "commander" },
    { qty: 1, card: card("Exsanguinate", "Sorcery", "{X}{B}{B}", "Each opponent loses X life. You gain life equal to the life lost this way.", 2) },
    { qty: 1, card: card("Crackle with Power", "Sorcery", "{X}{X}{X}{R}{R}", "Crackle with Power deals five times X damage to each of up to X targets.", 2) },
    { qty: 1, card: card("Mana Geyser", "Sorcery", "{3}{R}{R}", "Add {R} for each tapped land your opponents control.", 5) },
    { qty: 1, card: card("Dark Ritual", "Instant", "{B}", "Add {B}{B}{B}.", 1) },
    { qty: 1, card: card("Bonus Round", "Sorcery", "{1}{R}{R}", "Until end of turn, whenever a player casts an instant or sorcery spell, that player copies it.", 3) },
  ],
};

function names(entries = []) {
  return entries.map(entry => entry.card?.name).filter(Boolean);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const stormPlan = buildWinPlan(stormDeck);
const stormLane = stormPlan.lanes.find(lane => lane.key === "spellslinger-copy");
const stormXLane = stormPlan.lanes.find(lane => lane.key === "big-mana-x");

assert(stormPlan.primary.key === "spellslinger-copy", `Tendrils deck primary lane is ${stormPlan.primary.label}`);
assert(names(stormLane?.payoffs).includes("Tendrils of Agony"), "Tendrils of Agony is a Spellslinger payoff");
assert(!names(stormXLane?.payoffs).includes("Tendrils of Agony"), "Tendrils of Agony is not an X-spell payoff");
assert((stormXLane?.payoffs || []).length === 0, "Storm-only deck has no Big Mana X payoffs");

const xPlan = buildWinPlan(xDeck);
const xLane = xPlan.lanes.find(lane => lane.key === "big-mana-x");

assert(xPlan.primary.key === "big-mana-x", `Exsanguinate deck primary lane is ${xPlan.primary.label}`);
assert(names(xLane?.payoffs).includes("Exsanguinate"), "Exsanguinate is an X-spell payoff");
assert(names(xLane?.payoffs).includes("Crackle with Power"), "Crackle with Power is an X-spell payoff");
