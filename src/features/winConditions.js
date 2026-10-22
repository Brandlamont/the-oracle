import { getCardColors, getOracleText, isSubset, sortColorIdentity } from "../utils/cardUtils.js";

const MAX_EXAMPLES = 6;

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

function nameIncludesAny(card, needles) {
  const name = cardName(card);
  return includesAny(name, needles.map(lower));
}

function textIncludesAny(card, needles) {
  const text = cardText(card);
  return includesAny(text, needles.map(lower));
}

function hasExactName(card, names) {
  const name = cardName(card);
  return names.some(candidate => name === lower(candidate));
}

function isLand(card) {
  return cardType(card).includes("land");
}

function uniqueMatches(entries, predicate) {
  const seen = new Set();
  const matches = [];

  for (const entry of entries) {
    if (!entry?.card || !predicate(entry.card, entry)) continue;

    const key = entry.card.id || lower(entry.card.name);
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(entry);
  }

  return matches.slice(0, MAX_EXAMPLES);
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
    keys.add(lower(card.name));
    lower(card.name).split("//").map(part => part.trim()).filter(Boolean).forEach(part => keys.add(part));
  }

  return keys;
}

const FETCH_LAND_NAMES = [
  "Arid Mesa",
  "Bloodstained Mire",
  "Flooded Strand",
  "Marsh Flats",
  "Misty Rainforest",
  "Polluted Delta",
  "Prismatic Vista",
  "Scalding Tarn",
  "Verdant Catacombs",
  "Windswept Heath",
  "Wooded Foothills",
];

function countEntries(entries, predicate) {
  return entries.reduce((sum, entry) => sum + (predicate(entry.card, entry) ? entry.qty || 1 : 0), 0);
}

function getLane(lanes, key) {
  return lanes.find(lane => lane.key === key);
}

function buildDeckProfile(analysis, lanes) {
  const entries = (analysis?.cardList || []).filter(({ card }) => card);
  const names = getDeckNameKeys(analysis);
  const allowedColors = getDeckColors(analysis);
  const laneMap = new Map(lanes.map(lane => [lane.key, lane]));
  const activeLanes = lanes.filter(lane => lane.score >= 5);
  const primaryLane = activeLanes[0] || lanes[0] || null;
  const commanderText = cardText(analysis?.commanderCard);

  const instantSorceryCount = countEntries(entries, card => {
    const type = cardType(card);
    return type.includes("instant") || type.includes("sorcery");
  });
  const cheapSpellCount = countEntries(entries, card => {
    const type = cardType(card);
    return (type.includes("instant") || type.includes("sorcery")) && (card?.cmc || 0) <= 2;
  });
  const fetchlandCount = countEntries(entries, card => {
    const name = card?.name || "";
    const text = cardText(card);
    return (
      FETCH_LAND_NAMES.some(fetchName => lower(fetchName) === lower(name)) ||
      isLand(card) && text.includes("pay 1 life") && text.includes("search your library")
    );
  });
  const basicSwampCount = countEntries(entries, card => lower(card?.name) === "swamp");

  const hasCard = namesToCheck => namesToCheck.some(name => names.has(lower(name)));
  const lane = key => laneMap.get(key) || { engines: [], payoffs: [], amplifiers: [], score: 0 };
  const laneScore = key => lane(key).score || 0;
  const landfallDrainLane = lane("landfall-drain");
  const landfallTokenLane = lane("token-swarm");
  const landSacLane = lane("land-sacrifice");

  return {
    entries,
    names,
    allowedColors,
    laneMap,
    activeLanes,
    primaryLane,
    primaryLaneKey: primaryLane?.key,
    commanderName: analysis?.commanderCard?.name || analysis?.commanderName || "",
    commanderText,
    landCount: analysis?.landCount || 0,
    basicSwampCount,
    instantSorceryCount,
    cheapSpellCount,
    fetchlandCount,
    hasCard,
    lane,
    laneScore,
    hasBigManaPlan: laneScore("big-mana-x") >= 7,
    hasSpellslingerPlan: laneScore("spellslinger-copy") >= 7 || instantSorceryCount >= 20,
    hasLandPlan:
      (landfallDrainLane.score >= 7 && landfallDrainLane.payoffs.length > 0) ||
      (landfallTokenLane.score >= 7 && landfallTokenLane.payoffs.length >= 2) ||
      landSacLane.score >= 7,
    hasLandSacPlan: landSacLane.score >= 7,
    hasTokenPlan: laneScore("token-swarm") >= 7,
    hasGoWidePlan: laneScore("token-overrun") >= 8,
    hasLandDrainPlan: landfallDrainLane.score >= 7 && landfallDrainLane.payoffs.length > 0,
    hasFetchPackage: fetchlandCount >= 4,
    hasScapeshift: hasCard(["Scapeshift"]),
    hasManaGeyser: hasCard(["Mana Geyser"]),
    hasExsanguinate: hasCard(["Exsanguinate"]),
    hasFieldOrScute: hasCard(["Field of the Dead", "Scute Swarm", "Springheart Nantuko"]),
  };
}

function scryfallExactUrl(name) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;
}

function isBigManaEngine(card) {
  if (isLand(card)) return false;

  const name = cardName(card);
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Dark Ritual",
      "Desperate Ritual",
      "Mana Geyser",
      "Storm-Kiln Artist",
      "Baral, Chief of Compliance",
      "Goblin Electromancer",
      "Nightscape Familiar",
      "Sol Ring",
      "Arcane Signet",
      "Dimir Signet",
      "Izzet Signet",
      "Rakdos Signet",
      "Talisman of Creativity",
      "Talisman of Dominance",
      "Talisman of Indulgence",
    ]) ||
    name.includes("ritual") ||
    text.includes("add {") ||
    text.includes("create a treasure") ||
    text.includes("treasure token") ||
    text.includes("costs {1} less") ||
    text.includes("costs one less")
  );
}

function isXSpellPayoff(card) {
  if (isLand(card)) return false;

  const text = cardText(card);
  if (!hasXCost(card)) return false;

  return (
    hasExactName(card, [
      "Exsanguinate",
      "Torment of Hailfire",
      "Fall of the Titans",
      "Expansion // Explosion",
      "Explosion",
      "Stroke of Genius",
      "Crackle with Power",
      "Electrodominance",
      "Pull from Tomorrow",
    ]) ||
    (
      text.includes("each opponent") ||
      text.includes("target player") ||
      text.includes("target opponent") ||
      text.includes("deals") ||
      text.includes("loses") ||
      text.includes("draw")
    )
  );
}

function isStormFinisher(card) {
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

function isSpellMultiplier(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Dualcaster Mage",
      "Increasing Vengeance",
      "Repeated Reverberation",
      "Veyran, Voice of Duality",
      "Thousand-Year Storm",
      "Bonus Round",
      "Reiterate",
      "Narset's Reversal",
    ]) ||
    text.includes("copy target instant or sorcery") ||
    text.includes("copy target spell") ||
    text.includes("copy an instant or sorcery") ||
    text.includes("copy it") ||
    text.includes("triggers an additional time") ||
    text.includes("triggers additional")
  );
}

function isSpellslingerEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Archmage Emeritus",
      "Baral, Chief of Compliance",
      "Goblin Electromancer",
      "Nightscape Familiar",
      "Storm-Kiln Artist",
      "Veyran, Voice of Duality",
      "Snapcaster Mage",
      "Torrential Gearhulk",
      "Mizzix's Mastery",
      "Past in Flames",
    ]) ||
    text.includes("whenever you cast an instant or sorcery") ||
    text.includes("whenever you cast or copy an instant or sorcery") ||
    text.includes("instant or sorcery card from your graveyard") ||
    text.includes("flashback")
  );
}

function isSpellslingerPayoff(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Guttersnipe",
      "Electrostatic Field",
      "Fiery Inscription",
      "Exalted Flamer of Tzeentch",
      "Aetherflux Reservoir",
      "Tendrils of Agony",
      "Fire Lord Azula",
    ]) ||
    isStormFinisher(card) ||
    (text.includes("whenever you cast") && text.includes("instant") && text.includes("sorcery") && (
      text.includes("damage") ||
      text.includes("each opponent") ||
      text.includes("loses")
    )) ||
    (text.includes("magecraft") && (
      text.includes("damage") ||
      text.includes("each opponent") ||
      text.includes("loses")
    ))
  );
}

function isConsultationComboPiece(card) {
  return hasExactName(card, ["Thassa's Oracle", "Demonic Consultation", "Tainted Pact"]);
}

function isConsultationFinder(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Demonic Consultation",
      "Dimir Infiltrator",
      "Demonic Tutor",
      "Imperial Seal",
      "Mystical Tutor",
      "Scheming Symmetry",
      "Vampiric Tutor",
      "Wishclaw Talisman",
    ]) ||
    text.includes("search your library for a card") ||
    text.includes("transmute") ||
    text.includes("name a card")
  );
}

function isConsultationProtectionOrBurst(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Ad Nauseam",
      "Counterspell",
      "Culling the Weak",
      "Dark Ritual",
      "Dispel",
      "Duress",
      "Miscast",
      "Negate",
      "Peer into the Abyss",
      "Spell Pierce",
      "Swan Song",
    ]) ||
    text.includes("counter target") ||
    text.includes("target opponent reveals their hand") ||
    text.includes("add {") ||
    text.includes("draw cards equal")
  );
}

function isPoisonSource(card) {
  return (
    hasExactName(card, [
      "Atraxa, Praetors' Voice",
      "Blighted Agent",
      "Bloated Contaminator",
      "Bloodroot Apothecary",
      "Contaminant Grafter",
      "Fynn, the Fangbearer",
      "Ichor Rats",
      "Infectious Inquiry",
      "Pestilent Syphoner",
      "Phyresis Outbreak",
      "Plague Stinger",
      "Prologue to Phyresis",
      "Skithiryx, the Blight Dragon",
      "Skrelv, Defector Mite",
      "Tainted Strike",
      "Triumph of the Hordes",
      "Venerated Rotpriest",
      "Vraska's Fall",
    ]) ||
    textIncludesAny(card, ["toxic", "infect", "poison counter", "poison counters", "corrupted"])
  );
}

function isProliferateEngine(card) {
  return (
    hasExactName(card, [
      "Atraxa, Praetors' Voice",
      "Evolution Sage",
      "Ezuri, Stalker of Spheres",
      "Flux Channeler",
      "Inexorable Tide",
      "Staff of Compleation",
      "Tekuthal, Inquiry Dominus",
      "Tezzeret's Gambit",
      "Vorinclex, Monstrous Raider",
    ]) ||
    textIncludesAny(card, ["proliferate"])
  );
}

function isPoisonAmplifier(card) {
  return (
    hasExactName(card, [
      "Tekuthal, Inquiry Dominus",
      "Vorinclex, Monstrous Raider",
      "Tainted Strike",
      "Triumph of the Hordes",
      "Skrelv's Hive",
      "Contagion Engine",
    ]) ||
    textIncludesAny(card, [
      "proliferate twice",
      "additional time",
      "double the number of each kind of counter",
      "toxic 1 and can't block",
    ])
  );
}

function isLandfallEngine(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    hasExactName(card, [
      "Exploration",
      "Oracle of Mul Daya",
      "Crucible of Worlds",
      "Ramunap Excavator",
      "Aftermath Analyst",
      "Scapeshift",
      "Crop Rotation",
      "Harrow",
      "Entish Restoration",
      "Cultivate",
      "Farseek",
      "Nature's Lore",
      "Sakura-Tribe Elder",
      "Lotus Cobra",
      "Nissa, Resurgent Animist",
      "Squandered Resources",
      "Lord Windgrace",
      "Lumra, Bellow of the Woods",
    ]) ||
    text.includes("you may play an additional land") ||
    text.includes("play lands from your graveyard") ||
    text.includes("put a land card") && text.includes("onto the battlefield") ||
    text.includes("search your library") && text.includes("land card") && text.includes("onto the battlefield") ||
    (type.includes("land") && text.includes("search your library") && text.includes("land"))
  );
}

function isLandfallDrainPayoff(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Retreat to Hagra",
      "Ob Nixilis, the Fallen",
      "Dread Presence",
      "Iridescent Vinelasher",
      "Valakut Exploration",
      "Mayhem Devil",
    ]) ||
    text.includes("landfall") && (
      text.includes("each opponent loses") ||
      text.includes("target player loses") ||
      text.includes("deals") ||
      text.includes("damage to each opponent")
    ) ||
    text.includes("whenever a land enters") && (
      text.includes("loses") ||
      text.includes("damage")
    )
  );
}

function isTokenSwarmPayoff(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Field of the Dead",
      "Scute Swarm",
      "Springheart Nantuko",
      "Omnath, Locus of Rage",
      "Avenger of Zendikar",
    ]) ||
    text.includes("landfall") && text.includes("create") && text.includes("token") ||
    text.includes("whenever a land enters") && text.includes("create") && text.includes("token")
  );
}

function isGoWideTokenMaker(card) {
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
      "Undercellar Myconid",
    ]) ||
    text.includes("create") && text.includes("creature token") ||
    text.includes("create") && text.includes("tokens") && text.includes("creature")
  );
}

function isGoWideCombatPayoff(card) {
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
      "Warleader's Call",
    ]) ||
    text.includes("creatures you control get") ||
    text.includes("creature tokens you control") ||
    text.includes("for each creature you control") ||
    text.includes("if you control six or more creatures")
  );
}

function isGoWideProtectionOrDraw(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Bennie Bracks, Zoologist",
      "Clever Concealment",
      "Giver of Runes",
      "Mother of Runes",
      "Ohran Frostfang",
      "Selfless Spirit",
      "Skullclamp",
      "The Wandering Rescuer",
    ]) ||
    text.includes("tokens would be created") ||
    text.includes("creatures you control gain indestructible") ||
    text.includes("draw a card") && text.includes("creature token")
  );
}

function isStaxPressureEngine(card) {
  return (
    hasExactName(card, [
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
    ]) ||
    textIncludesAny(card, [
      "can't cast more than one spell",
      "can't search libraries",
      "nonbasic lands are mountains",
      "put that card onto the battlefield tapped and attacking",
      "whenever a non-human creature you control attacks",
    ])
  );
}

function isStaxCombatPayoff(card) {
  return (
    hasExactName(card, [
      "Angrath's Marauders",
      "Auratouched Mage",
      "Blade Historian",
      "Combat Celebrant",
      "Winota, Joiner of Forces",
      "Zealous Conscripts",
    ]) ||
    textIncludesAny(card, [
      "double strike",
      "damage would be dealt",
      "additional combat phase",
      "tapped and attacking",
    ])
  );
}

function isLandSacEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Zuran Orb",
      "Squandered Resources",
      "Scapeshift",
      "Crop Rotation",
      "Harrow",
      "Entish Restoration",
      "Constant Mists",
      "Lotus Field",
      "Sylvan Safekeeper",
      "Glacial Chasm",
    ]) ||
    text.includes("sacrifice a land") ||
    text.includes("sacrifice lands") ||
    text.includes("sacrifice any number of lands")
  );
}

function isLandSacPayoff(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Mayhem Devil",
      "Titania, Protector of Argoth",
      "Titania, Nature's Force",
      "World Shaper",
      "Splendid Reclamation",
      "Aftermath Analyst",
    ]) ||
    text.includes("whenever a land is put into your graveyard") ||
    text.includes("whenever you sacrifice") && (text.includes("damage") || text.includes("create"))
  );
}

function isCombatEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Field of the Dead",
      "Scute Swarm",
      "Ashaya, Soul of the Wild",
      "Nissa, Who Shakes the World",
      "Nissa, Resurgent Animist",
      "Moraug, Fury of Akoum",
      "Craterhoof Behemoth",
    ]) ||
    text.includes("creatures you control get") ||
    text.includes("additional combat phase") ||
    text.includes("create") && text.includes("creature token")
  );
}

function isEnchantressValueEngine(card) {
  const type = cardType(card);
  return (
    type.includes("saga") ||
    hasExactName(card, [
      "Satsuki, the Living Lore",
      "Sythis, Harvest's Hand",
      "Mesa Enchantress",
      "Satyr Enchanter",
      "Eidolon of Blossoms",
      "Setessan Champion",
      "Enchantress's Presence",
      "Argothian Enchantress",
      "Sanctum Weaver",
      "Jukai Naturalist",
      "Herald of the Pantheon",
      "Starfield Mystic",
    ]) ||
    textIncludesAny(card, [
      "whenever you cast an enchantment spell",
      "whenever an enchantment enters the battlefield under your control",
      "constellation",
      "put a lore counter",
      "enchantment spells you cast cost",
    ])
  );
}

function isEnchantmentTokenPayoff(card) {
  const text = cardText(card);
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
      "Anointed Procession",
      "Parallel Lives",
    ]) ||
    text.includes("whenever you cast an enchantment spell") && text.includes("create") ||
    text.includes("whenever an enchantment enters the battlefield under your control") && text.includes("create") ||
    text.includes("tokens would be created under your control") ||
    text.includes("creature tokens you control")
  );
}

function isAuraPlanEngine(card) {
  const type = cardType(card);
  return (
    type.includes("aura") ||
    hasExactName(card, [
      "Hero of Iroas",
      "Killian, Ink Duelist",
      "Kor Spiritdancer",
      "Light-Paws, Emperor's Voice",
      "Mesa Enchantress",
      "Ondu Spiritdancer",
      "Sram, Senior Edificer",
      "Starfield Mystic",
      "Transcendent Envoy",
    ]) ||
    textIncludesAny(card, [
      "aura spell",
      "aura card",
      "aura you control",
      "auras you control",
      "enchanted creature",
      "whenever you cast an enchantment spell",
    ])
  );
}

function isAuraDrainOrPressurePayoff(card) {
  return (
    hasExactName(card, [
      "All That Glitters",
      "Archon of Sun's Grace",
      "Dead Man's Chest",
      "Eriette of the Charmed Apple",
      "Ethereal Armor",
      "Grim Guardian",
      "Hateful Eidolon",
      "Light of Promise",
      "Lord Skitter's Blessing",
      "Mantle of the Ancients",
      "Morgul-Knife Wound",
      "Nettlevine Blight",
      "Nurgle's Rot",
      "Sage's Reverie",
      "Vampiric Link",
      "Wicked Visitor",
      "Withercrown",
    ]) ||
    textIncludesAny(card, [
      "each opponent loses",
      "whenever an enchantment enters",
      "whenever enchanted creature dies",
      "for each aura",
      "number of auras you control",
      "auras you control",
      "enchanted creature gets +",
    ])
  );
}

function isAuraPlanProtection(card) {
  return (
    hasExactName(card, [
      "Flawless Maneuver",
      "Greater Auramancy",
      "Karametra's Blessing",
      "Kaya's Ghostform",
      "Mantle of the Ancients",
      "Open the Vaults",
      "Replenish",
      "Retether",
      "Teferi's Protection",
      "Timely Ward",
    ]) ||
    textIncludesAny(card, [
      "return all aura cards",
      "return all enchantment cards",
      "return target enchantment",
      "enchanted creature has hexproof",
      "enchanted creature has indestructible",
      "permanents you control phase out",
      "permanents you control gain hexproof",
      "you gain protection from everything",
    ])
  );
}

function isGraveyardValueEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Animate Dead",
      "Buried Alive",
      "Dance of the Dead",
      "Entomb",
      "Eternal Witness",
      "Living Death",
      "Meren of Clan Nel Toth",
      "Necromancy",
      "Reanimate",
      "Stitcher's Supplier",
      "Survival of the Fittest",
      "Timeless Witness",
      "Unmarked Grave",
      "Victimize",
    ]) ||
    text.includes("return target creature card from your graveyard to the battlefield") ||
    text.includes("return a creature card from your graveyard to the battlefield") ||
    text.includes("return target creature card from your graveyard to your hand") ||
    text.includes("return target card from your graveyard to your hand") ||
    text.includes("put target creature card from a graveyard onto the battlefield") ||
    text.includes("search your library for a card and put that card into your graveyard") ||
    text.includes("mill three cards") ||
    text.includes("mill four cards") ||
    text.includes("mill five cards")
  );
}

function isGraveyardValuePayoff(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    hasExactName(card, [
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
    text.includes("dies") && text.includes("search your library") ||
    text.includes("dies") && text.includes("return")
  );
}

function isSacrificeOutletOrDeathEngine(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Altar of Dementia",
      "Ashnod's Altar",
      "Carrion Feeder",
      "Culling the Weak",
      "Phyrexian Altar",
      "Viscera Seer",
      "Woe Strider",
      "Yawgmoth, Thran Physician",
    ]) ||
    text.includes("sacrifice a creature") ||
    text.includes("sacrifice another creature") ||
    text.includes("sacrifice any number of creatures") ||
    text.includes("whenever a creature dies") ||
    text.includes("whenever another creature dies")
  );
}

function isOverrunFinisher(card) {
  return (
    hasExactName(card, [
      "Craterhoof Behemoth",
      "Pathbreaker Ibex",
      "End-Raze Forerunners",
      "Moonshaker Cavalry",
      "Finale of Devastation",
      "Overwhelming Stampede",
      "Triumph of the Hordes",
      "Starfield of Nyx",
    ]) ||
    textIncludesAny(card, [
      "creatures you control get",
      "creatures you control gain trample",
      "base power and toughness",
    ])
  );
}

function statusForLane(lane) {
  if (lane.payoffs.length >= 2 && lane.engines.length >= 2) return "Live Plan";
  if (lane.payoffs.length >= 1 && lane.engines.length >= 1) return "Coming Together";
  if (lane.engines.length >= 2) return "Needs Payoff";
  if (lane.payoffs.length >= 2) return "Needs Setup";
  return "Weak Signal";
}

function missingForLane(lane) {
  const missing = [];

  if (lane.engines.length < 2) missing.push(lane.engineGap);
  if (lane.payoffs.length < 2) missing.push(lane.payoffGap);
  if (lane.amplifierGap && lane.amplifiers.length < 1) missing.push(lane.amplifierGap);

  return missing.filter(Boolean).slice(0, 3);
}

const LANE_CONFIGS = [
  {
    key: "oracle-consultation",
    label: "Oracle Consultation Combo",
    shortLabel: "Oracle",
    summary: "Assemble Thassa's Oracle with Demonic Consultation or Tainted Pact, then win as the Oracle trigger resolves.",
    engineLabel: "Tutors / setup",
    payoffLabel: "Combo pieces",
    amplifierLabel: "Protection / burst",
    engineGap: "This lane wants more ways to find or protect the two-card package.",
    payoffGap: "The lane needs both Thassa's Oracle and a library-exile partner before it is a real combo finish.",
    amplifierGap: "Cheap protection or burst draw helps force the combo through interaction.",
    engine: isConsultationFinder,
    payoff: isConsultationComboPiece,
    amplifier: isConsultationProtectionOrBurst,
    weights: { engine: 2, payoff: 5, amplifier: 1 },
  },
  {
    key: "big-mana-x",
    label: "Big Mana X-Spells",
    shortLabel: "X-Spells",
    summary: "Build a burst of mana, then convert it into one lethal spell or a massive draw/burn turn.",
    engineLabel: "Mana",
    payoffLabel: "Finishers",
    amplifierLabel: "Copy",
    engineGap: "More burst mana or cost reduction would make the kill turns easier to assemble.",
    payoffGap: "This lane wants another true mana sink that can end the game from a large X value.",
    amplifierGap: "One more copy or recursion piece would turn a single payoff into a table kill.",
    engine: isBigManaEngine,
    payoff: isXSpellPayoff,
    amplifier: isSpellMultiplier,
    weights: { engine: 1, payoff: 3, amplifier: 2 },
  },
  {
    key: "spellslinger-copy",
    label: "Spellslinger Copy Burst",
    shortLabel: "Spellslinger",
    summary: "Chain cheap spells through reducers, draw engines, and copy effects until spell payoffs close the table.",
    engineLabel: "Engines",
    payoffLabel: "Payoffs",
    amplifierLabel: "Copy",
    engineGap: "More cast/copy engines would keep the chain from stalling.",
    payoffGap: "Add a payoff that directly turns spell volume into opponent life loss or damage.",
    amplifierGap: "Copy effects help this lane shift from value to a real finishing turn.",
    engine: isSpellslingerEngine,
    payoff: isSpellslingerPayoff,
    amplifier: isSpellMultiplier,
    weights: { engine: 2, payoff: 3, amplifier: 2 },
  },
  {
    key: "poison-proliferate",
    label: "Poison Proliferate Clock",
    shortLabel: "Poison",
    summary: "Seed poison counters early, then use proliferate engines and doublers to turn one counter into a tablewide clock.",
    engineLabel: "Poison sources",
    payoffLabel: "Proliferate",
    amplifierLabel: "Doublers / burst",
    engineGap: "This lane needs reliable ways to put the first poison counter on each opponent.",
    payoffGap: "More proliferate turns poison from combat damage into inevitability.",
    amplifierGap: "A doubler or burst poison card gives the clock a real closing turn.",
    engine: isPoisonSource,
    payoff: isProliferateEngine,
    amplifier: isPoisonAmplifier,
    weights: { engine: 3, payoff: 3, amplifier: 2 },
  },
  {
    key: "token-overrun",
    label: "Token Overrun",
    shortLabel: "Tokens",
    summary: "Make a wide board, cross anthem or commander thresholds, and convert creature count into one lethal combat step.",
    engineLabel: "Token makers",
    payoffLabel: "Anthems / closers",
    amplifierLabel: "Protection / draw",
    engineGap: "More repeatable token production would make the deck less dependent on one burst spell.",
    payoffGap: "This lane wants a cleaner overrun, anthem, or impact-damage payoff to turn bodies into wins.",
    amplifierGap: "Wide boards need protection or refill so one sweeper does not erase the plan.",
    engine: isGoWideTokenMaker,
    payoff: isGoWideCombatPayoff,
    amplifier: isGoWideProtectionOrDraw,
    weights: { engine: 3, payoff: 3, amplifier: 2 },
  },
  {
    key: "stax-snowball",
    label: "Stax Combat Snowball",
    shortLabel: "Stax",
    summary: "Slow opponents with tax pieces while attack triggers or hatebear bodies build a combat lead.",
    engineLabel: "Tax / attack engines",
    payoffLabel: "Combat payoffs",
    amplifierLabel: "Pressure",
    engineGap: "This lane needs more rule-setting bodies or attack engines to make the lock intentional.",
    payoffGap: "A combat payoff turns the slowed table into a closing window.",
    amplifierGap: "More pressure helps the stax player end games before opponents recover.",
    engine: isStaxPressureEngine,
    payoff: isStaxCombatPayoff,
    amplifier: isCombatEngine,
    weights: { engine: 3, payoff: 3, amplifier: 1 },
  },
  {
    key: "landfall-drain",
    label: "Landfall Drain",
    shortLabel: "Drain",
    summary: "Loop land drops and fetches into repeatable opponent life loss, damage, or burst Scapeshift turns.",
    engineLabel: "Land drops",
    payoffLabel: "Drain",
    amplifierLabel: "Recursion",
    engineGap: "More land recursion or extra land drops would make this lane repeatable.",
    payoffGap: "The engine needs another card that converts land entries into life loss or damage.",
    amplifierGap: "Mass land return turns this from value into a closing burst.",
    engine: isLandfallEngine,
    payoff: isLandfallDrainPayoff,
    amplifier: card => hasExactName(card, ["Splendid Reclamation", "World Shaper", "Aftermath Analyst", "Lord Windgrace", "Crucible of Worlds", "Ramunap Excavator"]),
    weights: { engine: 2, payoff: 3, amplifier: 2 },
  },
  {
    key: "token-swarm",
    label: "Landfall Token Swarm",
    shortLabel: "Tokens",
    summary: "Use repeated land entries to build a board that wins through combat or sacrifice pressure.",
    engineLabel: "Land drops",
    payoffLabel: "Token makers",
    amplifierLabel: "Finish",
    engineGap: "More land-drop density would make token production less draw-dependent.",
    payoffGap: "This lane wants another high-output token maker before it becomes a primary win plan.",
    amplifierGap: "An overrun, extra combat, or damage converter would help the board actually finish.",
    engine: isLandfallEngine,
    payoff: isTokenSwarmPayoff,
    amplifier: isCombatEngine,
    weights: { engine: 1, payoff: 3, amplifier: 2 },
  },
  {
    key: "land-sacrifice",
    label: "Land Sacrifice Loop",
    shortLabel: "Land Sac",
    summary: "Sacrifice lands for mana, value, or protection, then replay or return them for a decisive swing.",
    engineLabel: "Sac outlets",
    payoffLabel: "Payoffs",
    amplifierLabel: "Return",
    engineGap: "More land sacrifice outlets would make this plan intentional instead of incidental.",
    payoffGap: "This lane needs more cards that reward lands entering the graveyard or coming back.",
    amplifierGap: "A mass land-return piece lets the deck rebuild and threaten a kill after sacrificing resources.",
    engine: isLandSacEngine,
    payoff: isLandSacPayoff,
    amplifier: card => hasExactName(card, ["Splendid Reclamation", "World Shaper", "Aftermath Analyst", "Ramunap Excavator", "Crucible of Worlds", "Lord Windgrace"]),
    weights: { engine: 2, payoff: 3, amplifier: 2 },
  },
  {
    key: "aura-drain-fort",
    label: "Aura Drain Fort",
    shortLabel: "Aura Fort",
    summary: "Use Auras to neutralize attacks and build repeatable drain, lifegain, or commander-pressure wins.",
    engineLabel: "Auras",
    payoffLabel: "Drain / pressure",
    amplifierLabel: "Protection",
    engineGap: "More useful Auras would make the commander text matter every game.",
    payoffGap: "This lane wants another card that turns Aura count into life loss, cards, or lethal pressure.",
    amplifierGap: "Commander protection or mass enchantment recovery keeps the fort from collapsing to one answer.",
    engine: isAuraPlanEngine,
    payoff: isAuraDrainOrPressurePayoff,
    amplifier: isAuraPlanProtection,
    weights: { engine: 2, payoff: 3, amplifier: 2 },
    requires: lane => lane.engines.length >= 3 && (lane.payoffs.length >= 1 || lane.amplifiers.length >= 1),
  },
  {
    key: "graveyard-value",
    label: "Graveyard Value Loop",
    shortLabel: "Graveyard",
    summary: "Use graveyard setup, sacrifice outlets, and recursive creatures to grind value or assemble death-trigger wins.",
    engineLabel: "Setup / recursion",
    payoffLabel: "Targets / payoffs",
    amplifierLabel: "Sacrifice outlets",
    engineGap: "This lane wants more ways to stock the graveyard or bring creatures back.",
    payoffGap: "Add a payoff creature, death trigger, or reanimation target that makes the recursion matter.",
    amplifierGap: "Free or repeatable sacrifice outlets help control the loop and protect key creatures from exile.",
    engine: isGraveyardValueEngine,
    payoff: isGraveyardValuePayoff,
    amplifier: isSacrificeOutletOrDeathEngine,
    weights: { engine: 2, payoff: 3, amplifier: 2 },
    requires: lane => lane.engines.length >= 2 && (lane.payoffs.length >= 1 || lane.amplifiers.length >= 1),
  },
  {
    key: "enchantress-token-swarm",
    label: "Enchantress Token Swarm",
    shortLabel: "Enchantress",
    summary: "Use Sagas and enchantress engines to build cards and bodies, then convert the enchantment board into one lethal combat step.",
    engineLabel: "Engines",
    payoffLabel: "Token makers",
    amplifierLabel: "Closers",
    engineGap: "More enchantress engines or Saga acceleration would keep the story engine moving.",
    payoffGap: "This lane wants another enchantment payoff that turns value into bodies.",
    amplifierGap: "A dedicated overrun or enchantment animation effect helps the board actually end the game.",
    engine: isEnchantressValueEngine,
    payoff: isEnchantmentTokenPayoff,
    amplifier: isOverrunFinisher,
    weights: { engine: 2, payoff: 3, amplifier: 3 },
  },
  {
    key: "combat-overrun",
    label: "Combat Finish",
    shortLabel: "Combat",
    summary: "Turn a wide or mana-rich board into lethal combat with extra combats, pumps, or animated lands.",
    engineLabel: "Board",
    payoffLabel: "Closers",
    amplifierLabel: "Pressure",
    engineGap: "More board production would make combat a realistic fallback.",
    payoffGap: "A clean combat closer would help convert board presence into wins.",
    amplifierGap: "",
    engine: isTokenSwarmPayoff,
    payoff: isCombatEngine,
    amplifier: card => textIncludesAny(card, ["haste", "trample", "additional combat"]),
    weights: { engine: 1, payoff: 3, amplifier: 1 },
  },
];

const RECOMMENDATIONS = [
  {
    name: "Ondu Spiritdancer",
    colors: ["W"],
    lanes: ["enchantress-token-swarm"],
    impact: "Enchantress payoff",
    reason: "The deck is already built around enchantments entering; this turns those normal turns into copied enchantment value.",
    fitNote: "Fits: Saga and enchantment ETB density",
    fits: profile => profile.laneScore("enchantress-token-swarm") >= 8,
    priority: 10,
  },
  {
    name: "Jukai Naturalist",
    colors: ["W", "G"],
    lanes: ["enchantress-token-swarm"],
    impact: "Cost reducer",
    reason: "This keeps multi-enchantment turns cheaper while staying on-theme as an enchantment creature.",
    fitNote: "Fits: enchantment-heavy curve",
    fits: profile => profile.laneScore("enchantress-token-swarm") >= 8,
    priority: 9,
  },
  {
    name: "Replenish",
    colors: ["W"],
    lanes: ["enchantress-token-swarm", "aura-drain-fort"],
    impact: "Mass rebuild",
    reason: profile => profile.primaryLaneKey === "aura-drain-fort"
      ? "Aura decks can lose their commander, engines, and shields to the same answer; Replenish turns that graveyard into a rebuilt board."
      : "Sagas and enchantment engines naturally expose the deck to sweepers; Replenish turns that graveyard into one enormous reset.",
    fitNote: "Fits: enchantment graveyard recovery",
    fits: profile => profile.laneScore("enchantress-token-swarm") >= 10 || profile.laneScore("aura-drain-fort") >= 10,
    priority: 7,
  },
  {
    name: "Darksteel Mutation",
    colors: ["W"],
    lanes: ["aura-drain-fort"],
    impact: "Opposing-threat lock",
    reason: "This gives Eriette-style decks an Aura that answers a scary creature while still feeding the commander plan.",
    fitNote: "Fits: Auras on opposing creatures",
    fits: profile => profile.laneScore("aura-drain-fort") >= 8,
    priority: 9,
  },
  {
    name: "Minimus Containment",
    colors: ["W"],
    lanes: ["aura-drain-fort"],
    impact: "Aura removal",
    reason: "It removes a problem permanent without lowering Aura density, which is exactly the kind of interaction this shell wants.",
    fitNote: "Fits: removal plus Aura count",
    fits: profile => profile.laneScore("aura-drain-fort") >= 8,
    priority: 8,
  },
  {
    name: "Greater Auramancy",
    colors: ["W"],
    lanes: ["aura-drain-fort"],
    impact: "Enchantment shield",
    reason: "The deck's board is mostly enchantments; shielding that board makes the drain-fort plan much harder to pick apart.",
    fitNote: "Fits: enchantment-heavy protection",
    fits: profile => profile.laneScore("aura-drain-fort") >= 10,
    priority: 8,
  },
  {
    name: "Open the Vaults",
    colors: ["W"],
    lanes: ["aura-drain-fort", "enchantress-token-swarm"],
    impact: "Mass recovery",
    reason: "This gives an Aura-heavy deck a second rebuild spell when one-for-one protection is not enough.",
    fitNote: "Fits: enchantment recursion",
    fits: profile => profile.laneScore("aura-drain-fort") >= 10 || profile.laneScore("enchantress-token-swarm") >= 10,
    priority: 5,
  },
  {
    name: "Ajani's Chosen",
    colors: ["W"],
    lanes: ["enchantress-token-swarm"],
    impact: "Token maker",
    reason: "This is a clean way to add more bodies from the thing the deck already wants to do: play enchantments.",
    fitNote: "Fits: enchantment cast/ETB loops",
    fits: profile => profile.lane("enchantress-token-swarm").payoffs.length < 5,
    priority: 6,
  },
  {
    name: "Torment of Hailfire",
    colors: ["B"],
    lanes: ["big-mana-x"],
    impact: "Redundant finisher",
    reason: profile => profile.hasExsanguinate
      ? "The list already wants to pour mana into Exsanguinate; this gives that same burst-mana plan a second table-kill spell."
      : "This gives big ritual or treasure turns a direct way to convert mana into a win.",
    fitNote: "Fits: big mana plus black finishers",
    fits: profile => profile.hasBigManaPlan && profile.lane("big-mana-x").payoffs.length >= 1,
    priority: profile => profile.lane("big-mana-x").payoffs.length < 3 ? 9 : 5,
  },
  {
    name: "Buried Alive",
    colors: ["B"],
    lanes: ["graveyard-value"],
    impact: "Graveyard setup",
    reason: "This finds the exact creatures a graveyard-value deck wants to recur, sacrifice, or loop.",
    fitNote: "Fits: recursion plus creature payoffs",
    fits: profile => profile.laneScore("graveyard-value") >= 8,
    priority: 10,
  },
  {
    name: "Victimize",
    colors: ["B"],
    lanes: ["graveyard-value"],
    impact: "Sacrifice recursion",
    reason: "This turns one expendable creature into two returned creatures, which fits a Meren-style value exchange.",
    fitNote: "Fits: sacrifice outlets and recursion targets",
    fits: profile => profile.laneScore("graveyard-value") >= 8,
    priority: 9,
  },
  {
    name: "Animate Dead",
    colors: ["B"],
    lanes: ["graveyard-value"],
    impact: "Cheap reanimation",
    reason: "A cheap reanimation spell lets the deck cash in on graveyard setup without waiting for the commander.",
    fitNote: "Fits: graveyard creature plan",
    fits: profile => profile.laneScore("graveyard-value") >= 8,
    priority: 8,
  },
  {
    name: "Viscera Seer",
    colors: ["B"],
    lanes: ["graveyard-value"],
    impact: "Free sacrifice outlet",
    reason: "Free sacrifice outlets let graveyard decks choose when creatures die and turn recursion into a repeatable engine.",
    fitNote: "Fits: death triggers and Meren loops",
    fits: profile => profile.laneScore("graveyard-value") >= 8,
    priority: 7,
  },
  {
    name: "Reiterate",
    colors: ["R"],
    lanes: ["big-mana-x", "spellslinger-copy"],
    impact: "Copy engine",
    reason: profile => profile.hasManaGeyser
      ? "Mana Geyser is already here, and Reiterate is one of the cleanest ways to turn that burst-mana card into a real finishing turn."
      : "This strengthens the copy-turn plan when the deck is already built around rituals, reducers, and X-spells.",
    fitNote: "Fits: Mana Geyser or ritual turns",
    fits: profile => profile.hasBigManaPlan && (profile.hasManaGeyser || profile.lane("big-mana-x").engines.length >= 4),
    priority: profile => profile.hasManaGeyser ? 12 : 6,
  },
  {
    name: "Aetherflux Reservoir",
    colors: [],
    lanes: ["spellslinger-copy"],
    impact: "Spell-volume payoff",
    reason: "The deck is already chaining cheap spells; this turns the spell-count turn itself into a win condition.",
    fitNote: "Fits: many cheap instants and sorceries",
    fits: profile => profile.hasSpellslingerPlan && profile.cheapSpellCount >= 10,
    priority: profile => profile.cheapSpellCount >= 18 ? 10 : 6,
  },
  {
    name: "Mizzix's Mastery",
    colors: ["R"],
    lanes: ["spellslinger-copy", "big-mana-x"],
    impact: "Graveyard burst",
    reason: "The list naturally fills the graveyard with rituals, cantrips, interaction, and X-spells; this gives those spent resources a second payoff turn.",
    fitNote: "Fits: dense instant/sorcery count",
    fits: profile => (profile.hasSpellslingerPlan || profile.hasBigManaPlan) && profile.instantSorceryCount >= 18,
    priority: profile => Math.min(12, Math.floor(profile.instantSorceryCount / 3)),
  },
  {
    name: "Past in Flames",
    colors: ["R"],
    lanes: ["spellslinger-copy", "big-mana-x"],
    impact: "Recursion",
    reason: "This is strongest when the deck already has cheap spells and rituals; it lets one big turn keep going from the graveyard.",
    fitNote: "Fits: cheap spell density",
    fits: profile => (profile.hasSpellslingerPlan || profile.hasBigManaPlan) && profile.cheapSpellCount >= 8,
    priority: profile => profile.hasManaGeyser ? 9 : 6,
  },
  {
    name: "Underworld Breach",
    colors: ["R"],
    lanes: ["spellslinger-copy", "big-mana-x"],
    impact: "Combo recursion",
    reason: "A spell-heavy list with rituals and cantrips can use the graveyard like a second hand for one decisive turn.",
    fitNote: "Fits: low curve spells plus ritual mana",
    fits: profile => (profile.hasSpellslingerPlan || profile.hasBigManaPlan) && profile.cheapSpellCount >= 10,
    priority: 8,
  },
  {
    name: "Thousand-Year Storm",
    colors: ["U", "R"],
    lanes: ["spellslinger-copy"],
    impact: "Late-game multiplier",
    reason: "This fits when the deck is already trying to chain multiple spells in the same turn and cares about copying them.",
    fitNote: "Fits: spell chain plus copy payoffs",
    fits: profile => profile.hasSpellslingerPlan && profile.lane("spellslinger-copy").amplifiers.length >= 2,
    priority: 5,
  },
  {
    name: "Bonus Round",
    colors: ["R"],
    lanes: ["spellslinger-copy", "big-mana-x"],
    impact: "Burst multiplier",
    reason: "This belongs in decks that are already aiming for a single explosive turn with rituals, cantrips, and copy effects.",
    fitNote: "Fits: one-turn spell burst",
    fits: profile => profile.hasBigManaPlan && profile.hasSpellslingerPlan,
    priority: 7,
  },
  {
    name: "Fiery Inscription",
    colors: ["R"],
    lanes: ["spellslinger-copy"],
    impact: "Spell payoff",
    reason: "If the deck is casting lots of noncreature spells, this converts normal setup turns into steady opponent damage.",
    fitNote: "Fits: payoff-light spellslinger",
    fits: profile => profile.hasSpellslingerPlan && profile.lane("spellslinger-copy").payoffs.length < 3,
    priority: 5,
  },
  {
    name: "Guttersnipe",
    colors: ["R"],
    lanes: ["spellslinger-copy"],
    impact: "Table damage",
    reason: "This is a straightforward way to make every instant and sorcery advance the win instead of only trading resources.",
    fitNote: "Fits: payoff-light spellslinger",
    fits: profile => profile.hasSpellslingerPlan && profile.lane("spellslinger-copy").payoffs.length < 3,
    priority: 4,
  },
  {
    name: "Inexorable Tide",
    colors: ["U"],
    lanes: ["poison-proliferate"],
    impact: "Repeat proliferate",
    reason: "Poison decks that already seed counters want every setup spell to keep advancing the table clock.",
    fitNote: "Fits: poison counters already applied",
    fits: profile => profile.laneScore("poison-proliferate") >= 10 && profile.lane("poison-proliferate").payoffs.length < 6,
    priority: 8,
  },
  {
    name: "Contagion Engine",
    colors: [],
    lanes: ["poison-proliferate"],
    impact: "Proliferate finisher",
    reason: "This gives poison-control lists a repeatable late-game way to add multiple poison counters without attacking.",
    fitNote: "Fits: poison-control clock",
    fits: profile => profile.laneScore("poison-proliferate") >= 10,
    priority: 7,
  },
  {
    name: "Viral Drake",
    colors: ["U"],
    lanes: ["poison-proliferate"],
    impact: "Repeat proliferate",
    reason: "This gives poison-control decks a mana sink that keeps adding counters after the first poison hit connects.",
    fitNote: "Fits: poison clock plus open mana",
    fits: profile => profile.laneScore("poison-proliferate") >= 10,
    priority: 6,
  },
  {
    name: "Thrummingbird",
    colors: ["U"],
    lanes: ["poison-proliferate"],
    impact: "Cheap proliferate body",
    reason: "It helps a poison deck turn early chip damage into repeated proliferate pressure without needing a big spell.",
    fitNote: "Fits: early poison plus evasive pressure",
    fits: profile => profile.laneScore("poison-proliferate") >= 8,
    priority: 5,
  },
  {
    name: "Skrelv's Hive",
    colors: ["W"],
    lanes: ["poison-proliferate"],
    impact: "Toxic engine",
    reason: "It keeps producing toxic bodies, which matters when the deck needs reliable early poison counters before proliferating.",
    fitNote: "Fits: poison pressure",
    fits: profile => profile.lane("poison-proliferate").engines.length < 8,
    priority: 6,
  },
  {
    name: "Mondrak, Glory Dominus",
    colors: ["W"],
    lanes: ["token-overrun"],
    impact: "Token doubler",
    reason: "A go-wide deck wins by crossing creature-count thresholds; doubling token output makes normal setup turns lethal faster.",
    fitNote: "Fits: creature-token density",
    fits: profile => profile.hasGoWidePlan && profile.lane("token-overrun").engines.length >= 4,
    priority: 10,
  },
  {
    name: "Shared Animosity",
    colors: ["R"],
    lanes: ["token-overrun"],
    impact: "Combat multiplier",
    reason: "This turns a board of small bodies into a real combat kill without asking the deck to become Voltron.",
    fitNote: "Fits: wide combat",
    fits: profile => profile.hasGoWidePlan,
    priority: 8,
  },
  {
    name: "Purphoros, God of the Forge",
    colors: ["R"],
    lanes: ["token-overrun"],
    impact: "Token damage",
    reason: "If the deck is repeatedly making bodies, Purphoros gives the token plan reach through stalled boards and fogged combat.",
    fitNote: "Fits: repeated token creation",
    fits: profile => profile.hasGoWidePlan && profile.lane("token-overrun").engines.length >= 4,
    priority: 7,
  },
  {
    name: "Drannith Magistrate",
    colors: ["W"],
    lanes: ["stax-snowball"],
    impact: "Commander lock",
    reason: "Pressure-control decks want cheap hatebears that disrupt the table while still attacking.",
    fitNote: "Fits: hatebear stax",
    fits: profile => profile.laneScore("stax-snowball") >= 8,
    priority: 9,
  },
  {
    name: "Archon of Emeria",
    colors: ["W"],
    lanes: ["stax-snowball"],
    impact: "Rule of Law body",
    reason: "This keeps the stax plan creature-based, which matters for attack-trigger commanders and combat pressure.",
    fitNote: "Fits: proactive stax",
    fits: profile => profile.laneScore("stax-snowball") >= 8,
    priority: 8,
  },
  {
    name: "Esper Sentinel",
    colors: ["W"],
    lanes: ["stax-snowball"],
    impact: "Hatebear draw",
    reason: "Proactive stax decks need cheap cards that attack, tax interaction, and help keep cards flowing.",
    fitNote: "Fits: cheap pressure-control",
    fits: profile => profile.laneScore("stax-snowball") >= 8,
    priority: 8,
  },
  {
    name: "Ranger-Captain of Eos",
    colors: ["W"],
    lanes: ["stax-snowball"],
    impact: "Silence payload",
    reason: "This supports the stax-combat plan by finding a small enabler and protecting the turn where the deck commits to combat.",
    fitNote: "Fits: Winota-style combat window",
    fits: profile => profile.laneScore("stax-snowball") >= 8,
    priority: 7,
  },
  {
    name: "Boromir, Warden of the Tower",
    colors: ["W"],
    lanes: ["stax-snowball"],
    impact: "Free-spell hate",
    reason: "It adds another rule-setting body while giving a creature-heavy pressure deck a way to survive a sweeper.",
    fitNote: "Fits: proactive white stax",
    fits: profile => profile.laneScore("stax-snowball") >= 8,
    priority: 7,
  },
  {
    name: "Ob Nixilis, the Fallen",
    colors: ["B"],
    lanes: ["landfall-drain"],
    impact: "Landfall kill",
    reason: profile => profile.hasScapeshift
      ? "Scapeshift and fetchlands become direct life-total pressure instead of only fixing mana."
      : "Fetch-heavy landfall decks can make this threaten large chunks of life without needing combat.",
    fitNote: "Fits: fetchlands and Scapeshift",
    fits: profile => profile.hasLandDrainPlan && (profile.hasFetchPackage || profile.hasScapeshift),
    priority: profile => profile.hasScapeshift ? 10 : 7,
  },
  {
    name: "Dread Presence",
    colors: ["B"],
    lanes: ["landfall-drain"],
    impact: "Drain and draw",
    reason: "This only really belongs when the mana base can make enough lands count as Swamps; otherwise it is more package card than standalone payoff.",
    fitNote: "Fits: Urborg or heavy Swamp package",
    fits: profile => profile.hasLandDrainPlan && (profile.hasCard(["Urborg, Tomb of Yawgmoth"]) || profile.basicSwampCount >= 6),
    priority: 5,
  },
  {
    name: "Urborg, Tomb of Yawgmoth",
    colors: [],
    lanes: ["landfall-drain"],
    impact: "Swamp package support",
    reason: "This is a support recommendation when the deck wants black landfall cards like Dread Presence rather than a generic colorless land add.",
    fitNote: "Fits: black landfall package",
    fits: profile => profile.hasLandDrainPlan && profile.basicSwampCount >= 3 && profile.allowedColors.includes("B"),
    priority: 3,
  },
  {
    name: "Life from the Loam",
    colors: ["G"],
    lanes: ["landfall-drain", "land-sacrifice"],
    impact: "Land recursion engine",
    reason: "This is a very natural add when the deck is already using fetchlands, land sacrifice, and graveyard land recursion.",
    fitNote: "Fits: fetchlands plus land graveyard play",
    fits: profile => profile.hasLandPlan && (profile.hasFetchPackage || profile.hasLandSacPlan),
    priority: profile => profile.hasFetchPackage && profile.hasLandSacPlan ? 12 : 8,
  },
  {
    name: "Ancient Greenwarden",
    colors: ["G"],
    lanes: ["landfall-drain", "token-swarm"],
    impact: "Landfall doubler",
    reason: "This upgrades the deck's existing landfall cards instead of changing the plan; every fetchland becomes much more threatening.",
    fitNote: "Fits: multiple landfall payoffs",
    fits: profile => profile.hasLandPlan && (profile.lane("landfall-drain").payoffs.length + profile.lane("token-swarm").payoffs.length) >= 3,
    priority: 9,
  },
  {
    name: "Splendid Reclamation",
    colors: ["G"],
    lanes: ["landfall-drain", "land-sacrifice"],
    impact: "Mass land return",
    reason: "The deck is already putting lands into the graveyard; this turns that resource into one huge landfall and rebuild turn.",
    fitNote: "Fits: fetchlands, Scapeshift, sacrifice lands",
    fits: profile => profile.hasLandPlan && (profile.hasFetchPackage || profile.hasLandSacPlan || profile.hasScapeshift),
    priority: profile => profile.hasLandSacPlan ? 10 : 7,
  },
  {
    name: "World Shaper",
    colors: ["G"],
    lanes: ["landfall-drain", "land-sacrifice"],
    impact: "Delayed rebuild",
    reason: "This is slower than Splendid Reclamation, but it fits a deck that can sacrifice, recur, and profit from lands entering all at once.",
    fitNote: "Fits: graveyard land recursion",
    fits: profile => profile.hasLandSacPlan || profile.hasFetchPackage && profile.hasLandPlan,
    priority: 5,
  },
  {
    name: "Titania, Protector of Argoth",
    colors: ["G"],
    lanes: ["land-sacrifice", "token-swarm"],
    impact: "Land-sac payoff",
    reason: "The deck already sacrifices and replays lands; Titania turns that exchange into a real board instead of just value.",
    fitNote: "Fits: land sacrifice outlets",
    fits: profile => profile.hasLandSacPlan,
    priority: 8,
  },
  {
    name: "Titania, Nature's Force",
    colors: ["G"],
    lanes: ["land-sacrifice", "token-swarm"],
    impact: "Forest recursion payoff",
    reason: "This is better when the land package can repeatedly recur Forests and wants bodies as the payoff.",
    fitNote: "Fits: Forest-heavy recursion",
    fits: profile => profile.hasLandSacPlan && profile.lane("token-swarm").score >= 7,
    priority: 4,
  },
  {
    name: "The Gitrog Monster",
    colors: ["B", "G"],
    lanes: ["land-sacrifice"],
    impact: "Sacrifice draw engine",
    reason: "This fits the sacrifice-land shell because it turns lands going to the graveyard into cards while giving another land drop.",
    fitNote: "Fits: land sacrifice plus recursion",
    fits: profile => profile.hasLandSacPlan,
    priority: 7,
  },
  {
    name: "Omnath, Locus of Rage",
    colors: ["R", "G"],
    lanes: ["token-swarm", "landfall-drain"],
    impact: "Token finisher",
    reason: "This fits when the deck is already making landfall bodies; it gives those bodies reach by converting deaths into damage.",
    fitNote: "Fits: landfall tokens plus sacrifice pressure",
    fits: profile => profile.hasTokenPlan && profile.hasFieldOrScute,
    priority: 7,
  },
  {
    name: "Avenger of Zendikar",
    colors: ["G"],
    lanes: ["token-swarm", "combat-overrun"],
    impact: "Board burst",
    reason: "This is a board payoff for land-heavy decks that can make multiple land drops after it resolves.",
    fitNote: "Fits: extra land drops and combat finish",
    fits: profile => profile.hasTokenPlan && profile.lane("combat-overrun").score >= 5,
    priority: 4,
  },
  {
    name: "Moraug, Fury of Akoum",
    colors: ["R"],
    lanes: ["combat-overrun", "token-swarm"],
    impact: "Extra combats",
    reason: "Fetchlands and extra land drops can turn an established creature board into lethal combat, but only if the deck is already making that board.",
    fitNote: "Fits: creature board plus extra land drops",
    fits: profile => profile.hasTokenPlan && profile.lane("combat-overrun").score >= 5,
    priority: 3,
  },
  {
    name: "Craterhoof Behemoth",
    colors: ["G"],
    lanes: ["combat-overrun", "token-swarm"],
    impact: "Combat closer",
    reason: "This should only show up when the deck is genuinely making a wide board, not just because it has green mana.",
    fitNote: "Fits: Field of the Dead or Scute Swarm boards",
    fits: profile => profile.hasTokenPlan && profile.lane("token-swarm").payoffs.length >= 3,
    priority: 3,
  },
];

function buildLane(config, entries) {
  const engines = uniqueMatches(entries, config.engine);
  const payoffs = uniqueMatches(entries, config.payoff);
  const amplifiers = uniqueMatches(entries, config.amplifier);
  let score =
    engines.length * config.weights.engine +
    payoffs.length * config.weights.payoff +
    amplifiers.length * config.weights.amplifier;

  const lane = {
    ...config,
    engines,
    payoffs,
    amplifiers,
    score,
  };

  if (config.requires && !config.requires(lane, entries)) {
    lane.score = 0;
  }

  lane.status = statusForLane(lane);
  lane.missing = missingForLane(lane);
  return lane;
}

function confidenceFor(primary) {
  if (!primary || primary.score === 0) return "Low";
  if (primary.payoffs.length >= 2 && primary.engines.length >= 3 && primary.score >= 10) return "High";
  if (primary.payoffs.length >= 1 && primary.engines.length >= 1 && primary.score >= 5) return "Medium";
  return "Low";
}

function conversionFor(primary) {
  if (!primary) return "No clear lane";
  if (primary.engines.length >= 3 && primary.payoffs.length < 2) return "Lots of Setup";
  if (primary.payoffs.length >= 2 && primary.engines.length < 2) return "Needs Setup";
  if (primary.payoffs.length >= 2 && primary.engines.length >= 2) return "Good Mix";
  return "Incomplete";
}

function getRecommendationReason(rec, profile) {
  return typeof rec.reason === "function" ? rec.reason(profile) : rec.reason;
}

function getRecommendationPriority(rec, profile) {
  return typeof rec.priority === "function" ? rec.priority(profile) : rec.priority || 0;
}

function recommendationScore(rec, profile) {
  const laneScore = rec.lanes.reduce((score, laneKey) => {
    const lane = profile.laneMap.get(laneKey);
    if (!lane) return score;
    if (lane.score < 5) return score;

    const primaryBonus = laneKey === profile.primaryLaneKey ? 1.3 : 0.65;
    const needBonus = lane.payoffs.length < 2 && /payoff|finisher|kill|closer|drain|volume/i.test(rec.impact) ? 4 : 0;
    return score + lane.score * primaryBonus + needBonus;
  }, 0);

  return laneScore + getRecommendationPriority(rec, profile);
}

const SUPPORTING_RECOMMENDATION_LANES = {
  "big-mana-x": ["spellslinger-copy"],
  "spellslinger-copy": ["big-mana-x"],
  "landfall-drain": ["land-sacrifice", "token-swarm"],
  "land-sacrifice": ["landfall-drain", "token-swarm"],
  "token-swarm": ["landfall-drain", "land-sacrifice", "combat-overrun"],
  "token-overrun": ["combat-overrun"],
  "graveyard-value": ["aura-drain-fort"],
  "aura-drain-fort": ["enchantress-token-swarm"],
  "enchantress-token-swarm": ["aura-drain-fort", "combat-overrun"],
};

function isRecommendationRelevantToPrimary(rec, profile) {
  const primaryKey = profile.primaryLaneKey;
  if (!primaryKey) return true;
  if (rec.lanes.includes(primaryKey)) return true;

  const support = SUPPORTING_RECOMMENDATION_LANES[primaryKey] || [];
  return rec.lanes.some(laneKey => {
    if (!support.includes(laneKey)) return false;
    const lane = profile.lane(laneKey);
    return lane.score >= 8 && lane.payoffs.length > 0;
  });
}

function buildRecommendations(analysis, lanes, limit = 6) {
  const profile = buildDeckProfile(analysis, lanes);
  if (!profile.activeLanes.length) return [];

  return RECOMMENDATIONS
    .filter(rec => !profile.names.has(lower(rec.name)))
    .filter(rec => profile.allowedColors.length === 0 || isSubset(rec.colors, profile.allowedColors))
    .filter(rec => isRecommendationRelevantToPrimary(rec, profile))
    .filter(rec => !rec.fits || rec.fits(profile))
    .map(rec => ({
      ...rec,
      reason: getRecommendationReason(rec, profile),
      score: recommendationScore(rec, profile),
      searchUrl: scryfallExactUrl(rec.name),
    }))
    .filter(rec => rec.score >= 5)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildWinPlan(analysis) {
  const entries = (analysis?.cardList || []).filter(({ card }) => card);
  if (!entries.length) return null;

  const lanes = LANE_CONFIGS
    .map(config => buildLane(config, entries))
    .sort((a, b) => b.score - a.score || b.payoffs.length - a.payoffs.length || a.label.localeCompare(b.label));

  const activeLanes = lanes.filter(lane => lane.score > 0);
  const primary = activeLanes[0] || lanes[0] || null;
  const confidence = confidenceFor(primary);
  const conversion = conversionFor(primary);
  const recommendations = buildRecommendations(analysis, lanes);

  return {
    primary,
    lanes: activeLanes.slice(0, 5),
    recommendations,
    confidence,
    conversion,
    hasSignal: Boolean(primary?.score),
    summary: primary?.summary || "No clear win plan detected yet.",
  };
}
