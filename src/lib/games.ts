/* ============================================================
   ScribeDesk — Games Registry
   ------------------------------------------------------------
    Shelf listing → GitHub trees API (public, CORS-open) from
      github.com/HomemadeGameStudio/lessons-moved-
    Payloads      → CDN mirror ladder (gitloaf → raw.githack →
      statically → jsdelivr), raced in parallel per game.
   Entry resolution supports every playable file type a port
   can ship:
     1. index.html / index.htm            (HEAD probe, no API hit)
     2. any .html / .htm / .xhtml         (trees listing fallback)
     3. .swf                              (executed via Ruffle shim)
     4. anything else                     → surfaced as unsupported

   Every resolved URL still passes through the proxy bridge
   before it reaches an iframe. Nothing ever opens in a tab.
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

/* ---------- CDN mirror ladder ----------
   The repo is ~11 GB of game ports, so most generic CDNs refuse
   it — and some CDNs that *serve* the games fine will still
   reject our HEAD probe (CORS / 405). Probes are therefore only
   an optimization:

     hit     → 2xx, confirmed servable
     miss    → 404/403/410, definitely not on this mirror
     unknown → CORS / network / 405 / 5xx — can't verify, but an
               iframe doesn't need CORS, so mount it anyway

   All mirrors are probed in parallel with a hard timeout. If
   nothing confirms, the first `unknown` mirror is mounted
   optimistically; the player auto-advances once if it stalls,
   and mirrors can be cycled manually (M key / footer chip).
   A mirror that actually loads a game is remembered per game. */

export interface GameMirror {
  id: string;
  label: string;
  build: (path: string) => string;
}

export const MIRRORS: GameMirror[] = [
  {
    id: "gitloaf",
    label: "gitloaf",
    build: (p) => `https://gitloaf.com/cdn/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${p}`,
  },
  {
    id: "githack",
    label: "raw.githack",
    build: (p) => `https://raw.githack.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${p}`,
  },
  {
    id: "statically",
    label: "statically",
    build: (p) => `https://cdn.statically.io/gh/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${p}`,
  },
  {
    id: "jsdelivr",
    label: "jsdelivr",
    build: (p) => `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}/${p}`,
  },
];

const encodePath = (file: string) => file.split("/").map(encodeURIComponent).join("/");

export function mirrorUrl(mirrorId: string, slug: string, file: string): string {
  const m = MIRRORS.find((x) => x.id === mirrorId) ?? MIRRORS[0];
  return m.build(encodePath(`${slug}/${file}`));
}

/* Per-game mirror memory — once a mirror loads a game, prefer it. */
const PREFS_KEY = "scribedesk:mirror-prefs:v1";

function readPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveMirrorPref(slug: string, mirrorId: string): void {
  try {
    const prefs = readPrefs();
    prefs[slug] = mirrorId;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — preference just won't stick */
  }
}

/** Ladder order for a game: remembered mirror first, then the rest. */
export function mirrorLadder(slug: string): string[] {
  const pref = readPrefs()[slug];
  const ids = MIRRORS.map((m) => m.id);
  if (pref && ids.includes(pref)) return [pref, ...ids.filter((id) => id !== pref)];
  return ids;
}

export type ProbeVerdict = "hit" | "miss" | "unknown";

/** HEAD probe with a hard timeout and a three-way verdict. */
export async function probeMirror(
  mirrorId: string,
  slug: string,
  file: string
): Promise<ProbeVerdict> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(mirrorUrl(mirrorId, slug, file), {
      method: "HEAD",
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (res.ok) return "hit";
    if (res.status === 404 || res.status === 403 || res.status === 410) return "miss";
    return "unknown"; // server answered oddly (405/5xx) — still worth mounting
  } catch {
    return "unknown"; // CORS / network / timeout — unverifiable, mountable
  } finally {
    window.clearTimeout(timer);
  }
}

/** Race every mirror against one file, in ladder order. */
export async function pickMirror(
  slug: string,
  file: string,
  order: string[]
): Promise<{ mirrorId: string; verified: boolean } | null> {
  const verdicts = await Promise.all(
    order.map(async (id) => ({ id, v: await probeMirror(id, slug, file) }))
  );
  const byId = new Map(verdicts.map((r) => [r.id, r.v]));
  for (const id of order) if (byId.get(id) === "hit") return { mirrorId: id, verified: true };
  for (const id of order) if (byId.get(id) === "unknown") return { mirrorId: id, verified: false };
  return null;
}

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
  "fears-to-fathom": "Fears to Fathom",
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
    TITLES[base] ??
    base.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function hashHue(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) % 360;
  return h;
}

interface TreeNode {
  path: string;
  type: "blob" | "tree";
}

/* ---------- cache ---------- */

const CACHE_KEY = "scribedesk:games:v3";

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

/* ---------- shelf fetch ---------- */

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

  /* Tile rule — exactly two sources, nothing else:
       1. every top-level folder (each one is a game)
       2. the `games/` container, expanded one level: each of its
          child folders gets its own tile.
     Slugs for expanded tiles keep the full path (`games/xyz`), so
     the player loads everything inside that folder. Deeper nesting
     never produces extra tiles. */
  const slugs: string[] = [];
  for (const node of nodes) {
    if (node.type !== "tree") continue;
    if (node.path.includes("/")) continue; // never path into a game's files
    if (node.path.startsWith(".")) continue;
    if (IGNORED.has(node.path)) continue;
    if (node.path === "games") continue; // expanded below
    slugs.push(node.path);
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}:games?recursive=0`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (res.ok) {
      const data = (await res.json()) as { tree?: TreeNode[] };
      for (const node of data.tree ?? []) {
        if (node.type === "tree" && !node.path.startsWith(".") && !IGNORED.has(node.path)) {
          slugs.push(`games/${node.path}`);
        }
      }
    }
  } catch {
    /* no `games/` container on this branch — top-level folders stand alone */
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

/* ---------- entry resolution (all file types) ----------
   Resolution is mirror-agnostic: it returns the *relative* entry
   file inside the port folder. The player then asks the mirror
   ladder to serve `slug/file`. */

export type EntryKind = "html" | "swf" | "unsupported";

export interface GameEntry {
  kind: EntryKind;
  /** Entry file relative to the port folder, or a summary of found extensions. */
  file: string;
  /** Mirror the entry was confirmed on (or optimistically picked). */
  mirrorId?: string;
  /** True when a HEAD probe confirmed the mirror serves the file. */
  verified?: boolean;
}

/** Lower = better document candidate. ≥5 = not executable in-browser. */
function rank(path: string): number {
  const low = path.toLowerCase();
  if (/(^|\/)index\.x?html?$/.test(low)) return 0;
  if (low.endsWith(".html")) return 1;
  if (low.endsWith(".htm")) return 2;
  if (low.endsWith(".xhtml")) return 3;
  if (low.endsWith(".swf")) return 4;
  return 5;
}

const entryCache = new Map<string, GameEntry>();

export async function resolveGameEntry(game: RemoteGame): Promise<GameEntry> {
  const hit = entryCache.get(game.slug);
  if (hit) return hit;

  const order = mirrorLadder(game.slug);

  /* Fast path — the conventional entry files, racing every mirror
     in parallel so one slow/dead CDN can't stall the launch. */
  for (const f of ["index.html", "index.htm"]) {
    const pick = await pickMirror(game.slug, f, order);
    if (pick) {
      const entry: GameEntry = {
        kind: "html",
        file: f,
        mirrorId: pick.mirrorId,
        verified: pick.verified,
      };
      entryCache.set(game.slug, entry);
      return entry;
    }
  }

  /* Slow path — list the port folder, pick the best executable file,
     then race the mirrors for that file too. */
  let entry: GameEntry;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}:${game.slug}?recursive=1`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) throw new Error(`listing ${res.status}`);
    const data = (await res.json()) as { tree?: TreeNode[] };
    const blobs = (data.tree ?? []).filter((n) => n.type === "blob");

    const candidates = blobs
      .filter((b) => rank(b.path) < 5)
      .sort((a, b) => rank(a.path) - rank(b.path) || a.path.length - b.path.length || a.path.localeCompare(b.path));

    if (candidates.length > 0) {
      const file = candidates[0].path;
      const kind: EntryKind = file.toLowerCase().endsWith(".swf") ? "swf" : "html";
      const pick = await pickMirror(game.slug, file, order);
      entry = {
        kind,
        file,
        mirrorId: pick?.mirrorId ?? order[0],
        verified: pick?.verified ?? false,
      };
    } else {
      const exts = blobs.length
        ? [...new Set(blobs.map((b) => `.${b.path.split(".").pop() ?? "?"}`))].slice(0, 4).join(" ")
        : "empty folder";
      entry = { kind: "unsupported", file: exts };
    }
  } catch {
    throw new Error(`no entry found under /${game.slug}`);
  }

  entryCache.set(game.slug, entry);
  return entry;
}

/** Build a game object from a bare slug (bridge hook: `play("ultrakill")`). */
export function describeGame(slug: string): RemoteGame {
  return { slug, name: prettify(slug), hue: hashHue(slug) };
}

/* ---------- Ruffle shim for legacy Flash ports ---------- */

export function ruffleDocument(swfUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}ruffle-embed{width:100%;height:100%}</style>
<script src="https://unpkg.com/@ruffle-rs/ruffle"><\/script>
</head><body><ruffle-embed src="${swfUrl}"></ruffle-embed></body></html>`;
}
