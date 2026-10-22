import { classifyCommanderRole } from "../src/features/cardRoles.js";

const CASES = [
  {
    name: "Path to Exile",
    type_line: "Instant",
    oracle_text: "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    has: ["Targeted Removal"],
    lacks: ["Ramp", "Graveyard Recursion"],
  },
  {
    name: "Swords to Plowshares",
    type_line: "Instant",
    oracle_text: "Exile target creature. Its controller gains life equal to its power.",
    has: ["Targeted Removal"],
    lacks: ["Ramp", "Graveyard Recursion"],
  },
  {
    name: "Rampant Growth",
    type_line: "Sorcery",
    oracle_text: "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    has: ["Ramp"],
    lacks: ["Targeted Removal", "Graveyard Recursion"],
  },
  {
    name: "Eternal Witness",
    type_line: "Creature - Human Shaman",
    oracle_text: "When Eternal Witness enters the battlefield, you may return target card from your graveyard to your hand.",
    has: ["Graveyard Recursion"],
    lacks: ["Targeted Removal", "Protection"],
  },
  {
    name: "Reanimate",
    type_line: "Sorcery",
    oracle_text: "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.",
    has: ["Graveyard Recursion"],
    lacks: ["Targeted Removal", "Protection"],
  },
  {
    name: "Soul Manipulation",
    type_line: "Instant",
    oracle_text: "Choose one or both - Counter target creature spell; and/or return target creature card from your graveyard to your hand.",
    has: ["Targeted Removal", "Graveyard Recursion"],
    lacks: ["Ramp", "Protection"],
  },
  {
    name: "Kolaghan's Command",
    type_line: "Instant",
    oracle_text: "Choose two - Return target creature card from your graveyard to your hand; Target player discards a card; Destroy target artifact; Kolaghan's Command deals 2 damage to any target.",
    has: ["Targeted Removal", "Graveyard Recursion"],
    lacks: ["Ramp", "Protection"],
  },
  {
    name: "Wrath of God",
    type_line: "Sorcery",
    oracle_text: "Destroy all creatures. They can't be regenerated.",
    has: ["Board Wipes"],
    lacks: ["Protection", "Targeted Removal"],
  },
  {
    name: "Heroic Intervention",
    type_line: "Instant",
    oracle_text: "Permanents you control gain hexproof and indestructible until end of turn.",
    has: ["Protection"],
    lacks: ["Targeted Removal", "Graveyard Recursion"],
  },
  {
    name: "Tendrils of Agony",
    type_line: "Sorcery",
    mana_cost: "{2}{B}{B}",
    oracle_text: "Target player loses 2 life and you gain 2 life.\nStorm",
    has: ["Win Conditions"],
    lacks: ["Ramp", "Targeted Removal", "Graveyard Recursion"],
  },
];

let failures = 0;

for (const card of CASES) {
  const roles = classifyCommanderRole(card);
  const missing = card.has.filter(role => !roles.includes(role));
  const unexpected = card.lacks.filter(role => roles.includes(role));
  const ok = missing.length === 0 && unexpected.length === 0;

  console.log(`${ok ? "PASS" : "FAIL"} ${card.name}: ${roles.join(", ") || "None"}`);

  if (!ok) {
    failures += 1;
    if (missing.length) console.log(`  Missing: ${missing.join(", ")}`);
    if (unexpected.length) console.log(`  Unexpected: ${unexpected.join(", ")}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
