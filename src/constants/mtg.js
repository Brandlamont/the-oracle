export const MTG_COLOR_INFO = {
  W: { label: "White", hex: "#D9D6C7" },
  U: { label: "Blue", hex: "#3A82C4" },
  B: { label: "Black", hex: "#8066A6" },
  R: { label: "Red", hex: "#D85A4E" },
  G: { label: "Green", hex: "#3D8F63" },
  C: { label: "Colorless", hex: "#7A8190" },
};

export const MTG_COLOR_ORDER = ["W", "U", "B", "R", "G"];

export const MTG_COLOR_IDENTITY_NAMES = {
  C: "Colorless",
  W: "Mono-White",
  U: "Mono-Blue",
  B: "Mono-Black",
  R: "Mono-Red",
  G: "Mono-Green",
  WU: "Azorius",
  UB: "Dimir",
  BR: "Rakdos",
  RG: "Gruul",
  WG: "Selesnya",
  WB: "Orzhov",
  UR: "Izzet",
  BG: "Golgari",
  WR: "Boros",
  UG: "Simic",
  WUG: "Bant",
  WUB: "Esper",
  UBR: "Grixis",
  BRG: "Jund",
  WRG: "Naya",
  WBG: "Abzan",
  WUR: "Jeskai",
  UBG: "Sultai",
  WBR: "Mardu",
  URG: "Temur",
  WUBR: "Yore-Tiller",
  UBRG: "Glint-Eye",
  WBRG: "Dune-Brood",
  WURG: "Ink-Treader",
  WUBG: "Witch-Maw",
  WUBRG: "WUBRG",
};

export const TYPE_COLOR = {
  Creature: "#C6453D",
  Instant: "#2477B3",
  Sorcery: "#8A5FB8",
  Enchantment: "#23845F",
  Artifact: "#6D7781",
  Planeswalker: "#9A6A8D",
  Land: "#6E665C",
  Battle: "#D26945",
  Other: "#5A6570",
};

export const DECK_PREVIEW_TYPE_ORDER = [
  "Creature",
  "Sorcery",
  "Instant",
  "Artifact",
  "Enchantment",
  "Planeswalker",
  "Battle",
  "Land",
  "Other",
];

export const DECK_PREVIEW_TYPE_LABELS = {
  Creature: "Creatures",
  Sorcery: "Sorceries",
  Instant: "Instants",
  Artifact: "Artifacts",
  Enchantment: "Enchantments",
  Planeswalker: "Planeswalkers",
  Battle: "Battles",
  Land: "Lands",
  Other: "Other",
};

export const COMMANDER_CATEGORY_TARGETS = [
  { key: "Lands", label: "Lands", target: "36-38", min: 36, good: 38, description: "Most Commander decks want enough lands to hit early drops without flooding too hard." },
  { key: "Ramp", label: "Ramp", target: "10-12", min: 10, good: 12, description: "Mana rocks, land ramp, rituals, and repeatable mana acceleration." },
  { key: "Card Draw", label: "Card Draw", target: "10-12", min: 10, good: 12, description: "Cards that replace themselves or generate sustained card advantage." },
  { key: "Targeted Removal", label: "Targeted Removal", target: "8-10", min: 8, good: 10, description: "Spot removal, counterspells, bounce, exile, or destroy effects for specific threats." },
  { key: "Board Wipes", label: "Board Wipes", target: "2-4", min: 2, good: 4, description: "Reset buttons for creatures, artifacts, enchantments, or all nonland permanents." },
  { key: "Protection", label: "Protection", target: "3-5", min: 3, good: 5, description: "Shields such as hexproof, indestructible, phasing, prevention, or anti-countermagic." },
  { key: "Graveyard Recursion", label: "Graveyard Recursion", target: "Contextual", min: 0, good: 2, optional: true, description: "Cards that replay, return, cast, or rebuild resources from the graveyard." },
  { key: "Win Conditions", label: "Win Conditions", target: "2-4", min: 2, good: 4, description: "Cards that directly close games or create overwhelming board states." },
];
