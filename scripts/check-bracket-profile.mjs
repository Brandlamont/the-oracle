import { buildArchetypeProfile } from "../src/features/archetypes.js";
import { buildBracketProfile } from "../src/features/bracketProfile.js";
import { buildWinPlan } from "../src/features/winConditions.js";

function card(name, typeLine, manaCost = "", oracleText = "", cmc = 1) {
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

function analysis(commanderName, cards) {
  return {
    commanderName,
    commanderCard: cards[0],
    landCount: 34,
    cardList: cards.map((item, index) => ({
      qty: 1,
      card: item,
      role: index === 0 ? "commander" : "main",
    })),
  };
}

function names(items = []) {
  return items.map(item => item.label || item.name || item.card?.name).filter(Boolean);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

const yuriko = analysis("Yuriko, the Tiger's Shadow", [
  card("Yuriko, the Tiger's Shadow", "Legendary Creature - Human Ninja", "{1}{U}{B}", "Commander ninjutsu {U}{B}. Whenever a Ninja you control deals combat damage to a player, reveal the top card of your library and put that card into your hand. Each opponent loses life equal to its mana value.", 3),
  card("Changeling Outcast", "Creature - Shapeshifter", "{B}", "Changeling. Changeling Outcast can't block and can't be blocked.", 1),
  card("Ornithopter", "Artifact Creature - Thopter", "{0}", "Flying", 0),
  card("Mist-Cloaked Herald", "Creature - Merfolk Warrior", "{U}", "Mist-Cloaked Herald can't be blocked.", 1),
  card("Ingenious Infiltrator", "Creature - Vedalken Ninja", "{2}{U}{B}", "Ninjutsu {U}{B}. Whenever a Ninja you control deals combat damage to a player, draw a card.", 4),
  card("Brainstorm", "Instant", "{U}", "Draw three cards, then put two cards from your hand on top of your library in any order.", 1),
  card("Ponder", "Sorcery", "{U}", "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.", 1),
  card("Thassa's Oracle", "Creature - Merfolk Wizard", "{U}{U}", "When Thassa's Oracle enters the battlefield, look at the top X cards of your library. If X is greater than or equal to the number of cards in your library, you win the game.", 2),
  card("Demonic Consultation", "Instant", "{B}", "Choose a card name. Exile the top six cards of your library, then reveal cards from the top of your library until you reveal the named card.", 1),
  card("Narset, Parter of Veils", "Legendary Planeswalker - Narset", "{1}{U}{U}", "Each opponent can't draw more than one card each turn.", 3),
  card("Windfall", "Sorcery", "{2}{U}", "Each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way.", 3),
  card("Wishclaw Talisman", "Artifact", "{1}{B}", "{1}, {T}: Search your library for a card, put it into your hand, then shuffle. An opponent gains control of Wishclaw Talisman.", 2),
  card("Counterspell", "Instant", "{U}{U}", "Counter target spell.", 2),
]);

const yurikoArchetype = buildArchetypeProfile(yuriko);
const yurikoWinPlan = buildWinPlan(yuriko);
const yurikoBracket = buildBracketProfile(yuriko, yurikoArchetype, yurikoWinPlan);

assert(yurikoArchetype.primary.key === "yuriko-tempo", `Yuriko archetype is ${yurikoArchetype.primary.label}`);
assert(yurikoWinPlan.primary.key === "oracle-consultation", `Yuriko win lane is ${yurikoWinPlan.primary.label}`);
assert(names(yurikoBracket.combos).includes("Oracle Consultation"), "Yuriko bracket finds Oracle Consultation");
assert(names(yurikoBracket.combos).includes("Narset Wheel Lock"), "Yuriko bracket finds Narset Wheel Lock as a package");
assert(yurikoBracket.estimate.level === 4, `Yuriko bracket estimate is ${yurikoBracket.estimate.title}`);
assert(yurikoBracket.tags.some(tag => tag.key === "evasive-enabler" && tag.count >= 3), "Yuriko bracket tags evasive enablers");
assert(yurikoBracket.tags.some(tag => tag.key === "ninja-payoff"), "Yuriko bracket tags ninja payoffs");

const azula = analysis("Fire Lord Azula", [
  card("Fire Lord Azula", "Legendary Creature", "{U}{B}{R}", "Whenever you cast your second instant or sorcery spell each turn, copy it.", 3),
  card("Mana Geyser", "Sorcery", "{3}{R}{R}", "Add {R} for each tapped land your opponents control.", 5),
  card("Reiterate", "Instant", "{1}{R}{R}", "Copy target instant or sorcery spell. Buyback {3}.", 3),
  card("Exsanguinate", "Sorcery", "{X}{B}{B}", "Each opponent loses X life. You gain life equal to the life lost this way.", 2),
  card("Crackle with Power", "Sorcery", "{X}{X}{X}{R}{R}", "Crackle with Power deals five times X damage to each of up to X targets.", 2),
  card("Dark Ritual", "Instant", "{B}", "Add {B}{B}{B}.", 1),
  card("Storm-Kiln Artist", "Creature - Dwarf Shaman", "{3}{R}", "Whenever you cast or copy an instant or sorcery spell, create a Treasure token.", 4),
]);

const azulaArchetype = buildArchetypeProfile(azula);
const azulaWinPlan = buildWinPlan(azula);
const azulaBracket = buildBracketProfile(azula, azulaArchetype, azulaWinPlan);

assert(azulaWinPlan.primary.key === "big-mana-x", `Azula win lane is ${azulaWinPlan.primary.label}`);
assert(names(azulaBracket.combos).includes("Reiterate Geyser Loop"), "Azula bracket finds Reiterate Geyser Loop");
assert(azulaBracket.estimate.level === 4, `Azula bracket estimate is ${azulaBracket.estimate.title}`);
assert(azulaBracket.tags.some(tag => tag.key === "x-finisher" && tag.count >= 2), "Azula bracket tags X finishers");
