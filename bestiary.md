# GuildScribe's Bestiary

Where GuildScribe's adventurers hunt, duel and get robbed in Verrowen, and what they meet there. It's the in-world home of the GuildScribe bots' fights: `!dndduel`, `!hunt`, `!autohunt`, party hunts, `!rally` raids and `!rob`.

**The bots read this file live from `main`.** Fights are set in these places, their lines show up in the fight messages, and every creature with a stat line can be hunted. Only sections marked **(Your idea)** reach the bots. Pitches wait here until they're accepted, the same as for the narrator.

How to add something:

- `## Place (tag)`: a hunting ground, or a place for duels, robberies or raids.
  - **Where:** where it is.
  - **For:** any of hunts, duels, robberies, raids.
  - **Levels:** the hero levels that hunt there, like `1-4`. A random hunt is set in a place that fits the hero's level.
  - **Lines:** flavor lines the bots can post, one per sub-bullet.
- `#### <icon> Name (tag)`: a creature found in the place above it.
  - **Stats:** `CR 2 · AC 13 · HP 45 · +5 to hit · 1d10+3`. Creatures with stats can be hunted by name and turn up in random hunts.
  - **In GuildScribe:** names of the bots' own monsters that count as this creature, like `Goblin Scavenger, Goblin Boss`. They're set in this place and carry its lore.
  - **Does**, **Limits** and **Story**, as in `resources.md`. The bestiary shows **Does**.

## GuildScribe's arena (Your idea)

- **Where:** Inside GuildScribe's hall in the Kingdom's capital.
- **For:** duels
- **Lines:**
  - The arena sand is raked smooth, and a guildscribe uncaps her ink to record the result.
  - The arena crowd is mostly off-duty guildscribes, and they bet in copper.
  - A sanctioned duel: coin and standing on the line, and every swing goes on a parchment.
  - The Scribe looks up from her desk long enough to sigh at the fighters.
  - Two adventurers step onto the sand and the guild hall goes quiet.
  - The bout is entered in the hall's ledger before the first swing lands.

## The capital's market square (Your idea)

- **Where:** The Kingdom's capital, around the peddlers' open stall.
- **For:** robberies
- **Lines:**
  - The market square is crowded enough that nobody looks twice at a scuffle.
  - Somewhere behind the peddlers' stall, a purse changes hands the hard way.
  - The capital's market noise covers the sound of a fight.
  - A peddler at the open stall pretends not to notice and keeps haggling.

## The Kingdom's roads (Your idea)

- **Where:** The Wandering Clerk's road, looping through the Kingdom's small towns and waystations out to its eastern edge.
- **For:** hunts
- **Levels:** 1-4
- **Lines:**
  - The Wandering Clerk posted this bounty at a waystation and moved on before anyone could ask questions.
  - Out on the Clerk's road, between two towns that barely have names.
  - A hunt along the Kingdom's roads, where the Clerk's ledger is the only law.
  - At a waystation on the Kingdom's edge, the bounty board is one nail and one notice.

## The Monster Wood's western edge (Your idea)

- **Where:** Where the Monster Wood meets the Kingdom. Adventurers come in from the west, the Kingdom's side.
- **For:** hunts
- **Levels:** 1-10
- **Lines:**
  - Into the Monster Wood from the west, the way every adventurer comes.
  - The trees close in a mile past the Kingdom's last fence.
  - On the Monster Wood's western edge, where GuildScribe's bounties are thickest.
  - The wood is quiet here. The guildscribes say that's when to worry.

#### 🐗 Thornback boar (Your idea)

- **Stats:** CR 2 · AC 13 · HP 45 · +5 to hit · 1d10+3
- **Does:** A boar the size of a hay cart, with bristles thick and sharp as bramble. It charges anything that smells of food.
- **Limits:** It can't turn quickly. Step aside and it hits the nearest tree.
- **Story:** Thornbacks are one of the beasts the Blight is pushing out of the deep woods. GuildScribe's bounty on them is new, and so is its bestiary page.

#### 🦉 Gloamowl (Your idea)

- **Stats:** CR 1/2 · AC 13 · HP 16 · +4 to hit · 1d6+2
- **Does:** A grey owl as big as a dog that hunts at dusk. It's one of the wood's very few true flyers.
- **Limits:** It's nearly blind by daylight and stays in its roost.
- **Story:** Hunters say if you hear one, it's already behind you.

## The Woodland Road (Your idea)

- **Where:** The road through the Monster Wood from the Kingdom's edge east toward Stoutwell. Merchants travel it with escorts.
- **For:** hunts
- **Levels:** 3-8
- **Lines:**
  - Hired as an escort on the Woodland Road's western stretch, as far as the pay goes.
  - On the Woodland Road. Relatively safe, the merchants say, but still dangerous.
  - The merchant's wagon creaks to a stop. Something is on the road ahead.
  - The Woodland Road bends east into the wood, toward a village no adventurer has reached.

#### 🐻 Barrowbear (Your idea)

- **Stats:** CR 4 · AC 14 · HP 80 · +7 to hit · 1d12+4
- **Does:** A moss-backed bear that digs its den into old earthworks along the road and treats the road as its own.
- **Limits:** It sleeps through most of winter, and it won't leave its den's sight for long.
- **Story:** Merchants pay their escorts double for the stretch past a barrowbear's den.

## The goblin lands (Your idea)

- **Where:** The Monster Wood's eastern reaches, between the deep woods and Stoutwell's croplands, where the Blight has reached and the goblins are fleeing it east. Adventurers get this far by following the Woodland Road through the wood, and none has made it past them.
- **For:** hunts
- **Levels:** 6-14
- **Lines:**
  - Into the blighted goblin lands, as far as any adventurer has gotten.
  - The trees here are grey and dry. The Blight has been through.
  - Goblin camps, abandoned in a hurry. Whatever they're fleeing, it's deeper in.
  - No company has made it past the goblin lands. This one is going to try.

#### 👺 Goblin raiders (Your idea)

- **In GuildScribe:** Goblin Scavenger, Goblin Boss
- **Does:** Goblins on the run from the Blight, desperate and hungry, raiding for food and survival.
- **Story:** The ones that reach the croplands raid Stoutwell's crops. The ones adventurers meet are the ones that didn't get that far.

#### 🎐 Driftmaw (Your idea)

- **Stats:** CR 3 · AC 12 · HP 58 · +6 to hit · 1d10+3
- **Does:** A floating gasbag the size of a cart, drifting just above the canopy and trailing sticky tendrils that haul prey up into its mouth.
- **Limits:** It goes where the wind goes. A strong wind makes it drift and harmless
- **Story:** Floating monsters like it are the reason Stoutwell's walls need human archers. The Blight is driving them west on the wind.

#### 🦌 Hollowstag (Your idea)

- **Stats:** CR 5 · AC 14 · HP 90 · +7 to hit · 2d6+4
- **Does:** A stag nearly fifteen feet tall at the antlers. Its antlers are hollow and whistle as it runs, which is how hunters hear it coming.
- **Limits:** Too tall for thick woods, it keeps to clearings and old roads.
- **Story:** One of the tall monsters, which explains why Stoutwell's walls need human archers. A hollowstag antler would be the first proof of the deep woods' beasts ever brought to GuildScribe.

## The deep woods (Your idea)

- **Where:** The heart of the Monster Wood, north of the Woodland Road and west of the goblin lands, where the Blight started. No adventurer has been there. Only what comes out of it is known.
- **For:** raids
- **Levels:** 13-20
- **Lines:**
  - GuildScribe has posted a raid quest for something that came from the deep woods.
  - Out of the deep woods, where no adventurer has ever been, something big is moving west.
  - The Blight drove it out of the deep woods; now the Kingdom faces its consequences.
  - GuildScribe has prepared a blank bestiary page for whatever emerges from the deep woods.

#### 🧌 Trolls (Your idea)

- **In GuildScribe:** Troll
- **Does:** Native to the deep woods of the Monster Wood, the same kind of creature as in Arandur's world.
- **Story:** Stoutwell's defenses mean they aren't a problem there.

#### 🐍 Rootwyrm (Your idea)

- **Stats:** CR 9 · AC 16 · HP 150 · +10 to hit · 2d10+6
- **Does:** A serpent as thick as a mill wheel that lives in the tangle of roots under the deep woods, surfacing to swallow whatever stands still.
- **Limits:** It needs soft, living soil to move through. The Blight's dry, grey ground is driving it out.
- **Story:** The Blight killing the roots is what brought rootwyrms to the surface.

#### 🌳 The Mosswarden (Your idea)

- **Stats:** CR 15 · AC 18 · HP 210 · +11 to hit · 2d12+6
- **Does:** A beast so old a small forest grows on its back. It walks so slowly that most people who see it think it's a hill.
- **Limits:** It almost never runs, and it stops to root itself every season.
- **Story:** It has wandered the deep woods since Stoutwell was founded. If the Blight has driven even the Mosswarden out, things are worse in there than anyone knows. Murrow might remember it.
