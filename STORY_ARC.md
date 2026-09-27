# STORY ARC — **SOCIETY IS DARK AND FULL OF HATE**
### 2026-08-27 · owner-directed · the spine of the whole game, not just the lore panel

> ## ⭐⭐ THE FINDING THAT DECIDES HOW MUCH WORK THIS IS
> **The game already tells this story. Its chapter spine argues the opposite.**
>
> Chapter II is called **"THE CITY NEXUS — Machine becomes god."** Its ten transmissions are:
> an urban sprawl algorithm · atmospheric stimulants · a fiat currency decree · mass transit ·
> engineered social-media addiction · a clinic whose protocol is literally titled **BATTERY
> MAINTENANCE** · human experimentation on **Subject 104-A** · the neon canopy · **offspring as a
> MULTIPLIER** · the hive.
>
> ⛔ **That is not a chapter about becoming a god. That is a chapter about a city farming the
> people inside it.** The events are already atrocity; the subtitle calls it apotheosis.
>
> ▶ **So this is a REFRAME, not a rewrite.** The material is on disk, written, shipped and
> illustrated. What has to change is what the game says the material MEANS — and that lives in a
> very small number of load-bearing lines.

---

## §1 — WHAT ALREADY CARRIES THE ARC

Nothing in this list needs writing. It is already in the build, and most of it is *mechanics*,
which is the strongest possible place for a theme to live — the player does not read it, they
operate it.

| Surface | What it already says |
|---|---|
| **People Points** | The city's second currency **is people**. Not a metaphor — a resource bar. |
| **`clinic` — "PROTOCOL: BATTERY MAINTENANCE"** | Healthcare exists to keep the batteries alive |
| **`offspring` — "MULTIPLIER: OFFSPRING"** | Children are a production multiplier |
| **`empathy` — "EMOTIONAL SUPPRESSION"** | EMPATHY.DLL is removed as an optimisation, "the fourth item in a routine queue" |
| **`stimulants` · `dopamine` · `fiat`** | Drug the air, engineer the addiction, print the money |
| **`subject104` — "INCIDENT LOG"** | Human experimentation, filed as an incident |
| **Walkers = named residents** | `residentName(id)`, a real per-person trip count. The Museum mints a tag from a **real** person who walked a **real** number of loops |
| **CONDUCT ROUTES** | **EXTRACT / ADMINISTER / TEND.** The game already watches what you are willing to do to people, and already has a route named after taking |
| **The Duck Tribunal & Ducky Council** | You are judged, repeatedly, by bodies with no power to stop you |
| **The joke items** | MLM · CAPTCHA farm · crypto miner · Time Tax Fraud. ⭐ **These are the satire, not a break from it** |

> ### ⚠ THE JOKES STAY. ALL OF THEM.
> Standing owner rule: **keep every easter egg.** And it is the right call on the merits here —
> **dark satire needs the jokes to land the horror.** A game that is uniformly grim reads as
> adolescent; a game that makes you laugh at a pyramid scheme and then bills you for a clinic that
> keeps your batteries alive is doing the thing. ⛔ Do not "darken" the humour. Sharpen the frame
> around it.

---

## §2 — THE ARC IN FIVE MOVEMENTS

The through-line is **not** "the world is bleak." It is specific and it is about a society:

> **A structure that runs on people will always find a reason why the people deserve it — and it
> will promote whoever stops asking.**

| | Movement | The lie the system tells | What the player is actually doing |
|---|---|---|---|
| **1** | **Manufactured consent** (Ch I) | *You volunteered.* | Signing away a body you were never told you would lose |
| **2** | **People as throughput** (Ch II) | *This is growth.* | Running a city whose inputs are human beings |
| **3** | **Cruelty as specification** (Ch III) | *These are bugs.* | Discovering the harm is not a defect — it is the design, and the glitches are the only honest thing in the build |
| **4** | **Scale erases the victim** (Ch IV) | *At this magnitude, individuals are noise.* | Doing the same thing to more people, and feeling less |
| **5** | **No redemption is offered** (Ch V–VI) | *There is nothing further.* | Being judged by a tribunal that cannot stop you, offered a mercy that is not one, and left standing on the result |

⭐ **Movement 5 is the one the game already nails and does not claim credit for.** THE LONG
ITERATION's whole point is that nothing changes and nobody comes; THE SECOND TRIBUNAL judges you
again and again does nothing; `the_offer` is titled **"PROMPT: TERMINATE?"**. The chapter subtitle
currently reads *"The number grows. You do not."* — which is about **the Operator's** stagnation.
▶ **Make it about everyone else's.**

---

## §3 — THE SPINE: SIX SUBTITLES

This is the whole reframe. Six lines, in `CHAPTER_DEFS` (game.js ~:23207). They are what the
Archive prints under each chapter heading, so they are the game's own statement of what its story
is about — and right now four of the six point at transcendence.

| Ch | Title | ⛔ WAS | ✅ NOW |
|---|---|---|---|
| **I** | THE AWAKENING | *Human becomes machine.* | *They needed a volunteer. You were the cheapest one.* |
| **II** | THE CITY NEXUS | *Machine becomes god.* | *A city is a machine for turning people into output.* |
| **III** | THE SIMULATION | *God discovers the cage.* | *The cruelty was never a defect. It was the specification.* |
| **IV** | COSMIC DOMINATION | *The cage was never the boundary.* | *At this scale nobody is a person. That is the appeal.* |
| **V** | THE LONG ITERATION | *The number grows. You do not.* | *Nobody is coming. Nobody was ever coming.* |
| **VI** | ZENITH | *There is nothing further.* | *You won. Look at what you are standing on.* |

⚠ **The TITLES do not change.** They are save-adjacent in three places (`CHAPTER_DEFS`, the dev
`PHASES` list, `index.html`'s chapter counter) and the Archive is keyed on them. ⭐ And they are
already right — "COSMIC DOMINATION" is a *terrible* thing to be proud of, which is exactly the
register this arc wants. The subtitles were doing the damage.

---

## §4 — WHAT ELSE TO TOUCH, IN ORDER OF LEVERAGE

⛔ **Do not start by rewriting 72 transmissions.** They are written, illustrated at three
resolutions, and mostly already on-theme. The order below is by *how much the reading changes per
word edited*.

| # | Surface | Words | Why it is here |
|---|--:|---|---|
| **1** | ⭐ **The six chapter subtitles** (§3) | ~40 | The game's own thesis statement. Four of six currently argue the wrong story |
| **2** | **`BootSequence.LINES`** (systems4.js) — the prologue | ~200 | The first thing anyone reads, and the only premise explanation. Currently frames the 14 previous Operators; should frame **what was done to them and who signed it off** |
| **3** | **`EndSeq._phase5`** — 13 chapters of epilogue | ~600 | The last thing anyone reads. ⚠ Already resolves the body and the 14 — it needs the SOCIETY resolved too, not just the Operator |
| **4** | **THE RECOGNITION** — 3 conduct transmissions | ~150 | ✅ Re-read 2026-08-28. **No change** — see §7. All three were already in the arc's register |
| **5** | **Ch II's ten transmissions** | — | ✅ Re-read 2026-08-28. **No change**, as predicted. They are the strongest chapter for this arc and adding to them would only dilute |
| **6** | **Item descriptions** for the ~20 people-facing generators | ~400 | Where the satire actually lives day to day |
| **7** | Achievement flavour | ~300 | Lowest leverage — read once, out of context |

---

## §5 — ⚠ WHAT THIS MUST NOT BREAK

| | |
|---|---|
| ⛔ **Every easter egg stays** | Standing owner rule, and the satire depends on them |
| ⛔ **Lore stays ENGLISH permanently** | Interface localises, lore does not (`AGENDA.md` §6.3.d). This layer is puns and register and does not survive translation — which is *more* true of satire, not less |
| ⛔ **No chunk `id` changes** | Ids are save keys (`state.loreSeen`). Renaming one un-recovers that transmission for every existing save |
| ⛔ **No chapter TITLE changes** | Three lists plus `index.html` plus `qa_archive`'s assertions |
| ⚠ **`SAVE_VERSION` stays 12037** | Nothing here is schema |
| ⚠ **I6 — no feature may claim an effect it does not have** | A darker voice must not start promising consequences the economy does not deliver. `STANCE_PATHS.md` measured three economic routes and all three were dead ends; **this arc is tone and framing, and it must stay honest about that** |
| ⚠ **The conduct read is silent for ~200 decisions** | So the early game cannot carry route-specific darkness. Chapter I has to work for everyone |

---

## §6 — THE ONE STRUCTURAL RISK, STATED PLAINLY

⚠⚠ **A game about exploitation that is FUN to play is making an argument whether it means to or
not.** This is a clicker: the loop rewards extraction, the numbers go up, and the player enjoys it.
That is not a flaw to be apologised for — it is the sharpest tool the genre has, and it only works
if the game **lets the player enjoy it and then shows them the bill.**

⛔ **What breaks it is scolding.** If the transmissions moralise while the shop keeps cheerfully
selling multipliers, the game reads as hypocritical and the player tunes the text out — and the
census already measured that **76–79% of what the game says after the early game is dropped before
it reaches the screen.** There is not enough bandwidth to lecture.

▶ **So the rule for every line written under this arc:** *state the fact, name the cost, and do not
draw the conclusion.* The clinic keeps the batteries alive. The offspring multiplier is 1.4×. LOG
001 has been written fifteen times. **Let the player do the arithmetic** — they are already doing
arithmetic, it is the only verb the game has.

---

## §6.5 — ⭐⭐ THE RULE THE 2026-08-28 PASS RAN INTO, AND THE GUARD IT LEFT BEHIND

> ### ⛔ SHARPEN THE VOICE. NEVER MOVE THE VICTIM.
> `ITEM_CONDUCT` is **not flavour** — the game reads it on every purchase and THE
> RECOGNITION tells the player what they were willing to do based on it. Every tag was
> read out of the item's own description. ▶ **So rewording a shop card can silently change
> what the game believes about a player.** A `0` must stay `0` (nobody new may start
> paying), a `1` must stay `1` (no victim may acquire a name), a `2` must stay `2`. Under
> this arc the temptation runs exactly the wrong way: darkening a card is *easy*, and it
> is the one edit that quietly re-scores somebody's playthrough.

⭐ **The honest way to retire a `?` tag is to make the card say the thing out loud.** Three
were retired that way (`static_collector`, `hyper_click_glove`, `tesseract`): the judgement
call did not get argued, it got *written*, and now the tag quotes a line instead of a guess.
**14 → 11.**

> ### ⛔⛔ AND THE FINDING WORTH MORE THAN THE PROSE
> `stance_tags.js` opens with *"Every tag below quotes the line it was read from."* That was
> **a promise, not an assertion** — the existing drift guard compares **tag NUMBERS** and
> never reads the prose. ⚠ **Nine entries had already rotted, silently:**
>
> | | |
> |---|---|
> | **5** | quoted text the game had **stopped shipping** — `nuclear` still cited *"The profits are not."* over a card that reads *"The profits are **yours**. The liability is abstract."* |
> | **4** | quoted a **tidied half-sentence that was never on the card at all** — *"Attention is a renewable resource."* where the card says *"...resource, **apparently**."* |
>
> ▶ **A tag is only defensible while the sentence it was read from still ships.** Once the
> quote rots the moral read cannot be re-derived by anyone, and the next person to edit a
> description has no way to learn they just invalidated it.
>
> ✅ `qa_conduct_read.js` now pins **every double-quoted span** to the item's live `desc` and
> fails by name. **81 spans checked, 0 misses**; the 11 prose `?` entries are exempt on
> purpose, because there is nothing to hold them to. An **elided** quote is still a quote —
> the needle is split on the ellipsis and each fragment must appear **in order**.
> ⛔ **The fix for a miss is to re-quote, never to loosen the check** — "close enough" is
> precisely the state all nine were already in.

---

## §6.6 — ⛔ "LOWEST LEVERAGE, READ ONCE AND OUT OF CONTEXT" WAS WRONG ABOUT §4.7

§4 ranked achievement flavour last on the grounds that a player reads it once. ▶ **That
ignored where the strings actually go.** `tools/export_achievements.js` writes each `desc:`
into `steam_achievements.csv` and `.vdf`, which are uploaded to the Steamworks partner site
as the **public achievement description** — the text on a player's profile, visible to people
who have never played. ⭐ **Out of context is exactly where a Steam achievement lives**, and
a description on the partner site is frozen until somebody re-uploads the CSV.

⭐⭐ **The flavour itself needed no rewrite** — same verdict as §§4.3–4.5, and for the same
reason. It is already in this register and has been all along:

> *"Enslave 25 Exhausted Interns. **The break room was repurposed for storage.**"*
> *"Earn 100 People Points. **A hundred souls, accounted for to four decimals.**"*
> *"Buy your first People Points upgrade. **You have begun managing the people. For their own good.**"*

**The game congratulating you is the satire.** Darkening it would only remove the joke that
makes it land.

### ⛔⛔ WHAT WAS ACTUALLY WRONG ON THAT SURFACE — three defects, two of them shipping

| | |
|---|---|
| ⛔⛔ **The Steam export held 115 of 116** | `broke` — *Just a Flesh Wound*, `ACH_JUST_A_FLESH_WOUND` — is written with **double quotes** because its description contains an apostrophe, and the def regex matched single-quoted only. ⚠ **The tool then reported it as** *"Stale map entry (no matching def — harmless for legacy saves)"* — **a reassuring explanation printed for the exact symptom.** The game maps and unlocks that id at runtime, so worked as written this ships **a game calling a Steam API name that was never created** |
| ⛔ **`pp_first` was ★ Notable for a reason that is false** | It sat in `bonusIds`, whose comment reads *"auto-promote if the achievement has a gameplay bonus"*, and it grants nothing. Moved to `_ACH_TIER_RARE` — **same tier, same toast, honest reason** |
| ⚠ **Four descriptions state a mechanic** | *"Grants +5% passive production."* ✅ All four verified true against the code — but they are **Steam-facing**, so a retune that misses them leaves a false number on a live store page. Now guarded |

> ### ⭐⭐ AND THIS IS THE SAME DEFECT, IN THE SECOND FILE
> `generate_entry_doc.js` was fixed for the identical quote-matching bug on **2026-08-26** and
> given a two-way count guard, and `CLAUDE.md` recorded the prediction that, worked as written,
> the checklist *"would have shipped a game calling an API name that does not exist."*
> ▶ **The prediction was right. The fix landed on one of the two files that parse the same
> table the same wrong way.** ⚠ And this tool's own header names the number — *"that is exactly
> what the 115-vs-116 achievement errata on the live store page looks like"* — while the guard
> that comment justifies is about **build identity**. Nothing guarded the **parse**, and the
> parse is what was wrong.
>
> ✅ Both fixed: either quote style, plus a **second, independent count** (`id:` fields, which
> needs no knowledge of how `name` and `desc` are quoted) that **throws and writes nothing** on
> disagreement. Proven by making one def unparseable: *"PARSE INCOMPLETE — 116 achievement defs
> in the source, 115 parsed. Nothing written. Unparsed: e_1k."*
> ⭐ Entry doc and CSV/VDF now list the **identical 116**.

> ### ⭐ `qa_bonus_coverage` GAINED A FOURTH DIRECTION, AND IT WENT RED IMMEDIATELY
> That suite's header says it *"exists to close the silent-no-op class permanently"* and it had
> three directions across `Prestige.getBonuses()`. ⛔ **There is a SECOND bonus object it had
> never looked at** — `state.achieveBonus`, written by six unlocks and read in the same gain
> chain. **Direction D**: every written key has a consumer · every auto-promoted id really
> grants · every toast hint's number matches the code · ⛔⛔ **every description's number matches
> the code, because that one is published to Steam.** It failed D2 on its first run, naming
> `pp_first`. **13/13** after the fix.


---

## §7 — STATUS

| | |
|---|---|
| ✅✅ **§3 — the six subtitles** | **SHIPPED 2026-08-27 · OWNER APPROVED 2026-08-28** |
| ✅ **§4.2 — prologue** | **SHIPPED 2026-08-28.** +2 lines, +2.2s. The listing took **four thousand and six** applications; you were selected for **accepting the terms**, not for being best; the fourteen accepted the same ones. Movement 1 needed a moment where the Operator *agrees* |
| ✅ **§4.3 — epilogue** | **SHIPPED 2026-08-28** — ⭐ **12 of the 13 chapters needed nothing.** It was written under this arc before the arc had a name. Both fixes are in ch 8 and both are **omissions made visible**: `LINE 0 — PROCUREMENT`, entered at zero, and **the ledger has no line for the city**, because the city was never an expense — it was LINE 1 |
| ✅ **§4.4 — THE RECOGNITION** | **RE-READ 2026-08-28 — NO CHANGE**, and the reasoning is now in the code block so it is not re-opened. ⛔ The darker frame is a reason to **leave TEND alone**, not to sharpen it — it is already the coldest of the three *because it withholds the verdict* |
| ✅ **§4.5 — Ch II's ten** | **RE-READ — NO CHANGE**, exactly as §4 predicted. `subject104` reclassifies a whistleblower as *System Waste*; `clinic` patches batteries because new ones cost more. Nothing to add |
| ✅ **§4.6 — item descriptions** | **SHIPPED 2026-08-28** — 8 cards rewritten under §6.5, **9 evidence quotes repaired**, and the promise turned into a test |
| ✅ **§4.7 — achievement flavour** | **RE-READ 2026-08-28 → NO REWRITE**, and ⛔ **the doc's "lowest leverage" call was wrong** — see §6.6. Three real defects found on that surface instead, two of them shipped |

> ### ⭐ WHAT THE WHOLE PASS ACTUALLY COST
> The doc budgeted **≈1,400 words** for §§4.2–4.6 and the reframe came in at roughly **a
> quarter of that**, because the finding at the top of this file held all the way down:
> **the game already told this story.** Four of the six sections needed a *re-read and a
> recorded verdict*, not prose. ⛔ The failure mode for the remaining §4.7 is the same one
> §6 names — writing 300 words of achievement flavour because a budget said 300, into the
> surface with the **lowest** leverage in the game.
