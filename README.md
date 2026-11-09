# The Grand Orrery

A medieval fantasy universe by Sheamus. Most of it so far takes place on **Verrowen**, a world of weak, everyday magic, D&D-style monsters and a far-off corrupt Kingdom, centered on the walled village of **Stoutwell**.

**The Orrery is the database everything runs off.** It's the universe for every Tavernworks project: all the bots (GuildScribe on Twitch and Discord, The Wandering Clerk, UndercoverBurn), the Tavernworks site and its Orrery Explorer, Wake in Verrowen, and the AI chats (the lore-keeper, the narrator and the bots' AI replies). Every one of them reads it from here, and changes only ever flow outward: change a name, a line, a creature, a document or a map here and they all follow on their own. Nothing in another project is changed first and copied back. See [Who reads from here](#who-reads-from-here).

Every change waits on the `review` branch first. On the [review page](https://tavernworks.dev/orrery/control/review/) the owner **approves** what's waiting, **views** it in the Review Clone, and **publishes** it to `main`. Auto mode (the laptop's AI) can write ideas and give its view on each one, but it never publishes.

It's built so any place, person or idea can be lifted out and used on its own: in a D&D campaign, a story or a book. It's a work in progress, and names and details may still change.

**Browse it:** the [Orrery Explorer](https://tavernworks.dev/orrery/) shows the maps, every document and the full roster, and gathers everything written about any one person.

**Play in it:** [Wake in Verrowen](https://tavernworks.dev/verrowen/) on Tavernworks. You wake with no memory somewhere in Verrowen, and an AI narrator reveals who you are through your choices.

## What's here

| File | What it is | How settled |
| --- | --- | --- |
| [`universe.md`](universe.md) | **Stoutwell & Beyond.** The universe draft: magic, Stoutwell, its people, the Monster Wood, the Kingdom and its guild hall GuildScribe (with its Scribe, the market peddlers and the Wandering Clerk), and characters from other worlds. | Decided |
| [`working-notes.md`](working-notes.md) | **Village Hero.** The full working notes behind the draft, including ideas still being weighed. | Mixed, marked per section |
| [`midkemia.md`](midkemia.md) | **World of Midkemia.** The world of Rose's homebrew D&D campaign that Arandur plays in: the quest for the missing queen, its places and gods, the linked world Aetherwyn, and the party. | DM lore |
| [`roster.md`](roster.md) | **Character Roster.** Everyone decided, at a glance: race, role, one line and secret. GuildScribe, the Wandering Clerk and UndercoverBurn read it live (names and lines, never the Secret column). | Decided only |
| [`resources.md`](resources.md) | **Resources.** Every item and resource, sorted by category and then type: enchanted items, materials, tools, weapons and armor, food and drink, coin. The Explorer's Items and Resources tabs read it live. | Marked per entry |
| [`bestiary.md`](bestiary.md) | **GuildScribe's Bestiary.** Where GuildScribe's adventurers hunt, duel and get robbed in Verrowen (the arena, the market, the roads, the Monster Wood, the deep woods), the lines the bots post there, and Verrowen's own creatures with stat lines. The GuildScribe bots read it live from `main`: only sections marked **(Your idea)** reach them. Creatures accepted from the lore-keeper or auto mode join them too: the build puts each in a hunting ground and makes a stat line for any that has none (add a `Stats:` line to the write-up to set your own). | Marked per section |
| [`rifts.md`](rifts.md) | **Through the Rifts.** The worlds on the other side of the rifts (Midkemia so far) and their links: the campaign, its Discord, a game. The Explorer and the lore-keeper show them. | Owner's links |
| [`lore.md`](lore.md) | The condensed lore the Wake in Verrowen narrator reads every turn. | Decided only |
| [`maps/`](maps/) | Rough maps: the region, Stoutwell, the lake and the Kingdom's capital. | Rough draft |
| [`tools/`](tools/), [`client/`](client/) | The database: the build that compiles the documents into JSON, and the client every app reads it with. See [The database](#the-database). | |

### Reading the working notes

Every section heading in `working-notes.md` carries a tag:

- **(Your idea)**: decided. It's part of the universe.
- **(Pitch)**: a suggestion to pick from, change or toss. Not canon.
- **(Not decided yet)**: an open direction.
- **(DM lore)**: comes from a D&D campaign's Dungeon Master and is only changed from there.

## Where the characters show up

Every character in the Tavernworks examples comes from this universe.

| Character | Where |
| --- | --- |
| Tobin Ashby, Doric, Osric, Hesketh Reeve, Murrow, the five Elders, Glumtom, Arandur | Chatters in the [Tavernworks](https://tavernworks.dev/) home page's GuildScribe example chat. Tobin is also in the [Sound Bytes](https://tavernworks.dev/soundbytes/) example, and Doric in [The Wandering Clerk](https://tavernworks.dev/wandering-clerk/)'s. |
| The Scribe | GuildScribe's own voice in chat: the replies, the grumbles when tagged, and the fine for `!rob @GuildScribeBot`. Her roster line goes into her replies. |
| The peddlers (Tansy Ninefingers and the rest) | GuildScribe's market stall (`!stall`, `!haggle`, both lists) and Hunt & Hoard's stall, and The Wandering Clerk's merchants (the road peddlers). The names come from `roster.md`, and each peddler's line goes into their `!haggle` replies. |
| The Wandering Clerk | The Wandering Clerk bot (GuildBreak: Hunt & Hoard). |
| Burn | UndercoverBurn, the Twitch roast bot: its **Burn (Grand Orrery)** personality is built from his row in `roster.md`. |
| Everyone in `lore.md` | People the player can meet in [Wake in Verrowen](https://tavernworks.dev/verrowen/). GuildScribe's AI replies (the Scribe, the peddlers' `!haggle`, `!npc` characters) also read `lore.md` live. |

When a character changes here, everything picks it up on its own (see below), the example chats on the Tavernworks home page, Sound Bytes and The Wandering Clerk included: they're cast from the Orrery's people, peddlers and wares each time they open.

## Who reads from here

Everything below reads [the database](#the-database) built from this repo's `main`, through the same client. **Nothing keeps its own copy of the universe**: no built-in names, wares, places, worlds or lore. The only thing hard-coded anywhere is the Orrery itself (its address, and the ids of the few records an app is about, like the Scribe for GuildScribe or Burn for UndercoverBurn). Each app keeps the Orrery's *last good read* (the client's `cache` option: a file for the bots and the laptop, the browser's storage for the pages), so it still has the Orrery when GitHub is out of reach.

| Project | Reads | How often |
| --- | --- | --- |
| [Orrery Explorer](https://tavernworks.dev/orrery/) | The database for everything it shows: people, items, beasts, places, worlds, and which documents and maps there are (the Review Clone reads `review`'s). It reads the documents' and maps' own text for the Documents and Maps tabs. A new document, map or world shows up without changing the Explorer | On open, then follows every change live (checked every 30 seconds, at once after a publish) |
| [Wake in Verrowen](https://tavernworks.dev/verrowen/) narrator, and the Codex | The database's lore lines (compiled from `lore.md`) | Every turn, checked again every 10 minutes |
| GuildScribe (Twitch bot, `dnd-twitch-bot`) | The database: lore lines (AI replies), places and creatures (where fights happen, Verrowen's beasts), people (the peddlers, and the Scribe's and peddlers' lines) and items with a **Sold:** line (the peddlers' stall) | Every 5 minutes, and at once when a new database is live |
| GuildScribe (Discord bot, `guildscribe-discord`) | The same as the Twitch bot: it runs the Twitch bot's game code, synced every 15 minutes | Same |
| The Wandering Clerk (GuildScribe's Hunt & Hoard) | The same as GuildScribe: it's part of the Twitch bot. The separate Wandering Clerk bot reads its road peddlers from the database too | Same; the separate bot at the start of each run and every 30 minutes |
| UndercoverBurn | The database: Burn's person record (name, race, role, line) | At start-up, then every 30 minutes |
| The Wake in Verrowen narrator's server (the laptop) | The database: the world's name, its places, its maps and lore.md's labels, for every prompt that writes or files lore (auto mode, Add to the Orrery, the catch-ups) | Every 10 minutes |
| Tavernworks pages (home, Sound Bytes, The Wandering Clerk, the Codex, the review page) | The database: the example chats' people, peddler and ware, the Codex's lore notes, the review page's maps and document names | On open |

Only decided content reaches them: the bots and the narrator only use records whose status is `decided` (Your idea) or `dm-lore`. Secrets stay out of the bots' prompts. To add a new project, have it read [the database](#the-database) rather than copying anything in or parsing the documents itself.

## The database

The Orrery is meant to be the database of everything in the universe, and every app should get its people, places and things from it. The documents are still where things get written, by hand or by the review page. The *Build the Orrery database* action ([`.github/workflows/build-data.yml`](.github/workflows/build-data.yml)) runs [`tools/build.mjs`](tools/build.mjs) on every push, which compiles them into JSON: every thing as one record with a stable id, a type and its fields.

- **Where it lives:** the `data` branch, one folder per source branch: `main/` for the live Orrery and `review/` for what's waiting. Nothing is ever committed to `main` or `review` by the build, so it can't get in the way of the review page's writes.
- **The files:** `entities.public.json` holds everything with every secret taken out, and is what bots and AI prompts read. `entities.json` is the same with secrets, for the owner's tools only. There's also one public file per type (`people.json`, `items.json`, `creatures.json`, `places.json`, `lore.json`, `notes.json`, `roles.json`, `worlds.json`, `documents.json`, `maps.json`). Documents and maps are records too: every `*.md` here and in `maps/` (title, file, one line) and every `maps/*.png` (title, caption from `maps/README.md`), so apps list what the Orrery has rather than keeping a list of their own.
- **Reading it:** use [`client/orrery.js`](client/orrery.js) instead of parsing anything. It works the same in Deno, Node and the browser, refreshes on its own, reads the exact newest build rather than the raw server's lagging copy, and never throws: until the first good read, lookups return nothing (or the app's fallback).

  ```js
  import { Orrery } from "https://cdn.jsdelivr.net/gh/sheastolp/grand-orrery@<commit>/client/orrery.js";

  const orrery = new Orrery();               // main, no secrets, checks every 5 minutes
  await orrery.ready();
  orrery.get("tansy-ninefingers");           // { id, type: "person", name, race, sex, line, group, … }
  orrery.list("person", { group: "The road peddlers" });
  orrery.find("fenwick");                    // both Fenwicks, best match first
  orrery.onChange(() => { /* a new build landed */ });
  ```

- **Ids:** made from the name (`Tansy Ninefingers` → `tansy-ninefingers`, a role → `role-the-tanner`). Two things with the same id fail the build, and a rename changes the id, so apps should look things up by id but expect renames.
- **Who reads it:** every app in [Who reads from here](#who-reads-from-here). Tavernworks pages load the client through its `/orrery-db.js`, and GuildScribe imports it directly; both pin a commit of `client/orrery.js`, so bump that pin to take a newer client.
- **What's in it:** every document.

  | From | Becomes |
  | --- | --- |
  | `roster.md` | `person`, `role` (nobody fills it yet), `world` |
  | `resources.md` | `item`: its category, kind, icon and fields (`sold`, `does`, `made` …) |
  | `bestiary.md` | `place` (where fights happen: `uses`, `levels`, `lines`) and `creature` (`stats`, `place`) |
  | `lore.md` | `lore`: each line the narrator reads, in order |
  | `universe.md`, `working-notes.md`, `midkemia.md` | `note`: every section, with its body and fields |

  Every record has a `status` from its tag: `decided` (Your idea), `pitch`, `open` (Not decided yet), `dm-lore`, `draft` or `untagged`. Apps that only want canon filter on `decided` (and `dm-lore` where it fits). Notes list the people, items, creatures and places they name in `mentions`, and those list the notes back in `mentioned_in`, so any app can gather everything written about one thing.
- **From the chat to the database:** whatever is sent for review from Wake in Verrowen, the Codex or the lore-keeper is filed as a `working-notes.md` section on `review`, and the next build turns it into a note (with `origin` and the `review_key` it was filed under), so it's in `review/` within a minute or two. A Wake in Verrowen character also becomes a `person` (`kind: "wake-character"`), and an item idea (the lore-keeper's *Items & inventions*, auto mode's items and peddlers' relics) also becomes an `item`, under *Sent in from the chat* (relics under *Peddlers' wares*), so the Items tab shows it; if the roster or `resources.md` later gets one with the same name, that record takes the note instead. Marking it **Your idea** makes it `decided`, and publishing it to `main` puts it in the live database, after which the build tells the apps that keep a copy (GuildScribe by default; more in the `ORRERY_REFRESH_URLS` repository variable) to re-read at once.

To check the documents still compile, run `node tools/build.mjs --check`; `node tools/build.mjs` writes the files into `dist/`. `node --test tools/build.test.mjs` runs the build's tests.

## Keeping it in sync

- **Every change goes to the `review` branch, never straight to `main`.** `main` is the live Orrery: the Explorer, the lore-keeper and the Wake in Verrowen narrator read it. The owner checks what's waiting on the [Review Clone](https://tavernworks.dev/orrery/control/review/) and publishes it to `main` from there.
- **`review` never falls behind `main`.** If something lands on `main` directly, the *Keep review up to date* GitHub Action brings `review` up to date: a fast-forward when nothing is waiting, or a merge that keeps the waiting changes. If the two conflict, the run fails and `review` is left alone to fix by hand.
- **The phone apps follow the same rules.** The Orrery Explorer and Wake in Verrowen install as Android apps (Install app in Chrome). They read the same branches as the website: `main` for the live Orrery, the lore-keeper, the narrator and the Codex, and `review` for the Review Clone. Nothing is published from a saved copy, and the apps share the website's storage, so the Codex, the owner's token and lore-keeper pitches are the same everywhere. **📨 Send for review** in the Codex, under a wrapped-up Wake in Verrowen character and under a lore-keeper write-up files it as a section of `working-notes.md` on `review` (under *From the Codex*, *From Wake in Verrowen* or *From the lore-keeper*). The owner's own sends go straight onto `review`; anyone else's wait in a queue on the laptop until the owner files or turns them down on the review page. A decided Codex note the narrator should know also gets a `CODEX:` line in `lore.md`. The Orrery app's icon shows how many changes are waiting on `review` on a phone that holds the owner's token, and a long press on it opens the review page or the Review Clone.
- **This repo is canonical.** Sheamus's Claude docs (*Stoutwell & Beyond: Universe Draft* and *Village Hero: Character & Story Notes*) are where some of this started, but where the two disagree, this repo wins. Ideas that start anywhere else (a doc, a bot, a game session) come in as pitches on `review` and only count once they're here.
- `lore.md` is what the game's narrator reads, and the game loads it straight from this repo. Only decided lore goes in it, never pitches. Keep it compact, since it's sent with every turn.
- When the universe changes, change it here first (on `review`), then `lore.md` if the change is decided and matters to the game. Once it's on `main`, everything in [Who reads from here](#who-reads-from-here) follows on its own. Never change a character in a bot and copy it back. **📜 Catch the lore up** on the [review page](https://tavernworks.dev/orrery/control/review/) drafts the `lore.md` lines for everything decided since the last catch-up, for the owner to check and add.

## Rights

This is original creative work. All rights reserved. You're welcome to read it and play the game, but please ask before reusing the setting, characters or text.
