/* ============================================================
   ScribeDesk — Game cover art
   ------------------------------------------------------------
   Source chain per tile:
     1. Curated key-art map (Steam CDN — served straight into an
        <img>, so no CORS involved). Only appids verified against
        the actual game are mapped; anything uncertain is left
        out, because a wrong cover is worse than no cover.
     2. Procedural emblem — a slug-seeded pattern variant + ghost
        monogram rendered in CSS, so every port has its own face
        even without a photo.
   ============================================================ */

const STEAM_APPS: Record<string, number> = {
  ultrakill: 1229490,
  cuphead: 268910,
  "pizza-tower": 2231450,
  "buckshot-roulette": 2835570,
  "getting-over-it": 240720,
  "hotline-miami": 219150,
  omori: 1150690,
  "omori-fixed": 1150690,
  "yume-nikki": 650760,
  "people-playground": 1118200,
  "web-fishing": 2992350,
  bendy: 622650,
  raft: 648800,
  kindergarten: 561990,
  tattletail: 525480,
  "amanda-the-adventurer": 1973530,
  deltatraveler: 1535560,
};

/** Key-art URL for a game slug (handles `games/xyz` paths), or null. */
export function coverArt(slug: string): string | null {
  const base = slug.split("/").pop() ?? slug;
  const appid = STEAM_APPS[base] ?? STEAM_APPS[slug];
  return appid
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
    : null;
}

/** Emblem pattern variant, seeded by the slug — stable per game. */
export function artVariant(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 33 + slug.charCodeAt(i)) % 997;
  return h % 4;
}
