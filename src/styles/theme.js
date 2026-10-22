export const BODY_FONT = "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const DISPLAY_FONT = "'Space Grotesk', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const MONO_FONT = "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace";

export const BG = "var(--oracle-bg)";
export const SURFACE = "var(--oracle-surface)";
export const SURFACE2 = "var(--oracle-surface-2)";
export const GOLD = "var(--oracle-accent)";
export const GOLD_DIM = "var(--oracle-accent-dim)";
export const GOLD_FAINT = "var(--oracle-accent-faint)";
export const BORDER = "1px solid var(--oracle-border-color)";
export const TEXT = "var(--oracle-text)";
export const TEXT_DIM = "var(--oracle-text-dim)";
export const TEXT_MUTED = "var(--oracle-text-muted)";
export const DANGER = "var(--oracle-danger)";
export const SUCCESS = "var(--oracle-success)";
export const WARN = "var(--oracle-warn)";
export const CONTROL_BG = "var(--oracle-control-bg)";
export const CONTROL_BORDER = "1px solid var(--oracle-control-border)";
export const ROW_BG = "var(--oracle-row-bg)";
export const CARD_SHADOW = "var(--oracle-card-shadow)";
export const HOVER_SHADOW = "var(--oracle-hover-shadow)";
export const TOOLTIP_SHADOW = "var(--oracle-tooltip-shadow)";
export const BAR_EMPTY = "var(--oracle-bar-empty)";
export const INVERSE_TEXT = "var(--oracle-inverse-text)";
export const DANGER_TEXT = "var(--oracle-danger-text)";
export const WARN_TEXT = "var(--oracle-warn-text)";

const LIGHT_THEME = {
  "--oracle-bg": "#F6F7FA",
  "--oracle-surface": "#FFFFFF",
  "--oracle-surface-2": "#ECEFF3",
  "--oracle-accent": "#2F6FED",
  "--oracle-accent-dim": "rgba(47,111,237,0.24)",
  "--oracle-accent-faint": "rgba(47,111,237,0.09)",
  "--oracle-border-color": "rgba(23,28,38,0.14)",
  "--oracle-text": "#171C26",
  "--oracle-text-dim": "#56606F",
  "--oracle-text-muted": "#8B94A3",
  "--oracle-danger": "#C94F4A",
  "--oracle-success": "#2F8B6B",
  "--oracle-warn": "#D56B55",
  "--oracle-control-bg": "#FBFCFE",
  "--oracle-control-border": "rgba(23,28,38,0.16)",
  "--oracle-row-bg": "#F8FAFC",
  "--oracle-card-shadow": "0 1px 0 rgba(23,28,38,0.04), 0 14px 30px rgba(23,28,38,0.07)",
  "--oracle-hover-shadow": "0 8px 18px rgba(23,28,38,0.10)",
  "--oracle-tooltip-shadow": "0 20px 48px rgba(23,28,38,0.26)",
  "--oracle-bar-empty": "#DCE2EA",
  "--oracle-inverse-text": "#FFFFFF",
  "--oracle-danger-text": "#93352F",
  "--oracle-warn-text": "#9C4636",
};

const DARK_THEME = {
  "--oracle-bg": "#080A0F",
  "--oracle-surface": "#11141B",
  "--oracle-surface-2": "#1A1F2A",
  "--oracle-accent": "#65A8FF",
  "--oracle-accent-dim": "rgba(101,168,255,0.24)",
  "--oracle-accent-faint": "rgba(101,168,255,0.10)",
  "--oracle-border-color": "rgba(229,235,245,0.13)",
  "--oracle-text": "#F1F4F8",
  "--oracle-text-dim": "#AAB4C2",
  "--oracle-text-muted": "#687383",
  "--oracle-danger": "#F06B64",
  "--oracle-success": "#5CC48C",
  "--oracle-warn": "#F08A6C",
  "--oracle-control-bg": "#0B0E14",
  "--oracle-control-border": "rgba(229,235,245,0.16)",
  "--oracle-row-bg": "#0D1118",
  "--oracle-card-shadow": "0 1px 0 rgba(255,255,255,0.03), 0 18px 38px rgba(0,0,0,0.30)",
  "--oracle-hover-shadow": "0 10px 22px rgba(0,0,0,0.30)",
  "--oracle-tooltip-shadow": "0 24px 60px rgba(0,0,0,0.48)",
  "--oracle-bar-empty": "#27303C",
  "--oracle-inverse-text": "#06101E",
  "--oracle-danger-text": "#F3B5AF",
  "--oracle-warn-text": "#F2B09A",
};

export function getThemeVars(isDark) {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

export const cardStyle = {
  background: SURFACE,
  border: BORDER,
  borderRadius: 6,
  padding: "18px 20px",
  boxShadow: CARD_SHADOW,
};

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body,#root{background:${BG};min-height:100%;}
  body{font-family:${BODY_FONT};}
  textarea,input,select{resize:vertical;}
  button{cursor:pointer;transition:background 0.15s,border-color 0.15s,box-shadow 0.15s,color 0.15s;}
  button:not(:disabled):hover{box-shadow:${HOVER_SHADOW};}
  button:not(:disabled):active{box-shadow:none;}
  button:disabled{cursor:not-allowed;}
  a{color:${GOLD};}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:${BG};}
  ::-webkit-scrollbar-thumb{background:${GOLD_DIM};border-radius:2px;}
  ::selection{background:${GOLD_DIM};}
  @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
`;
