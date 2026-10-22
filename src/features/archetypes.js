import { getCardColors, getOracleText, isSubset, normalizeCardName, sortColorIdentity } from "../utils/cardUtils.js";

const MAX_SIGNAL_CARDS = 5;

function lower(value = "") {
  return String(value).toLowerCase();
}

function cardText(card) {
  return lower(getOracleText(card));
}

function cardName(card) {
  return lower(card?.name || "");
}

function cardType(card) {
  return lower(card?.type_line || "");
}

function manaCost(card) {
  if (card?.mana_cost) return card.mana_cost;
  return (card?.card_faces || []).map(face => face.mana_cost || "").join(" ");
}

function hasXCost(card) {
  return manaCost(card).includes("{X}");
}

function includesAny(value, needles) {
  return needles.some(needle => value.includes(needle));
}

function hasExactName(card, names) {
  const name = cardName(card);
  return names.some(candidate => name === lower(candidate));
}

function textIncludesAny(card, needles) {
  const text = cardText(card);
  return includesAny(text, needles.map(lower));
}

function uniqueMatches(entries, predicate) {
  const seen = new Set();
  const matches = [];

  for (const entry of entries) {
    if (!entry?.card || !predicate(entry.card, entry)) continue;
    const key = entry.card.id || normalizeCardName(entry.card.name);
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(entry);
  }

  return matches.slice(0, MAX_SIGNAL_CARDS);
}

function getDeckColors(analysis) {
  const commanderColors = sortColorIdentity(getCardColors(analysis?.commanderCard));
  if (commanderColors.length) return commanderColors;

  const deckColors = new Set();
  for (const { card } of analysis?.cardList || []) {
    getCardColors(card).forEach(color => deckColors.add(color));
  }
  return sortColorIdentity([...deckColors]);
}

function getDeckNameKeys(analysis) {
  const keys = new Set();

  for (const { card } of [
    ...(analysis?.cardList || []),
    ...(analysis?.sideboardCardList || []),
  ]) {
    if (!card?.name) continue;
    keys.add(normalizeCardName(card.name));
    lower(card.name).split("//").map(part => part.trim()).filter(Boolean).forEach(part => keys.add(normalizeCardName(part)));
  }

  return keys;
}

function scryfallExactUrl(name) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;
}

function isGroupBenefit(card) {
  return (
    hasExactName(card, [
      "Kynaios and Tiro of Meletis",
      "Kwain, Itinerant Meddler",
      "Gluntch, the Bestower",
      "Ms. Bumbleflower",
      "Zedruu the Greathearted",
      "Xyris, the Writhing Storm",
      "Howling Mine",
      "Font of Mythos",
      "Temple Bell",
      "Rites of Flourishing",
      "Dictate of Kruphix",
    ]) ||
    textIncludesAny(card, [
      "each player draws",
      "each player may draw",
      "each player may put a land",
      "each player may play an additional land",
      "each player gains",
      "each player creates",
      "each player searches",
      "target opponent draws",
      "each opponent draws",
      "at the beginning of each player's draw step",
    ])
  );
}

function isPoliticalCard(card) {
  return textIncludesAny(card, [
    "goad",
    "votes",
    "vote",
    "will of the council",
    "council's dilemma",
    "tempting offer",
    "friend or foe",
    "gift a card",
  ]);
}

function isGroupHugPayoff(card) {
  return (
    hasExactName(card, ["Smothering Tithe", "Faerie Mastermind", "Trouble in Pairs", "Consecrated Sphinx", "Psychosis Crawler"]) ||
    textIncludesAny(card, [
      "whenever an opponent draws",
      "whenever one or more opponents draw",
      "whenever a player draws",
      "whenever an opponent draws a card",
    ])
  );
}

function isSagaCard(card) {
  const type = cardType(card);
  return (
    type.includes("saga") ||
    hasExactName(card, ["Urza's Saga"]) ||
    textIncludesAny(card, ["lore counter", "after this saga"])
  );
}

function isSagaAccelerator(card) {
  return (
    hasExactName(card, ["Satsuki, the Living Lore", "Nesting Grounds", "Power Conduit", "The Millennium Calendar"]) ||
    textIncludesAny(card, [
      "put a lore counter",
      "move a counter from target permanent",
      "proliferate",
    ])
  );
}

function isEnchantressEngine(card) {
  return (
    hasExactName(card, [
      "Sythis, Harvest's Hand",
      "Mesa Enchantress",
      "Satyr Enchanter",
      "Eidolon of Blossoms",
      "Setessan Champion",
      "Enchantress's Presence",
      "Argothian Enchantress",
      "Verduran Enchantress",
      "Beast Whisperer",
      "Guardian Project",
    ]) ||
    textIncludesAny(card, [
      "whenever you cast an enchantment spell, draw",
      "whenever an enchantment enters the battlefield under your control, draw",
      "whenever you cast an enchantment spell, you may draw",
      "constellation",
    ])
  );
}

function isAuraCard(card) {
  const type = cardType(card);
  return (
    type.includes("aura") ||
    textIncludesAny(card, [
      "aura spell",
      "aura card",
      "aura you control",
      "auras you control",
    ])
  );
}

function isAuraControlCard(card) {
  return (
    hasExactName(card, [
      "Eriette of the Charmed Apple",
      "Darksteel Mutation",
      "Dead Man's Chest",
      "Ghoulish Impetus",
      "Martial Impetus",
      "Minimus Containment",
      "Morgul-Knife Wound",
      "Nettlevine Blight",
      "Nurgle's Rot",
      "Parasitic Impetus",
      "Prison Term",
      "Screams from Within",
      "Vampiric Link",
      "Withercrown",
    ]) ||
    textIncludesAny(card, [
      "enchanted creature can't attack",
      "enchanted creature attacks each combat if able",
      "enchanted creature can't block",
      "enchanted creature gets -",
      "enchanted creature loses all abilities",
      "enchanted creature has base power and toughness",
      "each creature that's enchanted by an aura you control can't attack",
      "at the beginning of enchanted creature's controller",
      "whenever enchanted creature dies",
    ])
  );
}

function isAuraPayoffCard(card) {
  return (
    hasExactName(card, [
      "All That Glitters",
      "Archon of Sun's Grace",
      "Eriette of the Charmed Apple",
      "Ethereal Armor",
      "Hateful Eidolon",
      "Hero of Iroas",
      "Killian, Ink Duelist",
      "Kor Spiritdancer",
      "Light-Paws, Emperor's Voice",
      "Mantle of the Ancients",
      "Mesa Enchantress",
      "Ondu Spiritdancer",
      "Retether",
      "Sage's Reverie",
      "Sram, Senior Edificer",
      "Starfield Mystic",
    ]) ||
    textIncludesAny(card, [
      "aura spells you cast cost",
      "whenever you cast an aura spell",
      "whenever you cast an enchantment spell, draw",
      "whenever an aura",
      "auras you control",
      "enchanted creatures you control",
      "for each aura",
      "return all aura cards",
      "return all enchantment cards",
    ])
  );
}

function isEnchantmentTokenPayoff(card) {
  return (
    hasExactName(card, [
      "Hallowed Haunting",
      "Sigil of the Empty Throne",
      "Court of Grace",
      "Ajani's Chosen",
      "Archon of Sun's Grace",
      "Starfield of Nyx",
      "Avenger of Zendikar",
      "Tendershoot Dryad",
      "Parallel Lives",
      "Anointed Procession",
    ]) ||
    textIncludesAny(card, [
      "whenever you cast an enchantment spell, create",
      "whenever an enchantment enters the battlefield under your control, create",
      "if you control seven or more enchantments",
      "creature tokens you control",
      "tokens would be created under your control",
    ])
  );
}

function isPillowFortCard(card) {
  return (
    hasExactName(card, [
      "Ghostly Prison",
      "Propaganda",
      "Sphere of Safety",
      "Crawlspace",
      "Norn's Annex",
      "Windborn Muse",
      "No Mercy",
      "Solitary Confinement",
      "Elephant Grass",
      "Koskun Falls",
      "Dueling Grounds",
      "Silent Arbiter",
      "Pramikon, Sky Rampart",
      "Angus Mackenzie",
    ]) ||
    textIncludesAny(card, [
      "creatures can't attack you unless",
      "can't attack you unless",
      "can't attack you or planeswalkers you control unless",
      "can't attack you or planeswalkers you control",
      "enchanted by an aura you control can't attack",
      "prevent all combat damage",
      "no more than one creature can attack",
      "protection from creatures",
      "can't be attacked",
    ])
  );
}

function isLifeDrainCard(card) {
  return (
    hasExactName(card, [
      "Blood Artist",
      "Zulaport Cutthroat",
      "Bastion of Remembrance",
      "Vito, Thorn of the Dusk Rose",
      "Dina, Soul Steeper",
      "Sanguine Bond",
      "Exquisite Blood",
      "Gray Merchant of Asphodel",
      "Kambal, Consul of Allocation",
      "Marauding Blight-Priest",
    ]) ||
    textIncludesAny(card, [
      "each opponent loses",
      "target opponent loses",
      "opponent loses life",
      "whenever an opponent loses life",
      "whenever you gain life",
    ])
  );
}

function isLifeGainCard(card) {
  return textIncludesAny(card, ["you gain life", "whenever you gain life", "lifelink"]);
}

function isSpellManaEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Baral, Chief of Compliance",
      "Birgi, God of Storytelling",
      "Dark Ritual",
      "Desperate Ritual",
      "Goblin Electromancer",
      "Mana Geyser",
      "Nightscape Familiar",
      "Storm-Kiln Artist",
    ]) ||
    text.includes("add {") && (
      text.includes("instant") ||
      text.includes("sorcery") ||
      text.includes("treasure")
    ) ||
    text.includes("instant and sorcery spells you cast cost") ||
    text.includes("instant or sorcery spells you cast cost")
  );
}

function isSpellChainCard(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    hasExactName(card, [
      "Archmage Emeritus",
      "Bonus Round",
      "Increasing Vengeance",
      "Mizzix's Mastery",
      "Past in Flames",
      "Repeated Reverberation",
      "Reiterate",
      "Snapcaster Mage",
      "Thousand-Year Storm",
      "Veyran, Voice of Duality",
    ]) ||
    type.includes("instant") && (card?.cmc || 0) <= 1 ||
    type.includes("sorcery") && (card?.cmc || 0) <= 1 ||
    text.includes("whenever you cast an instant or sorcery") ||
    text.includes("whenever you cast or copy an instant or sorcery") ||
    text.includes("copy target instant or sorcery") ||
    text.includes("copy target spell") ||
    text.includes("instant or sorcery card from your graveyard") ||
    text.includes("flashback")
  );
}

function isXSpellFinisher(card) {
  const text = cardText(card);
  if (!hasXCost(card)) return false;

  return (
    hasExactName(card, [
      "Comet Storm",
      "Crackle with Power",
      "Electrodominance",
      "Exsanguinate",
      "Expansion // Explosion",
      "Fall of the Titans",
      "Finale of Promise",
      "Stroke of Genius",
      "Torment of Hailfire",
    ]) ||
    (
      text.includes("damage") ||
      text.includes("each opponent") ||
      text.includes("loses") ||
      text.includes("draw")
    )
  );
}

function isStormSpellFinisher(card) {
  const text = cardText(card);
  return (
    text.includes("storm") &&
    (
      hasExactName(card, ["Tendrils of Agony", "Grapeshot", "Brain Freeze"]) ||
      text.includes("target player loses") ||
      text.includes("target opponent loses") ||
      text.includes("damage to any target") ||
      text.includes("damage to target player") ||
      text.includes("damage to target opponent") ||
      text.includes("target player mills")
    )
  );
}

function isPoisonCard(card) {
  return (
    hasExactName(card, [
      "Vishgraz, the Doomhive",
      "Skithiryx, the Blight Dragon",
      "Fynn, the Fangbearer",
      "Atraxa, Praetors' Voice",
      "Skrelv's Hive",
      "Bloated Contaminator",
      "Venerated Rotpriest",
      "Tainted Strike",
      "Triumph of the Hordes",
    ]) ||
    textIncludesAny(card, ["toxic", "infect", "poison counter", "poison counters", "corrupted"])
  );
}

function isProliferateCard(card) {
  return textIncludesAny(card, ["proliferate"]);
}

function isTokenMaker(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Adeline, Resplendent Cathar",
      "Anim Pakal, Thousandth Moon",
      "Avenger of Zendikar",
      "Dragon Fodder",
      "Forbidden Friendship",
      "Forth Eorlingas!",
      "Hanweir Garrison",
      "Hero of Bladehold",
      "Hop to It",
      "Join the Dance",
      "Krenko's Command",
      "March of the Multitudes",
      "Pest Infestation",
      "Raise the Alarm",
      "Rabble Rousing",
      "Ral's Reinforcements",
      "Release the Dogs",
      "Saproling Migration",
      "Secure the Wastes",
      "Sprout Swarm",
      "Tendershoot Dryad",
      "Undercellar Myconid",
    ]) ||
    text.includes("create") && text.includes("creature token") ||
    text.includes("create") && text.includes("tokens") && text.includes("creature")
  );
}

function isGoWidePayoff(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Jetmir, Nexus of Revels",
      "Beastmaster Ascension",
      "Champion of Lambholt",
      "Craterhoof Behemoth",
      "Finale of Devastation",
      "King Darien XLVIII",
      "Moonshaker Cavalry",
      "Shared Animosity",
      "Triumph of the Hordes",
      "Warleader's Call",
    ]) ||
    text.includes("creatures you control get") ||
    text.includes("creature tokens you control") ||
    text.includes("for each creature you control") ||
    text.includes("creatures you control gain trample") ||
    text.includes("if you control six or more creatures")
  );
}

function isTokenSupport(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Anointed Procession",
      "Bennie Bracks, Zoologist",
      "Clever Concealment",
      "Elspeth, Sun's Champion",
      "Mondrak, Glory Dominus",
      "Ohran Frostfang",
      "Parallel Lives",
      "Skullclamp",
    ]) ||
    text.includes("tokens would be created") ||
    text.includes("draw a card") && text.includes("creature token") ||
    text.includes("creatures you control gain") && text.includes("indestructible")
  );
}

function isAristocratsCard(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Blood Artist",
      "Zulaport Cutthroat",
      "Bastion of Remembrance",
      "Mayhem Devil",
      "Pitiless Plunderer",
      "Ashnod's Altar",
      "Viscera Seer",
      "Yawgmoth, Thran Physician",
    ]) ||
    text.includes("sacrifice a creature") ||
    text.includes("sacrifice another creature") ||
    text.includes("whenever a creature dies") ||
    text.includes("whenever another creature dies") ||
    text.includes("whenever") && text.includes("dies") && text.includes("opponent loses")
  );
}

function isSacrificeOutletCard(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Altar of Dementia",
      "Ashnod's Altar",
      "Carrion Feeder",
      "Goblin Bombardment",
      "Phyrexian Altar",
      "Viscera Seer",
      "Woe Strider",
      "Yawgmoth, Thran Physician",
    ]) ||
    text.includes("sacrifice a creature") ||
    text.includes("sacrifice another creature") ||
    text.includes("sacrifice any number of creatures")
  );
}

function isGraveyardSetupCard(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Buried Alive",
      "Entomb",
      "Final Parting",
      "Grisly Salvage",
      "Oriq Loremage",
      "Satyr Wayfinder",
      "Stitcher's Supplier",
      "Survival of the Fittest",
      "Unmarked Grave",
    ]) ||
    text.includes("search your library for a card and put that card into your graveyard") ||
    text.includes("search your library for a creature card and put it into your graveyard") ||
    text.includes("mill three cards") ||
    text.includes("mill four cards") ||
    text.includes("mill five cards")
  );
}

function isGraveyardRecursionCard(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Animate Dead",
      "Dance of the Dead",
      "Eternal Witness",
      "Living Death",
      "Meren of Clan Nel Toth",
      "Necromancy",
      "Reanimate",
      "Timeless Witness",
      "Unearth",
      "Victimize",
    ]) ||
    text.includes("return target creature card from your graveyard to the battlefield") ||
    text.includes("return a creature card from your graveyard to the battlefield") ||
    text.includes("return target creature card from your graveyard to your hand") ||
    text.includes("return target card from your graveyard to your hand") ||
    text.includes("return target permanent card from your graveyard to your hand") ||
    text.includes("put target creature card from a graveyard onto the battlefield") ||
    text.includes("from your graveyard to the battlefield")
  );
}

function isGraveyardPayoffCard(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    hasExactName(card, [
      "Archon of Cruelty",
      "Blood Artist",
      "Body Launderer",
      "Butcher of Malakir",
      "Gray Merchant of Asphodel",
      "Hoarding Broodlord",
      "Kokusho, the Evening Star",
      "Massacre Wurm",
      "Protean Hulk",
      "Razaketh, the Foulblooded",
      "Syr Konrad, the Grim",
      "Zulaport Cutthroat",
    ]) ||
    type.includes("creature") && (card?.cmc || 0) >= 6 ||
    text.includes("whenever a creature dies") ||
    text.includes("whenever another creature dies") ||
    text.includes("when") && text.includes("dies") && text.includes("return") ||
    text.includes("dies") && text.includes("search your library")
  );
}

function isVoltronCard(card) {
  const type = cardType(card);
  if (hasExactName(card, ["Skullclamp"])) return false;
  return (
    type.includes("equipment") ||
    type.includes("aura") ||
    hasExactName(card, ["Swiftfoot Boots", "Lightning Greaves", "Shadowspear", "Blackblade Reforged", "All That Glitters", "Ethereal Armor"]) ||
    textIncludesAny(card, ["equipped creature", "enchanted creature", "commander gets", "commander has"])
  );
}

function isStaxTaxCard(card) {
  return (
    hasExactName(card, [
      "Archon of Emeria",
      "Aven Mindcensor",
      "Blood Moon",
      "Deafening Silence",
      "Drannith Magistrate",
      "Eidolon of Rhetoric",
      "Ethersworn Canonist",
      "Grafdigger's Cage",
      "Hushbringer",
      "Linvala, Keeper of Silence",
      "Magus of the Moon",
      "Rule of Law",
      "Sanctum Prelate",
      "Thalia, Guardian of Thraben",
      "Vryn Wingmare",
    ]) ||
    textIncludesAny(card, [
      "can't cast more than one spell",
      "can't search libraries",
      "can't activate abilities",
      "nonbasic lands are mountains",
      "spells cost {1} more",
      "players can't cast spells from graveyards",
      "creatures entering the battlefield don't cause abilities to trigger",
    ])
  );
}

function isAttackCheatCard(card) {
  return (
    hasExactName(card, [
      "Winota, Joiner of Forces",
      "Auratouched Mage",
      "Angrath's Marauders",
      "Blade Historian",
      "Combat Celebrant",
      "Professional Face-Breaker",
      "Recruiter of the Guard",
      "Rionya, Fire Dancer",
      "Zealous Conscripts",
    ]) ||
    textIncludesAny(card, [
      "whenever a non-human creature you control attacks",
      "put that card onto the battlefield tapped and attacking",
      "whenever one or more creatures you control attack",
      "attacks, create",
      "attacking token",
    ])
  );
}

function isYurikoEvasiveEnabler(card) {
  const text = cardText(card);
  const type = cardType(card);

  return (
    hasExactName(card, [
      "Changeling Outcast",
      "Faerie Seer",
      "Gingerbrute",
      "Gudul Lurker",
      "Hope of Ghirapur",
      "Merfolk Windrobber",
      "Mist-Cloaked Herald",
      "Mothdust Changeling",
      "Ornithopter",
      "Phyrexian Walker",
      "Slither Blade",
      "Spectral Sailor",
      "Thousand-Faced Shadow",
      "Tormented Soul",
      "Triton Shorestalker",
      "Universal Automaton",
      "Wingcrafter",
    ]) ||
    type.includes("creature") && (
      text.includes("can't be blocked") ||
      text.includes("flying") ||
      text.includes("menace")
    )
  );
}

function isNinjaTempoPayoff(card) {
  const text = cardText(card);
  const type = cardType(card);

  return (
    type.includes("ninja") ||
    text.includes("ninjutsu") ||
    hasExactName(card, [
      "Yuriko, the Tiger's Shadow",
      "Ingenious Infiltrator",
      "Mist-Syndicate Naga",
      "Mistblade Shinobi",
      "Prosperous Thief",
      "Skullsnatcher",
    ])
  );
}

function isTopdeckManipulationCard(card) {
  const text = cardText(card);

  return (
    hasExactName(card, [
      "Brainstorm",
      "Faerie Seer",
      "Halimar Depths",
      "Mystic Sanctuary",
      "Opt",
      "Ponder",
      "Portent",
      "Preordain",
      "Sage of Epityr",
      "Sage Owl",
      "Telling Time",
    ]) ||
    text.includes("scry") ||
    text.includes("surveil") ||
    text.includes("look at the top")
  );
}

function isConsultationComboCard(card) {
  const text = cardText(card);

  return (
    hasExactName(card, [
      "Demonic Consultation",
      "Dimir Infiltrator",
      "Scheming Symmetry",
      "Tainted Pact",
      "Thassa's Oracle",
      "Wishclaw Talisman",
    ]) ||
    text.includes("transmute") ||
    text.includes("name a card, then exile") ||
    text.includes("if x is greater than or equal to the number of cards in your library")
  );
}

const ARCHETYPE_CONFIGS = [
  {
    key: "yuriko-tempo",
    label: "Yuriko Ninja Tempo",
    requiredNames: ["Yuriko, the Tiger's Shadow"],
    summary: "Uses cheap evasive creatures to enable ninjutsu, manipulate the top of the library, and pressure life totals while holding up disruption.",
    signals: [
      { label: "Evasive Enablers", weight: 3, predicate: isYurikoEvasiveEnabler },
      { label: "Ninja Payoffs", weight: 4, predicate: isNinjaTempoPayoff },
      { label: "Topdeck Setup", weight: 3, predicate: isTopdeckManipulationCard },
      { label: "Consultation Combo", weight: 4, predicate: isConsultationComboCard },
    ],
  },
  {
    key: "saga-enchantress",
    label: "Saga Enchantress",
    summary: "Uses Sagas and enchantress engines to draw cards, accelerate chapters, and turn enchantment value into a token finish.",
    signals: [
      { label: "Sagas", weight: 3, predicate: isSagaCard },
      { label: "Enchantress Engines", weight: 4, predicate: isEnchantressEngine },
      { label: "Token Finishers", weight: 3, predicate: isEnchantmentTokenPayoff },
      { label: "Chapter Acceleration", weight: 2, predicate: isSagaAccelerator },
    ],
  },
  {
    key: "group-hug",
    label: "Group Hug / Politics",
    summary: "Gives opponents cards or resources, then tries to profit politically or punish the extra draws.",
    signals: [
      { label: "Shared Resources", weight: 3, predicate: isGroupBenefit },
      { label: "Political Tools", weight: 2, predicate: isPoliticalCard },
      { label: "Hug Payoffs", weight: 3, predicate: isGroupHugPayoff },
    ],
  },
  {
    key: "aura-pillowfort",
    label: "Aura Pillowfort",
    summary: "Uses Auras on friendly and opposing creatures to steer attacks, protect the pilot, and drain the table.",
    signals: [
      { label: "Aura Package", weight: 2, predicate: isAuraCard },
      { label: "Aura Control", weight: 4, predicate: isAuraControlCard },
      { label: "Aura Payoffs", weight: 3, predicate: isAuraPayoffCard },
      { label: "Attack Deterrence", weight: 2, predicate: isPillowFortCard },
    ],
  },
  {
    key: "pillow-fort",
    label: "Pillow Fort",
    summary: "Discourages attacks, redirects combat pressure, and wins after the table is slowed down.",
    signals: [
      { label: "Attack Taxes", weight: 4, predicate: isPillowFortCard },
      { label: "Politics", weight: 1, predicate: isPoliticalCard },
    ],
  },
  {
    key: "life-drain",
    label: "Life Drain",
    summary: "Converts life gain, death triggers, or repeatable drain effects into opponent life loss.",
    signals: [
      { label: "Drain Payoffs", weight: 4, predicate: isLifeDrainCard },
      { label: "Life Gain", weight: 2, predicate: isLifeGainCard },
      { label: "Sacrifice Drain", weight: 2, predicate: isAristocratsCard },
    ],
  },
  {
    key: "spellslinger-x",
    label: "Spellslinger / X-Spells",
    summary: "Uses cheap spells, ritual mana, copy effects, storm payoffs, or scalable X-spell finishers to end the game in one burst turn.",
    signals: [
      { label: "Spell Mana", weight: 3, predicate: isSpellManaEngine },
      { label: "Spell Chain", weight: 2, predicate: isSpellChainCard },
      { label: "Storm Finishers", weight: 4, predicate: isStormSpellFinisher },
      { label: "X-Spell Finishers", weight: 4, predicate: isXSpellFinisher },
    ],
  },
  {
    key: "poison",
    label: "Poison / Toxic",
    summary: "Wins through poison counters, toxic/infect combat, or proliferate pressure.",
    signals: [
      { label: "Poison Sources", weight: 4, predicate: isPoisonCard },
      { label: "Proliferate", weight: 3, predicate: isProliferateCard },
    ],
  },
  {
    key: "tokens-overrun",
    label: "Tokens / Go-Wide",
    summary: "Builds a wide board of creature tokens, then turns creature count into lethal combat or table damage.",
    signals: [
      { label: "Token Makers", weight: 3, predicate: isTokenMaker },
      { label: "Go-Wide Payoffs", weight: 4, predicate: isGoWidePayoff },
      { label: "Token Support", weight: 2, predicate: isTokenSupport },
    ],
  },
  {
    key: "stax-hatebears",
    label: "Stax / Hatebears",
    summary: "Uses tax pieces, rule-setting creatures, and attack-trigger pressure to slow the table while advancing its own plan.",
    signals: [
      { label: "Tax / Lock Pieces", weight: 4, predicate: isStaxTaxCard },
      { label: "Attack-Cheat Pressure", weight: 3, predicate: isAttackCheatCard },
    ],
  },
  {
    key: "aristocrats",
    label: "Aristocrats",
    summary: "Sacrifices creatures for value while death triggers drain the table or control the board.",
    signals: [
      { label: "Sacrifice Engine", weight: 3, predicate: isAristocratsCard },
      { label: "Drain Payoffs", weight: 2, predicate: isLifeDrainCard },
    ],
  },
  {
    key: "voltron",
    label: "Voltron",
    summary: "Stacks auras, equipment, and protection onto one main threat, often the commander.",
    signals: [
      { label: "Auras / Equipment", weight: 3, predicate: isVoltronCard },
    ],
  },
  {
    key: "reanimator",
    label: "Reanimator / Graveyard Value",
    summary: "Uses the graveyard as a staging area for recursive creatures, sacrifice loops, and high-impact creature payoffs.",
    signals: [
      { label: "Setup / Tutors", weight: 3, predicate: isGraveyardSetupCard },
      { label: "Recursion Engines", weight: 4, predicate: isGraveyardRecursionCard },
      { label: "Sacrifice Outlets", weight: 3, predicate: isSacrificeOutletCard },
      { label: "Graveyard Payoffs", weight: 3, predicate: isGraveyardPayoffCard },
    ],
  },
];

const RECOMMENDATIONS = [
  {
    name: "Ondu Spiritdancer",
    colors: ["W"],
    archetypes: ["saga-enchantress"],
    impact: "Enchantress payoff",
    fitNote: "Fits: enchantments entering repeatedly",
    reason: "Sagas and enchantment token makers give this plenty of triggers, and copying key enchantments pushes the deck toward its actual value plan.",
    priority: 10,
  },
  {
    name: "Jukai Naturalist",
    colors: ["W", "G"],
    archetypes: ["saga-enchantress"],
    impact: "Cost reducer",
    fitNote: "Fits: enchantment-dense curve",
    reason: "This makes the Saga and enchantress turns smoother without pulling the deck away from its theme.",
    priority: 9,
  },
  {
    name: "Calix, Guided by Fate",
    colors: ["W", "G"],
    archetypes: ["saga-enchantress"],
    impact: "Enchantress pressure",
    fitNote: "Fits: enchantment combat payoff",
    reason: "It rewards enchantments entering and can copy high-impact enchantments once the deck is already attacking.",
    priority: 8,
  },
  {
    name: "Yenna, Redtooth Regent",
    colors: ["W", "G"],
    archetypes: ["saga-enchantress"],
    impact: "Legendary enchantment copier",
    fitNote: "Fits: unique enchantment toolbox",
    reason: "A singleton enchantment deck gets real upside from copying the best non-Aura enchantment on board.",
    priority: 7,
  },
  {
    name: "Replenish",
    colors: ["W"],
    archetypes: ["saga-enchantress", "aura-pillowfort"],
    impact: "Mass enchantment recursion",
    fitNote: "Fits: enchantment graveyard recovery",
    reason: "Enchantment-heavy decks can lose a whole board to one answer; this turns the graveyard into one huge rebuild turn.",
    priority: 7,
  },
  {
    name: "Darksteel Mutation",
    colors: ["W"],
    archetypes: ["aura-pillowfort", "pillow-fort"],
    impact: "Threat blanker",
    fitNote: "Fits: Auras on opposing creatures",
    reason: "Eriette-style Aura Fort decks want opposing threats enchanted, harmless, and unable to turn back toward you.",
    priority: 10,
  },
  {
    name: "Minimus Containment",
    colors: ["W"],
    archetypes: ["aura-pillowfort", "pillow-fort"],
    impact: "Aura removal",
    fitNote: "Fits: removal that keeps Aura count high",
    reason: "This answers a permanent while still behaving like an Aura for the commander and enchantment package.",
    priority: 8,
  },
  {
    name: "Greater Auramancy",
    colors: ["W"],
    archetypes: ["aura-pillowfort", "pillow-fort"],
    impact: "Enchantment shield",
    fitNote: "Fits: commander-dependent Aura board",
    reason: "When the plan depends on Eriette and a board of enchantments, protecting both is worth a dedicated slot.",
    priority: 8,
  },
  {
    name: "Open the Vaults",
    colors: ["W"],
    archetypes: ["aura-pillowfort", "saga-enchantress"],
    impact: "Mass rebuild",
    fitNote: "Fits: enchantment-heavy recovery",
    reason: "Aura decks can lose a lot of cardboard to one sweeper; this turns the graveyard into a second board.",
    priority: 6,
  },
  {
    name: "Kaya's Ghostform",
    colors: ["B"],
    archetypes: ["aura-pillowfort"],
    impact: "Commander insurance",
    fitNote: "Fits: commander-centric Aura shell",
    reason: "It is cheap protection that also adds to the Aura count Eriette cares about.",
    priority: 6,
  },
  {
    name: "Historian's Boon",
    colors: ["W"],
    archetypes: ["saga-enchantress"],
    impact: "Saga token payoff",
    fitNote: "Fits: chapter counters",
    reason: "It specifically rewards Sagas entering and chapter counters being added, which matches what Satsuki is trying to do.",
    priority: 6,
  },
  {
    name: "Smothering Tithe",
    colors: ["W"],
    archetypes: ["group-hug"],
    impact: "Draw tax payoff",
    fitNote: "Fits: opponents drawing extra cards",
    reason: "If the deck is giving cards away, this turns that table generosity into mana for your actual win turn.",
    priority: 10,
  },
  {
    name: "Trouble in Pairs",
    colors: ["W"],
    archetypes: ["group-hug", "pillow-fort"],
    impact: "Catch-up draw",
    fitNote: "Fits: political tables",
    reason: "A good political deck wants opponents to do things, but still needs to keep up on cards.",
    priority: 7,
  },
  {
    name: "Faerie Mastermind",
    colors: ["U"],
    archetypes: ["group-hug"],
    impact: "Opponent-draw payoff",
    fitNote: "Fits: extra draw effects",
    reason: "This punishes the exact resource pattern Group Hug decks create: opponents drawing extra cards.",
    priority: 8,
  },
  {
    name: "Rites of Flourishing",
    colors: ["G"],
    archetypes: ["group-hug"],
    impact: "Shared engine",
    fitNote: "Fits: classic hug shell",
    reason: "It gives the table cards and lands, which is useful when the deck has ways to break parity.",
    priority: 5,
  },
  {
    name: "Kami of the Crescent Moon",
    colors: ["U"],
    archetypes: ["group-hug"],
    impact: "Shared draw",
    fitNote: "Fits: extra-card politics",
    reason: "A low-cost hug piece that keeps the table drawing while your deck looks for the payoff.",
    priority: 5,
  },
  {
    name: "Dictate of Kruphix",
    colors: ["U"],
    archetypes: ["group-hug"],
    impact: "Flash draw engine",
    fitNote: "Fits: draw-go hug",
    reason: "Flash lets you give the table cards only after you have passed with mana available.",
    priority: 5,
  },
  {
    name: "Ghostly Prison",
    colors: ["W"],
    archetypes: ["pillow-fort", "group-hug"],
    impact: "Attack tax",
    fitNote: "Fits: combat deterrence",
    reason: "A Group Hug or control-leaning deck often needs a reason for opponents to attack elsewhere.",
    priority: 8,
  },
  {
    name: "Propaganda",
    colors: ["U"],
    archetypes: ["pillow-fort", "group-hug"],
    impact: "Attack tax",
    fitNote: "Fits: blue fort shell",
    reason: "This buys time without spending removal, especially when the deck is inviting a longer game.",
    priority: 8,
  },
  {
    name: "Sphere of Safety",
    colors: ["W"],
    archetypes: ["pillow-fort"],
    impact: "Scaling fort",
    fitNote: "Fits: enchantment-heavy fort",
    reason: "If the fort is built from enchantments, this becomes one of the hardest attack taxes to beat.",
    priority: 7,
  },
  {
    name: "Crawlspace",
    colors: [],
    archetypes: ["pillow-fort"],
    impact: "Combat limiter",
    fitNote: "Fits: creature-heavy tables",
    reason: "This does not stop attacks entirely, but it prevents wide boards from deleting you in one swing.",
    priority: 5,
  },
  {
    name: "Norn's Annex",
    colors: ["W"],
    archetypes: ["pillow-fort"],
    impact: "Attack tax",
    fitNote: "Fits: white fort shell",
    reason: "It taxes attacks in a way that is awkward for many creature decks to pay through repeatedly.",
    priority: 5,
  },
  {
    name: "Windborn Muse",
    colors: ["W"],
    archetypes: ["pillow-fort"],
    impact: "Creature fort",
    fitNote: "Fits: attack tax redundancy",
    reason: "Redundant attack taxes matter because Pillow Fort decks need the shield to survive removal.",
    priority: 5,
  },
  {
    name: "Silent Arbiter",
    colors: [],
    archetypes: ["pillow-fort"],
    impact: "Combat limiter",
    fitNote: "Fits: wide-board defense",
    reason: "It keeps go-wide creature decks from overwhelming your fort in a single combat.",
    priority: 4,
  },
  {
    name: "War Tax",
    colors: ["U"],
    archetypes: ["pillow-fort"],
    impact: "Mana sink defense",
    fitNote: "Fits: blue fort control",
    reason: "This turns unused mana into a flexible attack deterrent that scales with the board.",
    priority: 4,
  },
  {
    name: "Exquisite Blood",
    colors: ["B"],
    archetypes: ["life-drain"],
    impact: "Drain combo piece",
    fitNote: "Fits: repeatable opponent life loss",
    reason: "Life-drain decks can turn small recurring drain into a true combo finish with the right partner.",
    priority: 9,
  },
  {
    name: "Vito, Thorn of the Dusk Rose",
    colors: ["B"],
    archetypes: ["life-drain"],
    impact: "Life-gain converter",
    fitNote: "Fits: gain life into drain",
    reason: "This turns life gain into damage pressure, which is exactly what lifegain-drain decks need.",
    priority: 8,
  },
  {
    name: "Blood Artist",
    colors: ["B"],
    archetypes: ["life-drain", "aristocrats"],
    impact: "Death drain",
    fitNote: "Fits: sacrifice and death triggers",
    reason: "Creature death becomes a clock, especially if the deck already has sacrifice outlets.",
    priority: 8,
  },
  {
    name: "Bastion of Remembrance",
    colors: ["B"],
    archetypes: ["life-drain", "aristocrats"],
    impact: "Resilient drain",
    fitNote: "Fits: aristocrats drain",
    reason: "An enchantment-based drain payoff is harder to remove than a creature and keeps the engine live.",
    priority: 7,
  },
  {
    name: "Reiterate",
    colors: ["R"],
    archetypes: ["spellslinger-x"],
    impact: "Copy engine",
    fitNote: "Fits: ritual and X-spell turns",
    reason: "A spell deck with burst mana wants copy effects that turn one large payoff into a table-ending turn.",
    priority: 9,
  },
  {
    name: "Mizzix's Mastery",
    colors: ["R"],
    archetypes: ["spellslinger-x"],
    impact: "Graveyard burst",
    fitNote: "Fits: spent rituals and spells",
    reason: "Spell-heavy decks naturally fill the graveyard; this converts that spent setup into a second explosive turn.",
    priority: 8,
  },
  {
    name: "Aetherflux Reservoir",
    colors: [],
    archetypes: ["spellslinger-x"],
    impact: "Spell-volume payoff",
    fitNote: "Fits: cheap spell chains",
    reason: "If the deck can chain several spells in one turn, this gives the spell count itself a clean win condition.",
    priority: 7,
  },
  {
    name: "Skrelv's Hive",
    colors: ["W"],
    archetypes: ["poison"],
    impact: "Toxic engine",
    fitNote: "Fits: poison pressure",
    reason: "It provides a steady stream of toxic attackers, which matters when poison needs repeated contact.",
    priority: 8,
  },
  {
    name: "Bloated Contaminator",
    colors: ["G"],
    archetypes: ["poison"],
    impact: "Toxic plus proliferate",
    fitNote: "Fits: poison and counters",
    reason: "It both applies poison and grows poison counters once one opponent is marked.",
    priority: 8,
  },
  {
    name: "Venerated Rotpriest",
    colors: ["G"],
    archetypes: ["poison"],
    impact: "Targeting payoff",
    fitNote: "Fits: toxic creature shell",
    reason: "This gives poison decks a noncombat way to add counters when creatures are being targeted.",
    priority: 7,
  },
  {
    name: "Evolution Sage",
    colors: ["G"],
    archetypes: ["poison"],
    impact: "Landfall proliferate",
    fitNote: "Fits: poison counters already applied",
    reason: "Once poison counters are on the table, every land drop can push the win without more combat damage.",
    priority: 7,
  },
  {
    name: "Infectious Inquiry",
    colors: ["B"],
    archetypes: ["poison"],
    impact: "Poison plus cards",
    fitNote: "Fits: black poison decks",
    reason: "It adds a poison counter while replacing itself, which helps poison decks keep pressure without overcommitting.",
    priority: 5,
  },
  {
    name: "Tainted Strike",
    colors: ["B"],
    archetypes: ["poison"],
    impact: "Surprise poison kill",
    fitNote: "Fits: big attacker or combat burst",
    reason: "It can turn a single large attacker into a sudden poison-clock finisher.",
    priority: 6,
  },
  {
    name: "Triumph of the Hordes",
    colors: ["G"],
    archetypes: ["poison"],
    impact: "Poison finisher",
    fitNote: "Fits: creature board poison kill",
    reason: "If the deck makes a board, this can convert normal combat into a poison finish immediately.",
    priority: 6,
  },
  {
    name: "Mondrak, Glory Dominus",
    colors: ["W"],
    archetypes: ["tokens-overrun"],
    impact: "Token doubler",
    fitNote: "Fits: creature-token density",
    reason: "A go-wide deck wants its token makers to cross critical mass quickly; Mondrak doubles the board without changing the plan.",
    priority: 10,
  },
  {
    name: "Shared Animosity",
    colors: ["R"],
    archetypes: ["tokens-overrun"],
    impact: "Combat multiplier",
    fitNote: "Fits: go-wide combat math",
    reason: "This turns a wide board into a real damage step, especially when the deck is already attacking with many small creatures.",
    priority: 8,
  },
  {
    name: "Purphoros, God of the Forge",
    colors: ["R"],
    archetypes: ["tokens-overrun"],
    impact: "Token damage",
    fitNote: "Fits: repeated token creation",
    reason: "If the deck is making bodies every turn, Purphoros gives those bodies reach even through stalled combat.",
    priority: 8,
  },
  {
    name: "Second Harvest",
    colors: ["G"],
    archetypes: ["tokens-overrun"],
    impact: "Token burst",
    fitNote: "Fits: established token board",
    reason: "A token deck often needs one card that turns a modest board into a lethal board at instant speed.",
    priority: 6,
  },
  {
    name: "Thalia, Guardian of Thraben",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Tax piece",
    fitNote: "Fits: proactive stax",
    reason: "Pressure-control decks want cheap bodies that slow opponents while still attacking.",
    priority: 9,
  },
  {
    name: "Drannith Magistrate",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Commander lock",
    fitNote: "Fits: hatebear pressure",
    reason: "This is one of the cleanest hatebears for Commander tables because it attacks commanders and free-cast plans at once.",
    priority: 9,
  },
  {
    name: "Archon of Emeria",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Rule of Law body",
    fitNote: "Fits: creature-based stax",
    reason: "A stax deck that wins through combat would rather staple Rule of Law pressure to a body when possible.",
    priority: 8,
  },
  {
    name: "Esper Sentinel",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Hatebear draw",
    fitNote: "Fits: cheap pressure and taxes",
    reason: "It pressures opponents' noncreature spells while giving proactive stax decks a way to keep cards moving.",
    priority: 8,
  },
  {
    name: "Ranger-Captain of Eos",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Silence payload",
    fitNote: "Fits: creature-based stax",
    reason: "This finds small enablers and can protect the decisive combat turn by shutting off noncreature interaction.",
    priority: 7,
  },
  {
    name: "Boromir, Warden of the Tower",
    colors: ["W"],
    archetypes: ["stax-hatebears"],
    impact: "Free-spell hate",
    fitNote: "Fits: proactive white stax",
    reason: "It taxes free-cast lines while also protecting a creature board when the stax deck has to turn sideways.",
    priority: 7,
  },
  {
    name: "Skullclamp",
    colors: [],
    archetypes: ["aristocrats"],
    impact: "Sacrifice draw",
    fitNote: "Fits: expendable creatures",
    reason: "Aristocrats decks need to keep cards flowing while sacrificing creatures.",
    priority: 9,
  },
  {
    name: "Pitiless Plunderer",
    colors: ["B"],
    archetypes: ["aristocrats"],
    impact: "Sacrifice mana",
    fitNote: "Fits: creature death loops",
    reason: "This turns death triggers into mana, which helps sacrifice decks chain turns together.",
    priority: 8,
  },
  {
    name: "Swiftfoot Boots",
    colors: [],
    archetypes: ["voltron"],
    impact: "Commander protection",
    fitNote: "Fits: single-threat decks",
    reason: "Voltron decks need the main threat to survive and attack on schedule.",
    priority: 7,
  },
  {
    name: "Blackblade Reforged",
    colors: [],
    archetypes: ["voltron"],
    impact: "Commander damage",
    fitNote: "Fits: land-heavy commander damage",
    reason: "It turns a protected commander into a real damage clock as the game goes long.",
    priority: 6,
  },
  {
    name: "Reanimate",
    colors: ["B"],
    archetypes: ["reanimator"],
    impact: "Efficient recursion",
    fitNote: "Fits: graveyard creature plan",
    reason: "If the deck is already setting up the graveyard, this is one of the most efficient ways to cash in.",
    priority: 9,
  },
  {
    name: "Buried Alive",
    colors: ["B"],
    archetypes: ["reanimator"],
    impact: "Graveyard setup",
    fitNote: "Fits: creature recursion",
    reason: "This finds the exact creatures the reanimation plan wants to bring back.",
    priority: 8,
  },
  {
    name: "Victimize",
    colors: ["B"],
    archetypes: ["reanimator", "aristocrats"],
    impact: "Sacrifice recursion",
    fitNote: "Fits: creature fodder plus graveyard payoffs",
    reason: "This turns one expendable body into two returned creatures, which is exactly the exchange graveyard-value decks want.",
    priority: 8,
  },
  {
    name: "Animate Dead",
    colors: ["B"],
    archetypes: ["reanimator"],
    impact: "Cheap reanimation",
    fitNote: "Fits: graveyard creature plan",
    reason: "A cheap reanimation spell helps the deck cash in on graveyard setup without waiting for the commander.",
    priority: 7,
  },
  {
    name: "Viscera Seer",
    colors: ["B"],
    archetypes: ["reanimator", "aristocrats"],
    impact: "Free sacrifice outlet",
    fitNote: "Fits: death triggers and recursion",
    reason: "Free sacrifice outlets let Meren-style decks control when creatures die and rebuy the right piece each turn.",
    priority: 7,
  },
];

function statusForScore(score) {
  if (score >= 12) return "Strong Match";
  if (score >= 7) return "Likely";
  if (score > 0) return "Light Signal";
  return "No Signal";
}

function buildArchetype(config, entries) {
  if (config.requiredNames?.length) {
    const names = new Set(entries.map(entry => normalizeCardName(entry.card?.name || "")));
    const hasRequiredName = config.requiredNames.some(name => names.has(normalizeCardName(name)));
    if (!hasRequiredName) {
      return {
        ...config,
        signals: config.signals.map(signal => ({ label: signal.label, cards: [], score: 0 })),
        score: 0,
        status: "No Signal",
        examples: [],
      };
    }
  }

  const signals = config.signals.map(signal => {
    const cards = uniqueMatches(entries, signal.predicate);
    return {
      label: signal.label,
      cards,
      score: cards.reduce((sum, entry) => sum + (entry.qty || 1), 0) * signal.weight,
    };
  });
  const score = signals.reduce((sum, signal) => sum + signal.score, 0);

  return {
    ...config,
    signals,
    score,
    status: statusForScore(score),
    examples: signals.flatMap(signal => signal.cards).slice(0, MAX_SIGNAL_CARDS),
  };
}

function buildProfile(analysis, archetypes) {
  const names = getDeckNameKeys(analysis);
  const allowedColors = getDeckColors(analysis);
  const archetypeMap = new Map(archetypes.map(archetype => [archetype.key, archetype]));
  const activeArchetypes = archetypes.filter(archetype => archetype.score > 0);
  const primary = activeArchetypes[0] || null;

  return {
    names,
    allowedColors,
    archetypeMap,
    activeArchetypes,
    primary,
    archetype: key => archetypeMap.get(key) || { score: 0, signals: [] },
  };
}

function recommendationScore(rec, profile) {
  const archetypeScore = rec.archetypes.reduce((score, key) => {
    const archetype = profile.archetype(key);
    const primaryBonus = profile.primary?.key === key ? 1.25 : 0.7;
    return score + archetype.score * primaryBonus;
  }, 0);
  return archetypeScore + (rec.priority || 0);
}

const SUPPORTING_RECOMMENDATION_ARCHETYPES = {
  reanimator: ["aristocrats"],
  aristocrats: ["reanimator", "life-drain"],
  "life-drain": ["aristocrats"],
  "aura-pillowfort": ["pillow-fort"],
  "pillow-fort": ["aura-pillowfort", "group-hug"],
  "tokens-overrun": ["aristocrats"],
};

function isRecommendationRelevantToPrimary(rec, profile) {
  const primaryKey = profile.primary?.key;
  if (!primaryKey) return true;
  if (rec.archetypes.includes(primaryKey)) return true;

  const support = SUPPORTING_RECOMMENDATION_ARCHETYPES[primaryKey] || [];
  return rec.archetypes.some(key => support.includes(key) && profile.archetype(key).score >= 7);
}

function buildRecommendations(profile, limit = 6) {
  if (!profile.activeArchetypes.length) return [];

  return RECOMMENDATIONS
    .filter(rec => !profile.names.has(normalizeCardName(rec.name)))
    .filter(rec => profile.allowedColors.length === 0 || isSubset(rec.colors, profile.allowedColors))
    .filter(rec => rec.archetypes.some(key => profile.archetype(key).score >= 4))
    .filter(rec => isRecommendationRelevantToPrimary(rec, profile))
    .map(rec => ({
      ...rec,
      score: recommendationScore(rec, profile),
      searchUrl: scryfallExactUrl(rec.name),
    }))
    .filter(rec => rec.score >= 6)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildArchetypeProfile(analysis) {
  const entries = (analysis?.cardList || []).filter(({ card }) => card);
  if (!entries.length) return null;

  const archetypes = ARCHETYPE_CONFIGS
    .map(config => buildArchetype(config, entries))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  const profile = buildProfile(analysis, archetypes);

  return {
    primary: profile.primary,
    archetypes: profile.activeArchetypes.slice(0, 5),
    recommendations: buildRecommendations(profile),
  };
}
