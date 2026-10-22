const FIND_MY_COMBOS_URL = "https://backend.commanderspellbook.com/find-my-combos?groupByCombo=true";

// Commander Spellbook's API only allows CORS from an allowlist of origins (their own
// site plus localhost for local dev) - it does not reflect arbitrary origins, so a
// browser calling it directly from a deployed domain gets silently blocked by CORS.
// This proxy makes the request server-to-server instead, where CORS doesn't apply,
// and hands the JSON straight back to the browser from the same origin as the app.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const upstream = await fetch(FIND_MY_COMBOS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch {
    res.status(502).json({ error: "Could not reach Commander Spellbook" });
  }
}
