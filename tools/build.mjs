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
//   every *.md, maps/ document (one each, with its title, file and line
//                     for the Explorer) and map (one per maps/*.png, with
//                     its title and caption), so the Explorer lists what the
//                     Orrery has instead of a list of its own
//   universe.md, working-notes.md, midkemia.md
//                     note: every section, with its status from its tag.
//                     What the review page files from the chat, the Codex or
//                     the lore-keeper carries origin and review_key, and a
//                     Wake in Verrowen character also becomes a person.
//                     A write-up from the chat or auto mode also becomes
//                     the item, creature, place or person it describes; a
//                     creature is put in a hunting ground and given a stat
//                     line if it has none, so GuildScribe can hunt it.
// Every record has id, type, name, status (decided, pitch, open, dm-lore,
// draft, untagged) and source. Notes list the people, items, creatures and
// places they mention, and those list mentioned_in back.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
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
  [/^from claude$/i, "claude"],
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
      else if (s.origin) entities.push(...chatThings(s, e, file));
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
    kind: relic ? "Relics" : { "lore-keeper": "From the lore-keeper", claude: "From Cl" + "aude", codex: "From the Codex", rest: "From auto mode" }[s.origin] || "Sent in",
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

// ── creatures, places and people sent in from the chat ──
//
// Accepting a lore-keeper or auto mode write-up only changes its tag in
// working-notes.md, so the build turns the write-up itself into the thing it
// describes: a creature (which GuildScribe hunts once it's decided), a place
// or a person. One write-up can hold several, split by "---" lines, each
// with its own "Name:". Anything that isn't clearly one of these stays a note.

// A write-up's parts: the text between "---" lines that names something.
function blocksOf(body) {
  const parts = body.split(/^\s*-{3,}\s*$/m).map((b) => b.trim()).filter(Boolean);
  const named = parts.filter((b, i) => i === 0 || profileOf(b).name);
  return named.length ? named : [body];
}

// "**Xan**" on a line of its own names a character write-up that has no "Name:".
const loneBold = (b) => (b.match(/^\s*\*\*([^*:]{2,60})\*\*\s*$/m) || [])[1];
const cleanName = (n) => String(n).replace(/\*\*/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
// The topic the review page stamped: "_From a lore-keeper chat, 2026-11-08 · Physics & nature._"
const topicOf = (body) => body.match(/^_[^_]*_$/m)?.[0] || "";

const LIVING = /\b(creature|beast|monster|animal|predator|spirit|wraith|undead|plant|fungus|fungi|insect|vermin|serpent|bird|grub|swarm)s?\b/i;
const FIGHTS = /\b(attack|prey|predator|hunts?|ambush|grapple|bite|claws?|jaws?|saving throw|saves?|DC\s*\d+|damage|venom|ensnare|stalk|spores?)/i;
// What the thing itself is, in its first words: "A spectral hound…", not "A stone owl statue…".
const BEING = /\b(creature|predator|beast|monster|animal|hound|wolf|serpent|snake|spirit|wraith|wyrm|bird|owl|hawk|insect|spider|grub|worm|fungus|plant)s?\b/i;
const NOT_BEING = /\b(statue|carving|bell|device|tool|system|ritual|custom|woman|man|halfling|human|elf|dwarf|watcher|guard|post|tower|stone|charm)\b/i;

/** Which kind of thing a write-up's part is: "creature", "place", "person" or null. */
export function ideaKind(block, topic = "") {
  const prof = profileOf(block);
  const kindLabel = (block.match(/^\W*Kind\s*\(([^)]*)\)/im) || [])[1] || "";
  const kind = `${kindLabel} ${prof.kind || ""}`;
  if (LIVING.test(kind) && FIGHTS.test(block)) return "creature";
  // Auto mode's creature topic doesn't always get a creature back, so the
  // write-up has to say it is one.
  if (/about a creature\b/i.test(topic)) {
    const says = [prof.what_it_is, prof.label, (block.match(/^\s*[-*]\s+(.+)$/m) || [])[1]].filter(Boolean).map((t) => String(t).replace(/\*\*/g, ""));
    if (says.some((t) => BEING.test(t.slice(0, 80)) && !NOT_BEING.test(t.slice(0, 40)))) return "creature";
    return null;
  }
  if (/^\s*regions?\s*(?:&|and)\s*places/i.test(kindLabel) || /^\s*regions?\s*(?:&|and)\s*places/i.test(prof.kind || "")) return "place";
  // An office, guild or other body of people is a place too: where it sits and what it does.
  if (/^\s*(?:an?\s+|the\s+)?(?:\w+\s+){0,2}(office|court|guild|order|institution|council|ministry|chancery|bureau)\b/i.test(prof.kind || "")) return "institution";
  if (prof.race && (prof.role || prof.lives_in || prof.personality)) return "person";
  return null;
}

function chatThings(s, note, file) {
  const topic = topicOf(s.body);
  const out = [];
  for (const block of blocksOf(s.body)) {
    const kind = ideaKind(block, topic);
    if (!kind) continue;
    const prof = profileOf(block);
    // 'What it is: A "Silken Stalker," a small…' names the creature itself.
    const quoted = kind === "creature" && !prof.name && (String(prof.what_it_is || "").match(/^\W*(?:an?|the)?\s*["“]([^"”]{2,40}?)[,.]?["”]/i) || [])[1];
    const name = cleanName(prof.name || quoted || loneBold(block) || s.title);
    if (!name || name.length > 60) continue;
    const base = { name, origin: s.origin, status: s.status || "pitch", world: "verrowen" };
    if (s.review_key) base.review_key = s.review_key;
    if (s.filed) base.filed = s.filed;
    base.body = block;
    base.notes = [note.id];
    base.source = { file, line: s.line };
    let e;
    if (kind === "creature") {
      const fields = {};
      const does = prof.the_rule || prof.what_it_is || prof.label || prof.how_it_works;
      if (does) fields.does = does;
      const limits = prof.costs_and_limits || prof.costs_limits || prof.limits;
      if (limits) fields.limits = limits;
      if (prof.what_it_changes) fields.story = prof.what_it_changes;
      if (prof.where) fields.where = prof.where;
      if (prof.kind) fields.kind = prof.kind;
      const stats = (s.fields.stats && blocksOf(s.body).length === 1 ? s.fields.stats : prof.stats) || "";
      if (stats) fields.stats = String(stats).replace(/`/g, "");
      e = { id: slug(name), type: "creature", ...base, icon: creatureIcon(`${name} ${prof.kind || ""}`, `${prof.what_it_is || prof.label || ""} ${block}`), fields };
    } else if (kind === "place" || kind === "institution") {
      const fields = {};
      const kindText = (prof.kind || "").replace(/^\s*regions?\s*(?:&|and)\s*places\s*[-–—:]?\s*/i, "");
      const where = prof.where || (kind === "place" ? kindText : "");
      if (where) fields.where = where;
      if (prof.the_rule || prof.what_it_is) fields.what = prof.the_rule || prof.what_it_is;
      if (kind === "institution" && prof.kind) fields.kind = prof.kind;
      if (prof.how_it_works) fields.how = prof.how_it_works;
      if (prof.costs_and_limits || prof.costs_limits) fields.limits = prof.costs_and_limits || prof.costs_limits;
      if (prof.who_it_affects) fields.who = prof.who_it_affects;
      if (prof.ties) fields.ties = prof.ties;
      if (prof.still_open) fields.still_open = prof.still_open;
      e = { id: "place-" + slug(name), type: "place", kind: kind === "institution" ? "institution" : "region", ...base, fields };
    } else {
      const p = { id: slug(name), type: "person", ...base, kind: "chat-character" };
      if (prof.race) p.race = prof.race;
      if (prof.sex) p.sex = SEXES[prof.sex] || prof.sex.toLowerCase();
      const age = prof.age && prof.age.match(/\d+/);
      if (age) p.age = +age[0];
      if (prof.role) p.role = prof.role;
      if (prof.lives_in) p.where = prof.lives_in;
      for (const k of ["magic", "personality", "appearance"]) if (prof[k]) p[k] = prof[k];
      if (prof.secret) p.secret = prof.secret;
      // Group them the way the roster does, by where they live.
      const lives = prof.lives_in || "";
      p.section = /stoutwell/i.test(lives) ? "Stoutwell" : /capital|kingdom/i.test(lives) ? "The Kingdom" : "Elsewhere in Verrowen";
      e = p;
    }
    e[SOFT] = true;
    out.push(e);
  }
  return out;
}

// The icon by what the name and kind say first, then by the rest of the write-up.
function creatureIcon(first, rest = "") {
  const icons = [[/shroom|fung|spore|mold|mould/i, "🍄"], [/root|vine|thorn|bramble|plant|tree/i, "🌿"], [/grub|worm|larva|burrow/i, "🪱"],
    [/wraith|spirit|ghost|spectral|shade/i, "👻"], [/serpent|snake|stalker|wyrm/i, "🐍"], [/spider/i, "🕷️"], [/bird|owl|hawk|raven|crow|wing/i, "🦅"],
    [/wolf|hound|dog/i, "🐺"], [/bear/i, "🐻"], [/boar|pig/i, "🐗"], [/fish|eel|shark|marine|sea\b/i, "🐟"], [/rat|vermin/i, "🐀"], [/insect|beetle|swarm|bee/i, "🪲"]];
  for (const t of [first, rest]) { const hit = icons.find(([re]) => re.test(t)); if (hit) return hit[1]; }
  return "🐾";
}

// ── stat lines for creatures written without one ──

// What a creature of each challenge rating has, close to the bestiary's own
// hand-written lines: [CR, AC, HP, to hit, damage].
const CR_TABLE = [
  ["1/8", 12, 9, 3, "1d4+1"], ["1/4", 12, 13, 3, "1d6+1"], ["1/2", 13, 18, 4, "1d6+2"], ["1", 13, 28, 4, "1d8+2"],
  ["2", 13, 45, 5, "1d10+3"], ["3", 13, 60, 5, "2d6+3"], ["4", 14, 80, 6, "2d8+3"], ["5", 15, 95, 7, "2d8+4"],
  ["6", 15, 110, 7, "2d10+4"], ["7", 15, 125, 7, "2d10+5"], ["8", 16, 140, 8, "2d12+5"], ["9", 16, 155, 8, "2d12+6"],
  ["10", 17, 170, 9, "3d10+5"], ["11", 17, 185, 9, "3d10+6"], ["12", 17, 200, 9, "3d12+6"], ["13", 18, 215, 10, "3d12+7"],
  ["14", 18, 230, 10, "4d10+7"], ["15", 18, 245, 11, "4d10+8"], ["16", 18, 260, 11, "4d12+8"], ["17", 19, 280, 12, "4d12+9"],
  ["18", 19, 300, 12, "5d10+9"], ["19", 19, 320, 12, "5d10+10"], ["20", 19, 340, 13, "5d12+10"],
];
const crValue = (cr) => (String(cr).includes("/") ? 1 / +String(cr).split("/")[1] : +cr);
const crIndex = (v) => CR_TABLE.reduce((best, row, i) => (Math.abs(crValue(row[0]) - v) < Math.abs(crValue(CR_TABLE[best][0]) - v) ? i : best), 0);

// How dangerous a write-up makes a creature sound: steps up or down from CR 2.
function threatOf(text) {
  let steps = 0;
  if (/\b(tiny|small|little|minor|weak|cluster|clusters|grubs?|swarm of tiny)\b/i.test(text)) steps -= 1;
  if (/\b(large|powerful|armou?red|pack|packs|fierce|aggressive)\b/i.test(text)) steps += 1;
  if (/\b(huge|giant|massive|colossal|ancient|deadly|terrifying)\b/i.test(text)) steps += 2;
  if (/\b(legendary|titanic|world-ending)\b/i.test(text)) steps += 4;
  return steps;
}

/** A stat line for a creature that has none: "CR 2 · AC 13 · HP 45 · +5 to hit · 1d10+3".
 * The same write-up always gets the same line. A "CR n" in the write-up is kept. */
export function makeStatLine(text, band = null) {
  const said = text.match(/\bCR\s*(\d+(?:\/\d+)?)\b/i);
  let v = said ? crValue(said[1]) : crValue(CR_TABLE[Math.max(0, Math.min(CR_TABLE.length - 1, crIndex(2) + threatOf(text)))][0]);
  if (!said && band) v = Math.min(Math.max(v, band[0]), band[1]);
  const [cr, ac0, hp0, hit, dmg] = CR_TABLE[crIndex(v)];
  let ac = ac0, hp = hp0;
  if (/\b(armou?r(ed)?|shell|plated|stone|bark|scales?)\b/i.test(text)) ac += 1;
  if (/\b(fragile|frail|swarm)\b/i.test(text)) hp = Math.round(hp * 0.8);
  return `CR ${cr} · AC ${ac} · HP ${hp} · +${hit} to hit · ${dmg}`;
}

// The challenge ratings a hunting ground's levels suit, from the bestiary's own pairings.
const bandOf = (levels) => (levels ? [Math.max(1 / 8, levels[0] / 3), Math.max(1, levels[1] / 1.3)] : null);

const STOP = new Set(["the", "and", "edge", "western", "eastern", "northern", "southern", "lands", "land", "kingdoms", "kingdom"]);
// The words a hunting ground goes by: "The Monster Wood's western edge" → monster, wood.
const groundWords = (p) => `${p.name} ${p.fields?.also_called || ""}`.toLowerCase().replace(/['’]s\b/g, "").split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/s$/, ""));

/** Puts every creature from the chat in a decided hunting ground, and gives
 * it a stat line if it has none, so GuildScribe can hunt it. */
export function placeCreatures(entities) {
  const grounds = entities.filter((e) => e.type === "place" && e.kind === "hunting-ground" && (e.status === "decided" || e.status === "dm-lore") && (e.uses || []).includes("hunts"));
  if (!grounds.length) return;
  for (const c of entities) {
    if (c.type !== "creature" || !c[SOFT]) continue;
    const text = `${c.name}\n${c.body || ""}`;
    const low = text.toLowerCase();
    let best = null, bestScore = 0;
    for (const g of grounds) {
      let score = groundWords(g).filter((w) => new RegExp(`\\b${w}`, "i").test(low)).length;
      if (/\bdeep(est)?\b/i.test(low) && /deep/i.test(g.name)) score += 2;
      if (score > bestScore) { best = g; bestScore = score; }
    }
    // Nothing named: the Monster Wood is where Verrowen's monsters come from.
    if (!best) best = grounds.find((g) => /monster wood/i.test(g.name)) || grounds[0];
    if (!c.place) c.place = best.id;
    c.fields = c.fields || {};
    if (!c.fields.stats) {
      c.fields.stats = makeStatLine(text, bandOf(best.levels));
      c.stats_made = true; // made by the build, not written by hand
    }
    const stats = statsOf(c.fields.stats);
    if (stats) c.stats = stats;
  }
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


// ── the catalog: documents and maps ──
//
// Every Markdown document in the repo (top level and maps/) and every map
// picture is a record too, so the Explorer (and anything else) lists what
// the Orrery actually has. A new document or map shows up on its own.
// orrery.json (written by the review page's New document and New map) can
// give a document's one line or a map's title and caption.

// The order the Explorer shows the documents in, and their one lines; any
// other document follows, then the README and the maps notes.
const DOC_ORDER = ["universe.md", "working-notes.md", "lore.md", "roster.md", "resources.md", "bestiary.md", "midkemia.md", "rifts.md"];
const DOC_LAST = ["README.md", "maps/README.md"];
const DOC_SUB = {
  "universe.md": "The universe draft · decided",
  "working-notes.md": "Working notes · tagged per section",
  "lore.md": "What Wake in Verrowen and the bots' AI read",
  "roster.md": "Everyone decided, at a glance",
  "resources.md": "Items and resources by category and type",
  "bestiary.md": "Where GuildScribe's adventurers hunt and duel, and what lives there · the bots read it",
  "midkemia.md": "Rose's D&D campaign · DM lore",
  "rifts.md": "The worlds the rifts reach, and where to play or follow each",
  "README.md": "About the Orrery · where everything shows up",
  "maps/README.md": "maps/README.md",
};
const DOC_TITLE = { "working-notes.md": "Village Hero", "universe.md": "Stoutwell & Beyond", "lore.md": "Narrator lore", "roster.md": "Character Roster", "README.md": "About the Orrery", "maps/README.md": "Maps notes" };
const MAP_TITLE = { region: "The region", lake: "The lake", stoutwell: "Stoutwell", capital: "The Kingdom's capital" };

function readJson(file) {
  try { return JSON.parse(readFileSync(join(ROOT, file), "utf8")); } catch { return null; }
}
/** Every document and map in the repo as records. */
export function catalog(root = ROOT) {
  const out = [];
  const extra = readJson("orrery.json") || {};
  const extraDoc = new Map((Array.isArray(extra.documents) ? extra.documents : []).filter((d) => d && d.file).map((d) => [d.file, d]));
  const extraMap = new Map((Array.isArray(extra.maps) ? extra.maps : []).filter((m) => m && m.file).map((m) => [m.file, m]));
  const files = [
    ...readdirSync(root).filter((f) => /\.md$/i.test(f)),
    ...(existsSync(join(root, "maps")) ? readdirSync(join(root, "maps")).filter((f) => /\.md$/i.test(f)).map((f) => "maps/" + f) : []),
  ];
  const rank = (f) => { const a = DOC_ORDER.indexOf(f), z = DOC_LAST.indexOf(f); return a >= 0 ? a : z >= 0 ? 1000 + z : 500; };
  files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  files.forEach((file, i) => {
    const text = readFileSync(join(root, file), "utf8");
    const h1 = (text.match(/^#\s+(.+)$/m) || [])[1];
    const title = DOC_TITLE[file] || String(extraDoc.get(file)?.title || h1 || file).replace(/[*_`]/g, "").trim();
    // Its one line: given, or the first sentence of its opening paragraph.
    const intro = text.replace(/<!--[\s\S]*?-->/g, "").split(/\n\s*\n/).map((p) => p.trim())
      .find((p) => p && !/^#/.test(p) && !/^\d{4}-\d\d-\d\d/.test(p) && !/^[|>-]/.test(p)) || "";
    const first = (intro.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`]/g, "").match(/^.*?[.!?](\s|$)/) || [intro])[0].trim();
    const id = "doc-" + slug(file.replace(/\.md$/i, "").replace("/", "-"));
    out.push({ id, type: "document", name: title, file, sub: String(extraDoc.get(file)?.sub || DOC_SUB[file] || first).slice(0, 200), order: i + 1, status: "decided", source: { file, line: 1 } });
  });
  // Maps: every picture in maps/, captioned by maps/README.md's bullet for it.
  const notes = existsSync(join(root, "maps/README.md")) ? readFileSync(join(root, "maps/README.md"), "utf8") : "";
  const pics = existsSync(join(root, "maps")) ? readdirSync(join(root, "maps")).filter((f) => /\.png$/i.test(f)) : [];
  const mrank = (f) => { const k = Object.keys(MAP_TITLE).indexOf(f.replace(/\.png$/i, "")); return k >= 0 ? k : 100; };
  pics.sort((a, b) => mrank(a) - mrank(b) || a.localeCompare(b)).forEach((f, i) => {
    const file = "maps/" + f, stem = f.replace(/\.png$/i, "");
    const given = extraMap.get(file) || {};
    const bullet = (notes.match(new RegExp("^- `" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\.png`:\\s*(.+)$", "m")) || [])[1] || "";
    const caption = String(given.caption || bullet.replace(/`[^`]+\.svg` is its editable source\.?/, "").replace(/[`*_]/g, "").trim()).replace(/^./, (c) => c.toUpperCase()).slice(0, 600);
    const name = String(given.title || MAP_TITLE[stem] || stem.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase())).slice(0, 80);
    out.push({ id: "map-" + slug(stem), type: "map", name, file, svg: existsSync(join(root, "maps", stem + ".svg")) ? `maps/${stem}.svg` : null, caption, order: i + 1, status: "decided", source: { file: "maps/README.md", line: 1 } });
  });
  return out;
}

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
  placeCreatures(entities);
  entities.push(...catalog());

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
    // resources.md: the resources.md entry gets the note. The same goes for a
    // creature, place or character from the chat that's since been written
    // into the bestiary or the roster.
    if (((["wake-character", "chat-character"].includes(e.kind) && same?.type === "person") || (["item", "creature", "place"].includes(e.type) && same?.type === e.type)) && same && !same[SOFT]) {
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
  joinChatNotes(entities);
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

// A write-up from the chat about something already written into the canon by
// hand ("Ash wood from the Ashen Reach" → the Ash wood in resources.md) joins
// that record as one of its notes, instead of standing on its own.
export function joinChatNotes(entities) {
  const promoted = new Set(entities.filter((e) => e.type !== "note").flatMap((e) => e.notes || []));
  const canon = entities.filter((e) => ["person", "item", "creature", "place"].includes(e.type) && !e[SOFT] && e.name && e.name.length >= 4)
    .sort((a, b) => b.name.length - a.name.length);
  const key = (n) => n.toLowerCase().replace(/^the\s+/, "").replace(/[’']/g, "'");
  for (const n of entities) {
    if (n.type !== "note" || !n.origin || promoted.has(n.id)) continue;
    const t = key(n.name);
    const hit = canon.find((e) => { const k = key(e.name); return t === k || t.startsWith(k + " "); });
    if (!hit) continue;
    hit.notes = [...new Set([...(hit.notes || []), n.id])];
    n.belongs_to = hit.id;
  }
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
