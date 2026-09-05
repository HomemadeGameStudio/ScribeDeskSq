/* ============================================================
   ScribeDesk — Games Registry
   ------------------------------------------------------------
   The shelf is fetched live from the ScribeDesk web-port repo:
     github.com/HomemadeGameStudio/lessons-moved-

   Directory listing → GitHub trees API (public, CORS-open).
   Game payload      → rawcdn.githack.com serves each folder's
                       index.html with correct content types.

   Every entry URL still passes through the proxy bridge
   (`resolveThrough`) before reaching an iframe or tab.
   ============================================================ */

export interface RemoteGame {
  slug: string;
  name: string;
  hue: number;
}

export const REPO_OWNER = "HomemadeGameStudio";
export const REPO_NAME = "lessons-moved-";
export const REPO_BRANCH = "main";
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

const TREES_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}?recursive=0`;
const CDN = "https://rawcdn.githack.com";

/** Folders that are infrastructure, not games. */
const IGNORED = new Set(["repo", ".github", "assets"]);

/** Slug → display title, mirrored from the repo README. */
const TITLES: Record<string, string> = {
  "amanda-the-adventurer": "Amanda the Adventurer",
  "andys-apple-farm": "Andy's Apple Farm",
  "baldi-plus": "Baldi's Basics Plus",
  "baldi-remaster": "Baldi's Basics Remastered",
  bendy: "Bendy and the Ink Machine",
  bergentruck: "BERGENTRUCK 201x",
  bloodmoney: "BLOODMONEY!",
  "buckshot-roulette": "Buckshot Roulette",
  "class-of-09": "Class of '09",
  cuphead: "Cuphead",
  "dead-plate": "Dead Plate",
  deadseat: "Deadseat",
  deltatraveler: "Deltatraveler",
  donottakethiscathome: "Do NOT Take This Cat Home",
  "fears-to-fathom/home-alone": "Fears to Fathom: Home Alone",
  "getting-over-it": "Getting Over It",
  "happy-sheepies": "Happy Sheepies",
  "hotline-miami": "Hotline Miami",
  "human-expenditure-program": "Human Expenditure Program",
  "jelly-drift": "Jelly Drift",
  karlson: "Karlson",
  kindergarten: "Kindergarten",
  lacysflashgames: "Lacey's Flash Games",
  "milkman-karlson": "Milkman Karlson",
  minesweeperplus: "Minesweeper Plus",
  "omori-fixed": "OMORI",
  "people-playground": "People Playground",
  "pizza-tower": "Pizza Tower",
  raft: "RAFT",
  "schoolboy-runaway": "Schoolboy Runaway",
  slender: "Slender: The Eight Pages",
  "sonic.exe": "Sonic.exe",
  "speed-stars": "Speed Stars",
  tattletail: "Tattletail",
  "thats-not-my-neighbor": "That's Not My Neighbor",
  "the-man-in-the-window": "The Man From the Window",
  ultrakill: "ULTRAKILL",
  "undertale-yellow": "Undertale Yellow",
  "web-fishing": "Web Fishing",
  "witch-heart": "The Witch's Heart",
  "yandere-simulator": "Yandere Simulator",
  "yume-nikki": "Yume Nikki",
};

function prettify(slug: string): string {
  const base = slug.split("/").pop() ?? slug;
  return (
    TITLES[slug] ??
    base
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function hashHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return h;
}

/** Rebuild a game descriptor from just a slug (used by external bridge hooks). */
export function describeGame(slug: string): RemoteGame {
  return { slug, name: prettify(slug), hue: hashHue(slug) };
}

interface TreeNode {
  path: string;
  type: "blob" | "tree";
}

/* ---------- cache ---------- */

const CACHE_KEY = "scribedesk:games:v1";

export interface GameCache {
  games: RemoteGame[];
  at: number;
}

export function readCache(): GameCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameCache;
    if (!Array.isArray(parsed.games) || parsed.games.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(games: RemoteGame[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ games, at: Date.now() }));
  } catch {
    /* private mode — shelf just re-syncs next visit */
  }
}

/* ---------- fetch ---------- */

export interface FetchResult {
  games: RemoteGame[];
  cached: boolean;
}

export async function fetchGames(): Promise<FetchResult> {
  const cached = readCache();
  let nodes: TreeNode[] | null = null;

  try {
    const res = await fetch(TREES_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub trees API ${res.status}`);
    const data = (await res.json()) as { tree?: TreeNode[] };
    nodes = data.tree ?? [];
  } catch {
    if (cached) return { games: cached.games, cached: true };
    throw new Error("offline");
  }

  const slugs: string[] = [];
  for (const node of nodes) {
    if (node.type !== "tree") continue;
    if (node.path.startsWith(".")) continue;
    if (IGNORED.has(node.path.split("/")[0])) continue;
    slugs.push(node.path);
  }
  slugs.sort((a, b) => prettify(a).localeCompare(prettify(b)));

  const games: RemoteGame[] = slugs.map((slug) => ({
    slug,
    name: prettify(slug),
    hue: hashHue(slug),
  }));

  if (games.length > 0) writeCache(games);
  return { games, cached: false };
}

/* ---------- entry resolution ----------
   Each port is a folder with an index.html; nested ports
   (e.g. fears-to-fathom/home-alone) resolve via the deepest tree. */

export function gameBaseUrl(game: RemoteGame): string {
  return `${CDN}/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${game.slug}/`;
}

const entryCache = new Map<string, string>();

export async function resolveGameEntry(game: RemoteGame): Promise<string> {
  const hit = entryCache.get(game.slug);
  if (hit) return hit;

  const base = gameBaseUrl(game);
  const res = await fetch(base, { method: "HEAD" });
  if (!res.ok) throw new Error(`entry 404 for ${game.slug}`);
  entryCache.set(game.slug, base);
  return base;
}
