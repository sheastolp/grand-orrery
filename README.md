# The Grand Orrery

A medieval fantasy universe by Sheamus. Most of it so far takes place on **Verrowen**, a world of weak, everyday magic, D&D-style monsters and a far-off corrupt Kingdom, centered on the walled village of **Stoutwell**.

It's built so any place, person or idea can be lifted out and used on its own: in a D&D campaign, a story or a book. It's a work in progress, and names and details may still change.

**Browse it:** the [Orrery Explorer](https://tavernworks.dev/orrery/) shows the maps, every document and the full roster, and gathers everything written about any one person.

**Play in it:** [Wake in Verrowen](https://tavernworks.dev/verrowen/) on Tavernworks. You wake with no memory somewhere in Verrowen, and an AI narrator reveals who you are through your choices.

## What's here

| File | What it is | How settled |
| --- | --- | --- |
| [`universe.md`](universe.md) | **Stoutwell & Beyond.** The universe draft: magic, Stoutwell, its people, the Monster Wood, the Kingdom and its guild hall GuildScribe (with its Scribe, the market peddlers and the Wandering Clerk), and characters from other worlds. | Decided |
| [`working-notes.md`](working-notes.md) | **Village Hero.** The full working notes behind the draft, including ideas still being weighed. | Mixed, marked per section |
| [`midkemia.md`](midkemia.md) | **World of Midkemia.** The world of Rose's homebrew D&D campaign that Arandur plays in: the quest for the missing queen, its places and gods, the linked world Aetherwyn, and the party. | DM lore |
| [`resources.md`](resources.md) | **Resources.** Every item and resource, sorted by category and then type: enchanted items, materials, tools, weapons and armor, food and drink, coin. The Explorer's Items and Resources tabs read it live. | Marked per entry |
| [`lore.md`](lore.md) | The condensed lore the Wake in Verrowen narrator reads every turn. | Decided only |
| [`maps/`](maps/) | Rough region and village maps. | Rough draft |

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
| The Scribe | GuildScribe's own voice in chat: the replies, the grumbles when tagged, and the fine for `!rob @GuildScribeBot`. |
| The peddlers (Tansy Ninefingers and the rest) | GuildScribe's market stall (`!stall`, `!haggle`) and The Wandering Clerk's merchants. |
| The Wandering Clerk | The Wandering Clerk bot (GuildBreak: Hunt & Hoard). |
| Everyone in `lore.md` | People the player can meet in [Wake in Verrowen](https://tavernworks.dev/verrowen/). |

When a character changes here, check those examples still fit.

## Keeping it in sync

- **Every change goes to the `review` branch, never straight to `main`.** `main` is the live Orrery: the Explorer, the lore-keeper and the Wake in Verrowen narrator read it. The owner checks what's waiting on the [Review Clone](https://tavernworks.dev/orrery/control/review/) and publishes it to `main` from there.
- **`review` never falls behind `main`.** If something lands on `main` directly, the *Keep review up to date* GitHub Action brings `review` up to date: a fast-forward when nothing is waiting, or a merge that keeps the waiting changes. If the two conflict, the run fails and `review` is left alone to fix by hand.
- **The phone apps follow the same rules.** The Orrery Explorer and Wake in Verrowen install as Android apps (Install app in Chrome). They read the same branches as the website: `main` for the live Orrery, the lore-keeper, the narrator and the Codex, and `review` for the Review Clone. Nothing is published from a saved copy, and the apps share the website's storage, so the Codex, the owner's token and lore-keeper pitches are the same everywhere. **📨 Send for review** in the Codex, under a wrapped-up Wake in Verrowen character and under a lore-keeper write-up files it as a section of `working-notes.md` on `review` (under *From the Codex*, *From Wake in Verrowen* or *From the lore-keeper*). The owner's own sends go straight onto `review`; anyone else's wait in a queue on the laptop until the owner files or turns them down on the review page. A decided Codex note the narrator should know also gets a `CODEX:` line in `lore.md`. The Orrery app's icon shows how many changes are waiting on `review` on a phone that holds the owner's token, and a long press on it opens the review page or the Review Clone.
- The canonical, longer versions live in Sheamus's Claude docs, *Stoutwell & Beyond: Universe Draft* and *Village Hero: Character & Story Notes*. These files are copies of them as of 2026-11-05.
- `lore.md` is what the game's narrator reads, and the game loads it straight from this repo. Only decided lore goes in it, never pitches. Keep it compact, since it's sent with every turn.
- When the universe changes, update the doc, then the matching file here, then `lore.md` if the change is decided and matters to the game. **📜 Catch the lore up** on the [review page](https://tavernworks.dev/orrery/control/review/) drafts the `lore.md` lines for everything decided since the last catch-up, for the owner to check and add.

## Rights

This is original creative work. All rights reserved. You're welcome to read it and play the game, but please ask before reusing the setting, characters or text.
