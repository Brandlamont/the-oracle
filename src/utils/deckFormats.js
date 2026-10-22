import { normalizeCardName } from "./cardUtils.js";

export const SAMPLE_DECK = `4 Lightning Bolt
4 Monastery Swiftspear
4 Goblin Guide
4 Eidolon of the Great Revel
4 Light Up the Stage
3 Skullcrack
4 Searing Blaze
4 Lava Spike
4 Rift Bolt
3 Shard Volley
4 Inspiring Vantage
2 Sacred Foundry
4 Fiery Islet
3 Sunbaked Canyon
4 Mountain`;

export const IMPORT_FORMATS = [
  { key: "plain", label: "Plain Text" },
  { key: "moxfield", label: "Moxfield" },
  { key: "archidekt", label: "Archidekt" },
  { key: "mtggoldfish", label: "MTGGoldfish" },
];

export const EXPORT_FORMATS = IMPORT_FORMATS;

function readSection(line) {
  const cleaned = line.replace(/^\/\//, "").replace(/[:#]+$/, "").trim().toLowerCase();
  if (!cleaned) return null;
  if (/^(commander|commanders|command zone|commandzone)$/.test(cleaned)) return "commander";
  if (/^(sideboard|side board|maybeboard|maybe board)$/.test(cleaned)) return "sideboard";
  if (/^(deck|main|mainboard|main deck|maindeck|non-commander)$/.test(cleaned)) return "main";
  return null;
}

function stripDecorations(name) {
  return name
    .replace(/\s+\*[^*]+\*\s*$/g, "")
    .replace(/\s+\[[^\]]+\]\s*$/g, "")
    .replace(/\s+#.*$/g, "")
    .trim();
}

function parsePrinting(rawName) {
  let name = stripDecorations(rawName);
  let setCode = "";
  let collectorNumber = "";

  const bracketMatch = name.match(/^(.*?)\s+\[([A-Z0-9]{2,6})#?([A-Z0-9\-★]+)?\]\s*$/i);
  if (bracketMatch) {
    return {
      name: bracketMatch[1].trim(),
      setCode: bracketMatch[2]?.toUpperCase() || "",
      collectorNumber: bracketMatch[3] || "",
    };
  }

  const setAndNumberMatch = name.match(/^(.*?)\s+\(([A-Z0-9]{2,6})\)\s+([A-Z0-9\-★]+)(?:\s+.*)?$/i);
  if (setAndNumberMatch) {
    return {
      name: setAndNumberMatch[1].trim(),
      setCode: setAndNumberMatch[2]?.toUpperCase() || "",
      collectorNumber: setAndNumberMatch[3] || "",
    };
  }

  const setOnlyMatch = name.match(/^(.*?)\s+\(([A-Z0-9]{2,6})\)(?:\s+.*)?$/i);
  if (setOnlyMatch) {
    name = setOnlyMatch[1].trim();
    setCode = setOnlyMatch[2]?.toUpperCase() || "";
  }

  return { name, setCode, collectorNumber };
}

function parseCardLine(rawLine, currentBoard, includePrintings) {
  let line = rawLine.trim();
  if (!line) return null;

  let board = currentBoard;
  if (/^SB:/i.test(line)) {
    board = "sideboard";
    line = line.replace(/^SB:\s*/i, "").trim();
  }

  const match = line.match(/^(\d+)[xX]?\s+(.+)$/);
  if (!match) return null;

  const qty = parseInt(match[1], 10);
  const printing = parsePrinting(match[2]);
  const card = {
    qty,
    name: printing.name,
    board,
    rawName: match[2].trim(),
    sourceLine: rawLine,
  };

  if (includePrintings) {
    card.setCode = printing.setCode;
    card.collectorNumber = printing.collectorNumber;
  }

  return card;
}

export function parseDeckImport(text, { format = "plain", includePrintings = false } = {}) {
  const cards = [];
  let commanderName = "";
  let currentBoard = "main";
  let parsedCardCount = 0;
  let blankAfterFirstCard = false;

  for (const raw of text.trim().split("\n")) {
    let line = raw.trim();
    if (!line) {
      if (parsedCardCount === 1) blankAfterFirstCard = true;
      continue;
    }

    const section = readSection(line);
    if (section) {
      currentBoard = section;
      continue;
    }

    if (/^\/\/\s*/.test(line)) {
      const commentSection = readSection(line);
      if (commentSection) currentBoard = commentSection;
      continue;
    }

    const parsed = parseCardLine(line, currentBoard === "commander" ? "main" : currentBoard, includePrintings);
    if (!parsed) continue;

    if (currentBoard === "commander" && !commanderName) {
      commanderName = parsed.name;
      parsed.role = "commander";
    }

    parsed.sourceFormat = format;
    cards.push(parsed);
    parsedCardCount += 1;
  }

  const mainCount = cards
    .filter(card => card.board !== "sideboard")
    .reduce((sum, card) => sum + card.qty, 0);
  const firstCard = cards[0];
  const looksLikeCommanderPreamble =
    format === "plain" &&
    !commanderName &&
    firstCard?.board === "main" &&
    firstCard.qty === 1 &&
    blankAfterFirstCard &&
    mainCount >= 98 &&
    mainCount <= 101;

  if (looksLikeCommanderPreamble) {
    commanderName = firstCard.name;
    firstCard.role = "commander";
  }

  return { cards, commanderName };
}

export function parseDecklist(text) {
  return parseDeckImport(text).cards;
}

export function collectLookupEntries(cards, commanderName, includePrintings = false) {
  const entries = [...cards];
  if (commanderName?.trim() && !entries.some(entry => normalizeCardName(entry.name) === normalizeCardName(commanderName))) {
    entries.push({ qty: 1, name: commanderName.trim(), board: "commander" });
  }

  return entries.map(entry => ({
    name: entry.name,
    setCode: includePrintings ? entry.setCode : "",
    collectorNumber: includePrintings ? entry.collectorNumber : "",
  }));
}

function printingSuffix(card, includePrintings) {
  if (!includePrintings || !card?.set) return "";
  const setCode = card.set.toUpperCase();
  const collector = card.collector_number ? ` ${card.collector_number}` : "";
  return ` (${setCode})${collector}`;
}

function formatLine(item, format, includePrintings) {
  const suffix = printingSuffix(item.card, includePrintings);
  if (format === "archidekt") return `${item.qty}x ${item.card.name}${suffix}`;
  return `${item.qty} ${item.card.name}${suffix}`;
}

function sectionHeader(section, format) {
  const headers = {
    plain: { commander: "// Commander", main: "// Main Deck", sideboard: "// Sideboard" },
    moxfield: { commander: "COMMANDER:", main: "MAINDECK:", sideboard: "SIDEBOARD:" },
    archidekt: { commander: "Commander", main: "Deck", sideboard: "Sideboard" },
    mtggoldfish: { commander: "Commander", main: "Deck", sideboard: "Sideboard" },
  };

  return headers[format]?.[section] || headers.plain[section];
}

export function formatDeckExport(analysis, { format = "plain", includePrintings = false } = {}) {
  if (!analysis) return "";

  const commanderKey = normalizeCardName(analysis.commanderCard?.name || analysis.commanderName || "");
  const commanderCards = [];
  const mainCards = [];

  for (const item of analysis.cardList || []) {
    const isCommander = item.role === "commander" || (commanderKey && normalizeCardName(item.card?.name) === commanderKey);
    if (isCommander && commanderCards.length === 0) commanderCards.push({ ...item, qty: 1 });
    else mainCards.push(item);
  }

  const sections = [];
  if (commanderCards.length) {
    sections.push([sectionHeader("commander", format), ...commanderCards.map(item => formatLine(item, format, includePrintings))].join("\n"));
  }

  if (mainCards.length) {
    sections.push([sectionHeader("main", format), ...mainCards.map(item => formatLine(item, format, includePrintings))].join("\n"));
  }

  if (analysis.sideboardCardList?.length) {
    sections.push([sectionHeader("sideboard", format), ...analysis.sideboardCardList.map(item => formatLine(item, format, includePrintings))].join("\n"));
  }

  return sections.join("\n\n");
}
