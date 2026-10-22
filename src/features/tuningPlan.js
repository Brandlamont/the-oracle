import { getCardType, getOracleText, isBasicLand, normalizeCardName } from "../utils/cardUtils.js";
import { classifyCommanderRole } from "./cardRoles.js";

const MAX_ADDS = 6;
const MAX_KEEPS = 6;
const MAX_CUTS = 4;

function lower(value = "") {
  return String(value).toLowerCase();
}

function cardText(card) {
  return lower(getOracleText(card));
}

function cardType(card) {
  return lower(card?.type_line || "");
}

function cardName(card) {
  return card?.name || "";
}

function addUnique(items, item, seen, limit = Infinity) {
  if (!item || items.length >= limit) return;
  const key = item.key || normalizeCardName(item.name || item.card?.name || "");
  if (!key || seen.has(key)) return;
  seen.add(key);
  items.push({ ...item, key });
}

function roleFromSignal(label = "") {
  return label
    .replace(/s$/i, "")
    .replace("Token maker", "Token Maker")
    .replace("Closer", "Finisher");
}

function shouldSuppressRoleGap(category, archetypeProfile, winPlan) {
  const primaryArchetype = archetypeProfile?.primary?.key || "";
  const primaryLane = winPlan?.primary?.key || "";

  if (category.key === "Board Wipes") {
    return [
      "stax-hatebears",
      "reanimator",
    ].includes(primaryArchetype) || [
      "stax-snowball",
      "graveyard-value",
    ].includes(primaryLane);
  }

  if (category.key === "Lands" && (primaryArchetype === "stax-hatebears" || primaryLane === "stax-snowball")) {
    return category.count >= 30;
  }

  return false;
}

function buildAddItems(roleCategories, archetypeProfile, winPlan) {
  const adds = [];
  const seen = new Set();

  const gaps = [...(roleCategories || [])]
    .filter(category => category.count < category.min)
    .filter(category => !shouldSuppressRoleGap(category, archetypeProfile, winPlan))
    .sort((a, b) => (a.count / Math.max(a.min, 1)) - (b.count / Math.max(b.min, 1)))
    .slice(0, 2);

  gaps.forEach(category => {
    addUnique(adds, {
      name: `More ${category.label}`,
      tag: "Role Gap",
      source: "Role Target",
      reason: `${category.count} detected. Target is ${category.target}, so this role should be addressed before adding more luxury cards.`,
    }, seen, MAX_ADDS);
  });

  for (const rec of winPlan?.recommendations || []) {
    addUnique(adds, {
      name: rec.name,
      tag: rec.impact || "On-plan Add",
      source: "Win Plan",
      reason: rec.reason,
      searchUrl: rec.searchUrl,
    }, seen, MAX_ADDS);
  }

  for (const rec of archetypeProfile?.recommendations || []) {
    addUnique(adds, {
      name: rec.name,
      tag: rec.impact || "Archetype Add",
      source: "Archetype",
      reason: rec.reason,
      searchUrl: rec.searchUrl,
    }, seen, MAX_ADDS);
  }

  return adds;
}

function buildKeepItems(analysis, archetypeProfile, winPlan) {
  const keeps = [];
  const seen = new Set();
  const coreKeys = new Set();

  const rememberCore = card => {
    if (card?.name) coreKeys.add(normalizeCardName(card.name));
  };

  if (analysis?.commanderCard) {
    addUnique(keeps, {
      card: analysis.commanderCard,
      name: analysis.commanderCard.name,
      tag: "Commander",
      source: "Core",
      reason: "The deck identity and legality check are built around this card.",
    }, seen, MAX_KEEPS);
    rememberCore(analysis.commanderCard);
  }

  for (const signal of archetypeProfile?.primary?.signals || []) {
    for (const { card, qty } of signal.cards || []) {
      rememberCore(card);
      addUnique(keeps, {
        card,
        qty,
        name: cardName(card),
        tag: roleFromSignal(signal.label),
        source: archetypeProfile.primary.label,
        reason: `This is one of the cards making the ${archetypeProfile.primary.label} read credible.`,
      }, seen, MAX_KEEPS);
    }
  }

  const primaryLane = winPlan?.primary;
  if (primaryLane) {
    const laneGroups = [
      [primaryLane.engineLabel, primaryLane.engines],
      [primaryLane.payoffLabel, primaryLane.payoffs],
      [primaryLane.amplifierLabel, primaryLane.amplifiers],
    ];

    for (const [label, cards] of laneGroups) {
      for (const { card, qty } of cards || []) {
        rememberCore(card);
        addUnique(keeps, {
          card,
          qty,
          name: cardName(card),
          tag: roleFromSignal(label),
          source: primaryLane.label,
          reason: `This supports the detected ${primaryLane.label} win lane.`,
        }, seen, MAX_KEEPS);
      }
    }
  }

  return { keeps, coreKeys };
}

function hasName(card, names) {
  const name = lower(cardName(card));
  return names.some(candidate => name === lower(candidate));
}

function isPremiumProtection(card) {
  const text = cardText(card);
  return (
    hasName(card, [
      "Flawless Maneuver",
      "Heroic Intervention",
      "Karametra's Blessing",
      "Lightning Greaves",
      "Swiftfoot Boots",
      "Teferi's Protection",
      "Timely Ward",
    ]) ||
    text.includes("permanents you control gain hexproof") ||
    text.includes("permanents you control phase out") ||
    text.includes("you gain protection from everything")
  );
}

function rolesForCard(card) {
  return classifyCommanderRole(card).filter(role => !["Lands", "Win Conditions"].includes(role));
}

function isSagaEnchantressCore(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    type.includes("saga") ||
    text.includes("lore counter") ||
    text.includes("whenever you cast an enchantment spell") ||
    text.includes("whenever an enchantment enters the battlefield under your control") ||
    text.includes("constellation") ||
    text.includes("tokens would be created under your control") ||
    text.includes("creatures you control get") ||
    hasName(card, [
      "Satsuki, the Living Lore",
      "Avenger of Zendikar",
      "Craterhoof Behemoth",
      "End-Raze Forerunners",
      "Pathbreaker Ibex",
      "Hallowed Haunting",
      "Sigil of the Empty Throne",
      "Court of Grace",
      "Parallel Lives",
      "Anointed Procession",
      "Starfield of Nyx",
      "Sanctum Weaver",
      "Mirari's Wake",
    ])
  );
}

function isAuraPillowfortCore(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    type.includes("aura") ||
    text.includes("aura spell") ||
    text.includes("aura card") ||
    text.includes("aura you control") ||
    text.includes("auras you control") ||
    text.includes("whenever you cast an enchantment spell") ||
    text.includes("whenever an enchantment enters the battlefield under your control") ||
    text.includes("constellation") ||
    hasName(card, [
      "Doomwake Giant",
      "Eriette of the Charmed Apple",
      "Ondu Spiritdancer",
      "Retether",
      "Winds of Rath",
    ])
  );
}

function isPoisonCore(card) {
  return (
    cardText(card).includes("proliferate") ||
    cardText(card).includes("poison counter") ||
    cardText(card).includes("toxic") ||
    cardText(card).includes("infect") ||
    hasName(card, [
      "Atraxa, Praetors' Voice",
      "Blighted Agent",
      "Bloated Contaminator",
      "Contaminant Grafter",
      "Evolution Sage",
      "Ezuri, Stalker of Spheres",
      "Ichor Rats",
      "Infectious Inquiry",
      "Prologue to Phyresis",
      "Staff of Compleation",
      "Tainted Strike",
      "Tekuthal, Inquiry Dominus",
      "Tezzeret's Gambit",
      "Triumph of the Hordes",
      "Vorinclex, Monstrous Raider",
      "Vraska's Fall",
    ])
  );
}

function isTokenOverrunCore(card) {
  const text = cardText(card);
  return (
    text.includes("create") && text.includes("creature token") ||
    text.includes("creatures you control get") ||
    text.includes("creature tokens you control") ||
    text.includes("for each creature you control") ||
    text.includes("tokens would be created") ||
    hasName(card, [
      "Adeline, Resplendent Cathar",
      "Anim Pakal, Thousandth Moon",
      "Beastmaster Ascension",
      "Bennie Bracks, Zoologist",
      "Champion of Lambholt",
      "Clever Concealment",
      "Giver of Runes",
      "Hanweir Garrison",
      "Hero of Bladehold",
      "Jetmir, Nexus of Revels",
      "King Darien XLVIII",
      "March of the Multitudes",
      "Mother of Runes",
      "Ohran Frostfang",
      "Selfless Spirit",
      "Skullclamp",
      "The Wandering Rescuer",
      "Warleader's Call",
    ])
  );
}

function isStaxCore(card) {
  const text = cardText(card);
  return (
    text.includes("can't cast more than one spell") ||
    text.includes("can't search libraries") ||
    text.includes("put that card onto the battlefield tapped and attacking") ||
    text.includes("whenever a non-human creature you control attacks") ||
    hasName(card, [
      "Angrath's Marauders",
      "Archon of Emeria",
      "Auratouched Mage",
      "Blade Historian",
      "Blood Moon",
      "Drannith Magistrate",
      "Magus of the Moon",
      "Rule of Law",
      "Thalia, Guardian of Thraben",
      "Winota, Joiner of Forces",
    ])
  );
}

function isGraveyardValueCore(card) {
  const text = cardText(card);
  const type = cardType(card);
  return (
    hasName(card, [
      "Animate Dead",
      "Ashnod's Altar",
      "Blood Artist",
      "Buried Alive",
      "Carrion Feeder",
      "Entomb",
      "Eternal Witness",
      "Hoarding Broodlord",
      "Living Death",
      "Meren of Clan Nel Toth",
      "Necromancy",
      "Phyrexian Altar",
      "Protean Hulk",
      "Reanimate",
      "Syr Konrad, the Grim",
      "Victimize",
      "Viscera Seer",
      "Yawgmoth, Thran Physician",
      "Zulaport Cutthroat",
    ]) ||
    type.includes("creature") && (card?.cmc || 0) >= 6 ||
    text.includes("return target creature card from your graveyard") ||
    text.includes("return a creature card from your graveyard") ||
    text.includes("search your library for a card and put that card into your graveyard") ||
    text.includes("sacrifice a creature") ||
    text.includes("sacrifice another creature") ||
    text.includes("whenever a creature dies") ||
    text.includes("whenever another creature dies")
  );
}

function categoryByKey(roleCategories, key) {
  return (roleCategories || []).find(category => category.key === key);
}

function buildCutItems(analysis, roleCategories, archetypeProfile, winPlan, coreKeys) {
  const primaryArchetype = archetypeProfile?.primary?.key || "";
  const primaryLane = winPlan?.primary?.key || "";
  const cards = (analysis?.cardList || []).filter(({ card, role }) => {
    if (!card || role === "commander") return false;
    if (isBasicLand(card)) return false;
    if (cardType(card).includes("land")) return false;
    if (isPremiumProtection(card)) return false;
    if (primaryArchetype === "saga-enchantress" && isSagaEnchantressCore(card)) return false;
    if (primaryArchetype === "aura-pillowfort" && isAuraPillowfortCore(card)) return false;
    if ((primaryArchetype === "poison" || primaryLane === "poison-proliferate") && isPoisonCore(card)) return false;
    if ((primaryArchetype === "tokens-overrun" || primaryLane === "token-overrun") && isTokenOverrunCore(card)) return false;
    if ((primaryArchetype === "stax-hatebears" || primaryLane === "stax-snowball") && isStaxCore(card)) return false;
    if ((primaryArchetype === "reanimator" || primaryLane === "graveyard-value") && isGraveyardValueCore(card)) return false;
    return !coreKeys.has(normalizeCardName(card.name));
  });

  const candidates = cards.map(({ card, qty }) => {
    const reasons = [];
    let score = 0;
    const type = cardType(card);
    const roles = rolesForCard(card);

    for (const role of roles) {
      const category = categoryByKey(roleCategories, role);
      if (primaryArchetype === "saga-enchantress" && role === "Card Draw") continue;
      if ((primaryArchetype === "reanimator" || primaryLane === "graveyard-value") && role === "Graveyard Recursion") continue;
      if (category && category.count > category.good + 2) {
        score += 2;
        reasons.push(`${role} is already above target.`);
      }
    }

    if ((card.cmc || 0) >= 6) {
      score += 2;
      reasons.push("High mana value; make sure it wins, stabilizes, or advances the main plan.");
    }

    if (type.includes("equipment") && primaryArchetype !== "voltron") {
      const protection = categoryByKey(roleCategories, "Protection");
      score += protection && protection.count > protection.good + 2 ? 2 : 1;
      reasons.push("Equipment can be a flex slot when commander-damage is not the primary plan.");
    }

    if (!roles.length && (card.cmc || 0) >= 4) {
      score += 1;
      reasons.push("Does not clearly map to the current role checklist.");
    }

    return {
      card,
      qty,
      score,
      key: normalizeCardName(card.name),
      name: card.name,
      tag: type.includes("equipment") ? "Equipment" : roles[0] || getCardType(card.type_line),
      source: "Flex Review",
      reason: reasons[0] || "This looks less connected to the detected plan than the core cards above.",
    };
  });

  return candidates
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.card.cmc || 0) - (a.card.cmc || 0) || a.name.localeCompare(b.name))
    .slice(0, MAX_CUTS);
}

export function buildTuningPlan(analysis, roleCategories, archetypeProfile, winPlan) {
  const adds = buildAddItems(roleCategories, archetypeProfile, winPlan);
  const { keeps, coreKeys } = buildKeepItems(analysis, archetypeProfile, winPlan);
  const cuts = buildCutItems(analysis, roleCategories, archetypeProfile, winPlan, coreKeys);

  return {
    adds,
    keeps,
    cuts,
  };
}
