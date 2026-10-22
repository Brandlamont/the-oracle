import { classifyCommanderRole } from "./cardRoles.js";
import { getOracleText, normalizeCardName } from "../utils/cardUtils.js";

function lower(value = "") {
  return String(value).toLowerCase();
}

function cardName(card) {
  return lower(card?.name || "");
}

function cardText(card) {
  return lower(getOracleText(card));
}

function cardType(card) {
  return lower(card?.type_line || "");
}

function manaCost(card) {
  if (card?.mana_cost) return card.mana_cost;
  return (card?.card_faces || []).map(face => face.mana_cost || "").join(" ");
}

function includesAny(value, needles) {
  return needles.some(needle => value.includes(lower(needle)));
}

function hasExactName(card, names) {
  const name = cardName(card);
  return names.some(candidate => name === lower(candidate));
}

function getEntries(analysis) {
  return (analysis?.cardList || []).filter(({ card }) => card);
}

function getNameMap(entries) {
  const map = new Map();

  for (const entry of entries) {
    const names = [
      entry.card?.name,
      ...(entry.card?.card_faces || []).map(face => face.name),
    ].filter(Boolean);

    for (const name of names) {
      map.set(normalizeCardName(name), entry);
    }
  }

  return map;
}

function findEntry(nameMap, name) {
  return nameMap.get(normalizeCardName(name));
}

const COMBO_DEFINITIONS = [
  {
    key: "oracle-consultation",
    label: "Oracle Consultation",
    type: "Deterministic win",
    confidence: "Confirmed",
    source: "Known cEDH package",
    pieces: ["Thassa's Oracle", "Demonic Consultation"],
    outcome: "Resolve Thassa's Oracle, then exile the library with Demonic Consultation before the trigger checks devotion.",
    setup: "Needs both cards, two blue mana for Oracle, and one black mana for Consultation.",
  },
  {
    key: "oracle-pact",
    label: "Oracle Pact",
    type: "Deterministic win",
    confidence: "Confirmed",
    source: "Known cEDH package",
    pieces: ["Thassa's Oracle", "Tainted Pact"],
    outcome: "Resolve Thassa's Oracle, then use Tainted Pact to exile the library before the trigger resolves.",
    setup: "Needs singleton-friendly deck construction and both cards available.",
  },
  {
    key: "narset-wheel",
    label: "Narset Wheel Lock",
    type: "Soft lock",
    confidence: "Confirmed package",
    source: "Known Commander interaction",
    pieces: ["Narset, Parter of Veils", "Windfall"],
    outcome: "Narset limits opponents to one draw, then Windfall empties hands and prevents opponents from refilling normally.",
    setup: "Needs Narset on board and a wheel effect. This is disruptive, not an infinite combo.",
  },
  {
    key: "reiterate-geyser",
    label: "Reiterate Geyser Loop",
    type: "Infinite mana",
    confidence: "Confirmed",
    source: "Known Commander combo",
    pieces: ["Reiterate", "Mana Geyser"],
    outcome: "With enough tapped opponent lands, buyback Reiterate can copy Mana Geyser repeatedly for unbounded red mana.",
    setup: "Needs Mana Geyser to produce enough mana to pay Reiterate with buyback while netting mana.",
  },
  {
    key: "dualcaster-twinflame",
    label: "Dualcaster Twinflame",
    type: "Infinite hasty tokens",
    confidence: "Confirmed",
    source: "Known Commander combo",
    pieces: ["Dualcaster Mage", "Twinflame"],
    outcome: "Dualcaster copies Twinflame targeting itself, creating a loop of hasty Dualcaster copies.",
    setup: "Needs a legal Twinflame target and enough mana to cast both pieces.",
  },
  {
    key: "dualcaster-heat-shimmer",
    label: "Dualcaster Heat Shimmer",
    type: "Infinite hasty tokens",
    confidence: "Confirmed",
    source: "Known Commander combo",
    pieces: ["Dualcaster Mage", "Heat Shimmer"],
    outcome: "Dualcaster copies Heat Shimmer targeting itself, creating a loop of hasty Dualcaster copies.",
    setup: "Needs a legal Heat Shimmer target and enough mana to cast both pieces.",
  },
  {
    key: "sanguine-blood",
    label: "Sanguine Blood Loop",
    type: "Life drain loop",
    confidence: "Confirmed",
    source: "Known Commander combo",
    pieces: ["Sanguine Bond", "Exquisite Blood"],
    outcome: "Life gain and opponent life loss trigger each other until opponents lose the game.",
    setup: "Needs both enchantments on board and any life gain or opponent life loss event.",
  },
  {
    key: "dramatic-scepter",
    label: "Dramatic Scepter",
    type: "Infinite mana engine",
    confidence: "Confirmed",
    source: "Known Commander combo",
    pieces: ["Isochron Scepter", "Dramatic Reversal"],
    outcome: "Imprint Dramatic Reversal and repeatedly untap mana rocks to generate unbounded mana.",
    setup: "Needs nonland mana sources that produce at least three mana total.",
  },
];

function detectCombos(entries) {
  const nameMap = getNameMap(entries);

  return COMBO_DEFINITIONS
    .map(definition => {
      const matched = definition.pieces.map(name => findEntry(nameMap, name));
      const missing = definition.pieces.filter((name, index) => !matched[index]);

      if (missing.length) return null;

      return {
        ...definition,
        cards: matched.filter(Boolean),
      };
    })
    .filter(Boolean);
}

// Commander Spellbook groups near-duplicate variants (e.g. the same combo with
// six interchangeable mana dorks) as separate variants. Cluster variants that
// share the same produced features and differ by at most one card so the UI
// shows one card with an "also works with" note instead of six near-identical rows.
function clusterSpellbookCombos(rawCombos) {
  const bySignature = new Map();
  for (const combo of rawCombos) {
    const sig = [...combo.producesNames].sort().join("|");
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push(combo);
  }

  const clusters = [];
  for (const group of bySignature.values()) {
    const used = new Array(group.length).fill(false);
    for (let i = 0; i < group.length; i++) {
      if (used[i]) continue;
      const cluster = [group[i]];
      used[i] = true;
      const namesA = new Set(group[i].cards.map(({ card }) => card.name));

      for (let j = i + 1; j < group.length; j++) {
        if (used[j]) continue;
        const namesB = new Set(group[j].cards.map(({ card }) => card.name));
        if (namesA.size !== namesB.size) continue;
        const overlap = [...namesA].filter(name => namesB.has(name)).length;
        if (overlap >= namesA.size - 1) {
          cluster.push(group[j]);
          used[j] = true;
        }
      }
      clusters.push(cluster);
    }
  }
  return clusters;
}

function classifySpellbookComboType(producesNames) {
  const joined = producesNames.join(" ").toLowerCase();
  if (joined.includes("win the game") || joined.includes("lose the game") || joined.includes("loses the game")) {
    return "Deterministic win";
  }
  return producesNames[0] || "Combo package";
}

function formatSpellbookCombo(cluster) {
  const sorted = [...cluster].sort((a, b) => b.producesNames.length - a.producesNames.length || b.popularity - a.popularity);
  const primary = sorted[0];
  const primaryNames = new Set(primary.cards.map(({ card }) => card.name));
  const anchorNames = primary.cards
    .map(({ card }) => card.name)
    .filter(name => cluster.every(combo => combo.cards.some(({ card }) => card.name === name)));
  const alternates = sorted
    .slice(1)
    .flatMap(combo => combo.cards.filter(({ card }) => !anchorNames.includes(card.name)))
    .map(({ card }) => card.name)
    .filter((name, index, arr) => arr.indexOf(name) === index && !primaryNames.has(name));

  const steps = primary.description.split("\n").map(line => line.trim()).filter(Boolean);
  const prerequisites = [primary.notablePrerequisites, primary.easyPrerequisites].filter(Boolean).join(" ");

  return {
    key: `spellbook-${primary.id}`,
    label: primary.cards.map(({ card }) => card.name).join(" + "),
    type: classifySpellbookComboType(primary.producesNames),
    confidence: "Confirmed",
    source: "Commander Spellbook",
    sourceUrl: primary.url,
    cards: primary.cards,
    missingNames: primary.missingNames || [],
    outcome: primary.producesNames.join(" • ") || "Produces a repeatable loop.",
    setup: prerequisites,
    steps,
    alternates,
    popularity: primary.popularity,
  };
}

function buildSpellbookCombos(spellbookResult) {
  if (!spellbookResult?.included?.length) return null;

  return clusterSpellbookCombos(spellbookResult.included)
    .map(formatSpellbookCombo)
    .sort((a, b) => (b.type === "Deterministic win") - (a.type === "Deterministic win") || b.popularity - a.popularity)
    .slice(0, 10);
}

function buildAlmostCombos(spellbookResult) {
  if (!spellbookResult?.almostIncluded?.length) return [];

  return clusterSpellbookCombos(spellbookResult.almostIncluded)
    .map(formatSpellbookCombo)
    .map(combo => ({ ...combo, confidence: "1 card away" }))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 6);
}

function isEvasiveEnabler(card) {
  const text = cardText(card);
  const type = cardType(card);

  return (
    hasExactName(card, [
      "Ornithopter",
      "Phyrexian Walker",
      "Changeling Outcast",
      "Gingerbrute",
      "Gudul Lurker",
      "Hope of Ghirapur",
      "Merfolk Windrobber",
      "Mist-Cloaked Herald",
      "Mothdust Changeling",
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
      text.includes("unblockable") ||
      text.includes("flying") ||
      text.includes("menace")
    )
  );
}

function isNinjaPayoff(card) {
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
    ])
  );
}

function isTopdeckSetup(card) {
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

function isTutorOrFinder(card) {
  const text = cardText(card);

  return (
    hasExactName(card, [
      "Demonic Consultation",
      "Dimir Infiltrator",
      "Scheming Symmetry",
      "Wishclaw Talisman",
    ]) ||
    text.includes("search your library for a card") ||
    text.includes("transmute") ||
    text.includes("name a card")
  );
}

function isRitualOrBurstMana(card) {
  const text = cardText(card);
  const type = cardType(card);
  if (type.includes("land")) return false;
  // Permanents that just tap for mana (mana dorks/rocks) are ramp, not one-shot
  // ritual/burst mana - a repeatable {T}: Add ability isn't the same speed signal
  // as a single spell that dumps mana into the same turn.
  if (type.includes("creature") || type.includes("artifact")) return false;

  return (
    hasExactName(card, [
      "Cabal Ritual",
      "Culling the Weak",
      "Dark Ritual",
      "Desperate Ritual",
      "Mana Geyser",
      "Rain of Filth",
    ]) ||
    cardName(card).includes("ritual") ||
    text.includes("add {") ||
    text.includes("add one mana") ||
    text.includes("treasure token")
  );
}

function isSpellCopy(card) {
  const text = cardText(card);
  return (
    hasExactName(card, [
      "Bonus Round",
      "Dualcaster Mage",
      "Increasing Vengeance",
      "Narset's Reversal",
      "Repeated Reverberation",
      "Reiterate",
      "Thousand-Year Storm",
      "Veyran, Voice of Duality",
    ]) ||
    text.includes("copy target instant or sorcery") ||
    text.includes("copy target spell") ||
    text.includes("copy it")
  );
}

function isXFinisher(card) {
  const cost = manaCost(card);
  const text = cardText(card);

  return (
    cost.includes("{X}") &&
    (
      text.includes("each opponent") ||
      text.includes("target player") ||
      text.includes("damage") ||
      text.includes("loses") ||
      text.includes("draw")
    )
  );
}

function isHighImpactDraw(card) {
  return hasExactName(card, ["Ad Nauseam", "Peer into the Abyss", "Necropotence", "Rhystic Study"]) ||
    classifyCommanderRole(card).includes("Card Draw");
}

const ARCHETYPE_TAGS = [
  { key: "combo-piece", label: "Combo Piece", predicate: (_card, comboNames) => comboNames.has(normalizeCardName(_card?.name || "")) },
  { key: "evasive-enabler", label: "Evasive Enabler", predicate: isEvasiveEnabler },
  { key: "ninja-payoff", label: "Ninja Payoff", predicate: isNinjaPayoff },
  { key: "topdeck-setup", label: "Topdeck Setup", predicate: isTopdeckSetup },
  { key: "tutor-finder", label: "Tutor / Finder", predicate: isTutorOrFinder },
  { key: "ritual-burst", label: "Ritual / Burst Mana", predicate: isRitualOrBurstMana },
  { key: "spell-copy", label: "Spell Copy", predicate: isSpellCopy },
  { key: "x-finisher", label: "X Finisher", predicate: isXFinisher },
  { key: "draw-engine", label: "Draw Engine", predicate: isHighImpactDraw },
  { key: "interaction", label: "Interaction", predicate: card => classifyCommanderRole(card).some(role => ["Targeted Removal", "Board Wipes"].includes(role)) },
  { key: "protection", label: "Protection", predicate: card => classifyCommanderRole(card).includes("Protection") },
  { key: "recursion", label: "Recursion", predicate: card => classifyCommanderRole(card).includes("Graveyard Recursion") },
  { key: "ramp", label: "Ramp", predicate: card => classifyCommanderRole(card).includes("Ramp") },
  { key: "land", label: "Lands", predicate: card => classifyCommanderRole(card).includes("Lands") },
];

function buildArchetypeTags(entries, combos) {
  const comboNames = new Set(combos.flatMap(combo => combo.cards.map(({ card }) => normalizeCardName(card?.name || ""))));

  return ARCHETYPE_TAGS
    .map(tag => {
      const cards = entries.filter(entry => tag.predicate(entry.card, comboNames));
      return {
        ...tag,
        count: cards.reduce((sum, entry) => sum + (entry.qty || 1), 0),
        cards: cards.slice(0, 7),
      };
    })
    .filter(tag => tag.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const CEDH_MARKER_NAMES = [
  "Ad Nauseam",
  "Ancient Tomb",
  "Chrome Mox",
  "City of Traitors",
  "Demonic Consultation",
  "Demonic Tutor",
  "Dockside Extortionist",
  "Fierce Guardianship",
  "Force of Negation",
  "Force of Will",
  "Grim Monolith",
  "Imperial Seal",
  "Lion's Eye Diamond",
  "Lotus Petal",
  "Mana Crypt",
  "Mana Vault",
  "Mox Amber",
  "Mox Diamond",
  "Mox Opal",
  "Mystic Remora",
  "Pact of Negation",
  "Rhystic Study",
  "Tainted Pact",
  "Thassa's Oracle",
  "Underworld Breach",
  "Vampiric Tutor",
  "Wishclaw Talisman",
];

const FAST_MANA_NAMES = [
  "Ancient Tomb",
  "Chrome Mox",
  "Culling the Weak",
  "Dark Ritual",
  "Dockside Extortionist",
  "Grim Monolith",
  "Lion's Eye Diamond",
  "Lotus Petal",
  "Mana Crypt",
  "Mana Vault",
  "Mox Amber",
  "Mox Diamond",
  "Mox Opal",
  "Rain of Filth",
  "Sol Ring",
];

const FREE_INTERACTION_NAMES = [
  "Deflecting Swat",
  "Fierce Guardianship",
  "Flusterstorm",
  "Force of Negation",
  "Force of Will",
  "Force of Vigor",
  "Mental Misstep",
  "Mindbreak Trap",
  "Pact of Negation",
  "Submerge",
  "Swan Song",
];

const BRACKET_LABELS = {
  1: ["Bracket 1", "Exhibition", "A low-pressure table profile with few speed or compact-combo signals."],
  2: ["Bracket 2", "Core", "The deck has a visible plan, but its wins look slower or less redundant."],
  3: ["Bracket 3", "Upgraded", "A clear Commander plan with enough redundancy to matter, without many top-end power markers."],
  4: ["Bracket 4", "Optimized", "Compact win packages or high-efficiency engines are present, with support that can convert them into wins."],
  5: ["Bracket 5", "cEDH", "The list shows compact wins, dense speed, tutors, and protection associated with max-power pods."],
};

function countEntriesByName(entries, names) {
  return entries.filter(({ card }) => hasExactName(card, names)).length;
}

function getTagCount(tags, key) {
  return tags.find(tag => tag.key === key)?.count || 0;
}

function isWinningCombo(combo) {
  return combo.type !== "Soft lock";
}

function isCompactWinCombo(combo) {
  return combo.type === "Deterministic win" || combo.type.includes("Infinite") || combo.type.includes("Life drain loop");
}

// Rough turn-clock estimate for when this deck's plan can realistically close a game,
// anchored around turn ~9.5 for an unfocused but functional Commander deck. A combo alone
// does not pull the estimate down much on its own: in a 99-card singleton deck, finding a
// multi-card combo with no tutors is slow, so the combo bonus scales with how consistently
// the deck can actually find and assemble it (tutors, fast mana, ritual/burst mana). Fast
// mana, tutors, free interaction, and a lower curve each add their own smaller, direct pull.
function estimateWinTurn({ deterministicCombos, infiniteCombos, compactWinCombos, tutorCount, ritualBurstCount, freeInteractionCount, fastManaCount, cedhMarkerCount, avgMV }) {
  let turn = 9.5;

  const comboStrength = deterministicCombos.length > 0 ? 4.5 : infiniteCombos.length > 0 ? 3 : compactWinCombos.length > 0 ? 1.5 : 0;
  if (comboStrength > 0) {
    const consistency = Math.min(1, tutorCount * 0.3 + fastManaCount * 0.15 + ritualBurstCount * 0.1);
    turn -= comboStrength * (0.35 + 0.65 * consistency);
  }

  turn -= Math.min(2.5, fastManaCount * 0.5);
  turn -= Math.min(1.5, tutorCount * 0.3);
  turn -= Math.min(1.2, ritualBurstCount * 0.3);
  turn -= Math.min(0.6, Math.max(0, compactWinCombos.length - 1) * 0.2);
  turn -= Math.min(1, freeInteractionCount * 0.2);
  turn -= Math.min(1.2, cedhMarkerCount * 0.15);

  const avgMvNumber = parseFloat(avgMV);
  if (!Number.isNaN(avgMvNumber)) turn += (avgMvNumber - 3) * 1.1;

  return Math.max(2, Math.min(13, Math.round(turn * 10) / 10));
}

function estimateBracket(entries, combos, tags, archetypeProfile, winPlan, avgMV) {
  const winCombos = combos.filter(isWinningCombo);
  const compactWinCombos = winCombos.filter(isCompactWinCombo);
  const deterministicCombos = combos.filter(combo => combo.type === "Deterministic win");
  const infiniteCombos = winCombos.filter(combo => combo.type.includes("Infinite"));
  const supportPackages = combos.filter(combo => combo.type === "Soft lock");
  const tutorCount = getTagCount(tags, "tutor-finder");
  const ritualBurstCount = getTagCount(tags, "ritual-burst");
  const xFinisherCount = getTagCount(tags, "x-finisher");
  const protectionCount = getTagCount(tags, "protection");
  const interactionCount = getTagCount(tags, "interaction");
  const drawEngineCount = getTagCount(tags, "draw-engine");
  const fastManaCount = countEntriesByName(entries, FAST_MANA_NAMES);
  const freeInteractionCount = countEntriesByName(entries, FREE_INTERACTION_NAMES);
  const cedhMarkerCount = countEntriesByName(entries, CEDH_MARKER_NAMES);
  const primaryScore = winPlan?.primary?.score || 0;
  const hasExactOracleCombo = combos.some(combo => combo.cards.some(({ card }) => card.name === "Thassa's Oracle"));
  const hasOracleRead = winPlan?.primary?.key === "oracle-consultation";
  const hasFocusedPlan = Boolean(winPlan?.primary && primaryScore >= 8);
  const hasStrongArchetype = archetypeProfile?.primary?.score >= 8 || archetypeProfile?.primary?.status === "Strong Match";

  let level = 1;
  if (
    deterministicCombos.length > 0 &&
    cedhMarkerCount >= 8 &&
    freeInteractionCount >= 2 &&
    (fastManaCount >= 4 || tutorCount >= 3)
  ) {
    level = 5;
  } else if (
    deterministicCombos.length > 0 ||
    hasExactOracleCombo ||
    (infiniteCombos.length > 0 && (xFinisherCount > 0 || tutorCount + ritualBurstCount + protectionCount >= 4)) ||
    (compactWinCombos.length >= 2 && cedhMarkerCount >= 4)
  ) {
    level = 4;
  } else if (
    winCombos.length > 0 ||
    hasFocusedPlan ||
    hasStrongArchetype ||
    tutorCount + drawEngineCount + interactionCount >= 10
  ) {
    level = 3;
  } else if (primaryScore >= 4 || tags.length >= 3) {
    level = 2;
  }

  const reasons = [];
  if (deterministicCombos.length > 0) {
    reasons.push(`Compact deterministic combo detected: ${deterministicCombos.map(combo => combo.label).join(", ")}.`);
  } else if (infiniteCombos.length > 0) {
    reasons.push(`Infinite package detected: ${infiniteCombos.map(combo => combo.label).join(", ")}.`);
  } else if (winCombos.length > 0) {
    reasons.push(`Confirmed win package detected: ${winCombos.map(combo => combo.label).join(", ")}.`);
  } else {
    reasons.push("No compact deterministic win combo matched the local registry.");
  }

  if (hasExactOracleCombo) {
    reasons.push("Exact Oracle combo matched in the local registry, which points toward optimized tables.");
  } else if (hasOracleRead) {
    reasons.push("Oracle-style setup detected, but no exact Oracle combo package matched the local registry.");
  } else if (winPlan?.primary?.label) {
    reasons.push(`Primary win lane: ${winPlan.primary.label} (${winPlan.primary.status || "visible signal"}).`);
  }

  if (tutorCount >= 2) {
    reasons.push(`${tutorCount} tutor/finder signals increase consistency.`);
  } else if (fastManaCount + ritualBurstCount >= 3) {
    reasons.push(`${fastManaCount + ritualBurstCount} fast mana or burst mana signals support earlier payoff turns.`);
  } else if (supportPackages.length > 0) {
    reasons.push(`${supportPackages.length} support package${supportPackages.length === 1 ? "" : "s"} add disruption or setup, but are not wins by themselves.`);
  } else if (archetypeProfile?.primary?.label) {
    reasons.push(`Archetype signal: ${archetypeProfile.primary.label}.`);
  }

  if (freeInteractionCount >= 2) {
    reasons.push(`${freeInteractionCount} free or hyper-efficient interaction pieces help protect the win turn.`);
  } else if (protectionCount + interactionCount >= 6) {
    reasons.push(`${protectionCount + interactionCount} protection/interaction signals give the plan some resilience.`);
  }

  const [title, subtitle, summary] = BRACKET_LABELS[level];
  const winTurn = estimateWinTurn({
    deterministicCombos, infiniteCombos, compactWinCombos, tutorCount, ritualBurstCount, freeInteractionCount, fastManaCount, cedhMarkerCount, avgMV,
  });

  return {
    level,
    title,
    subtitle,
    summary,
    reasons: reasons.slice(0, 3),
    winTurn,
    signals: {
      cedhMarkerCount,
      fastManaCount,
      freeInteractionCount,
      tutorCount,
      compactWinComboCount: compactWinCombos.length,
      supportPackageCount: supportPackages.length,
    },
    caveat: "Local read based on combo, archetype, and role signals. It is not an official Commander Bracket score.",
  };
}

function buildBracketSummary(combos, tags, archetypeProfile, winPlan, comboSource) {
  if (combos.length > 0) {
    const registry = comboSource === "spellbook" ? "Commander Spellbook" : "the local registry";
    return `${combos.length} confirmed package${combos.length === 1 ? "" : "s"} found via ${registry}. Primary plan: ${winPlan?.primary?.label || archetypeProfile?.primary?.label || "deck synergy"}.`;
  }

  const topTags = tags.slice(0, 3).map(tag => tag.label).join(", ");
  return `No confirmed combos found. Strongest visible packages: ${topTags || "none yet"}.`;
}

export function buildBracketProfile(analysis, archetypeProfile, winPlan, spellbookResult) {
  const entries = getEntries(analysis);
  if (!entries.length) return null;

  const spellbookCombos = buildSpellbookCombos(spellbookResult);
  const combos = spellbookCombos || detectCombos(entries);
  const comboSource = spellbookCombos ? "spellbook" : "local";
  const tags = buildArchetypeTags(entries, combos);
  const estimate = estimateBracket(entries, combos, tags, archetypeProfile, winPlan, analysis?.avgMV);

  return {
    combos,
    comboSource,
    almostCombos: buildAlmostCombos(spellbookResult),
    tags,
    estimate,
    primaryArchetype: archetypeProfile?.primary || null,
    primaryWinPlan: winPlan?.primary || null,
    summary: buildBracketSummary(combos, tags, archetypeProfile, winPlan, comboSource),
  };
}
