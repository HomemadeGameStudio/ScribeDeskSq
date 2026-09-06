/* ============================================================
   ScribeDesk — Games Registry + Port Loader
   ------------------------------------------------------------
   Shelf listing → GitHub trees API (public, CORS-open) from
     github.com/HomemadeGameStudio/lessons-moved-
   Tile rule     → every top-level folder + the `games/` folder
                   expanded one level. Deeper paths never tile.

   Payload pipeline (why games actually run now):
     Forked web ports break on plain CDN hosting because they
     reference assets with root-absolute paths (`/Build/data.wasm`)
     that resolve to the CDN host's root instead of the port's
     folder. So we never point an iframe straight at the mirror:

       1. fetch the port's entry HTML from a CORS-open mirror
       2. inject `<base href="…/slug/">`  → declarative resources
          (script src, img, link, fetch of relative URLs) resolve
          into the port folder
       3. inject a path shim that rewrites root-absolute strings
          in `fetch` / `XMLHttpRequest.open` to the mirror folder
       4. mount the result as a same-origin srcDoc → reliable
          load events, instant kill on close, no raw-code renders

     That is the runtime equivalent of setting
     `base: '/<repo>/<slug>/'` in the port's bundler config.
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

/* ---------- CDN mirrors ----------
   Every one of these is CORS-open, which the loader requires to
   fetch + rewrite the entry document. GitLoaf leads because it is
   purpose-built for serving giant game-port repos. */

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
    label: "jsDelivr",
    build: (p) => `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@${REPO_BRANCH}/${p}`,
  },
];

export function mirrorUrl(mirrorId: string, slug: string, file: string): string {
  const m = MIRRORS.find((x) => x.id === mirrorId) ?? MIRRORS[0];
  return m.build(`${slug}/${file}`);
}

const mirrorBase = (mirrorId: string, slug: string) =>
  (MIRRORS.find((x) => x.id === mirrorId) ?? MIRRORS[0]).build(slug) + "/";

/* Per-game mirror memory: a mirror that actually served a game
   jumps to the front of that game's ladder. */
const PREF_KEY = "scribedesk:mirror-prefs:v1";

function readPrefs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function mirrorLadder(slug: string): string[] {
  const pref = readPrefs()[slug];
  const ids = MIRRORS.map((m) => m.id);
  if (pref && ids.includes(pref)) {
    return [pref, ...ids.filter((i) => i !== pref)];
  }
  return ids;
}

export function saveMirrorPref(slug: string, mirrorId: string): void {
  try {
    const prefs = readPrefs();
    prefs[slug] = mirrorId;
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode — ladder just starts from scratch next time */
  }
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

/* ---------- shelf cache ---------- */

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

/* ---------- port loading (fetch → rebase → shim → srcDoc) ---------- */

const encodePath = (file: string) => file.split("/").map(encodeURIComponent).join("/");

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

/** Fetch a file from several mirrors at once; first real answer wins. */
async function raceMirrors(
  slug: string,
  file: string,
  mirrorIds: string[]
): Promise<{ text: string; mirrorId: string }> {
  const attempts = mirrorIds.map(async (id) => {
    const ctl = new AbortController();
    const timer = window.setTimeout(() => ctl.abort(), 9000);
    try {
      const res = await fetch(mirrorUrl(id, slug, encodePath(file)), { signal: ctl.signal });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error("empty body");
      return { text, mirrorId: id };
    } finally {
      window.clearTimeout(timer);
    }
  });

  /* First real answer wins; all-reject → single friendly error. */
  return new Promise((resolve, reject) => {
    let pending = attempts.length;
    if (pending === 0) return reject(new Error("no mirrors"));
    attempts.forEach((p) =>
      p.then(resolve, () => {
        if (--pending === 0) reject(new Error("every mirror refused"));
      })
    );
  });
}

const fileListCache = new Map<string, string[]>();

/** List every file inside a port folder (one API call, cached). */
async function listPortFiles(slug: string): Promise<string[]> {
  const hit = fileListCache.get(slug);
  if (hit) return hit;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${REPO_BRANCH}:${slug}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error(`folder listing failed (${res.status})`);
  const data = (await res.json()) as { tree?: TreeNode[] };
  const files = (data.tree ?? []).filter((n) => n.type === "blob").map((n) => n.path);
  fileListCache.set(slug, files);
  return files;
}

/* The runtime base-URL fix. Injected first thing into <head>:
   - <base> makes every declarative URL (script/link/img/srcset and
     relative fetch calls) resolve inside the port folder on the mirror
   - the shim rewrites root-absolute strings ("/Build/x.wasm") in
     fetch() and XMLHttpRequest.open() onto the mirror folder, which
     is what stops forked ports from silently crashing on their
     loading screens */
function portShim(base: string): string {
  return (
    `<script>(function(){var B=${JSON.stringify(base)};` +
    `function f(u){try{if(typeof u==="string"&&u.charAt(0)==="/"){return B.replace(/\\/+$/,"")+u;}}catch(e){}return u;}` +
    `var of=window.fetch;if(of){window.fetch=function(a,b){return of.call(window,f(a),b);};}` +
    `var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(){arguments[1]=f(arguments[1]);return oo.apply(this,arguments);};` +
    `})();<\/script>`
  );
}

export function buildPortDocument(html: string, base: string): string {
  const inject = `<base href="${base}">` + portShim(base);
  const stripped = html
    .replace(/<base\b[^>]*>/gi, "")
    // Root-absolute tags would escape the port folder — make them
    // resolve against the injected <base> instead.
    .replace(/(\s(?:src|href|action|poster|data)\s*=\s*(["']))\//gi, "$1./");
  if (/<head[^>]*>/i.test(stripped)) {
    return stripped.replace(/<head[^>]*>/i, (m) => m + inject);
  }
  if (/<html[^>]*>/i.test(stripped)) {
    return stripped.replace(/<html[^>]*>/i, (m) => m + `<head>${inject}</head>`);
  }
  return `<!doctype html><head>${inject}</head>` + stripped;
}

/** Legacy Flash ports execute through a Ruffle shim document. */
export function ruffleDocument(swfUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}ruffle-embed{width:100%;height:100%}</style>
<script src="https://unpkg.com/@ruffle-rs/ruffle"><\/script>
</head><body><ruffle-embed src="${swfUrl}"></ruffle-embed></body></html>`;
}

export interface PortPayload {
  kind: "html" | "swf";
  /** Entry file relative to the port folder. */
  file: string;
  mirrorId: string;
  /** Final, ready-to-mount srcDoc. */
  doc: string;
}

/**
 * Load a game: find its entry file, pull it from the best mirror,
 * rebase its paths, and hand back a mountable document.
 * `only` forces a single mirror (manual mirror switching).
 */
export async function loadPort(
  game: RemoteGame,
  opts?: { only?: string }
): Promise<PortPayload> {
  const ids = opts?.only ? [opts.only] : mirrorLadder(game.slug);

  /* Conventional entries first — no API call needed when they exist. */
  for (const file of ["index.html", "index.htm"]) {
    try {
      const { text, mirrorId } = await raceMirrors(game.slug, file, ids);
      saveMirrorPref(game.slug, mirrorId);
      return {
        kind: "html",
        file,
        mirrorId,
        doc: buildPortDocument(text, mirrorBase(mirrorId, game.slug)),
      };
    } catch {
      /* not there — try the next candidate */
    }
  }

  /* Otherwise list the folder and pick the best executable file. */
  const files = await listPortFiles(game.slug);
  const exec = files
    .filter((f) => rank(f) < 5)
    .sort((a, b) => rank(a) - rank(b) || a.length - b.length || a.localeCompare(b));

  if (exec.length === 0) {
    const exts = files.length
      ? [...new Set(files.map((f) => `.${f.split(".").pop() ?? "?"}`))].slice(0, 4).join(" ")
      : "empty folder";
    throw new Error(`can't execute ${exts} in-browser`);
  }

  const file = exec[0];

  if (file.toLowerCase().endsWith(".swf")) {
    const mirrorId = ids[0];
    saveMirrorPref(game.slug, mirrorId);
    return {
      kind: "swf",
      file: encodePath(file),
      mirrorId,
      doc: ruffleDocument(mirrorUrl(mirrorId, game.slug, encodePath(file))),
    };
  }

  try {
    const { text, mirrorId } = await raceMirrors(game.slug, file, ids);
    saveMirrorPref(game.slug, mirrorId);
    return {
      kind: "html",
      file: encodePath(file),
      mirrorId,
      doc: buildPortDocument(text, mirrorBase(mirrorId, game.slug)),
    };
  } catch {
    throw new Error(`every mirror refused /${game.slug}/${file}`);
  }
}

/** Build a game object from a bare slug (bridge hook: `play("ultrakill")`). */
export function describeGame(slug: string): RemoteGame {
  return { slug, name: prettify(slug), hue: hashHue(slug) };
}
