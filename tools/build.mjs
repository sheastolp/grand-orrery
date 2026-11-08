#!/usr/bin/env node
// Builds the Orrery's database: every thing in the universe as one record
// with a stable id, compiled from the markdown documents.
//
// The documents stay where things are written (by hand, by the review
// page's catch-up and Add to the Orrery, by accepted pitches). This reads
// them and writes:
//
//   <out>/entities.json       every entity, secrets included
//   <out>/entities.public.json  the same with every secret taken out: what
//                             bots and AI prompts should read
//   <out>/<type>.json         one file per type (people.json, roles.json …),
//                             public, for apps that only need one kind
//
// Usage:
//   node tools/build.mjs                build into dist/
//   node tools/build.mjs --out <dir>    build somewhere else
//   node tools/build.mjs --check        only check the documents parse cleanly
//
// No dependencies: plain Node 18+.
//
// Every document is compiled (PARSERS below):
//   roster.md         person, role, world
//   resources.md      item (category, kind, icon, fields like sold/does/made)
//   bestiary.md       place (where fights happen) and creature (stats)
//   lore.md           lore: each line the narrator reads, in order
//   universe.md, working-notes.md, midkemia.md
//                     note: every section, with its status from its tag.
//                     What the review page files from the chat, the Codex or
//                     the lore-keeper carries origin and review_key, and a
//                     Wake in Verrowen character also becomes a person.
// Every record has id, type, name, status (decided, pitch, open, dm-lore,
// draft, untagged) and source. Notes list the people, items, creatures and
// places they mention, and those list mentioned_in back.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = 1;

// ── helpers ──

/** "Tansy Ninefingers" → "tansy-ninefingers". Ids never change once used. */
export function slug(s) {
  return String(s)
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const unbold = (s) => s.replace(/^\*\*(.+)\*\*$/, "$1").trim();
const cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const isDivider = (line) => /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
const stripHeading = (h) => h.replace(/^#+\s*/, "").trim();

// ── roster.md ──

// What each roster column becomes on a person. A column not listed here is
// kept under its slugged header, so a new column never gets lost.
const ROSTER_COLUMNS = {
  "name": (p, v) => { p.name = unbold(v); },
  "race, sex, age": (p, v) => splitRaceSexAge(p, v),
  "race, sex": (p, v) => splitRaceSexAge(p, v),
  "race": (p, v) => { if (v) p.race = v; },
  "role": (p, v) => { if (v) p.role = v; },
  "where": (p, v) => { if (v) p.where = v; },
  "in a line": (p, v) => { if (v) p.line = v; },
  "secret": (p, v) => { if (v) p.secret = v; },
  "played by": (p, v) => { if (v) p.played_by = v; },
  "class": (p, v) => { if (v) p.class = v; },
  "level": (p, v) => { if (v) p.level = Number.isFinite(+v) ? +v : v; },
  "rank": (p, v) => { if (v) p.rank = v; },
  "company": (p, v) => { if (v) p.companies = v.split(",").map((s) => s.trim()).filter(Boolean); },
};

const SEXES = { M: "male", F: "female" };

function splitRaceSexAge(p, v) {
  const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts[0]) p.race = parts[0];
  if (parts[1]) p.sex = SEXES[parts[1]] || parts[1];
  if (parts[2]) p.age = /^\d+$/.test(parts[2]) ? +parts[2] : parts[2];
}

export function parseRoster(text, file = "roster.md") {
  const out = [];
  const problems = [];
  const lines = text.split(/\r?\n/);
  let world = null, section = null, lead = null;
  let header = null, worldStatus = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = { file, line: i + 1 };

    if (/^##\s/.test(line)) {
      // "## Midkemia (DM lore)": a world's tag sets its people's status.
      const { title: h, status } = splitTag(stripHeading(line));
      world = /still to fill/i.test(h) ? null : h;
      worldStatus = status;
      section = null; lead = null; header = null;
      if (/still to fill/i.test(h)) {
        // The roles that exist in the world with nobody named for them yet.
        for (let j = i + 1; j < lines.length && !/^#{1,2}\s/.test(lines[j]); j++) {
          const m = lines[j].match(/^\s*[-*]\s+(.+?)\s*$/);
          if (m) out.push({ id: "role-" + slug(m[1]), type: "role", name: m[1], status: "open", source: { file, line: j + 1 } });
        }
      }
      continue;
    }
    if (/^###\s/.test(line)) { section = stripHeading(line); lead = null; header = null; continue; }

    // "**The capital peddlers** work the stall …": names the table under it.
    const leadMatch = line.match(/^\*\*(.+?)\*\*/);
    if (leadMatch && !isTableRow(line)) { lead = leadMatch[1]; header = null; continue; }

    // Any line that isn't part of a table ends the table above it.
    if (!isTableRow(line)) { header = null; continue; }
    if (isDivider(line)) continue;
    if (!header) { header = cellsOf(line).map((h) => h.toLowerCase()); continue; }

    const cells = cellsOf(line);
    const p = { id: "", type: "person", name: "" };
    header.forEach((h, k) => {
      const v = cells[k] ?? "";
      const set = ROSTER_COLUMNS[h];
      if (set) set(p, v);
      else if (v) p[slug(h).replace(/-/g, "_")] = v;
    });
    if (!p.name) { problems.push(`${file}:${at.line}: a roster row has no name`); continue; }
    p.id = slug(p.name);
    if (world) p.world = slug(world);
    if (section) {
      p.section = section;
      const place = section.split(":")[0].trim();
      if (place) p.place = slug(place);
    }
    if (lead) p.group = lead;
    if (p.played_by) p.kind = "adventurer";
    p.status = worldStatus || "decided"; // roster.md only holds decided characters, and DM lore
    p.source = at;
    out.push(p);
  }

  // Worlds the roster names become entities of their own.
  const worlds = new Map();
  for (const p of out) if (p.world && !worlds.has(p.world)) worlds.set(p.world, p);
  for (const [id] of worlds) {
    const h = lines.findIndex((l) => /^##\s/.test(l) && slug(splitTag(stripHeading(l)).title) === id);
    const { title, status } = splitTag(stripHeading(lines[h]));
    out.push({ id, type: "world", name: title, status: status || "decided", source: { file, line: h + 1 } });
  }

  return { entities: out, problems };
}

// ── every other document: sections ──
//
// The documents are headings with a tag, a body and "- **Key:** value"
// bullets. walkSections() turns any of them into a flat list of sections,
// each knowing its heading path, its own or inherited tag, its fields, and
// the review key the review page stamps on what it files from the chat, the
// Codex or the lore-keeper. The per-document parsers below decide what each
// section becomes.

// A heading's "(Your idea)" tag → the record's status.
const TAGS = [
  [/^your idea$/i, "decided"],
  [/^your d&d character/i, "decided"],
  [/^dm lore$/i, "dm-lore"],
  [/^pitch$/i, "pitch"],
  [/^not decided yet$/i, "open"],
  [/^rough draft$/i, "draft"],
];

function splitTag(heading) {
  const m = heading.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) for (const [re, status] of TAGS) if (re.test(m[2].trim())) return { title: m[1].trim(), status };
  return { title: heading.trim(), status: null };
}

// Where a "## From …" heading says a section came from.
const ORIGINS = [
  [/^from the codex$/i, "codex"],
  [/^from wake in verrowen$/i, "verrowen"],
  [/^from the lore-keeper$/i, "lore-keeper"],
  [/^from rest mode$/i, "rest"],
];

const fieldKey = (k) => slug(k).replace(/-/g, "_");

/** "- **Key:** value" bullets (and "  - item" lists under an empty key) → fields. */
export function fieldsOf(lines) {
  const fields = {};
  let listKey = null;
  for (const line of lines) {
    const m = line.match(/^[-*]\s+\*\*(.+?):\*\*\s*(.*)$/);
    if (m) {
      const k = fieldKey(m[1]);
      if (!k) { listKey = null; continue; }
      const v = m[2].trim();
      if (v) { fields[k] = v; listKey = null; }
      else { fields[k] = []; listKey = k; }
      continue;
    }
    const sub = line.match(/^\s{2,}[-*]\s+(.+)$/);
    if (sub && listKey) { fields[listKey].push(sub[1].trim()); continue; }
    if (line.trim()) listKey = null;
  }
  return fields;
}

/** Every heading in a document as a section, with what it inherits. */
export function walkSections(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  const stack = []; // the open headings above, by level
  let cur = null;
  let fence = false;
  const close = (end) => {
    if (!cur) return;
    const raw = lines.slice(cur.line, end);
    const keyMatch = raw.join("\n").match(/<!-- review-key: ([^>]+?) -->/);
    if (keyMatch) cur.review_key = keyMatch[1].trim();
    const body = raw.join("\n").replace(/<!--[\s\S]*?-->/g, "").trim();
    cur.body = body;
    cur.fields = fieldsOf(body.split("\n"));
    const from = body.match(/^_(From [^_]*?|Made up by [^_]*?), (\d{4}-\d{2}-\d{2})\b[^_]*_$/m);
    if (from) { cur.filed_from = from[1]; cur.filed = from[2]; }
    out.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) fence = !fence;
    const h = !fence && lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!h) continue;
    close(i);
    const level = h[1].length;
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const { title, status } = splitTag(h[2]);
    const parents = stack.map((s) => s.title);
    const inherited = [...stack].reverse().find((s) => s.status)?.status || null;
    const origin = stack.map((s) => ORIGINS.find(([re]) => re.test(s.title))?.[1]).find(Boolean) || null;
    cur = { level, title, status: status || inherited, own_status: status, parents, origin, line: i + 1 };
    stack.push({ level, title, status: status || inherited });
  }
  close(lines.length);
  return out;
}

// A record made from a section: what every kind shares.
function fromSection(s, file, extra) {
  const e = { id: "", type: "note", name: s.title, ...extra };
  if (s.status) e.status = s.status;
  if (s.parents.length > 1) e.section = s.parents.slice(1).join(" › ");
  if (s.origin) e.origin = s.origin;
  if (s.review_key) e.review_key = s.review_key;
  if (s.filed) e.filed = s.filed;
  if (s.filed_from) e.filed_from = s.filed_from;
  const { secret, ...fields } = s.fields;
  if (secret) e.secret = Array.isArray(secret) ? secret.join(" ") : secret;
  if (Object.keys(fields).length) e.fields = fields;
  e.body = s.body;
  e.source = { file, line: s.line };
  return e;
}

// Notes can share a heading (two pitches for the same place, a heading in
// both universe.md and working-notes.md); they get a numbered id instead of
// failing the build. Hand-made things (people, items, creatures) must be unique.
const SOFT = Symbol("soft-id");

/** Prose documents (universe.md, working-notes.md, midkemia.md): every section is a note.
 * Characters sent in from Wake in Verrowen also become people. */
export function proseParser({ world = null, defaultStatus = null } = {}) {
  return (text, file) => {
    const entities = [];
    const stem = file.replace(/\.md$/, "");
    for (const s of walkSections(text)) {
      if (s.level === 1) continue;
      if (!s.body && !s.own_status) continue; // a bare grouping heading
      if (ORIGINS.some(([re]) => re.test(s.title))) continue; // "## From the Codex" itself
      const status = s.status || defaultStatus || "untagged";
      const e = fromSection({ ...s, status }, file, { type: "note", doc: stem });
      if (world) e.world = world;
      e.id = stem + "-" + slug(s.title);
      e[SOFT] = true;
      entities.push(e);
      if (s.origin === "verrowen") entities.push(wakeCharacter(s, e, file));
      else if (s.origin && isItemIdea(s)) entities.push(chatItem(s, e, file));
    }
    return { entities, problems: [] };
  };
}

// "Label: value" lines, bold or not, bulleted or not, as the chat writes
// them up: "**Kind (Items & Inventions):** …", "Costs and Limits: …".
function profileOf(body) {
  const prof = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(?:[-*]\s+)?\**([A-Z][A-Za-z'&() ]{1,40}?)\**:\**\s+(.+)$/);
    if (m && !prof[fieldKey(m[1].replace(/\s*\(.*\)\s*$/, ""))]) prof[fieldKey(m[1].replace(/\s*\(.*\)\s*$/, ""))] = m[2].replace(/\*\*/g, "").trim();
  }
  return prof;
}

// An idea sent in from the chat, the Codex or auto mode that's a thing
// people make, use or trade: the lore-keeper's "Items & inventions", auto
// mode's item and peddlers' relic topics, or a write-up whose Kind says so.
// Before 2026-11-07 these were all filed in working-notes.md, so the build
// finds them there; newer ones are filed in resources.md as items already.
function isItemIdea(s) {
  const by = s.filed_from ? s.body.match(/^_[^_]*_$/m)?.[0] || "" : "";
  if (/Items & inventions|magic item or tool|peddlers' relics/i.test(by)) return true;
  const kind = profileOf(s.body).kind || "";
  return /^(?:object|item|relic|tool|weapon|artifact)(?![a-z])/i.test(kind);
}

// What a chat write-up's labels mean on an item, as resources.md names them.
const ITEM_LABELS = { what_it_is: "does", the_rule: "does", how_it_works: "made", costs_and_limits: "limits", limits: "limits", who: "made_by", where: "where", story: "story", the_details: "story", what_it_changes: "story" };

// A thing from the chat, as an item, beside the note it was filed as.
function chatItem(s, note, file) {
  const prof = profileOf(s.body);
  const name = (prof.name || s.title).replace(/\s*\([^)]*\)\s*$/, "").trim();
  // Auto mode's "peddlers' relics" topic belongs on the stall's shelf.
  const relic = /peddlers' relics/i.test(s.body.match(/^_[^_]*_$/m)?.[0] || "");
  const fields = {};
  for (const [k, v] of Object.entries({ ...prof, ...s.fields })) {
    if (k === "name" || k === "kind" || !v) continue;
    const to = ITEM_LABELS[k] || k;
    if (!fields[to]) fields[to] = v;
  }
  const e = {
    id: slug(name), type: "item", name, icon: relic ? "🏺" : "💡",
    category: relic ? "Peddlers' wares" : "Sent in from the chat",
    kind: relic ? "Relics" : { "lore-keeper": "From the lore-keeper", codex: "From the Codex", rest: "From auto mode" }[s.origin] || "Sent in",
    origin: s.origin, status: s.status || "pitch",
  };
  if (prof.kind) e.fields = { kind: prof.kind, ...fields }; else if (Object.keys(fields).length) e.fields = fields;
  if (s.review_key) e.review_key = s.review_key;
  if (s.filed) e.filed = s.filed;
  e.body = s.body;
  e.notes = [note.id];
  e.source = { file, line: s.line };
  e[SOFT] = true;
  return e;
}

// "Name: Silas Blackwood (not found out yet)" and the rest of a Wake in
// Verrowen character profile, as a person.
function wakeCharacter(s, note, file) {
  const prof = {};
  for (const line of s.body.split("\n")) {
    const m = line.match(/^\s*(?:[-*]\s+)?\**([A-Z][A-Za-z' ]{1,30}?)\**:\**\s+(.+)$/);
    if (m) prof[fieldKey(m[1])] = m[2].trim();
  }
  const name = (prof.name || s.title).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const p = { id: slug(name), type: "person", name, kind: "wake-character", origin: "verrowen" };
  if (prof.race) p.race = prof.race;
  if (prof.sex) p.sex = SEXES[prof.sex] || prof.sex.toLowerCase();
  const age = prof.age && prof.age.match(/\d+/);
  if (age) p.age = +age[0];
  for (const k of ["magic", "personality", "appearance", "skills"]) if (prof[k]) p[k] = prof[k];
  const bg = prof.background_so_far || prof.background;
  if (bg) p.line = bg;
  p.world = "verrowen";
  p.status = s.status || "pitch";
  if (s.review_key) p.review_key = s.review_key;
  if (s.filed) p.filed = s.filed;
  p.notes = [note.id];
  p.source = { file, line: s.line };
  p[SOFT] = true;
  return p;
}

/** resources.md: every #### entry is an item, sorted by its ## category and ### kind. */
export function parseResources(text, file = "resources.md") {
  const entities = [];
  for (const s of walkSections(text)) {
    if (s.level !== 4) continue;
    const { icon, name } = iconName(s.title);
    const e = fromSection(s, file, { type: "item", name });
    if (icon) e.icon = icon;
    if (s.parents[1]) e.category = s.parents[1];
    if (s.parents[2]) e.kind = s.parents[2];
    delete e.section;
    e.id = slug(name);
    entities.push(e);
  }
  return { entities, problems: [] };
}

/** bestiary.md: each ## is a place fights happen, each #### a creature found there. */
export function parseBestiary(text, file = "bestiary.md") {
  const entities = [];
  let place = null;
  for (const s of walkSections(text)) {
    if (s.level === 2) {
      const e = fromSection(s, file, { type: "place", kind: "hunting-ground" });
      const f = s.fields;
      if (f.for) e.uses = String(f.for).split(/[,;]|\band\b/).map((x) => x.trim().toLowerCase()).filter(Boolean);
      const lv = String(f.levels || "").match(/(\d+)\s*[-–]\s*(\d+)/);
      if (lv) e.levels = [+lv[1], +lv[2]];
      if (Array.isArray(f.lines)) e.lines = f.lines;
      e.id = "place-" + slug(s.title);
      place = e.id;
      entities.push(e);
    } else if (s.level === 4) {
      const { icon, name } = iconName(s.title);
      const e = fromSection(s, file, { type: "creature", name });
      if (icon) e.icon = icon;
      if (place) e.place = place;
      delete e.section;
      const stats = statsOf(s.fields.stats);
      if (stats) e.stats = stats;
      e.id = slug(name);
      entities.push(e);
    }
  }
  return { entities, problems: [] };
}

function iconName(title) {
  const m = title.match(/^(\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️]*)\s+(.+)$/u);
  return m ? { icon: m[1], name: m[2].trim() } : { icon: null, name: title };
}

/** "CR 2 · AC 13 · HP 45 · +5 to hit · 1d10+3" → numbers. */
export function statsOf(v) {
  if (!v || typeof v !== "string") return null;
  const cr = v.match(/CR\s*([\d/]+)/i), ac = v.match(/AC\s*(\d+)/i), hp = v.match(/HP\s*(\d+)/i);
  const hit = v.match(/([+-]\d+)\s*to hit/i), dmg = v.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
  if (!ac && !hp) return null;
  const out = {};
  if (cr) out.cr = cr[1];
  if (ac) out.ac = +ac[1];
  if (hp) out.hp = +hp[1];
  if (hit) out.to_hit = +hit[1];
  if (dmg) out.damage = dmg[1].replace(/\s+/g, "");
  return out;
}

/** lore.md: each "KEY: text" line the narrator reads, in order. */
export function parseLore(text, file = "lore.md") {
  const entities = [];
  const seen = {};
  text.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^([A-Z][A-Z &]+?)(?:\s*\(([^)]*)\))?:\s+(.+)$/);
    if (!m) return;
    const key = m[1].trim();
    const n = (seen[key] = (seen[key] || 0) + 1);
    entities.push({
      id: "lore-" + slug(key) + (n > 1 ? "-" + n : ""),
      type: "lore", name: key, ...(m[2] ? { about: m[2] } : {}),
      text: m[3].replace(/<!--[\s\S]*?-->/g, "").trim(), order: entities.length + 1,
      status: "decided", source: { file, line: i + 1 },
    });
  });
  return { entities, problems: [] };
}

// Which documents are compiled, and by what. Add a parser to add a document.
const PARSERS = {
  "roster.md": parseRoster,
  "resources.md": parseResources,
  "bestiary.md": parseBestiary,
  "lore.md": parseLore,
  "universe.md": proseParser({ world: "verrowen", defaultStatus: "decided" }),
  "working-notes.md": proseParser({ world: "verrowen" }),
  "midkemia.md": proseParser({ world: "midkemia", defaultStatus: "dm-lore" }),
};

// ── build ──

function git(cmd) {
  try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
  catch { return null; }
}

export function build() {
  const entities = [];
  const problems = [];
  for (const [file, parse] of Object.entries(PARSERS)) {
    const r = parse(readFileSync(join(ROOT, file), "utf8"), file);
    entities.push(...r.entities);
    problems.push(...r.problems);
  }

  // Hand-made things claim their ids first; notes and characters filed from
  // the chat take a numbered id when theirs is taken.
  const seen = new Map();
  for (const e of entities.filter((x) => !x[SOFT])) {
    const before = seen.get(e.id);
    if (before) problems.push(`two things share the id "${e.id}": ${before.source.file}:${before.source.line} and ${e.source.file}:${e.source.line}. Give one a different name.`);
    else seen.set(e.id, e);
  }
  const merged = new Set();
  for (const e of entities.filter((x) => x[SOFT])) {
    // A character from Wake in Verrowen who's since been written into the
    // roster is the same person: the roster's record gets the story note.
    const same = seen.get(e.id);
    // Likewise an item from the chat that's since been written into
    // resources.md: the resources.md entry gets the note.
    if (((e.kind === "wake-character" && same?.type === "person") || (e.type === "item" && same?.type === "item")) && same && !same[SOFT]) {
      same.notes = [...(same.notes || []), ...e.notes];
      merged.add(e);
      continue;
    }
    let id = e.id, n = 1;
    while (seen.has(id)) id = `${e.id}-${++n}`;
    if (id !== e.id) {
      for (const p of entities) if (Array.isArray(p.notes)) p.notes = p.notes.map((x) => (x === e.id && p.source.line === e.source.line ? id : x));
      e.id = id;
    }
    seen.set(e.id, e);
  }
  for (let i = entities.length - 1; i >= 0; i--) if (merged.has(entities[i])) entities.splice(i, 1);
  linkMentions(entities);

  const counts = {};
  for (const e of entities) counts[e.type] = (counts[e.type] || 0) + 1;

  const meta = {
    schema: SCHEMA,
    built: new Date().toISOString(),
    branch: process.env.GITHUB_REF_NAME || git("rev-parse --abbrev-ref HEAD"),
    commit: process.env.GITHUB_SHA || git("rev-parse HEAD"),
    counts,
  };
  return { meta, entities, problems };
}

// Which people, items, creatures and places each note talks about, and back:
// so any app can gather everything written about one thing.
function linkMentions(entities) {
  // An all-lowercase handle ("nobody") would match the everyday word, so only
  // names with a capital letter, a digit or an underscore are looked for.
  const named = entities.filter((e) => ["person", "item", "creature", "place"].includes(e.type) && !e[SOFT] && e.name && /[A-Z0-9_]/.test(e.name));
  const pats = named.map((e) => {
    const esc = e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]");
    // "Hearthstone" also finds "Hearthstones" and "Hearthstone's".
    return [e, new RegExp(`(^|[^\\p{L}])${esc}(?:e?s)?(?=$|[^\\p{L}])`, "u")]; // case matters: "Kettle" the peddler, not a kettle
  });
  for (const n of entities) {
    if (n.type !== "note" && n.type !== "lore") continue;
    const text = `${n.name}\n${n.body || n.text || ""}`;
    const hit = pats.filter(([e, re]) => e.name.length >= 4 && re.test(text)).map(([e]) => e);
    if (!hit.length) continue;
    n.mentions = hit.map((e) => e.id);
    for (const e of hit) (e.mentioned_in ||= []).push(n.id);
  }
}

const plural = (t) => ({ person: "people", lore: "lore" })[t] || t + "s";
const withoutSecrets = (e) => { const { secret, ...rest } = e; return rest; };

function main(argv) {
  const check = argv.includes("--check");
  const outAt = argv.indexOf("--out");
  const out = resolve(ROOT, outAt >= 0 ? argv[outAt + 1] : "dist");

  const { meta, entities, problems } = build();
  for (const p of problems) console.error("✗ " + p);
  if (problems.length) process.exit(1);

  const summary = Object.entries(meta.counts).map(([t, n]) => `${n} ${n === 1 ? t : plural(t)}`).join(", ");
  if (check) { console.log(`✔ The Orrery parses cleanly: ${summary}.`); return; }

  mkdirSync(out, { recursive: true });
  const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data, null, 2) + "\n");
  const pub = entities.map(withoutSecrets);
  write("entities.json", { ...meta, entities });
  write("entities.public.json", { ...meta, entities: pub });
  for (const type of Object.keys(meta.counts)) {
    write(`${plural(type)}.json`, { ...meta, entities: pub.filter((e) => e.type === type) });
  }
  console.log(`✔ Built the Orrery into ${out}: ${summary}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
