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
// Pilot: only roster.md (people, and roles nobody fills yet) is compiled so
// far. Each document gets its own parser in PARSERS below; places, creatures,
// items, factions and the rest join the same way.

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
  let header = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = { file, line: i + 1 };

    if (/^##\s/.test(line)) {
      const h = stripHeading(line);
      world = /still to fill/i.test(h) ? null : h;
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
    p.status = "decided"; // roster.md only holds decided characters
    p.source = at;
    out.push(p);
  }

  // Worlds the roster names become entities of their own.
  const worlds = new Map();
  for (const p of out) if (p.world && !worlds.has(p.world)) worlds.set(p.world, p);
  for (const [id] of worlds) {
    const h = lines.findIndex((l) => /^##\s/.test(l) && slug(stripHeading(l)) === id);
    out.push({ id, type: "world", name: stripHeading(lines[h]), status: "decided", source: { file, line: h + 1 } });
  }

  return { entities: out, problems };
}

// Which documents are compiled, and by what. Add a parser to add a document.
const PARSERS = {
  "roster.md": parseRoster,
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

  const seen = new Map();
  for (const e of entities) {
    const before = seen.get(e.id);
    if (before) problems.push(`two things share the id "${e.id}": ${before.source.file}:${before.source.line} and ${e.source.file}:${e.source.line}. Give one a different name.`);
    else seen.set(e.id, e);
  }

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

const plural = (t) => ({ person: "people" })[t] || t + "s";
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
