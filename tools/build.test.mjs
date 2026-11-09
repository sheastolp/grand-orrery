// node --test tools/
import test from "node:test";
import assert from "node:assert/strict";
import { walkSections, parseBestiary, parseResources, parseLore, statsOf, build, proseParser, ideaKind, makeStatLine, placeCreatures, joinChatNotes, catalog } from "./build.mjs";

test("an item idea sent in from the chat is an item too, beside its note", () => {
  const md = [
    "# Notes", "## From the lore-keeper", "",
    "### Reinforced Gatehouse Beams (Your idea)", "", "<!-- review-key: lore-keeper:abc -->",
    "_From a lore-keeper chat, 2026-11-08 · Items & inventions._", "",
    "**Name:** Reinforced Gatehouse Beams", "", "**The Rule:** Iron-banded oak beams.", "", "**Costs and Limits:** Slow to make.", "",
    "### A place (Your idea)", "", "_From a lore-keeper chat, 2026-11-08 · Regions & places._", "", "Name: Somewhere",
    "## From rest mode", "",
    "### Murrow's Offering (Pitch)", "", "_Made up by the AI in auto mode, 2026-11-08 · about one of the market peddlers' relics and the story they tell about it._", "",
    "- **What it is:** A carved raven.",
  ].join("\n");
  const { entities } = proseParser({ world: "verrowen" })(md, "working-notes.md");
  const items = entities.filter((e) => e.type === "item");
  assert.deepEqual(items.map((e) => [e.id, e.status, e.category, e.kind]), [
    ["reinforced-gatehouse-beams", "decided", "Sent in from the chat", "From the lore-keeper"],
    ["murrows-offering", "pitch", "Peddlers' wares", "Relics"],
  ]);
  assert.equal(items[0].fields.does, "Iron-banded oak beams.");
  assert.equal(items[0].fields.limits, "Slow to make.");
  assert.equal(items[0].review_key, "lore-keeper:abc");
  assert.deepEqual(items[0].notes, ["working-notes-reinforced-gatehouse-beams"]);
  assert.equal(items[1].fields.does, "A carved raven.");
});

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

test("an accepted creature from the chat becomes a huntable creature, one per Name", () => {
  const md = [
    "# W", "## From the lore-keeper",
    "### Rootwraiths (Your idea)", "<!-- review-key: lore-keeper:abc -->",
    "_From a lore-keeper chat, 2026-11-08 · Physics & nature._", "",
    "Name: Rootwraiths", "Kind: Plant/Spirit (Entanglement)", "The Rule: Roots that grapple prey.", "",
    "---", "", "Name: Gloomshrooms", "Kind: Fungus/Psychic", "How It Works: Spores need a DC12 Wisdom save.",
  ].join("\n");
  const notes = proseParser({ world: "verrowen" })(md, "working-notes.md").entities;
  const beasts = parseBestiary(["# B", "## The Monster Wood's western edge (Your idea)", "- **For:** hunts", "- **Levels:** 1-10"].join("\n")).entities;
  const all = [...beasts, ...notes];
  placeCreatures(all);
  const made = all.filter((e) => e.type === "creature");
  assert.deepEqual(made.map((e) => e.name), ["Rootwraiths", "Gloomshrooms"]);
  for (const c of made) {
    assert.equal(c.status, "decided");
    assert.equal(c.place, "place-the-monster-woods-western-edge");
    assert.ok(c.stats && c.stats.ac && c.stats.hp, c.name + " has stats");
    assert.equal(c.stats_made, true);
    assert.deepEqual(c.notes, ["working-notes-rootwraiths"]);
  }
});

test("a stat line written in the write-up is kept, and a made one is stable", () => {
  assert.equal(makeStatLine("A small grub."), makeStatLine("A small grub."));
  assert.match(makeStatLine("Ancient, huge and deadly."), /^CR \d+ · AC \d+ · HP \d+ · \+\d+ to hit · \d+d\d+\+\d+$/);
  assert.match(makeStatLine("A beast. CR 7."), /^CR 7 /);
  assert.deepEqual(statsOf(makeStatLine("A beast")), { cr: "2", ac: 13, hp: 45, to_hit: 5, damage: "1d10+3" });
});

test("auto mode's creature topic needs the write-up to describe a creature", () => {
  const topic = "_Made up by the AI in auto mode, 2026-11-08 · about a creature of the Monster Wood._";
  assert.equal(ideaKind("- **What it is:** A spectral hound that stalks the wood's edge.", topic), "creature");
  assert.equal(ideaKind("- **What it is:** A stone owl statue that watches for creatures.", topic), null);
  assert.equal(ideaKind("- A lone halfling woman keeps watch.", topic), null);
  assert.equal(ideaKind("**Kind:** Regions & Places - A damp wood.", ""), "place");
  assert.equal(ideaKind("Name: Marda\nRace: Human\nRole: Peddler", ""), "person");

});

test("an accepted office becomes a canon record, and a write-up about a canon thing joins it", () => {
  assert.equal(ideaKind("- **Kind:** An office of the Kingdom's court.", ""), "institution");
  const { entities } = build();
  const highwrit = entities.find((e) => e.id === "place-highwrit");
  assert.equal(highwrit?.kind, "institution");
  assert.equal(highwrit?.status, "decided");
  const ash = entities.find((e) => e.id === "ash-wood");
  assert.ok(ash.notes.includes("working-notes-ash-wood-from-the-ashen-reach"));
  assert.equal(entities.find((e) => e.id === "working-notes-ash-wood-from-the-ashen-reach").belongs_to, "ash-wood");
});

test("every document and map is in the catalog, in the Explorer's order", () => {
  const c = catalog();
  const docs = c.filter((e) => e.type === "document"), maps = c.filter((e) => e.type === "map");
  assert.equal(docs[0].file, "universe.md");
  assert.equal(docs.at(-1).file, "maps/README.md");
  assert.ok(docs.every((d) => d.name && d.sub && d.id.startsWith("doc-")));
  assert.ok(maps.some((m) => m.file === "maps/region.png" && m.name === "The region" && /^Verrowen around Stoutwell/.test(m.caption) && !/editable source/.test(m.caption)));
});
