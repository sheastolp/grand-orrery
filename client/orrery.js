// The Grand Orrery client: how every Tavernworks app reads the universe.
//
// One small module, no dependencies, the same in Deno, Node 18+ and the
// browser. It reads the database the *Build the Orrery database* action
// publishes to the `data` branch (built from main or review), keeps it
// fresh, and never throws at the app: before the first good read every
// lookup returns nothing (or the app's fallback), and after a failed read
// the last good copy is kept.
//
//   import { Orrery } from "https://cdn.jsdelivr.net/gh/sheastolp/grand-orrery@<commit>/client/orrery.js";
//
//   const orrery = new Orrery();                  // main, no secrets
//   await orrery.ready();                         // false if it couldn't read yet
//   orrery.get("tansy-ninefingers");              // one thing by id
//   orrery.list("person", { group: "The road peddlers" });
//   orrery.find("tansy");                         // by name, any case
//   orrery.about("murrow");                       // every note that names Murrow
//   orrery.loreText();                            // the narrator's lore.md lines
//   orrery.onChange(() => rebuildPrompts());      // after a publish lands
//
// Options:
//   branch          "main" (the live Orrery) or "review" (what's waiting)
//   secrets         false (default) reads entities.public.json, which has every
//                   secret taken out. Only turn it on for the owner's tools,
//                   never for anything that goes into a bot's or AI's prompt.
//   refreshMinutes  how often to check for a new build (default 5; 0 = never)
//   cache           where to keep the last good copy, so an app that starts
//                   while GitHub is out of reach still has the Orrery (not a
//                   hand-written list of its own): fileCache("./data/orrery.json")
//                   in Deno or Node, storageCache() in a browser, or any
//                   { load(): data | null, save(data) } (sync or async)
//   fallback        an { entities: [...] } to use until the first good read
//                   (prefer cache: the Orrery should be the only copy)
//   repo            "sheastolp/grand-orrery"
//   githubToken     optional, for a higher GitHub API limit
//   fetch           a fetch to use instead of the global one

/**
 * One thing in the universe. Every entity has these; the rest of its fields
 * depend on its type (see the README's "The database").
 * @typedef {{ id: string, type: string, name: string, status?: string, [field: string]: any }} OrreryEntity
 */
/**
 * @typedef {object} OrreryMeta
 * @property {number} schema
 * @property {string} built        when it was built (ISO time)
 * @property {string | null} branch the grand-orrery branch it was built from
 * @property {string | null} commit the grand-orrery commit it was built from
 * @property {Record<string, number>} counts how many of each type
 */
/**
 * @typedef {object} OrreryOptions
 * @property {string} [repo]
 * @property {string} [branch]
 * @property {boolean} [secrets]
 * @property {number} [refreshMinutes]
 * @property {{ entities: OrreryEntity[] } | null} [fallback]
 * @property {{ load(): any, save(data: any): any } | null} [cache]
 * @property {string | null} [githubToken]
 * @property {(url: string, init?: RequestInit) => Promise<Response>} [fetch]
 */

/** @type {Required<Omit<OrreryOptions, "fetch">>} */
const DEFAULTS = {
  repo: "sheastolp/grand-orrery",
  branch: "main",
  secrets: false,
  refreshMinutes: 5,
  fallback: null,
  cache: null,
  githubToken: null,
};

const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\*+/g, "").trim();

export class Orrery {
  /** @param {OrreryOptions} [options] */
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this._fetch = options.fetch || globalThis.fetch.bind(globalThis);
    this._data = null;
    this._byId = new Map();
    this._etag = null;
    this._sha = null;
    this._listeners = new Set();
    this._timer = null;
    this.lastError = null;
    this.lastRead = null;
    if (this.options.fallback) this._set(this.options.fallback);
    // The last good copy first (if there is one), then the Orrery itself.
    this._first = this._loadCache().then(() => this.refresh());
    const every = Number(this.options.refreshMinutes) * 60_000;
    if (every > 0) {
      this._timer = setInterval(() => this.refresh(), every);
      // Don't keep a Node or Deno process alive just for this.
      if (typeof this._timer?.unref === "function") this._timer.unref();
      else if (typeof Deno !== "undefined" && Deno.unrefTimer) Deno.unrefTimer(this._timer);
    }
  }

  /** Resolves once the first read is done: true if the Orrery was read.
   * @returns {Promise<boolean>} */
  async ready() { await this._first; return this._data !== null && !this._data.__fallback; }

  /** True once something from the Orrery is held: a fresh read or the last good copy. */
  get loaded() { return !!this._data && !this._data.__fallback; }

  /** When it was built, from which branch and commit, and how many of each type.
   * @returns {OrreryMeta | null} */
  get meta() {
    if (!this._data) return null;
    const { entities, ...meta } = this._data;
    return meta;
  }

  /** Every entity, or every one of a type, matching every field in `where`.
   * @param {string} [type]
   * @param {Record<string, unknown>} [where]
   * @returns {OrreryEntity[]} */
  list(type, where = {}) {
    const all = this._data?.entities || [];
    return all.filter((e) => (!type || e.type === type) && Object.entries(where).every(([k, v]) =>
      Array.isArray(e[k]) ? e[k].includes(v) : e[k] === v));
  }

  /** One thing by its id, or undefined.
   * @param {string} id
   * @returns {OrreryEntity | undefined} */
  get(id) { return this._byId.get(id); }

  /** Things whose name matches, best first: exact, then starts with, then contains.
   * @param {string} name
   * @param {string} [type]
   * @returns {OrreryEntity[]} */
  find(name, type) {
    const q = norm(name);
    if (!q) return [];
    const score = (e) => { const n = norm(e.name); return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3; };
    return this.list(type).map((e) => [score(e), e]).filter(([s]) => s < 3).sort((a, b) => a[0] - b[0]).map(([, e]) => e);
  }

  /** Every note and lore line that names this thing (its `mentioned_in`), plus its own notes.
   * @param {string} id
   * @returns {OrreryEntity[]} */
  about(id) {
    const e = this.get(id);
    if (!e) return [];
    const ids = [...(e.notes || []), ...(e.mentioned_in || [])];
    return [...new Set(ids)].map((x) => this.get(x)).filter(Boolean);
  }

  /** The lore lines the Wake in Verrowen narrator reads, as "KEY: text" lines in order.
   * @returns {string} */
  loreText() {
    return this.list("lore").sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((l) => `${l.name}${l.about ? ` (${l.about})` : ""}: ${l.text}`).join("\n");
  }

  /** Calls `fn(orrery)` whenever a new build is read. Returns an unsubscribe.
   * @param {(orrery: Orrery) => void} fn
   * @returns {() => void} */
  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  /** Stop refreshing. */
  close() { clearInterval(this._timer); this._timer = null; }

  /** Checks for a new build now. Never throws; true if something new was read.
   * @returns {Promise<boolean>} */
  async refresh() {
    try {
      const { repo, branch, secrets } = this.options;
      const file = `${branch}/${secrets ? "entities.json" : "entities.public.json"}`;
      // Ask GitHub which commit the data branch is on, and read that exact
      // commit: the raw server's branch copy can lag a few minutes behind.
      // A 304 doesn't count against the API limit.
      let ref = "data";
      try {
        const headers = { accept: "application/vnd.github.sha" };
        if (this._etag) headers["if-none-match"] = this._etag;
        if (this.options.githubToken) headers.authorization = "Bearer " + this.options.githubToken;
        const r = await this._fetch(`https://api.github.com/repos/${repo}/commits/data`, { headers });
        if (r.status === 304 && this._data && !this._data.__fallback) { this.lastRead = new Date(); return false; }
        if (r.ok) {
          this._etag = r.headers.get("etag");
          const sha = (await r.text()).trim();
          if (sha === this._sha && this._data && !this._data.__fallback) { this.lastRead = new Date(); return false; }
          if (/^[0-9a-f]{40}$/.test(sha)) ref = sha;
        }
      } catch { /* the API is optional: fall back to the branch */ }

      const r = await this._fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${file}`);
      if (!r.ok) throw new Error(`reading ${file} answered ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data?.entities)) throw new Error(`${file} has no entities`);
      if (ref !== "data") this._sha = ref;
      this.lastRead = new Date();
      this.lastError = null;
      const changed = !this._data || this._data.__fallback || this._data.__cached || this._data.commit !== data.commit || this._data.built !== data.built;
      this._set(data);
      if (changed && this.options.cache) { try { await this.options.cache.save(data); } catch { /* best effort */ } }
      if (changed) for (const fn of this._listeners) { try { fn(this); } catch (e) { console.error("orrery onChange", e); } }
      return changed;
    } catch (e) {
      this.lastError = String(e?.message || e);
      return false;
    }
  }

  async _loadCache() {
    const c = this.options.cache;
    if (!c) return;
    try {
      const data = await c.load();
      if (Array.isArray(data?.entities) && (!this._data || this._data.__fallback)) {
        this._set(data);
        this._data.__cached = true;
        this.cachedFrom = data.built || null;
      }
    } catch { /* no copy yet */ }
  }

  _set(data) {
    this._data = data === this.options.fallback ? { ...data, __fallback: true } : data;
    this._byId = new Map((data.entities || []).map((e) => [e.id, e]));
  }
}

/** Keeps the last good copy in a file (Deno or Node). */
export function fileCache(path = "./data/orrery.json") {
  return {
    async load() {
      const text = globalThis.Deno ? await Deno.readTextFile(path) : await (await import("node:fs/promises")).readFile(path, "utf8");
      return JSON.parse(text);
    },
    async save(data) {
      const text = JSON.stringify(data);
      if (globalThis.Deno) {
        const dir = path.replace(/[\\/][^\\/]*$/, "");
        if (dir && dir !== path) await Deno.mkdir(dir, { recursive: true }).catch(() => {});
        await Deno.writeTextFile(path + ".tmp", text); await Deno.rename(path + ".tmp", path);
      } else {
        const fs = await import("node:fs/promises"), p = await import("node:path");
        await fs.mkdir(p.dirname(path), { recursive: true });
        await fs.writeFile(path + ".tmp", text); await fs.rename(path + ".tmp", path);
      }
    },
  };
}

/** Keeps the last good copy in the browser's localStorage. */
export function storageCache(key = "orrery-db") {
  return {
    load() { try { return JSON.parse(globalThis.localStorage.getItem(key) || "null"); } catch { return null; } },
    save(data) { try { globalThis.localStorage.setItem(key, JSON.stringify(data)); } catch { /* full or blocked */ } },
  };
}

export default Orrery;
