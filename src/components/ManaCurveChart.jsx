import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell,
} from "recharts";

import { Divider } from "./Divider";
import {
  BAR_EMPTY,
  BORDER,
  DISPLAY_FONT,
  GOLD,
  GOLD_FAINT,
  SURFACE,
  TEXT,
  TEXT_DIM,
  TOOLTIP_SHADOW,
  cardStyle,
} from "../styles/theme";

export default function ManaCurveChart({ data }) {
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: SURFACE, border: BORDER, borderRadius: 6, padding: "7px 12px", fontSize: 12, color: TEXT, boxShadow: TOOLTIP_SHADOW }}>
        <div style={{ fontFamily: DISPLAY_FONT, fontSize: 10, color: GOLD, marginBottom: 2, letterSpacing: "0.04em", fontWeight: 700 }}>
          CMC {payload[0].payload.mv}
        </div>
        {payload[0].value} cards
      </div>
    );
  };

  return (
    <div style={{ ...cardStyle, flex: 2, minWidth: 260 }}>
      <Divider label="Mana Curve" />
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="mv" tick={{ fill: TEXT_DIM, fontSize: 11, fontFamily: DISPLAY_FONT }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: TEXT_DIM, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: GOLD_FAINT }} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.count === 0 ? BAR_EMPTY : GOLD} fillOpacity={entry.count === 0 ? 0.75 : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
