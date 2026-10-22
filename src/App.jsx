import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { Divider } from "./components/Divider";
import {
  DECK_PREVIEW_TYPE_LABELS,
  DECK_PREVIEW_TYPE_ORDER,
  MTG_COLOR_INFO,
  TYPE_COLOR,
} from "./constants/mtg";
import { buildAnalysis } from "./features/analysis";
import { buildArchetypeProfile } from "./features/archetypes";
import { buildBracketProfile } from "./features/bracketProfile";
import { buildCommanderAssistant, fetchCommanderCategorySuggestions, getEdhrecCardUrl } from "./features/commanderAssistant";
import { buildManaBaseProfile } from "./features/manaBase";
import { buildTuningPlan } from "./features/tuningPlan";
import { buildWinPlan } from "./features/winConditions";
import { fetchCardsFromScryfall } from "./services/scryfall";
import { fetchSpellbookCombos } from "./services/spellbook";
import {
  BAR_EMPTY,
  BG,
  BODY_FONT,
  BORDER,
  CARD_SHADOW,
  CONTROL_BG,
  CONTROL_BORDER,
  DANGER,
  DANGER_TEXT,
  DISPLAY_FONT,
  GLOBAL_CSS,
  GOLD,
  GOLD_DIM,
  GOLD_FAINT,
  HOVER_SHADOW,
  INVERSE_TEXT,
  MONO_FONT,
  ROW_BG,
  SUCCESS,
  SURFACE,
  SURFACE2,
  TEXT,
  TEXT_DIM,
  TEXT_MUTED,
  TOOLTIP_SHADOW,
  WARN,
  WARN_TEXT,
  cardStyle,
  getThemeVars,
} from "./styles/theme";
import { formatColorIdentity, getCardImage, getCardType, getOracleText, normalizeCardName } from "./utils/cardUtils";
import {
  EXPORT_FORMATS,
  IMPORT_FORMATS,
  SAMPLE_DECK,
  collectLookupEntries,
  formatDeckExport,
  parseDeckImport,
} from "./utils/deckFormats";
import {
  buildShareUrl,
  loadRecentDecks,
  readDeckPayloadFromUrl,
  removeRecentDeck,
  saveRecentDeck,
} from "./utils/deckShare";

const ManaCurveChart = lazy(() => import("./components/ManaCurveChart"));

// ─── UI Components ────────────────────────────────────────────────────────────

function ManaStripe() {
  const colors = ["#D9D6C7", "#3A82C4", "#4E4651", "#D85A4E", "#3D8F63"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", height: 3, overflow: "hidden" }}>
      {colors.map(color => <div key={color} style={{ background: color }} />)}
    </div>
  );
}

function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 40,
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        background: SURFACE,
        border: BORDER,
        borderRadius: 6,
        color: TEXT,
        fontFamily: DISPLAY_FONT,
        fontSize: 11,
        fontWeight: 700,
        boxShadow: CARD_SHADOW,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 16,
          borderRadius: 4,
          background: GOLD_FAINT,
          border: `1px solid ${GOLD_DIM}`,
          padding: 2,
          display: "flex",
          justifyContent: isDark ? "flex-end" : "flex-start",
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 3, background: GOLD }} />
      </span>
      {isDark ? "Dark" : "Light"}
    </button>
  );
}

function FeatureCard({ title, children }) {
  return (
    <div style={{ ...cardStyle, minHeight: 118, borderLeft: `3px solid ${GOLD}`, boxShadow: "none" }}>
      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 14, color: TEXT, letterSpacing: "0", marginBottom: 8, fontWeight: 800 }}>
        {title}
      </div>
      <p style={{ fontSize: 14, color: TEXT_DIM, lineHeight: 1.55 }}>{children}</p>
    </div>
  );
}

function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "12px 18px",
        background: props.disabled ? SURFACE2 : GOLD,
        border: props.disabled ? CONTROL_BORDER : `1px solid ${GOLD_DIM}`,
        borderRadius: 6,
        color: props.disabled ? TEXT_MUTED : INVERSE_TEXT,
        fontFamily: DISPLAY_FONT,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.02em",
        boxShadow: "none",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, active, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 14px",
        background: active ? GOLD_FAINT : "transparent",
        border: active ? `1px solid ${GOLD_DIM}` : BORDER,
        borderRadius: 6,
        color: active ? GOLD : TEXT_DIM,
        fontFamily: DISPLAY_FONT,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function SelectControl({ value, onChange, options, label }) {
  return (
    <label style={{ display: "grid", gap: 6, flex: 1, minWidth: 170 }}>
      <span style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: GOLD, textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        style={{
          width: "100%",
          background: CONTROL_BG,
          border: CONTROL_BORDER,
          borderRadius: 6,
          color: TEXT,
          fontFamily: DISPLAY_FONT,
          fontSize: 12,
          fontWeight: 700,
          padding: "10px 12px",
          outline: "none",
        }}
      >
        {options.map(option => (
          <option key={option.key} value={option.key}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({ checked, onChange, label }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 9, color: TEXT_DIM, fontFamily: DISPLAY_FONT, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        style={{ width: 16, height: 16, accentColor: GOLD }}
      />
      {label}
    </label>
  );
}

function getDisplayManaCost(card) {
  if (card?.mana_cost) return card.mana_cost;
  return (card?.card_faces || []).map(face => face.mana_cost).filter(Boolean).join(" // ");
}

function CardHoverPreview({ card, children, as = "span", style, ...props }) {
  const [hover, setHover] = useState(null);
  const Wrapper = as;
  const img = getCardImage(card, "normal");
  const oracleText = getOracleText(card);
  const oracleLines = oracleText ? oracleText.split("\n").filter(Boolean).slice(0, 7) : [];
  const manaCost = getDisplayManaCost(card);

  const updateHover = event => {
    if (!card) return;
    const width = 380;
    const height = 510;
    const viewportWidth = typeof window === "undefined" ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 720 : window.innerHeight;
    const maxX = Math.max(16, viewportWidth - width - 16);
    const maxY = Math.max(16, viewportHeight - height - 16);

    setHover({
      x: Math.min(event.clientX + 18, maxX),
      y: Math.min(event.clientY + 18, maxY),
    });
  };

  return (
    <Wrapper
      {...props}
      onMouseEnter={updateHover}
      onMouseMove={updateHover}
      onMouseLeave={() => setHover(null)}
      style={{ position: "relative", ...style }}
    >
      {children}
      {hover && card && (
        <div
          style={{
            position: "fixed",
            zIndex: 90,
            left: hover.x,
            top: hover.y,
            width: 380,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "calc(100vh - 32px)",
            overflow: "auto",
            background: SURFACE,
            border: BORDER,
            borderRadius: 8,
            boxShadow: TOOLTIP_SHADOW,
            padding: 10,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: img ? "142px 1fr" : "1fr", gap: 12, alignItems: "start" }}>
            {img && (
              <img src={img} alt={card.name} style={{ display: "block", width: "100%", borderRadius: 6, border: BORDER }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: DISPLAY_FONT, color: TEXT, fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>
                {card.name}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 7, color: TEXT_MUTED, fontSize: 11 }}>
                {manaCost && <span style={{ fontFamily: MONO_FONT, color: GOLD }}>{manaCost}</span>}
                {card.type_line && <span>{card.type_line}</span>}
              </div>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {oracleLines.length > 0 ? (
                  oracleLines.map((line, index) => (
                    <p key={`${card.id}-oracle-${index}`} style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45 }}>
                      {line}
                    </p>
                  ))
                ) : (
                  <p style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.45 }}>
                    No rules text found for this card.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Wrapper>
  );
}

function CardNameWithPreview({ card, qty, muted = false }) {
  return (
    <CardHoverPreview
      card={card}
      as="span"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, color: muted ? TEXT_DIM : TEXT }}
    >
      <span>{card?.name || "Unknown Card"}</span>
      {qty != null && <span style={{ fontSize: 11, color: TEXT_DIM }}>x{qty}</span>}
    </CardHoverPreview>
  );

  const [hovered, setHovered] = useState(false);
  const img = getCardImage(card, "normal");

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6, color: muted ? TEXT_DIM : TEXT }}
    >
      <span>{card?.name || "Unknown Card"}</span>
      {qty != null && <span style={{ fontSize: 11, color: TEXT_DIM }}>×{qty}</span>}
      {hovered && img && (
        <span
          style={{
            position: "absolute",
            zIndex: 20,
            left: "50%",
            bottom: "calc(100% + 10px)",
            transform: "translateX(-50%)",
            width: 230,
            padding: 6,
            background: SURFACE2,
            border: BORDER,
            borderRadius: 10,
            boxShadow: TOOLTIP_SHADOW,
            pointerEvents: "none",
          }}
        >
          <img src={img} alt={card.name} style={{ display: "block", width: "100%", borderRadius: 8 }} />
        </span>
      )}
    </span>
  );
}

function ColorBreakdown({ data, groups, total }) {
  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 320 }}>
      <Divider label="Color Identity" />
      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: TEXT_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            Color Influence
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {data.map(d => {
              const pct = total ? Math.round((d.value / total) * 100) : 0;
              return (
                <div key={d.key} style={{ display: "grid", gridTemplateColumns: "82px 1fr 52px", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: d.hex, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: TEXT_DIM }}>{d.name}</span>
                  </div>
                  <div style={{ height: 8, background: BAR_EMPTY, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: d.hex, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, color: TEXT, fontFamily: DISPLAY_FONT, fontWeight: 700, textAlign: "right" }}>
                    {d.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: TEXT_DIM, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
            Exact Identities
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {groups.map(group => {
              const swatches = group.colors.length ? group.colors : ["C"];
              return (
                <div key={group.key} style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "9px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      {swatches.map(color => (
                        <span
                          key={color}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 999,
                            background: MTG_COLOR_INFO[color]?.hex || "#777",
                            border: "1px solid color-mix(in srgb, var(--oracle-text) 18%, transparent)",
                            marginLeft: color === swatches[0] ? 0 : -3,
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TEXT, fontWeight: 700, lineHeight: 1.2 }}>{group.label}</div>
                    </div>
                    <div style={{ fontFamily: DISPLAY_FONT, fontSize: 13, color: GOLD, fontWeight: 800 }}>
                      {group.count}
                    </div>
                  </div>
                  <div style={{ height: 5, background: BAR_EMPTY, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${group.pct}%`, height: "100%", background: GOLD, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.map(d => (
            <span key={d.key} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 7px", border: BORDER, borderRadius: 999, color: TEXT_DIM, fontSize: 11, background: SURFACE }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: d.hex }} />
              {d.key}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PipsVsSources({ analysis }) {
  const manaBase = useMemo(() => buildManaBaseProfile(analysis), [analysis]);
  if (!manaBase) return null;

  const maxSources = Math.max(...manaBase.rows.map(row => row.sources), ...manaBase.rows.map(row => row.recommended), 1);

  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 280 }}>
      <Divider label="Pips vs Sources" />
      <div style={{ display: "grid", gap: 12 }}>
        {manaBase.rows.map(row => {
          const sourcePct = Math.min(100, Math.round((row.sources / maxSources) * 100));
          const markerPct = Math.min(100, Math.round((row.recommended / maxSources) * 100));
          return (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center" }}>
              <div
                title={row.label}
                style={{ width: 16, height: 16, borderRadius: 999, background: row.hex, border: "1px solid color-mix(in srgb, var(--oracle-text) 18%, transparent)" }}
              />
              <div style={{ position: "relative" }}>
                <div style={{ height: 10, background: BAR_EMPTY, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${sourcePct}%`, height: "100%", background: row.hex, borderRadius: 999 }} />
                </div>
                <div
                  title={`Target: ~${row.recommended}+ sources`}
                  style={{ position: "absolute", left: `${markerPct}%`, top: -2, bottom: -2, width: 2, background: TEXT, opacity: 0.6, transform: "translateX(-1px)" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: TEXT, fontFamily: DISPLAY_FONT, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {row.sources} src
                </span>
                <StatusPill tone={row.thin ? WARN : SUCCESS}>{row.thin ? "Thin" : "Covered"}</StatusPill>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, fontSize: 11, color: TEXT_MUTED }}>
        {manaBase.rows.map(row => (
          <span key={`${row.key}-pips`}>{row.label}: {row.pips} pip{row.pips === 1 ? "" : "s"} in costs</span>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: TEXT_MUTED }}>
        Tick mark shows the recommended source count for how often that color appears in costs.
      </div>

      {manaBase.thinColors.length > 0 && (
        <div style={{ marginTop: 10, color: WARN_TEXT, fontSize: 12, lineHeight: 1.45 }}>
          Thin on sources: {manaBase.thinColors.join(", ")}. More lands, rocks, or dorks that produce {manaBase.thinColors.length === 1 ? "that color" : "these colors"} would help consistency.
        </div>
      )}
    </div>
  );
}

function StatusPill({ tone, children }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 9px",
      borderRadius: 6,
      border: `1px solid ${tone}`,
      color: tone,
      background: "color-mix(in srgb, currentColor 10%, transparent)",
      fontFamily: DISPLAY_FONT,
      fontSize: 11,
      fontWeight: 800,
      lineHeight: 1,
    }}>
      {children}
    </span>
  );
}

function ColorPipStack({ colors = [], size = 18 }) {
  const pips = colors.length ? colors : ["C"];

  return (
    <div style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
      {pips.map((color, index) => (
        <span
          key={`${color}-${index}`}
          title={MTG_COLOR_INFO[color]?.label || "Colorless"}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            background: MTG_COLOR_INFO[color]?.hex || MTG_COLOR_INFO.C.hex,
            border: "1px solid color-mix(in srgb, var(--oracle-text) 18%, transparent)",
            marginLeft: index === 0 ? 0 : -Math.max(4, Math.round(size * 0.28)),
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--oracle-bg) 70%, transparent)",
          }}
        />
      ))}
    </div>
  );
}

function AnalysisOverview({ analysis }) {
  const { totalCards, avgMV, totalPrice, landCount, isCmd, colorData, commanderReport } = analysis;
  const ok = commanderReport?.enabled && commanderReport.issues.length === 0;
  const tone = !commanderReport?.enabled ? TEXT_MUTED : ok ? SUCCESS : DANGER;
  const formatLabel = isCmd ? "Commander" : "Constructed";
  const metricStyle = {
    background: ROW_BG,
    border: BORDER,
    borderRadius: 6,
    padding: "11px 12px",
    minHeight: 72,
  };

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 0 }}>
        <div style={{ padding: "20px 22px", borderRight: BORDER, background: GOLD_FAINT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            <StatusPill tone={tone}>{commanderReport?.enabled ? commanderReport.status : "No Commander"}</StatusPill>
            <StatusPill tone={GOLD}>{formatLabel}</StatusPill>
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 68, fontWeight: 800, lineHeight: 0.85, color: TEXT }}>
            {totalCards}
          </div>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 12, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800, marginTop: 10 }}>
            Cards
          </div>
        </div>

        <div style={{ padding: "20px 22px", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, color: TEXT, lineHeight: 1.15 }}>
                {commanderReport?.commanderCard?.name || "Deck Snapshot"}
              </div>
              <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 5 }}>
                {commanderReport?.commanderCard ? formatColorIdentity(commanderReport.commanderColors) : "Color identity updates after commander lookup"}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
              {colorData.map(color => (
                <span key={color.key} title={color.name} style={{ width: 18, height: 18, borderRadius: 999, background: color.hex, border: "1px solid color-mix(in srgb, var(--oracle-text) 18%, transparent)" }} />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
            <div style={metricStyle}>
              <div style={{ color: TEXT_DIM, fontSize: 11, fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Lands</div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 800, marginTop: 5 }}>{landCount}</div>
            </div>
            <div style={metricStyle}>
              <div style={{ color: TEXT_DIM, fontSize: 11, fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Avg MV</div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 800, marginTop: 5 }}>{avgMV ?? "-"}</div>
            </div>
            <div style={metricStyle}>
              <div style={{ color: TEXT_DIM, fontSize: 11, fontFamily: DISPLAY_FONT, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>USD</div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 800, marginTop: 5 }}>${totalPrice}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WIN_TURN_SEGMENTS = [
  { key: "b1", label: "B1", detail: "10+", turn: "10+", hex: "#2f8f5b", min: 10, max: 13 },
  { key: "b2", label: "B2", detail: "8-10", turn: "turn 8", hex: "#3a6ea8", min: 8, max: 10 },
  { key: "b3", label: "B3", detail: "6-8", turn: "turn 6", hex: "#6a4fb0", min: 6, max: 8 },
  { key: "b4", label: "B4", detail: "4-6", turn: "turn 4", hex: "#a15a2e", min: 4, max: 6 },
  { key: "cedh", label: "cEDH", detail: "<4", turn: "", hex: "#8a2f3d", min: 2, max: 4 },
];
const WIN_TURN_AXIS_MIN = 2;
const WIN_TURN_AXIS_MAX = 12;

function WinTurnCard({ analysis, spellbookResult }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const bracket = useMemo(
    () => buildBracketProfile(analysis, archetypeProfile, winPlan, spellbookResult),
    [analysis, archetypeProfile, winPlan, spellbookResult]
  );
  const turn = bracket?.estimate?.winTurn;
  if (turn == null) return null;

  const clamped = Math.min(WIN_TURN_AXIS_MAX, Math.max(WIN_TURN_AXIS_MIN, turn));
  const markerPct = ((WIN_TURN_AXIS_MAX - clamped) / (WIN_TURN_AXIS_MAX - WIN_TURN_AXIS_MIN)) * 100;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 12, letterSpacing: "0.06em", color: TEXT_DIM, textTransform: "uppercase", fontWeight: 800 }}>
          Predicted Win Turn
        </div>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 26, fontWeight: 800, color: TEXT, lineHeight: 1 }}>
          {turn}
        </div>
      </div>

      <div style={{ position: "relative", paddingTop: 26 }}>
        <div
          style={{
            position: "absolute",
            left: `${markerPct}%`,
            top: 0,
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            background: SURFACE,
            border: BORDER,
            borderRadius: 999,
            padding: "3px 9px",
            fontFamily: DISPLAY_FONT,
            fontSize: 11,
            fontWeight: 800,
            color: TEXT,
            boxShadow: TOOLTIP_SHADOW,
          }}
        >
          This deck · {turn}
        </div>
        <div
          style={{
            position: "absolute",
            left: `${markerPct}%`,
            top: 22,
            bottom: -10,
            width: 2,
            background: TEXT,
            transform: "translateX(-1px)",
          }}
        />
        <div style={{ display: "flex", height: 34, borderRadius: 6, overflow: "hidden" }}>
          {WIN_TURN_SEGMENTS.map(segment => (
            <div
              key={segment.key}
              title={`${segment.label}: ${segment.detail}`}
              style={{ flex: 1, background: segment.hex, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <span style={{ color: "#fff", fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 800 }}>{segment.label}</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 11 }}>{segment.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: 6 }}>
          {WIN_TURN_SEGMENTS.map(segment => (
            <div key={segment.key} style={{ flex: 1, textAlign: "center", color: TEXT_MUTED, fontSize: 10 }}>
              {segment.turn}
            </div>
          ))}
        </div>
      </div>

      <p style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 16 }}>
        Brackets are turn ranges. This deck typically closes on turn {turn}.
      </p>
    </div>
  );
}

function BracketEstimateCard({ analysis, spellbookResult }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const bracket = useMemo(
    () => buildBracketProfile(analysis, archetypeProfile, winPlan, spellbookResult),
    [analysis, archetypeProfile, winPlan, spellbookResult]
  );
  const estimate = bracket?.estimate;

  if (!estimate) return null;

  const tone = estimate.level >= 5 ? DANGER : estimate.level >= 4 ? GOLD : estimate.level === 3 ? SUCCESS : TEXT_DIM;
  const signalItems = [
    { label: "Combos", value: estimate.signals.compactWinComboCount },
    { label: "Tutors", value: estimate.signals.tutorCount },
    { label: "Fast Mana", value: estimate.signals.fastManaCount },
    { label: "Free Stack", value: estimate.signals.freeInteractionCount },
  ];

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 0 }}>
        <div style={{ background: GOLD_FAINT, borderRight: BORDER, borderBottom: BORDER, padding: "18px 20px", display: "grid", alignContent: "center", gap: 10 }}>
          <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            Local Bracket Read
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <div style={{ color: tone, fontFamily: DISPLAY_FONT, fontSize: 56, lineHeight: 0.92, fontWeight: 800 }}>
              {estimate.level}
            </div>
            <div style={{ paddingBottom: 4 }}>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 19, fontWeight: 800, lineHeight: 1.05 }}>
                {estimate.title}
              </div>
              <div style={{ color: TEXT_DIM, fontSize: 12, marginTop: 4 }}>
                {estimate.subtitle}
              </div>
            </div>
          </div>
          <p style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.45 }}>
            {estimate.summary}
          </p>
        </div>

        <div style={{ padding: "18px 20px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {estimate.reasons.map(reason => (
              <div key={reason} style={{ display: "grid", gridTemplateColumns: "7px 1fr", gap: 9, alignItems: "start", color: TEXT_DIM, fontSize: 13, lineHeight: 1.45 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: tone, marginTop: 6 }} />
                <span>{reason}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {signalItems.map(item => (
              <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ROW_BG, border: BORDER, borderRadius: 999, color: TEXT_DIM, fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 800, padding: "5px 8px" }}>
                {item.label}
                <span style={{ color: TEXT }}>{item.value}</span>
              </span>
            ))}
          </div>
          <div style={{ color: TEXT_MUTED, fontSize: 11, lineHeight: 1.35 }}>
            {estimate.caveat}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeComposition({ data }) {
  const visible = data.filter(item => item.count > 0);
  if (!visible.length) return null;

  return (
    <div style={cardStyle}>
      <Divider label="Composition" />
      <div style={{ display: "flex", height: 18, borderRadius: 999, overflow: "hidden", background: BAR_EMPTY, marginBottom: 14 }}>
        {visible.map(item => (
          <div
            key={item.type}
            title={`${item.type}: ${item.count}`}
            style={{
              width: `${Math.max(item.pct, 2)}%`,
              background: TYPE_COLOR[item.type] || "#888",
            }}
          />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
        {visible.map(item => (
          <div key={item.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: ROW_BG, border: BORDER, borderRadius: 6, padding: "8px 10px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: TEXT_DIM, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_COLOR[item.type] || "#888" }} />
              {item.type}
            </span>
            <span style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 12 }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewQueue({ warnings, missing, mostExpensive }) {
  const items = [
    ...warnings.map(text => ({ key: `warning-${text}`, tone: WARN, label: "Review", text })),
    ...missing.map(({ name, board }) => ({
      key: `missing-${board}-${name}`,
      tone: WARN,
      label: board === "sideboard" ? "Sideboard" : board === "commander" ? "Commander" : "Missing",
      text: name,
    })),
  ];
  const priceCards = mostExpensive.filter(({ card }) => parseFloat(card.prices?.usd || 0) > 0);

  if (!items.length && !priceCards.length) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1.35fr) minmax(240px,0.9fr)", gap: 10 }}>
      {items.length > 0 && (
        <div style={cardStyle}>
          <Divider label="Review Queue" />
          <div style={{ display: "grid", gap: 8 }}>
            {items.map(item => (
              <div key={item.key} style={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 10, alignItems: "start", background: ROW_BG, border: BORDER, borderLeft: `3px solid ${item.tone}`, borderRadius: 6, padding: "8px 10px" }}>
                <span style={{ color: item.tone, fontFamily: DISPLAY_FONT, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.label}</span>
                <span style={{ color: TEXT, fontSize: 12, lineHeight: 1.45 }}>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {priceCards.length > 0 && (
        <div style={cardStyle}>
          <Divider label="Value Watch" />
          <div style={{ display: "grid", gap: 8 }}>
            {priceCards.slice(0, 4).map(({ qty, card }) => {
              const price = parseFloat(card.prices?.usd || 0);
              return (
                <div key={card.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: ROW_BG, border: BORDER, borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, minWidth: 0 }}><CardNameWithPreview card={card} qty={qty} /></div>
                  <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 12 }}>${price.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function buildDeckPreviewGroups(cards = []) {
  const groups = Object.fromEntries(DECK_PREVIEW_TYPE_ORDER.map(type => [type, []]));

  cards.forEach(item => {
    const type = getCardType(item.card?.type_line);
    const safeType = type in groups ? type : "Other";
    groups[safeType].push(item);
  });

  return DECK_PREVIEW_TYPE_ORDER
    .map(type => ({
      type,
      label: DECK_PREVIEW_TYPE_LABELS[type] || type,
      count: groups[type].reduce((sum, { qty }) => sum + qty, 0),
      cards: groups[type].sort((a, b) => a.card.name.localeCompare(b.card.name)),
    }))
    .filter(group => group.cards.length > 0);
}

function DeckPreviewSections({ cards, idPrefix = "main" }) {
  const groups = buildDeckPreviewGroups(cards);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map(group => (
        <div key={group.type} id={`decklist-${idPrefix}-${group.type}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: TYPE_COLOR[group.type] || "#888", flexShrink: 0 }} />
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: GOLD, textTransform: "uppercase", fontWeight: 700 }}>
              {group.label}
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: 11 }}>({group.count})</div>
            <div style={{ flex: 1, height: 1, background: GOLD_DIM }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 8 }}>
            {group.cards.map(({ qty, card }) => {
              const art = getCardImage(card, "art_crop") || getCardImage(card, "small");
              return (
                <CardHoverPreview key={`${group.type}-${card.id}-${qty}`} card={card} as="div" style={{ display: "grid", gridTemplateColumns: "76px 1fr", minHeight: 68, color: TEXT, background: ROW_BG, border: BORDER, borderLeft: `3px solid ${TYPE_COLOR[group.type] || "#888"}`, borderRadius: 6, overflow: "hidden", cursor: "help" }}>
                  <div style={{ position: "relative", background: SURFACE2 }}>
                    {art && <img src={art} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    <span style={{ position: "absolute", left: 6, bottom: 6, minWidth: 24, textAlign: "center", background: "rgba(0,0,0,0.68)", color: "#fff", borderRadius: 999, padding: "2px 7px", fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 800 }}>
                      {qty}
                    </span>
                  </div>
                  <div style={{ padding: "9px 10px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                      {card.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: TEXT_MUTED, fontSize: 11 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 2, background: TYPE_COLOR[group.type] || "#888" }} />
                      {group.type}
                    </div>
                  </div>
                </CardHoverPreview>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function scrollToDecklistSection(id) {
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function DeckCardList({ cards, sideboardCards }) {
  const [query, setQuery] = useState("");
  const mainCards = cards || [];
  const sideCards = sideboardCards || [];
  const sideboardCount = sideCards.reduce((sum, { qty }) => sum + qty, 0);

  if (!mainCards.length && !sideCards.length) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = ({ card }) => !normalizedQuery || card?.name?.toLowerCase().includes(normalizedQuery);
  const filteredMain = mainCards.filter(matchesQuery);
  const filteredSide = sideCards.filter(matchesQuery);
  const totalCount = mainCards.reduce((sum, { qty }) => sum + qty, 0);
  const filteredCount = filteredMain.reduce((sum, { qty }) => sum + qty, 0);
  const jumpGroups = buildDeckPreviewGroups(filteredMain);

  return (
    <div style={cardStyle}>
      <Divider label="Decklist Preview" />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search this decklist..."
          style={{
            flex: "1 1 220px",
            minWidth: 200,
            background: CONTROL_BG,
            border: CONTROL_BORDER,
            borderRadius: 6,
            color: TEXT,
            fontFamily: MONO_FONT,
            fontSize: 12,
            padding: "9px 10px",
            outline: "none",
          }}
        />
        <span style={{ color: TEXT_MUTED, fontSize: 12, whiteSpace: "nowrap" }}>
          {normalizedQuery ? `${filteredCount} of ${totalCount} cards` : `${totalCount} cards`}
        </span>
      </div>

      {jumpGroups.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {jumpGroups.map(group => (
            <button
              key={group.type}
              type="button"
              onClick={() => scrollToDecklistSection(`decklist-main-${group.type}`)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ROW_BG, border: BORDER, borderRadius: 999, color: TEXT_DIM, fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 700, padding: "5px 10px", cursor: "pointer" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: TYPE_COLOR[group.type] || "#888" }} />
              {group.label} <span style={{ color: TEXT_MUTED }}>({group.count})</span>
            </button>
          ))}
        </div>
      )}

      {normalizedQuery && filteredMain.length === 0 && filteredSide.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 13, padding: "14px 2px" }}>
          No cards match "{query.trim()}".
        </div>
      ) : (
        <>
          {filteredMain.length > 0 && <DeckPreviewSections cards={filteredMain} idPrefix="main" />}

          {filteredSide.length > 0 && (
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: BORDER }}>
              <Divider label={`Sideboard (${sideboardCount})`} />
              <DeckPreviewSections cards={filteredSide} idPrefix="side" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getWinPlanTone(value) {
  if (value === "Live Plan" || value === "High" || value === "Good Mix") return SUCCESS;
  if (value === "Coming Together" || value === "Medium" || value === "Incomplete" || value === "Lots of Setup") return WARN;
  return DANGER;
}

function formatManaPoolShoppingList(analysis) {
  if (!analysis) return "";

  const seen = new Set();
  const lines = [];
  const addItem = item => {
    if (!item?.card?.name) return;
    const qty = Math.max(1, item.qty || 1);
    const key = `${normalizeCardName(item.card.name)}-${item.role || "main"}`;
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`${qty} ${item.card.name}`);
  };

  (analysis.cardList || []).forEach(addItem);
  (analysis.sideboardCardList || []).forEach(addItem);
  return lines.join("\n");
}

async function copyDeckText(text) {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea copy path for browsers that block Clipboard API.
    }
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

function ManaPoolButton({ analysis, style }) {
  const [copyState, setCopyState] = useState("idle");
  const deckText = useMemo(() => formatManaPoolShoppingList(analysis), [analysis]);

  const openManaPool = async () => {
    let popup = null;
    if (typeof window !== "undefined") {
      popup = window.open("about:blank", "_blank");
    }

    const copied = await copyDeckText(deckText);
    setCopyState(copied ? "copied" : "failed");
    if (typeof window !== "undefined") window.setTimeout(() => setCopyState("idle"), 3000);

    if (popup) {
      popup.opener = null;
      popup.location.href = "https://manapool.com/add-deck";
    } else if (typeof window !== "undefined") {
      window.open("https://manapool.com/add-deck", "_blank", "noopener,noreferrer");
    }
  };

  const label = copyState === "copied"
    ? "Copied for Mana Pool"
    : copyState === "failed"
      ? "Open Mana Pool"
      : "Buy on Mana Pool";

  return (
    <PrimaryButton
      type="button"
      onClick={openManaPool}
      title="Copy a Mana Pool-friendly decklist and open Mana Pool mass entry"
      style={{ minWidth: 190, whiteSpace: "nowrap", ...style }}
    >
      {label}
    </PrimaryButton>
  );
}

function ShareLinkButton({ inputText, commanderName, importFormat, style }) {
  const [copyState, setCopyState] = useState("idle");

  const copyLink = async () => {
    const url = buildShareUrl({ inputText, commanderName, importFormat });
    const copied = await copyDeckText(url);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 3000);
  };

  const label = copyState === "copied" ? "Link Copied" : copyState === "failed" ? "Copy Failed" : "Copy Share Link";

  return (
    <SecondaryButton type="button" onClick={copyLink} title="Copy a link that reopens this exact decklist" style={{ whiteSpace: "nowrap", ...style }}>
      {label}
    </SecondaryButton>
  );
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function RecentDecksPanel({ onLoad }) {
  const [decks, setDecks] = useState(() => loadRecentDecks());

  if (!decks.length) return null;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Divider label="Recent Decks" />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {decks.map(deck => (
          <div key={deck.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", background: ROW_BG, border: BORDER, borderRadius: 6, padding: "8px 10px" }}>
            <button
              type="button"
              onClick={() => onLoad(deck)}
              style={{ background: "transparent", border: "none", textAlign: "left", cursor: "pointer", minWidth: 0, padding: 0 }}
            >
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {deck.label}
              </div>
              <div style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 2 }}>
                {deck.cardCount ? `${deck.cardCount} cards · ` : ""}{formatRelativeTime(deck.savedAt)}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDecks(current => { removeRecentDeck(deck.id); return current.filter(entry => entry.id !== deck.id); })}
              title="Remove from recent decks"
              style={{ background: "transparent", border: "none", color: TEXT_MUTED, cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WinPlanCards({ label, cards, emptyText = "None detected" }) {
  return (
    <div>
      <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, marginBottom: 6 }}>
        {label}
      </div>
      {cards.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {cards.map(({ qty, card }) => (
            <span key={`${label}-${card.id || card.name}`} style={{ fontSize: 12, background: SURFACE, border: BORDER, borderRadius: 999, padding: "5px 8px" }}>
              <CardNameWithPreview card={card} qty={qty} />
            </span>
          ))}
        </div>
      ) : (
        <div style={{ color: TEXT_MUTED, fontSize: 12 }}>{emptyText}</div>
      )}
    </div>
  );
}

function ComboPackageCard({ combo }) {
  const tone = combo.type === "Deterministic win" || combo.type.includes("Infinite") ? SUCCESS : WARN;
  const [showSteps, setShowSteps] = useState(false);

  return (
    <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "12px 13px", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
            {combo.type}
          </div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: 800, marginTop: 5 }}>
            {combo.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <StatusPill tone={tone}>{combo.confidence}</StatusPill>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {combo.cards.map(({ qty, card }) => (
          <span key={`${combo.key}-${card.id || card.name}`} style={{ fontSize: 12, background: SURFACE, border: BORDER, borderRadius: 999, padding: "5px 8px" }}>
            <CardNameWithPreview card={card} qty={qty} />
          </span>
        ))}
      </div>

      <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45 }}>
        {combo.outcome}
      </div>

      {combo.setup && (
        <div style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.45 }}>
          {combo.setup}
        </div>
      )}

      {combo.steps?.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowSteps(current => !current)}
            style={{ background: "transparent", border: "none", padding: 0, color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 800, letterSpacing: "0.03em", cursor: "pointer" }}
          >
            {showSteps ? "Hide setup steps ▴" : "Show setup steps ▾"}
          </button>
          {showSteps && (
            <ol style={{ margin: 0, marginTop: 8, paddingLeft: 18, display: "grid", gap: 3 }}>
              {combo.steps.map((step, index) => (
                <li key={`${combo.key}-step-${index}`} style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45 }}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {combo.missingNames?.length > 0 && (
        <div style={{ color: DANGER_TEXT, fontSize: 12, lineHeight: 1.45 }}>
          Still needed: {combo.missingNames.join(", ")}
        </div>
      )}

      {combo.alternates?.length > 0 && (
        <div style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.45 }}>
          Also works with: {combo.alternates.join(", ")}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 800 }}>
          Source: {combo.sourceUrl ? (
            <a href={combo.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD }}>{combo.source}</a>
          ) : combo.source}
        </div>
        {combo.popularity > 0 && (
          <span style={{ color: TEXT_MUTED, fontSize: 11 }}>Seen in ~{combo.popularity} decks</span>
        )}
      </div>
    </div>
  );
}

function BracketTagCard({ tag }) {
  return (
    <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "11px 12px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: 800 }}>
          {tag.label}
        </div>
        <StatusPill tone={GOLD}>{tag.count}</StatusPill>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tag.cards.map(({ qty, card }) => (
          <span key={`${tag.key}-${card.id || card.name}`} style={{ fontSize: 12, background: SURFACE, border: BORDER, borderRadius: 999, padding: "5px 8px" }}>
            <CardNameWithPreview card={card} qty={qty} />
          </span>
        ))}
      </div>
    </div>
  );
}

function BracketPanel({ analysis, spellbookResult, spellbookStatus }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const bracket = useMemo(
    () => buildBracketProfile(analysis, archetypeProfile, winPlan, spellbookResult),
    [analysis, archetypeProfile, winPlan, spellbookResult]
  );

  if (!bracket) return null;

  const winCombos = bracket.combos.filter(combo => combo.type !== "Soft lock");
  const supportPackages = bracket.combos.filter(combo => combo.type === "Soft lock");
  const estimate = bracket.estimate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={cardStyle}>
      <Divider label="Local Bracket Read" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 12, alignItems: "stretch" }}>
          <div style={{ background: GOLD_FAINT, border: BORDER, borderRadius: 6, padding: "14px 15px", display: "grid", gap: 9 }}>
            <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 800 }}>
              Matchmaking Read
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <div style={{ color: estimate?.level >= 5 ? DANGER : estimate?.level >= 4 ? GOLD : SUCCESS, fontFamily: DISPLAY_FONT, fontSize: 46, lineHeight: 0.9, fontWeight: 800 }}>
                {estimate?.level || "-"}
              </div>
              <div style={{ paddingBottom: 3 }}>
                <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800 }}>
                  {estimate?.title || "Bracket Pending"}
                </div>
                <div style={{ color: TEXT_DIM, fontSize: 12, marginTop: 3 }}>
                  {estimate?.subtitle || "Needs more card data"}
                </div>
              </div>
            </div>
            <p style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45 }}>
              {estimate?.summary || bracket.summary}
            </p>
          </div>

          <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "14px 15px", display: "grid", gap: 10 }}>
            <div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>
                {bracket.combos.length ? `${bracket.combos.length} package${bracket.combos.length === 1 ? "" : "s"} found` : "No exact combos found"}
              </div>
              <p style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                {bracket.summary}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bracket.primaryArchetype && <StatusPill tone={GOLD}>{bracket.primaryArchetype.label}</StatusPill>}
              {bracket.primaryWinPlan && <StatusPill tone={getWinPlanTone(bracket.primaryWinPlan.status)}>{bracket.primaryWinPlan.label}</StatusPill>}
              <StatusPill tone={winCombos.length ? SUCCESS : WARN}>{winCombos.length} win combo{winCombos.length === 1 ? "" : "s"}</StatusPill>
              {supportPackages.length > 0 && <StatusPill tone={WARN}>{supportPackages.length} support package{supportPackages.length === 1 ? "" : "s"}</StatusPill>}
            </div>
          </div>

          <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "14px 15px", display: "grid", alignContent: "center", gap: 10 }}>
            <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45 }}>
              Copy a Mana Pool-ready list, then paste it into Mass Entry to price or buy the deck.
            </div>
            <ManaPoolButton analysis={analysis} />
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <Divider label="Current Combos" />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>Confirmed Win Combos</div>
            <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
              {bracket.comboSource === "spellbook"
                ? "Exact packages matched live against Commander Spellbook's combo database."
                : "Exact packages where every required card is already in the deck."}
            </div>
          </div>
          <StatusPill tone={winCombos.length ? SUCCESS : WARN}>{winCombos.length} found</StatusPill>
        </div>

        {spellbookStatus === "loading" && (
          <div style={{ color: TEXT_MUTED, fontSize: 12, marginBottom: 10 }}>Checking Commander Spellbook for live combos…</div>
        )}
        {spellbookStatus === "error" && (
          <div style={{ color: TEXT_MUTED, fontSize: 12, marginBottom: 10 }}>Commander Spellbook was unreachable, so this falls back to the small local combo registry.</div>
        )}

        {winCombos.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 9 }}>
              {winCombos.map(combo => <ComboPackageCard key={combo.key} combo={combo} />)}
            </div>
        ) : (
          <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "12px 13px", color: TEXT_DIM, fontSize: 13, lineHeight: 1.45 }}>
            No exact win combos were found. This does not mean the deck has no synergies; it means no verified win package matched every required card.
          </div>
        )}
      </div>

      {bracket.almostCombos.length > 0 && (
        <div style={cardStyle}>
          <Divider label="One Card Away" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>Almost-There Combos</div>
              <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>Commander Spellbook packages missing exactly one piece from this decklist.</div>
            </div>
            <StatusPill tone={WARN}>{bracket.almostCombos.length} found</StatusPill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 9 }}>
            {bracket.almostCombos.map(combo => <ComboPackageCard key={combo.key} combo={combo} />)}
          </div>
        </div>
      )}

      {supportPackages.length > 0 && (
        <div style={cardStyle}>
          <Divider label="Support Packages" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>Locks, Setup, and Pressure</div>
              <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>These are meaningful packages, but they are not counted as deterministic wins.</div>
            </div>
            <StatusPill tone={WARN}>{supportPackages.length} found</StatusPill>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 9 }}>
            {supportPackages.map(combo => <ComboPackageCard key={combo.key} combo={combo} />)}
          </div>
        </div>
      )}

      {bracket.tags.length > 0 && (
        <div style={cardStyle}>
          <Divider label="Archetype Tags" />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>Card Role Evidence</div>
              <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>Tags explain why the Oracle reads this deck as a specific archetype or bracket.</div>
            </div>
            <StatusPill tone={GOLD}>{bracket.tags.length} tags</StatusPill>
          </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 9 }}>
              {bracket.tags.slice(0, 10).map(tag => <BracketTagCard key={tag.key} tag={tag} />)}
            </div>
        </div>
      )}
    </div>
  );
}

function ArchetypePanel({ analysis }) {
  const profile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const recommendationKey = useMemo(
    () => profile?.recommendations.map(rec => rec.name).join("|") || "",
    [profile]
  );
  const [recommendedCards, setRecommendedCards] = useState({});

  useEffect(() => {
    let cancelled = false;
    const names = recommendationKey.split("|").filter(Boolean);

    if (!names.length) {
      setRecommendedCards({});
      return () => { cancelled = true; };
    }

    fetchCardsFromScryfall(names.map(name => ({ name })))
      .then(cardMap => {
        if (!cancelled) setRecommendedCards(cardMap);
      })
      .catch(() => {
        if (!cancelled) setRecommendedCards({});
      });

    return () => { cancelled = true; };
  }, [recommendationKey]);

  if (!profile?.archetypes?.length) return null;

  const primary = profile.primary;
  const primaryTone = primary.status === "Strong Match" ? SUCCESS : primary.status === "Likely" ? WARN : GOLD;

  return (
    <div style={cardStyle}>
      <Divider label="Archetype Read" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10 }}>
        <div style={{ background: GOLD_FAINT, border: BORDER, borderRadius: 6, padding: "14px 15px" }}>
          <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 800, marginBottom: 8 }}>
            Primary Archetype
          </div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 24, lineHeight: 1.1, fontWeight: 800 }}>
            {primary.label}
          </div>
          <p style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>
            {primary.summary}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
            <StatusPill tone={primaryTone}>{primary.status}</StatusPill>
            <StatusPill tone={GOLD}>score {primary.score}</StatusPill>
          </div>
        </div>

        {profile.archetypes.slice(0, 4).map(archetype => (
          <div key={archetype.key} style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "12px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 9 }}>
              <div>
                <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800 }}>{archetype.label}</div>
                <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 3 }}>{archetype.summary}</div>
              </div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div style={{ color: archetype.status === "Strong Match" ? SUCCESS : archetype.status === "Likely" ? WARN : GOLD, fontFamily: DISPLAY_FONT, fontSize: 12, fontWeight: 800 }}>{archetype.status}</div>
                <div style={{ color: TEXT_MUTED, fontFamily: MONO_FONT, fontSize: 11, marginTop: 3 }}>score {archetype.score}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 9 }}>
              {archetype.signals.filter(signal => signal.cards.length > 0).slice(0, 3).map(signal => (
                <WinPlanCards key={`${archetype.key}-${signal.label}`} label={signal.label} cards={signal.cards} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {profile.recommendations.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 15, borderTop: BORDER }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800 }}>Archetype-aware adds</div>
            <div style={{ color: TEXT_MUTED, fontSize: 12 }}>Ranked by detected deck pattern</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 9 }}>
            {profile.recommendations.map(rec => {
              const recCard = recommendedCards[normalizeCardName(rec.name)];
              return (
                <CardHoverPreview
                  key={rec.name}
                  card={recCard}
                  as="a"
                  href={rec.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    background: ROW_BG,
                    border: BORDER,
                    borderRadius: 6,
                    padding: "11px 12px",
                    textDecoration: "none",
                    cursor: recCard ? "help" : "pointer",
                  }}
                >
                  <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
                    {rec.impact}
                  </div>
                  <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800, marginTop: 5 }}>
                    {rec.name}
                  </div>
                  {rec.fitNote && (
                    <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 800, marginTop: 7 }}>
                      {rec.fitNote}
                    </div>
                  )}
                  <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                    {rec.reason}
                  </div>
                </CardHoverPreview>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function WinPlanPanel({ analysis }) {
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const recommendationKey = useMemo(
    () => winPlan?.recommendations.map(rec => rec.name).join("|") || "",
    [winPlan]
  );
  const [recommendedCards, setRecommendedCards] = useState({});

  useEffect(() => {
    let cancelled = false;
    const names = recommendationKey.split("|").filter(Boolean);

    if (!names.length) {
      setRecommendedCards({});
      return () => { cancelled = true; };
    }

    fetchCardsFromScryfall(names.map(name => ({ name })))
      .then(cardMap => {
        if (!cancelled) setRecommendedCards(cardMap);
      })
      .catch(() => {
        if (!cancelled) setRecommendedCards({});
      });

    return () => { cancelled = true; };
  }, [recommendationKey]);

  if (!winPlan?.primary) return null;

  const primary = winPlan.primary;
  const lanes = winPlan.lanes.length ? winPlan.lanes : [primary];
  const confidenceTone = getWinPlanTone(winPlan.confidence);
  const conversionTone = getWinPlanTone(winPlan.conversion);

  return (
    <div style={cardStyle}>
      <Divider label="Win Plan" />
      <div style={{ background: GOLD_FAINT, border: BORDER, borderRadius: 6, padding: "15px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14, alignItems: "center" }}>
        <div>
          <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 800, marginBottom: 8 }}>
            Primary Lane
          </div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 26, lineHeight: 1.05, fontWeight: 800 }}>
            {primary.label}
          </div>
          <p style={{ color: TEXT_DIM, fontSize: 13, lineHeight: 1.45, marginTop: 8 }}>
            {winPlan.summary}
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "center" }}>
          <StatusPill tone={getWinPlanTone(primary.status)}>{primary.status}</StatusPill>
          <StatusPill tone={confidenceTone}>{winPlan.confidence} confidence</StatusPill>
          <StatusPill tone={conversionTone}>{winPlan.conversion}</StatusPill>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {[
            [primary.engineLabel, primary.engines.length],
            [primary.payoffLabel, primary.payoffs.length],
            [primary.amplifierLabel, primary.amplifiers.length],
          ].map(([label, value]) => (
            <div key={label} style={{ background: SURFACE, border: BORDER, borderRadius: 6, padding: "9px 10px" }}>
              <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 800 }}>{label}</div>
              <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 10, marginTop: 12 }}>
        {lanes.slice(0, 4).map(lane => (
          <div key={lane.key} style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "13px 13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800 }}>{lane.label}</div>
                <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 3 }}>{lane.summary}</div>
              </div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div style={{ color: getWinPlanTone(lane.status), fontFamily: DISPLAY_FONT, fontSize: 12, fontWeight: 800 }}>{lane.status}</div>
                <div style={{ color: TEXT_MUTED, fontFamily: MONO_FONT, fontSize: 11, marginTop: 3 }}>score {lane.score}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <WinPlanCards label={lane.engineLabel} cards={lane.engines} />
              <WinPlanCards label={lane.payoffLabel} cards={lane.payoffs} />
              {(lane.amplifiers.length > 0 || lane.missing.length > 0) && (
                <WinPlanCards label={lane.amplifierLabel} cards={lane.amplifiers} emptyText="No dedicated layer yet" />
              )}
            </div>

            {lane.missing.length > 0 && (
              <div style={{ display: "grid", gap: 6, marginTop: 11, paddingTop: 10, borderTop: BORDER }}>
                {lane.missing.map(item => (
                  <div key={`${lane.key}-${item}`} style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.4 }}>
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {winPlan.recommendations.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 15, borderTop: BORDER }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
            <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800 }}>On-plan adds</div>
            <div style={{ color: TEXT_MUTED, fontSize: 12 }}>Ranked by detected win lanes and deck synergies</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 9 }}>
            {winPlan.recommendations.map(rec => {
              const recCard = recommendedCards[normalizeCardName(rec.name)];
              return (
                <CardHoverPreview
                  key={rec.name}
                  card={recCard}
                  as="a"
                  href={rec.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    background: ROW_BG,
                    border: BORDER,
                    borderRadius: 6,
                    padding: "11px 12px",
                    textDecoration: "none",
                    cursor: recCard ? "help" : "pointer",
                  }}
                >
                  <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
                    {rec.impact}
                  </div>
                  <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800, marginTop: 5 }}>
                    {rec.name}
                  </div>
                  {rec.fitNote && (
                    <div style={{ color: GOLD, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 800, marginTop: 7 }}>
                      {rec.fitNote}
                    </div>
                  )}
                  <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
                    {rec.reason}
                  </div>
                </CardHoverPreview>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TuningPlanItem({ item, action, cardMap = {} }) {
  const resolvedCard = item.card || cardMap[normalizeCardName(item.name)];
  const tone = action === "add" ? SUCCESS : action === "keep" ? GOLD : WARN;
  const Wrapper = item.searchUrl ? "a" : "div";
  const wrapperProps = item.searchUrl
    ? { href: item.searchUrl, target: "_blank", rel: "noreferrer" }
    : {};

  return (
    <CardHoverPreview
      card={resolvedCard}
      as={Wrapper}
      {...wrapperProps}
      style={{
        display: "block",
        background: ROW_BG,
        border: BORDER,
        borderLeft: `3px solid ${tone}`,
        borderRadius: 6,
        padding: "10px 11px",
        color: TEXT,
        textDecoration: "none",
        cursor: resolvedCard ? "help" : item.searchUrl ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: tone, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
            {item.tag}
          </div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 14, fontWeight: 800, lineHeight: 1.2, marginTop: 5 }}>
            {resolvedCard ? <CardNameWithPreview card={resolvedCard} qty={item.qty} /> : item.name}
          </div>
        </div>
        <span style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", flex: "0 0 auto" }}>
          {item.source}
        </span>
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 7 }}>
        {item.reason}
      </div>
    </CardHoverPreview>
  );
}

function groupConsecutiveByReason(items) {
  const groups = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.reason === item.reason && last.tag === item.tag) {
      last.items.push(item);
    } else {
      groups.push({ reason: item.reason, tag: item.tag, source: item.source, items: [item] });
    }
  }
  return groups;
}

function TuningPlanGroup({ group, action, cardMap = {} }) {
  const tone = action === "add" ? SUCCESS : action === "keep" ? GOLD : WARN;

  return (
    <div style={{ background: ROW_BG, border: BORDER, borderLeft: `3px solid ${tone}`, borderRadius: 6, padding: "10px 11px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ color: tone, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800 }}>
          {group.tag}
        </div>
        <span style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", flex: "0 0 auto" }}>
          {group.source}
        </span>
      </div>
      <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 6 }}>
        {group.reason}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {group.items.map(item => {
          const resolvedCard = item.card || cardMap[normalizeCardName(item.name)];
          return (
            <span key={item.key} style={{ fontSize: 12, background: SURFACE, border: BORDER, borderRadius: 999, padding: "5px 8px" }}>
              {resolvedCard ? <CardNameWithPreview card={resolvedCard} qty={item.qty} /> : item.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TuningPlanColumn({ title, eyebrow, action, items, emptyText, cardMap }) {
  const tone = action === "add" ? SUCCESS : action === "keep" ? GOLD : WARN;
  const groups = useMemo(() => groupConsecutiveByReason(items), [items]);

  return (
    <div style={{ background: SURFACE, border: BORDER, borderRadius: 6, padding: "12px 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
        <div>
          <div style={{ color: tone, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 800 }}>
            {eyebrow}
          </div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.1, marginTop: 4 }}>
            {title}
          </div>
        </div>
        <StatusPill tone={tone}>{items.length}</StatusPill>
      </div>

      {groups.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {groups.map((group, index) => (
            group.items.length > 1
              ? <TuningPlanGroup key={`${action}-group-${index}-${group.items[0].key}`} group={group} action={action} cardMap={cardMap} />
              : <TuningPlanItem key={`${action}-${group.items[0].key}`} item={group.items[0]} action={action} cardMap={cardMap} />
          ))}
        </div>
      ) : (
        <div style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.45, background: ROW_BG, border: BORDER, borderRadius: 6, padding: "10px 11px" }}>
          {emptyText}
        </div>
      )}
    </div>
  );
}

function DeckReadCell({ label, value, detail, tone = TEXT, chips = [] }) {
  return (
    <div style={{ flex: "1 1 190px", background: ROW_BG, border: BORDER, borderRadius: 6, padding: "12px 13px", minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800, marginBottom: 7 }}>
          {label}
        </div>
        <div style={{ color: tone, fontFamily: DISPLAY_FONT, fontSize: 20, lineHeight: 1.05, fontWeight: 800 }}>
          {value}
        </div>
        {detail && (
          <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.35, marginTop: 7 }}>
            {detail}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chips.map(chip => (
            <StatusPill key={chip.label} tone={chip.tone || TEXT_DIM}>{chip.label}</StatusPill>
          ))}
        </div>
      )}
    </div>
  );
}

function getDeckReadConcern(tuningPlan) {
  const roleGap = tuningPlan?.adds?.find(item => item.tag === "Role Gap");
  if (roleGap) {
    return {
      value: roleGap.name.replace(/^More\s+/i, ""),
      detail: roleGap.reason,
      tone: WARN,
    };
  }

  const planAdd = tuningPlan?.adds?.find(item => item.source === "Win Plan" || item.source === "Archetype");
  if (planAdd) {
    return {
      value: planAdd.name,
      detail: planAdd.reason,
      tone: SUCCESS,
    };
  }

  const flexReview = tuningPlan?.cuts?.[0];
  if (flexReview) {
    return {
      value: `Review ${flexReview.name}`,
      detail: flexReview.reason,
      tone: WARN,
    };
  }

  return {
    value: "No urgent pressure",
    detail: "The local read did not find a major role gap or obvious flex slot.",
    tone: SUCCESS,
  };
}

function DeckReadStrip({ analysis, roleCategories, spellbookResult }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const bracket = useMemo(
    () => buildBracketProfile(analysis, archetypeProfile, winPlan, spellbookResult),
    [analysis, archetypeProfile, winPlan, spellbookResult]
  );
  const tuningPlan = useMemo(
    () => buildTuningPlan(analysis, roleCategories, archetypeProfile, winPlan),
    [analysis, roleCategories, archetypeProfile, winPlan]
  );

  const commanderCard = analysis.commanderCard || analysis.commanderReport?.commanderCard;
  const commanderColors = analysis.commanderReport?.commanderColors || commanderCard?.color_identity || [];
  const estimate = bracket?.estimate;
  const bracketTone = estimate?.level >= 5 ? DANGER : estimate?.level >= 4 ? GOLD : estimate?.level >= 3 ? SUCCESS : TEXT_DIM;
  const winCombos = bracket?.combos?.filter(combo => combo.type !== "Soft lock") || [];
  const supportPackages = bracket?.combos?.filter(combo => combo.type === "Soft lock") || [];
  const firstPackage = winCombos[0] || supportPackages[0];
  const concern = getDeckReadConcern(tuningPlan);
  const primaryLane = winPlan?.primary;
  const primaryArchetype = archetypeProfile?.primary;

  const comboValue = winCombos.length
    ? `${winCombos.length} Win Combo${winCombos.length === 1 ? "" : "s"}`
    : "No Exact Win";
  const comboDetail = winCombos.length
    ? firstPackage?.label
    : supportPackages.length
      ? `${supportPackages.length} support package${supportPackages.length === 1 ? "" : "s"} found: ${firstPackage?.label}`
      : "Local registry did not match a complete package.";

  return (
    <div style={cardStyle}>
      <Divider label="Deck Read" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <DeckReadCell
          label="Commander"
          value={commanderCard?.name || "Commander Pending"}
          detail={commanderCard ? formatColorIdentity(commanderColors) : `${analysis.totalCards || 0} cards analyzed`}
          tone={TEXT}
          chips={[
            { label: `${analysis.totalCards || 0} cards`, tone: analysis.totalCards === 100 ? SUCCESS : GOLD },
          ]}
        />
        <DeckReadCell
          label="Bracket"
          value={estimate?.level ? `Bracket ${estimate.level}` : "Pending"}
          detail={estimate ? `${estimate.title}: ${estimate.subtitle}` : "Needs more deck signals"}
          tone={bracketTone}
        />
        <DeckReadCell
          label="Likely Archetype"
          value={primaryArchetype?.label || "No Clear Read"}
          detail={primaryArchetype?.status || "The deck needs more recognizable pattern signals."}
          tone={primaryArchetype?.score >= 12 ? SUCCESS : primaryArchetype?.score >= 7 ? GOLD : WARN}
        />
        <DeckReadCell
          label="Likely Win Plan"
          value={primaryLane?.label || "Not Detected"}
          detail={primaryLane ? `${primaryLane.status} / ${winPlan.confidence} confidence` : "No primary win lane found yet."}
          tone={getWinPlanTone(primaryLane?.status || winPlan?.confidence)}
        />
        <DeckReadCell
          label="Exact Combos"
          value={comboValue}
          detail={comboDetail}
          tone={winCombos.length ? SUCCESS : supportPackages.length ? WARN : TEXT_DIM}
        />
      </div>

      <div style={{ background: GOLD_FAINT, border: BORDER, borderLeft: `3px solid ${concern.tone}`, borderRadius: 6, padding: "12px 13px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 800, marginBottom: 5 }}>
            Next Pressure
          </div>
          <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.4 }}>
            {concern.detail}
          </div>
        </div>
        <div style={{ color: concern.tone, fontFamily: DISPLAY_FONT, fontSize: 16, fontWeight: 800, whiteSpace: "nowrap" }}>
          {concern.value}
        </div>
      </div>
    </div>
  );
}

function TuningPlanPanel({ analysis, roleCategories }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const tuningPlan = useMemo(
    () => buildTuningPlan(analysis, roleCategories, archetypeProfile, winPlan),
    [analysis, roleCategories, archetypeProfile, winPlan]
  );
  const addLookupKey = useMemo(
    () => tuningPlan.adds.filter(item => !item.card).map(item => item.name).join("|"),
    [tuningPlan]
  );
  const [addCards, setAddCards] = useState({});

  useEffect(() => {
    let cancelled = false;
    const names = addLookupKey.split("|").filter(name => name && !name.startsWith("More "));

    if (!names.length) {
      setAddCards({});
      return () => { cancelled = true; };
    }

    fetchCardsFromScryfall(names.map(name => ({ name })))
      .then(cardMap => {
        if (!cancelled) setAddCards(cardMap);
      })
      .catch(() => {
        if (!cancelled) setAddCards({});
      });

    return () => { cancelled = true; };
  }, [addLookupKey]);

  return (
    <div style={cardStyle}>
      <Divider label="Tuning Board" />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 18, fontWeight: 800, lineHeight: 1.15 }}>
            Add Next / Keep Core / Review Flex Slots
          </div>
          <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 5 }}>
            A desktop-first tuning pass: what to add next, what looks core, and which cards deserve a closer review.
          </div>
        </div>
        <StatusPill tone={GOLD}>local read</StatusPill>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 10 }}>
        <TuningPlanColumn
          title="Add Next"
          eyebrow="Improve"
          action="add"
          items={tuningPlan.adds}
          emptyText="No urgent adds from this pass."
          cardMap={addCards}
        />
        <TuningPlanColumn
          title="Keep Core"
          eyebrow="Protect"
          action="keep"
          items={tuningPlan.keeps}
          emptyText="No core package detected yet."
        />
        <TuningPlanColumn
          title="Review Flex Slots"
          eyebrow="Review"
          action="cut"
          items={tuningPlan.cuts}
          emptyText="No obvious flex slots from this pass."
        />
      </div>
    </div>
  );
}

function CommanderAssistant({ analysis, spellbookResult, spellbookStatus }) {
  const categories = useMemo(() => buildCommanderAssistant(analysis), [analysis]);
  const roleCategories = useMemo(
    () => categories?.filter(category => category.key !== "Win Conditions" && (!category.optional || category.count > 0)) || null,
    [categories]
  );
  const [suggestionsByCategory, setSuggestionsByCategory] = useState({});

  useEffect(() => {
    let cancelled = false;
    if (!analysis?.commanderCard || !roleCategories?.length) {
      setSuggestionsByCategory({});
      return () => { cancelled = true; };
    }

    const targetCategories = roleCategories.filter(category =>
      category.count < category.good && (!category.optional || category.count > 0)
    );
    setSuggestionsByCategory(Object.fromEntries(
      targetCategories.map(category => [category.key, { loading: true, cards: [], error: "" }])
    ));

    Promise.all(targetCategories.map(async category => {
      try {
        const cards = await fetchCommanderCategorySuggestions(analysis, category.key, 4);
        return [category.key, { loading: false, cards, error: "" }];
      } catch (err) {
        return [category.key, { loading: false, cards: [], error: err.message || "Could not load suggestions." }];
      }
    })).then(entries => {
      if (!cancelled) setSuggestionsByCategory(Object.fromEntries(entries));
    });

    return () => { cancelled = true; };
  }, [analysis, roleCategories]);

  if (!categories) return null;

  const needsAttention = [];
  const requiredCategories = roleCategories.filter(category => !category.optional);
  const attentionCategories = requiredCategories.filter(category => category.count < category.min);
  const strongCount = requiredCategories.filter(category => category.count >= category.good).length;
  const playableCount = requiredCategories.filter(category => category.count >= category.min && category.count < category.good).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.35s ease" }}>
      <DeckReadStrip analysis={analysis} roleCategories={roleCategories} spellbookResult={spellbookResult} />

      <div style={cardStyle}>
        <Divider label="Role Snapshot" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 17, fontWeight: 800, lineHeight: 1.15 }}>
              Commander Role Coverage
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 12, lineHeight: 1.45, marginTop: 4 }}>
              Fast scan of core deck-building roles before individual category cards.
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <StatusPill tone={SUCCESS}>{strongCount} strong</StatusPill>
            <StatusPill tone={WARN}>{playableCount} playable</StatusPill>
            <StatusPill tone={attentionCategories.length ? DANGER : SUCCESS}>{attentionCategories.length} review</StatusPill>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {roleCategories.map(category => (
            <div key={`map-${category.key}`} style={{ flex: "1 1 132px", background: ROW_BG, border: BORDER, borderRadius: 6, padding: "9px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 7 }}>
                <span style={{ color: TEXT_DIM, fontFamily: DISPLAY_FONT, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{category.label}</span>
                <span style={{ color: category.tone, fontFamily: DISPLAY_FONT, fontSize: 12, fontWeight: 800 }}>{category.count}</span>
              </div>
              <div style={{ height: 5, background: BAR_EMPTY, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, Math.round((category.count / Math.max(category.good, 1)) * 100))}%`, height: "100%", background: category.tone, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <TuningPlanPanel analysis={analysis} roleCategories={roleCategories} />

      <BracketPanel analysis={analysis} spellbookResult={spellbookResult} spellbookStatus={spellbookStatus} />

      <ArchetypePanel analysis={analysis} />

      <WinPlanPanel analysis={analysis} />

      {needsAttention.length > 0 && analysis.commanderCard && (
        <div style={cardStyle}>
          <Divider label="EDHREC Suggestions" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <a href={edhrecRecsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 800 }}>
              Open EDHREC Recs
            </a>
            <span style={{ color: TEXT_MUTED, fontSize: 12 }}>·</span>
            <a href={edhrecCommanderUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 800 }}>
              Commander page
            </a>
          </div>
          <textarea
            readOnly
            value={edhrecImportText}
            style={{
              width: "100%",
              minHeight: 140,
              background: CONTROL_BG,
              border: CONTROL_BORDER,
              borderRadius: 6,
              color: TEXT,
              fontFamily: MONO_FONT,
              fontSize: 12,
              lineHeight: 1.55,
              padding: "10px 12px",
              outline: "none",
            }}
          />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
        {roleCategories.map(cat => (
          <div key={cat.key} style={{ ...cardStyle, padding: "16px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontFamily: DISPLAY_FONT, color: TEXT, fontSize: 14, letterSpacing: "0", fontWeight: 700 }}>{cat.label}</div>
                <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 3 }}>Target: {cat.target}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: DISPLAY_FONT, color: TEXT, fontSize: 24, lineHeight: 1, fontWeight: 800 }}>{cat.count}</div>
                <div style={{ fontSize: 11, color: cat.tone }}>{cat.status}</div>
              </div>
            </div>

            <div style={{ height: 5, background: BAR_EMPTY, borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${Math.min(100, Math.round((cat.count / Math.max(cat.good, 1)) * 100))}%`, height: "100%", background: cat.tone, borderRadius: 4 }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{ color: cat.tone, fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 800 }}>{cat.status}</span>
              <span style={{ color: TEXT_MUTED, fontSize: 11 }}>Target {cat.target}</span>
            </div>

            {cat.examples.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {cat.examples.map(({ qty, card }) => (
                  <div key={`${cat.key}-${card.id}`} style={{ fontSize: 12, color: TEXT, background: ROW_BG, border: BORDER, borderRadius: 999, padding: "5px 8px" }}>
                    <CardNameWithPreview card={card} qty={qty} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 10 }}>No obvious matches detected.</div>
            )}

            {suggestionsByCategory[cat.key] && (
              <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "10px 10px", marginBottom: 10 }}>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: GOLD, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                  Suggested Adds
                </div>
                {suggestionsByCategory[cat.key].loading && (
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>Checking EDHREC-ranked options...</div>
                )}
                {suggestionsByCategory[cat.key].error && (
                  <div style={{ fontSize: 12, color: WARN_TEXT }}>{suggestionsByCategory[cat.key].error}</div>
                )}
                {!suggestionsByCategory[cat.key].loading && !suggestionsByCategory[cat.key].error && suggestionsByCategory[cat.key].cards.length === 0 && (
                  <div style={{ fontSize: 12, color: TEXT_MUTED }}>No clean add candidates found outside this list.</div>
                )}
                {suggestionsByCategory[cat.key].cards.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {suggestionsByCategory[cat.key].cards.map(card => {
                      const art = getCardImage(card, "art_crop") || getCardImage(card, "small");
                      return (
                        <CardHoverPreview key={`${cat.key}-suggest-${card.id}`} card={card} as="div" style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 9, alignItems: "stretch", background: SURFACE, border: BORDER, borderRadius: 6, overflow: "hidden", cursor: "help" }}>
                          <div style={{ minHeight: 48, background: SURFACE2 }}>
                            {art && <img src={art} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                          </div>
                          <div style={{ minWidth: 0, padding: "7px 8px 7px 0" }}>
                            <div style={{ fontSize: 12, minWidth: 0, color: TEXT }}>
                              {card.name}
                              {card.edhrec_rank && (
                                <span style={{ color: TEXT_MUTED, marginLeft: 6, fontFamily: MONO_FONT, fontSize: 11 }}>
                                  #{card.edhrec_rank}
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 700, marginTop: 5 }}>
                              <a href={card.scryfall_uri} target="_blank" rel="noreferrer" style={{ color: GOLD, textDecoration: "none" }}>Scryfall</a>
                              <a href={getEdhrecCardUrl(card)} target="_blank" rel="noreferrer" style={{ color: GOLD, textDecoration: "none" }}>EDHREC</a>
                            </div>
                          </div>
                        </CardHoverPreview>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a href={cat.searchUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                Search Scryfall
              </a>
              {cat.wantsSuggestions && (
                <a href={cat.edhrecRecsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 700 }}>
                  Full EDHREC Recs
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingPreviewPanel() {
  const bars = [
    { label: "Ramp", value: 11, max: 12, tone: SUCCESS },
    { label: "Draw", value: 8, max: 12, tone: WARN },
    { label: "Removal", value: 10, max: 10, tone: SUCCESS },
  ];
  const colors = ["U", "B", "R"];

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 18px", borderBottom: BORDER, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div>
          <div style={{ fontFamily: DISPLAY_FONT, color: TEXT, fontSize: 15, fontWeight: 800 }}>Commander Workbench</div>
          <div style={{ color: TEXT_MUTED, fontSize: 12, marginTop: 4 }}>Grixis spell deck, 100 cards</div>
        </div>
        <div style={{ display: "flex" }}>
          {colors.map((color, index) => (
            <span
              key={color}
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: MTG_COLOR_INFO[color].hex,
                border: "1px solid color-mix(in srgb, var(--oracle-text) 18%, transparent)",
                marginLeft: index === 0 ? 0 : -5,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: BORDER }}>
        {[
          ["Avg MV", "2.84"],
          ["Lands", "36"],
          ["Legality", "Clean"],
        ].map(([label, value], index) => (
          <div key={label} style={{ padding: "14px 16px", borderRight: index < 2 ? BORDER : "none" }}>
            <div style={{ color: TEXT_MUTED, fontFamily: DISPLAY_FONT, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800 }}>{label}</div>
            <div style={{ color: TEXT, fontFamily: DISPLAY_FONT, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
        {bars.map(item => (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", color: TEXT_DIM, fontSize: 12, marginBottom: 6 }}>
              <span>{item.label}</span>
              <span style={{ color: item.tone, fontFamily: DISPLAY_FONT, fontWeight: 800 }}>{item.value}</span>
            </div>
            <div style={{ height: 7, background: BAR_EMPTY, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, Math.round((item.value / item.max) * 100))}%`, height: "100%", background: item.tone }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingScreen({ onStart, isDark, onToggleTheme }) {
  return (
    <div style={{ ...getThemeVars(isDark), minHeight: "100vh", background: BG, color: TEXT, fontFamily: BODY_FONT }}>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 54px", animation: "fadeUp 0.5s ease" }}>
        <ManaStripe />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", margin: "58px 0 34px" }}>
          <div style={{ textAlign: "left", flex: "1 1 480px", minWidth: 280 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GOLD_FAINT, border: `1px solid ${GOLD_DIM}`, borderRadius: 6, padding: "6px 9px", color: GOLD, fontSize: 12, fontWeight: 800, marginBottom: 16 }}>
              Commander deck intelligence
            </div>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 58, fontWeight: 800, color: TEXT, letterSpacing: "0", marginBottom: 12, lineHeight: 0.95 }}>
              THE ORACLE
            </h1>
            <p style={{ color: TEXT, fontSize: 19, lineHeight: 1.45, margin: "0 0 16px", maxWidth: 600, fontWeight: 600 }}>
              A focused workbench for importing, reading, and tuning Magic decks.
            </p>
            <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.65, margin: "0 0 26px", maxWidth: 610 }}>
              Paste a list, resolve Scryfall data, inspect Commander legality, and see the deck through the same questions players actually ask at the table.
            </p>
            <PrimaryButton onClick={onStart}>Open Workbench</PrimaryButton>
          </div>

          <div style={{ flex: "1 1 340px", minWidth: 280 }}>
            <LandingPreviewPanel />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}>
          <FeatureCard title="Import With Confidence">Plain text, Moxfield, Archidekt, MTGGoldfish, sideboards, and double-faced cards stay readable.</FeatureCard>
          <FeatureCard title="Read The Shape">Mana curve, card types, color identity, lands, and price are arranged for quick scanning.</FeatureCard>
          <FeatureCard title="Recognize The Plan">Archetypes, win paths, and Commander role packages are separated so tuning advice stays closer to how the deck plays.</FeatureCard>
        </div>

        <p style={{ textAlign: "left", marginTop: 26, fontSize: 12, color: TEXT_MUTED }}>
          Unofficial fan project. Card data, images, prices, and legality information are provided by <a href="https://scryfall.com" style={{ color: GOLD, textDecoration: "none" }}>Scryfall</a>.
        </p>
      </div>
    </div>
  );
}

function ImportFormatButtons({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 8 }}>
      {IMPORT_FORMATS.map(format => {
        const active = value === format.key;
        return (
          <button
            key={format.key}
            type="button"
            onClick={() => onChange(format.key)}
            style={{
              background: active ? GOLD_FAINT : CONTROL_BG,
              border: active ? `1px solid ${GOLD_DIM}` : CONTROL_BORDER,
              borderRadius: 6,
              color: active ? GOLD : TEXT_DIM,
              fontFamily: DISPLAY_FONT,
              fontSize: 11,
              fontWeight: 800,
              padding: "10px 11px",
              textAlign: "left",
            }}
          >
            {format.label}
          </button>
        );
      })}
    </div>
  );
}

function ImportMetric({ label, value, tone = TEXT }) {
  return (
    <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "10px 11px" }}>
      <div style={{ fontFamily: DISPLAY_FONT, color: TEXT_MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontFamily: DISPLAY_FONT, color: tone, fontSize: 20, lineHeight: 1, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  );
}

function ImportPreviewPanel({ preview, commanderName, setCommanderName, importFormat, setImportFormat, includePrintings, setIncludePrintings }) {
  const commanderLabel = preview.effectiveCommander || "Not set";
  const commanderTone = preview.effectiveCommander ? SUCCESS : TEXT_MUTED;
  const commanderSource = preview.detectedCommander ? "Detected" : commanderName.trim() ? "Override" : "Optional";

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Divider label="Import" />
        <ImportFormatButtons value={importFormat} onChange={setImportFormat} />
        <div style={{ marginTop: 12 }}>
          <ToggleRow checked={includePrintings} onChange={setIncludePrintings} label="Include printings" />
        </div>
      </div>

      <div>
        <Divider label="Preview" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 10 }}>
          <ImportMetric label="Deck" value={preview.deckTotal} tone={preview.deckTotal === 100 ? SUCCESS : TEXT} />
          <ImportMetric label="Sideboard" value={preview.sideboardCount} />
        </div>
        <div style={{ background: ROW_BG, border: BORDER, borderRadius: 6, padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: DISPLAY_FONT, color: TEXT_MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 800 }}>
                Commander
              </div>
              <div style={{ color: commanderTone, fontFamily: DISPLAY_FONT, fontSize: 15, fontWeight: 800, lineHeight: 1.25, marginTop: 5 }}>
                {commanderLabel}
              </div>
            </div>
            <StatusPill tone={preview.effectiveCommander ? SUCCESS : WARN}>{commanderSource}</StatusPill>
          </div>
          <input
            value={commanderName}
            onChange={event => setCommanderName(event.target.value)}
            placeholder="Override commander if needed"
            style={{
              width: "100%",
              background: CONTROL_BG,
              border: CONTROL_BORDER,
              borderRadius: 6,
              color: TEXT,
              fontFamily: MONO_FONT,
              fontSize: 12,
              padding: "9px 10px",
              outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: 1.55 }}>
        Plain Commander lists can start with the commander, then a blank line. Headers like <span style={{ fontFamily: MONO_FONT }}>// Sideboard</span> are detected automatically.
      </div>
    </div>
  );
}

function buildInputPreview(inputText, commanderName, importFormat, includePrintings) {
  const imported = parseDeckImport(inputText, { format: importFormat, includePrintings });
  const mainCount = imported.cards
    .filter(card => card.board !== "sideboard")
    .reduce((sum, card) => sum + card.qty, 0);
  const sideboardCount = imported.cards
    .filter(card => card.board === "sideboard")
    .reduce((sum, card) => sum + card.qty, 0);

  return {
    mainCount,
    deckTotal: mainCount + (!imported.commanderName && commanderName.trim() ? 1 : 0),
    sideboardCount,
    detectedCommander: imported.commanderName,
    effectiveCommander: imported.commanderName || commanderName.trim(),
  };
}

function InputScreenV2({ inputText, setInputText, commanderName, setCommanderName, importFormat, setImportFormat, includePrintings, setIncludePrintings, runAnalysis, onBack, isDark, onToggleTheme }) {
  const preview = useMemo(
    () => buildInputPreview(inputText, commanderName, importFormat, includePrintings),
    [inputText, commanderName, importFormat, includePrintings]
  );

  return (
    <div style={{ ...getThemeVars(isDark), minHeight: "100vh", background: BG, color: TEXT, fontFamily: BODY_FONT }}>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 24px 56px", animation: "fadeUp 0.4s ease" }}>
        <ManaStripe />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 28 }}>
          <button onClick={onBack} style={{ background: SURFACE, border: BORDER, borderRadius: 6, color: TEXT_DIM, padding: "8px 14px", fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}>
            Back
          </button>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 13, color: GOLD, letterSpacing: "0.03em", fontWeight: 800 }}>THE ORACLE</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontFamily: DISPLAY_FONT, fontSize: 34, fontWeight: 800, color: TEXT, letterSpacing: "0", marginBottom: 6 }}>
              Import Deck
            </h1>
            <p style={{ color: TEXT_DIM, fontSize: 15, lineHeight: 1.55, maxWidth: 560 }}>
              Paste the list. Commander, sideboard, and card counts update before analysis.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusPill tone={preview.deckTotal === 100 ? SUCCESS : GOLD}>{preview.deckTotal} cards</StatusPill>
            {preview.sideboardCount > 0 && <StatusPill tone={GOLD}>{preview.sideboardCount} sideboard</StatusPill>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ ...cardStyle, flex: "1 1 620px", minWidth: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.06em", color: GOLD, textTransform: "uppercase", fontWeight: 700 }}>
                Decklist
              </div>
              <div style={{ fontSize: 11, color: TEXT_MUTED }}>
                Ctrl+Enter to analyze
              </div>
            </div>
            <textarea
              value={inputText}
              onChange={event => setInputText(event.target.value)}
              onKeyDown={event => { if (event.ctrlKey && event.key === "Enter") runAnalysis(); }}
              placeholder={"1 Vivi Ornitier\n\n1 Command Tower\n1 Sol Ring\n1 Counterspell\n...\n\n// Sideboard\n1 Chrome Mox"}
              style={{
                width: "100%",
                height: 430,
                background: CONTROL_BG,
                border: CONTROL_BORDER,
                borderRadius: 6,
                color: TEXT,
                fontFamily: MONO_FONT,
                fontSize: 13,
                lineHeight: 1.7,
                padding: "12px 14px",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <SecondaryButton onClick={() => { setInputText(SAMPLE_DECK); setCommanderName(""); }} style={{ minWidth: 120 }}>
                Load Sample
              </SecondaryButton>
              {inputText.trim() && (
                <SecondaryButton onClick={() => { setInputText(""); setCommanderName(""); }} style={{ minWidth: 90 }}>
                  Clear
                </SecondaryButton>
              )}
              <PrimaryButton onClick={runAnalysis} disabled={!inputText.trim()} style={{ marginLeft: "auto", minWidth: 180 }}>
                Analyze Deck
              </PrimaryButton>
            </div>
          </div>

          <div style={{ flex: "1 1 300px", maxWidth: 350, minWidth: 280, display: "grid", gap: 14 }}>
            <ImportPreviewPanel
              preview={preview}
              commanderName={commanderName}
              setCommanderName={setCommanderName}
              importFormat={importFormat}
              setImportFormat={setImportFormat}
              includePrintings={includePrintings}
              setIncludePrintings={setIncludePrintings}
            />
            <RecentDecksPanel
              onLoad={deck => {
                setInputText(deck.inputText);
                setCommanderName(deck.commanderName || "");
                setImportFormat(deck.importFormat || "plain");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyExportButton({ exportText, style }) {
  const [copyState, setCopyState] = useState("idle");

  const copy = async () => {
    const copied = await copyDeckText(exportText);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 3000);
  };

  const label = copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy Failed" : "Copy to Clipboard";

  return (
    <SecondaryButton type="button" onClick={copy} title="Copy the export text below to your clipboard" style={{ whiteSpace: "nowrap", ...style }}>
      {label}
    </SecondaryButton>
  );
}

function DeckExportPanel({ analysis, exportFormat, setExportFormat, includePrintings, setIncludePrintings }) {
  const exportText = useMemo(() => formatDeckExport(analysis, { format: exportFormat, includePrintings }), [analysis, exportFormat, includePrintings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.35s ease" }}>
      <div style={cardStyle}>
        <Divider label="Export Deck" />
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <SelectControl label="Export Target" value={exportFormat} onChange={setExportFormat} options={EXPORT_FORMATS} />
          <div style={{ paddingBottom: 10 }}>
            <ToggleRow checked={includePrintings} onChange={setIncludePrintings} label="Include printings" />
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <CopyExportButton exportText={exportText} />
            <ManaPoolButton analysis={analysis} />
          </div>
        </div>
        <textarea
          readOnly
          value={exportText}
          style={{
            width: "100%",
            minHeight: 360,
            background: CONTROL_BG,
            border: CONTROL_BORDER,
            borderRadius: 6,
            color: TEXT,
            fontFamily: MONO_FONT,
            fontSize: 12,
            lineHeight: 1.6,
            padding: "11px 14px",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

function ResultsNavBar({ analysis, activeTab, setActiveTab, setPhase, onResetDeck, inputText, commanderName, importFormat }) {
  const archetypeProfile = useMemo(() => buildArchetypeProfile(analysis), [analysis]);
  const winPlan = useMemo(() => buildWinPlan(analysis), [analysis]);
  const commanderCard = analysis.commanderCard || analysis.commanderReport?.commanderCard;
  const commanderColors = analysis.commanderReport?.commanderColors || commanderCard?.color_identity || [];
  const deckName = commanderCard?.name || "Deck Analysis";
  const legalityOk = analysis.commanderReport?.enabled && analysis.commanderReport.issues.length === 0;
  const legalityTone = !analysis.commanderReport?.enabled ? TEXT_MUTED : legalityOk ? SUCCESS : DANGER;
  const tabs = [
    { key: "analysis", label: "Analysis", detail: "Deck state" },
    { key: "assistant", label: "Assistant", detail: "Tune plan" },
    { key: "decklist", label: "Decklist", detail: "Card view" },
    { key: "export", label: "Export", detail: "Share list" },
  ];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 32,
        padding: "10px 0 12px",
        marginBottom: 14,
        background: "color-mix(in srgb, var(--oracle-bg) 92%, transparent)",
        backdropFilter: "blur(16px)",
        borderBottom: BORDER,
      }}
    >
      <ManaStripe />
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", paddingTop: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setPhase("input")}
            style={{ background: SURFACE, border: BORDER, borderRadius: 6, color: TEXT_DIM, padding: "7px 12px", fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}
          >
            Edit
          </button>
          <button
            onClick={onResetDeck}
            style={{ background: SURFACE, border: BORDER, borderRadius: 6, color: TEXT_DIM, padding: "7px 12px", fontFamily: DISPLAY_FONT, fontSize: 11, fontWeight: 700, letterSpacing: "0.01em" }}
          >
            New
          </button>
          <ShareLinkButton inputText={inputText} commanderName={commanderName} importFormat={importFormat} style={{ padding: "7px 12px" }} />
        </div>

        <div style={{ minWidth: 220, flex: "1 1 300px" }}>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: DISPLAY_FONT, fontSize: 21, color: TEXT, letterSpacing: "0", fontWeight: 800, lineHeight: 1.05 }}>
              {deckName}
            </h2>
            <ColorPipStack colors={commanderColors} size={18} />
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
            <StatusPill tone={analysis.totalCards === 100 ? SUCCESS : GOLD}>{analysis.totalCards} cards</StatusPill>
            <StatusPill tone={legalityTone}>{analysis.commanderReport?.enabled ? analysis.commanderReport.status : "No commander"}</StatusPill>
            {archetypeProfile?.primary && <StatusPill tone={GOLD}>{archetypeProfile.primary.label}</StatusPill>}
            {winPlan?.primary && <StatusPill tone={getWinPlanTone(winPlan.primary.status)}>{winPlan.primary.label}</StatusPill>}
          </div>
        </div>

        <div style={{ marginLeft: "auto", marginRight: 106, background: ROW_BG, border: BORDER, borderRadius: 6, padding: "7px 10px", fontFamily: DISPLAY_FONT, fontSize: 11, color: TEXT_DIM, fontWeight: 800, letterSpacing: "0.03em" }}>
          THE ORACLE
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(148px,1fr))", gap: 8, marginTop: 12 }}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                textAlign: "left",
                background: active ? GOLD_FAINT : ROW_BG,
                border: active ? `1px solid ${GOLD_DIM}` : BORDER,
                borderRadius: 6,
                padding: "10px 12px",
                minHeight: 58,
                color: active ? GOLD : TEXT_DIM,
                fontFamily: DISPLAY_FONT,
                boxShadow: "none",
              }}
            >
              <span style={{ display: "block", color: active ? GOLD : TEXT, fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>
                {tab.label}
              </span>
              <span style={{ display: "block", color: active ? GOLD : TEXT_MUTED, fontSize: 11, fontWeight: 700, lineHeight: 1.2, marginTop: 5 }}>
                {tab.detail}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LoadingScreen({ loadMsg, isDark, onToggleTheme }) {
  return (
    <div style={{ ...getThemeVars(isDark), minHeight: "100vh", background: BG, color: TEXT, fontFamily: BODY_FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 180, margin: "0 auto 26px" }}><ManaStripe /></div>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 13, color: TEXT_DIM, marginTop: 22, animation: "pulse 1.6s ease-in-out infinite", letterSpacing: "0.04em", fontWeight: 700 }}>
          {loadMsg}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

function ResultsScreenRedesigned({ analysis, setPhase, onResetDeck, activeTab, setActiveTab, exportFormat, setExportFormat, includePrintings, setIncludePrintings, isDark, onToggleTheme, inputText, commanderName, importFormat }) {
  const { totalCards, manaCurveData, colorData, colorGroupData, typeData, warnings, mostExpensive, missing, cardList, sideboardCardList } = analysis;
  const [spellbookResult, setSpellbookResult] = useState(null);
  const [spellbookStatus, setSpellbookStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setSpellbookStatus("loading");
    setSpellbookResult(null);

    fetchSpellbookCombos(analysis, { signal: controller.signal })
      .then(result => {
        if (cancelled) return;
        setSpellbookResult(result);
        setSpellbookStatus(result ? "done" : "error");
      })
      .catch(() => {
        if (!cancelled) setSpellbookStatus("error");
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [analysis]);

  return (
    <div style={{ ...getThemeVars(isDark), minHeight: "100vh", background: BG, color: TEXT, fontFamily: BODY_FONT }}>
      <style>{GLOBAL_CSS}</style>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 48px", animation: "fadeUp 0.5s ease" }}>
        <ResultsNavBar
          analysis={analysis}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setPhase={setPhase}
          onResetDeck={onResetDeck}
          inputText={inputText}
          commanderName={commanderName}
          importFormat={importFormat}
        />

        {activeTab === "analysis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, animation: "fadeUp 0.35s ease" }}>
            <AnalysisOverview analysis={analysis} />
            <WinTurnCard analysis={analysis} spellbookResult={spellbookResult} />
            <BracketEstimateCard analysis={analysis} spellbookResult={spellbookResult} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 10 }}>
              <Suspense fallback={<div style={{ ...cardStyle, flex: 2, minWidth: 260, minHeight: 196 }} />}>
                <ManaCurveChart data={manaCurveData} />
              </Suspense>
              <PipsVsSources analysis={analysis} />
            </div>

            {colorData.length > 0 && <ColorBreakdown data={colorData} groups={colorGroupData} total={totalCards} />}

            <TypeComposition data={typeData} />
            <ReviewQueue warnings={warnings} missing={missing} mostExpensive={mostExpensive} />
          </div>
        )}

        {activeTab === "assistant" && (
          <CommanderAssistant analysis={analysis} spellbookResult={spellbookResult} spellbookStatus={spellbookStatus} />
        )}
        {activeTab === "decklist" && <DeckCardList cards={cardList} sideboardCards={sideboardCardList} />}
        {activeTab === "export" && (
          <DeckExportPanel
            analysis={analysis}
            exportFormat={exportFormat}
            setExportFormat={setExportFormat}
            includePrintings={includePrintings}
            setIncludePrintings={setIncludePrintings}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [inputText, setInputText] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [phase, setPhase] = useState("landing");
  const [activeTab, setActiveTab] = useState("analysis");
  const [importFormat, setImportFormat] = useState("plain");
  const [exportFormat, setExportFormat] = useState("plain");
  const [includePrintings, setIncludePrintings] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("oracle-theme") === "dark";
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setIsDark(current => {
      const next = !current;
      try {
        localStorage.setItem("oracle-theme", next ? "dark" : "light");
      } catch {
        // localStorage can be unavailable in some private/sandboxed contexts.
      }
      return next;
    });
  };

  const resetDeckInput = () => {
    setInputText("");
    setCommanderName("");
    setAnalysis(null);
    setError("");
    setActiveTab("analysis");
    setPhase("input");
  };

  const runAnalysis = async (overrides = {}) => {
    const text = overrides.text ?? inputText;
    const commander = overrides.commander ?? commanderName;
    const format = overrides.format ?? importFormat;
    if (!text.trim()) return;
    setPhase("loading");
    setError("");

    try {
      setLoadMsg("Parsing decklist...");
      const imported = parseDeckImport(text, { format, includePrintings });
      const parsed = imported.cards;
      const commanderForAnalysis = imported.commanderName || commander.trim() || "";
      if (parsed.length === 0) {
        setError("I couldn't read any cards. Use a format like: 4 Lightning Bolt");
        setPhase("input");
        return;
      }

      if (imported.commanderName && commander.trim() !== imported.commanderName) {
        setCommanderName(imported.commanderName);
      }

      setLoadMsg("Consulting the Oracle of Scryfall...");
      const lookupEntries = collectLookupEntries(parsed, commanderForAnalysis, includePrintings);
      const cardMap = await fetchCardsFromScryfall(lookupEntries);

      setLoadMsg("Weaving the analysis...");
      const built = buildAnalysis(parsed, cardMap, commanderForAnalysis);
      setAnalysis(built);
      saveRecentDeck({ inputText: text, commanderName: commanderForAnalysis, importFormat: format, cardCount: built.totalCards });
      setActiveTab("analysis");
      setPhase("results");
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong while analyzing the deck.");
      setPhase("input");
    }
  };

  useEffect(() => {
    const payload = readDeckPayloadFromUrl();
    if (!payload) return;
    setInputText(payload.inputText);
    setCommanderName(payload.commanderName);
    setImportFormat(payload.importFormat);
    runAnalysis({ text: payload.inputText, commander: payload.commanderName, format: payload.importFormat });
    // Only ever want this to run once, against whatever share link the app was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "landing") return <LandingScreen onStart={() => setPhase("input")} isDark={isDark} onToggleTheme={toggleTheme} />;

  if (phase === "input") {
    return (
      <>
        <InputScreenV2
          inputText={inputText}
          setInputText={setInputText}
          commanderName={commanderName}
          setCommanderName={setCommanderName}
          importFormat={importFormat}
          setImportFormat={setImportFormat}
          includePrintings={includePrintings}
          setIncludePrintings={setIncludePrintings}
          runAnalysis={runAnalysis}
          onBack={() => setPhase("landing")}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        {error && (
          <div style={{ ...getThemeVars(isDark), position: "fixed", left: 20, right: 20, bottom: 20, maxWidth: 720, margin: "0 auto", ...cardStyle, borderColor: DANGER, background: "color-mix(in srgb, var(--oracle-danger) 10%, transparent)", color: DANGER_TEXT, fontFamily: BODY_FONT, fontSize: 14 }}>
            {error}
          </div>
        )}
      </>
    );
  }

  if (phase === "loading") return <LoadingScreen loadMsg={loadMsg} isDark={isDark} onToggleTheme={toggleTheme} />;

  if (phase === "results" && analysis) {
    return (
      <ResultsScreenRedesigned
        analysis={analysis}
        setPhase={setPhase}
        onResetDeck={resetDeckInput}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        includePrintings={includePrintings}
        setIncludePrintings={setIncludePrintings}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        inputText={inputText}
        commanderName={commanderName}
        importFormat={importFormat}
      />
    );
  }

  return null;
}
