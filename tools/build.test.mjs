// node --test tools/
import test from "node:test";
import assert from "node:assert/strict";
import { walkSections, parseBestiary, parseResources, parseLore, statsOf, build } from "./build.mjs";

test("sections inherit their tag and know where the chat filed them", () => {
  const md = [
    "# Notes", "", "## From Wake in Verrowen", "", "Intro.", "",
    "### Silas Blackwood (Your idea)", "", "<!-- review-key: verrowen:abc -->",
    "_From a Wake in Verrowen story, 2026-11-08 · Story._", "", "- **Where:** Stoutwell", "",
    "### A pitch (Pitch)", "", "Body.",
  ].join("\n");
  const s = walkSections(md);
  const silas = s.find((x) => x.title === "Silas Blackwood");
  assert.equal(silas.status, "decided");
  assert.equal(silas.origin, "verrowen");
  assert.equal(silas.review_key, "verrowen:abc");
  assert.equal(silas.filed, "2026-11-08");
  assert.deepEqual(silas.fields, { where: "Stoutwell" });
  assert.equal(s.find((x) => x.title === "A pitch").status, "pitch");
});

test("bestiary places and creatures", () => {
  const md = [
    "# B", "## The wood (Your idea)", "- **For:** hunts, raids", "- **Levels:** 1-10", "- **Lines:**", "  - One.", "  - Two.",
    "#### 🐗 Thornback boar (Your idea)", "- **Stats:** CR 2 · AC 13 · HP 45 · +5 to hit · 1d10+3",
  ].join("\n");
  const { entities } = parseBestiary(md);
  const [place, boar] = entities;
  assert.deepEqual(place.uses, ["hunts", "raids"]);
  assert.deepEqual(place.levels, [1, 10]);
  assert.deepEqual(place.lines, ["One.", "Two."]);
  assert.equal(boar.id, "thornback-boar");
  assert.equal(boar.icon, "🐗");
  assert.equal(boar.place, place.id);
  assert.deepEqual(boar.stats, { cr: "2", ac: 13, hp: 45, to_hit: 5, damage: "1d10+3" });
});

test("resources become items with their category, and secrets are kept apart", () => {
  const md = ["# R", "## Enchanted items", "### Lenses", "#### 🔍 Truthglass (Pitch)", "- **Does:** Tells real from fake.", "- **Secret:** It lies to Murrow."].join("\n");
  const [glass] = parseResources(md).entities;
  assert.equal(glass.id, "truthglass");
  assert.equal(glass.category, "Enchanted items");
  assert.equal(glass.kind, "Lenses");
  assert.equal(glass.status, "pitch");
  assert.equal(glass.secret, "It lies to Murrow.");
  assert.equal(glass.fields.secret, undefined);
});

test("lore lines keep their order and repeated keys get numbered ids", () => {
  const { entities } = parseLore("# L\n\nintro\n\nTONE: Grim.\nMAGIC: Weak.\nTONE: Grimmer.\n");
  assert.deepEqual(entities.map((e) => e.id), ["lore-tone", "lore-magic", "lore-tone-2"]);
  assert.equal(entities[2].text, "Grimmer.");
});

test("stats need at least an AC or HP", () => {
  assert.equal(statsOf("fast and mean"), null);
});

test("the real documents build with unique ids and no secrets in public", () => {
  const { entities, problems } = build();
  assert.deepEqual(problems, []);
  assert.equal(new Set(entities.map((e) => e.id)).size, entities.length);
  for (const t of ["person", "item", "creature", "place", "lore", "note"]) assert.ok(entities.some((e) => e.type === t), t);
});
