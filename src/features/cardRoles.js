import { getOracleText } from "../utils/cardUtils.js";

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
  return lower(card?.name || "");
}

function includesAny(text, phrases) {
  return phrases.some(phrase => text.includes(phrase));
}

function isLandSearchForController(text) {
  if (!text.includes("search your library") || !text.includes("land")) return false;

  return !includesAny(text, [
    "its controller may search",
    "that player may search",
    "target opponent may search",
    "target player may search",
    "an opponent may search",
  ]);
}

function isCostReduction(text) {
  return includesAny(text, [
    "spells you cast cost",
    "instant and sorcery spells you cast cost",
    "creature spells you cast cost",
    "artifact spells you cast cost",
    "enchantment spells you cast cost",
    "costs {1} less to cast",
    "costs {2} less to cast",
    "costs one less to cast",
  ]);
}

export function isRampRole(card) {
  const text = cardText(card);
  const name = cardName(card);
  const type = cardType(card);

  if (type.includes("land")) return false;

  return (
    includesAny(text, [
      "add {",
      "add one mana",
      "add two mana",
      "add three mana",
      "add x mana",
      "add an amount of {",
      "add mana of any",
      "create a treasure",
      "create x treasure",
      "treasure token",
      "play an additional land",
      "you may play additional lands",
      "you may play an additional land",
    ]) ||
    isLandSearchForController(text) ||
    isCostReduction(text) ||
    includesAny(name, ["sol ring", "arcane signet", "signet", "talisman"])
  );
}

export function isCardDrawRole(card) {
  const text = cardText(card);

  return (
    includesAny(text, [
      "draw a card",
      "draw two cards",
      "draw three cards",
      "draw cards",
      "whenever you draw",
      "investigate",
      "clue token",
    ]) ||
    (text.includes("look at the top") && text.includes("put") && text.includes("hand"))
  );
}

export function isGraveyardRecursionRole(card) {
  const text = cardText(card);

  return (
    includesAny(text, [
      "from your graveyard to your hand",
      "from your graveyard to the battlefield",
      "from your graveyard onto the battlefield",
      "from your graveyard to the top of your library",
      "return target card from your graveyard",
      "return target creature card from your graveyard",
      "return target permanent card from your graveyard",
      "return target artifact card from your graveyard",
      "return target enchantment card from your graveyard",
      "return target instant card from your graveyard",
      "return target sorcery card from your graveyard",
      "cast target instant or sorcery card from your graveyard",
      "you may cast target instant or sorcery card from your graveyard",
      "you may cast spells from your graveyard",
      "you may cast this card from your graveyard",
      "you may play lands from your graveyard",
      "you may play cards from your graveyard",
      "play lands from your graveyard",
      "flashback",
      "jump-start",
      "escape",
    ]) ||
    (text.includes("put target creature card from a graveyard") && text.includes("under your control")) ||
    (text.includes("return all") && text.includes("from your graveyard")) ||
    (text.includes("return each") && text.includes("from your graveyard")) ||
    (text.includes("return up to") && text.includes("from your graveyard")) ||
    (text.includes("return target") && text.includes("from your graveyard"))
  );
}

function hasTargetThreat(text) {
  return includesAny(text, [
    "target creature",
    "target artifact",
    "target enchantment",
    "target planeswalker",
    "target battle",
    "target permanent",
    "target nonland permanent",
    "target tapped creature",
    "target attacking creature",
    "target blocked creature",
    "target blocking creature",
    "target creature or planeswalker",
    "target artifact or enchantment",
    "target spell",
    "target activated ability",
    "target triggered ability",
  ]);
}

function isGraveyardTarget(text) {
  return includesAny(text, [
    "target card from your graveyard",
    "target creature card from your graveyard",
    "target permanent card from your graveyard",
    "target artifact card from your graveyard",
    "target enchantment card from your graveyard",
    "target instant card from your graveyard",
    "target sorcery card from your graveyard",
    "target card in a graveyard",
    "target card from a graveyard",
    "target creature card from a graveyard",
  ]);
}

export function isTargetedRemovalRole(card) {
  const text = cardText(card);
  const graveyardTarget = isGraveyardTarget(text);

  const destroysOrExiles =
    (text.includes("destroy target") || text.includes("exile target")) &&
    hasTargetThreat(text) &&
    !graveyardTarget;

  const counters = includesAny(text, [
    "counter target spell",
    "counter target creature spell",
    "counter target noncreature spell",
    "counter target instant spell",
    "counter target sorcery spell",
    "counter target instant or sorcery spell",
    "counter target artifact spell",
    "counter target enchantment spell",
    "counter target planeswalker spell",
    "counter target activated ability",
    "counter target triggered ability",
    "counter target activated or triggered ability",
  ]);

  const bounces =
    text.includes("return target") &&
    hasTargetThreat(text) &&
    !graveyardTarget &&
    !text.includes("you control to its owner's hand") &&
    !text.includes("you control to their owner's hand");

  const shrinks = includesAny(text, [
    "target creature gets -",
    "target creature an opponent controls gets -",
  ]);

  const damage = includesAny(text, [
    "damage to any target",
    "damage to target creature",
    "damage to target planeswalker",
    "damage to target opponent",
    "damage to target player",
    "damage to another target",
  ]);

  const sacrifices = includesAny(text, [
    "target opponent sacrifices",
    "target player sacrifices a creature",
    "target player sacrifices a permanent",
    "target player sacrifices an artifact",
    "target player sacrifices an enchantment",
    "target player sacrifices a planeswalker",
  ]);

  const fights = includesAny(text, [
    "fights target creature",
    "fights up to one target creature",
  ]);

  return destroysOrExiles || counters || bounces || shrinks || damage || sacrifices || fights;
}

export function isBoardWipeRole(card) {
  const text = cardText(card);

  return (
    includesAny(text, [
      "destroy all creatures",
      "destroy all artifacts",
      "destroy all enchantments",
      "destroy all nonland permanents",
      "destroy all permanents",
      "exile all creatures",
      "exile all artifacts",
      "exile all enchantments",
      "exile all nonland permanents",
      "exile all permanents",
      "return all creatures",
      "return all nonland permanents",
      "return each nonland permanent",
      "each creature gets -",
      "damage to each creature",
      "damage to each other creature",
    ]) ||
    (text.includes("deals") && text.includes("damage") && text.includes("each creature")) ||
    (
      text.includes("each player sacrifices") &&
      includesAny(text, ["creature", "artifact", "enchantment", "planeswalker", "permanent"])
    )
  );
}

export function isProtectionRole(card) {
  const text = cardText(card);
  const isRegeneration =
    text.includes("regenerate") &&
    !text.includes("can't be regenerated") &&
    !text.includes("cannot be regenerated");

  return (
    includesAny(text, [
      "hexproof",
      "indestructible",
      "phase out",
      "protection from",
      "shroud",
      "can't be countered",
      "prevent all damage",
      "prevent the next",
    ]) ||
    isRegeneration
  );
}

export function isWinConditionRole(card) {
  const text = cardText(card);
  const isStormFinisher =
    text.includes("storm") &&
    (
      text.includes("target player loses") ||
      text.includes("target opponent loses") ||
      text.includes("damage to any target") ||
      text.includes("damage to target player") ||
      text.includes("damage to target opponent") ||
      text.includes("target player mills")
    );

  return (
    includesAny(text, [
      "you win the game",
      "each opponent loses",
      "deals damage to each opponent",
      "double each",
      "extra turn",
    ]) ||
    isStormFinisher ||
    (text.includes("create") && text.includes("token") && text.includes("for each")) ||
    (text.includes("whenever") && text.includes("each opponent") && text.includes("loses"))
  );
}

export function classifyCommanderRole(card) {
  const type = cardType(card);
  const cats = new Set();

  if (type.includes("land")) cats.add("Lands");
  if (isRampRole(card)) cats.add("Ramp");
  if (isCardDrawRole(card)) cats.add("Card Draw");
  if (isTargetedRemovalRole(card)) cats.add("Targeted Removal");
  if (isBoardWipeRole(card)) cats.add("Board Wipes");
  if (isProtectionRole(card)) cats.add("Protection");
  if (isGraveyardRecursionRole(card)) cats.add("Graveyard Recursion");
  if (isWinConditionRole(card)) cats.add("Win Conditions");

  return [...cats];
}
