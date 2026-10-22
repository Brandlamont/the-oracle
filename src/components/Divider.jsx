import { DISPLAY_FONT, GOLD, GOLD_DIM } from "../styles/theme";

export function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ flex: 1, height: 1, background: GOLD_DIM }} />
      <span style={{ fontFamily: DISPLAY_FONT, fontSize: 10, letterSpacing: "0.08em", color: GOLD, textTransform: "uppercase", fontWeight: 700 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: GOLD_DIM }} />
    </div>
  );
}
