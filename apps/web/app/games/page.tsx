import React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Compass, Crown, Map, Users } from "lucide-react";
import { GameIcon } from "@/components/GameIcons";
import { GamesWardrobeRuleButton } from "@/components/GamesWardrobeRuleButton";

export const metadata = {
  title: "Game Collection & Rules — TableFolk",
  description:
    "Explore the TableFolk board game collection and learn how to play Lantern Watch, Dawnspire, Harborreach, Sunstone Guild, Velvet Masque, Hearthvale, and Treasure Trails inside Sunlit Oak Café.",
};

export default function GamesCataloguePage() {
  return (
    <div className="min-h-screen bg-oat-100 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-espresso-soft hover:text-espresso"
          >
            <ArrowLeft className="h-4 w-4" /> Back to TableFolk
          </Link>
          <Link
            href="/cafe"
            className="rounded-full bg-sage-500 px-5 py-2 text-sm font-bold text-white hover:bg-sage-700"
          >
            Play in the Café →
          </Link>
        </div>

        <div>
          <h1 className="flex items-center gap-3 font-display text-4xl font-bold text-espresso">
            <GameIcon name="bookshelf" className="h-9 w-9" />
            TableFolk Game Collection
          </h1>
          <p className="mt-2 text-espresso-soft">
            Browse every tabletop game playable inside Sunlit Oak Café. Sit at any
            table to switch games, invite friends, or practice solo with smart Café Bots!
          </p>
        </div>

        {/* Game #7: Lantern Watch */}
        <article className="rounded-3xl border-2 border-[#2D3A59]/65 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-[#2D3A59]/15 px-3 py-1 text-xs font-bold text-[#2D3A59]">
                New • Hidden-Role Social Deduction &amp; Council Ledger
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-lantern" className="h-8 w-8" />
                Lantern Watch
              </h2>
              <p className="mt-1 text-espresso-soft">
                Form covert courier crews, read every public Approve/Reject vote in the
                Council Ledger, and light 3 Coastal Beacons before hidden Shadow Moles
                extinguish them — with zero player elimination!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 4–8 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 8–12 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Compass className="h-5 w-5 text-[#2D3A59]" /> Public Votes, Secret Missions
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Always-Visible Council Ledger:</strong> Every proposed team, public
                  Approve/Reject dot, and shuffled Beacon outcome stays logged for pure deduction!
                </li>
                <li>
                  <strong>Zero Player Elimination:</strong> Every player proposes, debates, and
                  votes all match — 5 consecutive rejections triggers a Shadow Council Collapse win!
                </li>
                <li>
                  <strong>Canonical 4–8p Balance:</strong> Features exact 5–8p crew tables (with
                  2-Fail Beacon 4 at 7–8p) plus cozy 4p Mini-Watch and fair Deduction Practice Bots!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-amberwarm-600" /> Two Playable Modes
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Classic Watch:</strong> Pure Resistance deduction — Loyal Couriers vs
                  Shadow Moles who know each other from Turn 1.
                </li>
                <li>
                  <strong>Oracle &amp; Shade:</strong> Unlocks The Oracle, The Warden, Mirage,
                  Veiled Mole (7–8p), and the Brass Spyglass after Missions 2, 3 &amp; 4!
                </li>
                <li>
                  <strong>Nightblade Unmasking Climax:</strong> If the Loyal Watch lights 3 Beacons,
                  the Nightblade gets ONE dramatic shot to name The Oracle and steal victory!
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="lantern-watch" />
        </article>

        {/* Game #6: Dawnspire */}
        <article className="rounded-3xl border-2 border-[#8B3A62]/65 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-[#8B3A62]/15 px-3 py-1 text-xs font-bold text-[#8B3A62]">
                Simultaneous Card Drafting &amp; Wonders
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-dawnspire" className="h-8 w-8" />
                Dawnspire
              </h2>
              <p className="mt-1 text-espresso-soft">
                Draft three eras of sunlit wonders simultaneously! Chain structures for free,
                borrow neighbor resources automatically, clash Shields each Era, and score across
                7 victory paths!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 2–7 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 6–10 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Compass className="h-5 w-5 text-[#8B3A62]" /> Zero-Downtime Drafting
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Simultaneous 3-Era Draft:</strong> Everyone chooses at once and passes
                  hands Left → Right → Left — a 7-player match plays just as fast as 3!
                </li>
                <li>
                  <strong>Smart Auto-Trade &amp; Free Chains:</strong> Instant badges show exact
                  cheapest Left/Right trade splits and 0g Era II/III chain upgrades.
                </li>
                <li>
                  <strong>7 Scoring Paths:</strong> Military Clashes, Treasury, Wonders, Blue
                  Civic, Yellow Markets, Purple Grand Guilds, and exponential Green Science!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-amberwarm-600" /> Dual-Sided Wonders &amp; Twist
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>☀ Sunlit &amp; ✦ Starlit Sides:</strong> Pick balanced Sunlit Wonders
                  or bold asymmetric Starlit powers (Free Builds, Wild Science, Copy Guild!).
                </li>
                <li>
                  <strong>Sunlit Caravan Bonus (+4g):</strong> Selling a card gives +3 Gold — or
                  +4 Gold whenever you hold the lowest Gold at the table!
                </li>
                <li>
                  <strong>2–7 Players Everywhere:</strong> Supports 3–7p neighbor circles PLUS a
                  crisp 2-player Caravan Duel mode at the cozy Window Nook!
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="dawnspire" />
        </article>

        {/* Game #5: Harborreach */}
        <article className="rounded-3xl border-2 border-[#1E7D74]/65 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-[#1E7D74]/15 px-3 py-1 text-xs font-bold text-[#1E7D74]">
                New • Coastal Hex Trading &amp; Settlement Builder
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-harbor" className="h-8 w-8" />
                Harborreach
              </h2>
              <p className="mt-1 text-espresso-soft">
                Settle a sunlit 19-hex coastal island, harvest Timber, Clay, Wool, Grain &amp;
                Ore on 2d6 rolls, trade across Harbors &amp; Pioneers, command the Bandit Fox,
                and race to 10 Victory Points!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 2–4 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 10–18 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Map className="h-5 w-5 text-[#1E7D74]" /> Living Coastal Island
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Balanced 19-Hex Island:</strong> Fair random generation guaranteeing
                  zero adjacent red 6/8 tokens, plus 9 coastal 3:1 &amp; 2:1 Harbors!
                </li>
                <li>
                  <strong>Build &amp; Upgrade:</strong> Snake-draft 2 founding Cottages, expand
                  with Roads, upgrade to double-harvest Towns (+2★), and draw Guild Scrolls!
                </li>
                <li>
                  <strong>Structured Live Trading:</strong> Trade 4:1 Bank, coastal Harbors, or
                  send 1-click Trade Offers to humans &amp; responsive Practice Bots!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-amberwarm-600" /> Cozy Signature Twists
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Dry-Spell Harbor Compass:</strong> Missed a non-7 roll? Gain +1 Compass
                  charge — spend 3 bandit-proof charges for ANY 1 resource!
                </li>
                <li>
                  <strong>Bandit Fox &amp; 5 Guild Scrolls:</strong> Move the Fox on 7-rolls or
                  Ranger Scouts, claim Longest Trade Route (5+) &amp; Largest Watch (3+) for +2★!
                </li>
                <li>
                  <strong>Quick (8★) or Classic (10★):</strong> Play head-to-head in the cozy
                  Window Nook or up to 4 Pioneers around any café table.
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="harborreach" />
        </article>

        {/* Game #4: Sunstone Guild */}
        <article className="rounded-3xl border-2 border-[#2B5096]/65 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-[#2B5096]/15 px-3 py-1 text-xs font-bold text-[#2B5096]">
                New • Gem-Drafting Engine Builder
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-sunstone" className="h-8 w-8" />
                Sunstone Guild
              </h2>
              <p className="mt-1 text-espresso-soft">
                Draft radiant gems, forge permanent Relic discounts, spark Tier I Catalysts &amp;
                2× Grand Masterworks, attract Royal Patrons, and race to 15 Prestige!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 2–4 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 6–10 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Compass className="h-5 w-5 text-[#2B5096]" /> Tactile Gem Engine
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Draft 3 Different or 2 Same:</strong> Pick 1 each of 3 base gems, or 2
                  matching gems when 4+ remain in stock (10-gem pouch cap).
                </li>
                <li>
                  <strong>Permanent Discounts:</strong> Every Relic you craft stays forever,
                  lowering future costs — plus automatic Wild Sunstone Gold fill!
                </li>
                <li>
                  <strong>Reserve Face-Up or Blind:</strong> Hold up to 3 Relics and claim +1
                  Wild Sunstone Gold — blind deck reserves stay secret from rivals!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-amberwarm-600" /> Cozy Signature Twists
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>⚡ Tier I Catalysts:</strong> Spark-badged Workshop cards refund +1
                  matching gem immediately on craft for snappy opening turns!
                </li>
                <li>
                  <strong>2× Grand Masterworks:</strong> Select Tier III relics award double
                  permanent discounts to leap straight into Royal Patrons (+3★)!
                </li>
                <li>
                  <strong>Quick (12★) or Classic (15★):</strong> Plays head-to-head in the cozy
                  Window Nook or up to 4 artisans around any café table.
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="sunstone-guild" />
        </article>

        {/* Game #3: Velvet Masque */}
        <article className="rounded-3xl border-2 border-terracotta-500/70 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-bold text-terracotta-700">
                New • Social Bluffing &amp; Memory
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-masque" className="h-8 w-8" />
                Velvet Masque
              </h2>
              <p className="mt-1 text-espresso-soft">
                Swap masks under the crimson curtain, bluff powers even when you forget
                your own identity, and dare rivals into simultaneous Showdowns to hit 13 Gold!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 3–8 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 8–12 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Compass className="h-5 w-5 text-terracotta-700" /> Under the Velvet Cloak
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>6s Curtain Call + Fast Opening:</strong> Study every mask face-up,
                  then after just 2 shuffle turns, full bluffing &amp; peeking unlock!
                </li>
                <li>
                  <strong>Swap or Fake-Swap:</strong> Pull any rival or Velvet Stage card
                  under the crimson curtain — everyone sees the same swirl, only you know
                  whether the masks actually traded!
                </li>
                <li>
                  <strong>Simultaneous 8s Showdowns:</strong> Announce any mask without
                  peeking; everyone chooses <em>Let It Slide</em> or <em>Challenge</em> at once!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-amberwarm-600" /> Balanced 8-Mask Troupe
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Core 6 (3–6p):</strong> Monarch (+3g), Patron (+2g &amp; peek),
                  Magistrate (up to 4g Fine Box), Trickster (±1g neighbors), Illusionist
                  (fortune swap ≤4g), and Jester (+1g &amp; swap 2 masks!).
                </li>
                <li>
                  <strong>Big Gala Extras (7–8p):</strong> Taxmaster (tax richest +2g) &amp;
                  Smuggler (instant win heist at 10+ Gold!).
                </li>
                <li>
                  <strong>Zero Bankruptcy Anti-Climax:</strong> Hitting 0 Gold never ends
                  the match abruptly — bounce back on your turn!
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="velvet-masque" />
        </article>

        {/* Game #2: Hearthvale */}
        <article className="rounded-3xl border-2 border-amberwarm-400/70 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-amberwarm-100 px-3 py-1 text-xs font-bold text-amberwarm-600">
                New • Cozy Tile-Laying Strategy
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-hearthvale" className="h-8 w-8" />
                Hearthvale
              </h2>
              <p className="mt-1 text-espresso-soft">
                Build a sunlit storybook valley of terracotta towns, lantern-lit
                roads, and hilltop windmills — and steal rival strongholds with your
                Mayor!
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 2–5 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 5–10 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Map className="h-5 w-5 text-amberwarm-600" /> Modernized Tile Rules
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>2-Tile Architect Hand:</strong> Hold 2 valley tiles at all
                  times — play 1 each turn and refill back to 2 for tactical choice
                  with zero dead draws.
                </li>
                <li>
                  <strong className="inline-flex items-center gap-1">
                    <GameIcon name="hv-lantern" className="h-4 w-4" /> Roadside Lanterns:
                  </strong>{" "}
                  Complete a road with at least 1 Lantern to double the entire road from
                  1 pt to <strong>2 pts per tile</strong>!
                </li>
                <li>
                  <strong className="inline-flex items-center gap-1">
                    <GameIcon name="hv-windmill" className="h-4 w-4" /> Hilltop Windmills:
                  </strong>{" "}
                  Surround a Windmill on all 8 neighboring tiles for an instant{" "}
                  <strong>9 points</strong>.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <Crown className="h-5 w-5 text-sage-700" /> Villagers &amp; The Mayor
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>5 Villagers (Strength 1) + 1 Mayor (Strength 2):</strong>{" "}
                  Merge separate towns or roads to outnumber rivals and take over the
                  payout!
                </li>
                <li>
                  <strong>Balanced Town Scoring:</strong> Completed 2-tile mini-towns
                  score 3 pts (+2/Crest); 3+ tile towns score 2 pts/tile + 2/Crest.
                </li>
                <li>
                  <strong>Cozy (36 tiles) or Grand (54 tiles):</strong> Great at both
                  the 2-seat Window Nook and 4–8 seat café tables.
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="hearthvale" />
        </article>

        {/* Game #1: Treasure Trails */}
        <article className="rounded-3xl border-2 border-oat-300 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-700">
                Available Now • Hidden-Role
              </span>
              <h2 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-bold text-espresso">
                <GameIcon name="game-trails" className="h-8 w-8" />
                Treasure Trails
              </h2>
              <p className="mt-1 text-espresso-soft">
                Chart sunlit botanical ruins to the hidden Treasure Chest — while secret
                Impostors plot from inside the expedition crew.
              </p>
            </div>
            <div className="flex gap-3 text-xs font-bold text-espresso-soft">
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Users className="h-4 w-4 text-sage-700" /> 3–8 Players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-oat-100 px-3 py-2">
                <Clock className="h-4 w-4 text-amberwarm-600" /> 10–25 Min
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <GameIcon name="role-explorer" className="h-5 w-5" /> Roles &amp; Win Conditions
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Explorers:</strong> Build an unbroken open trail from{" "}
                  <strong>Base Camp</strong> to the hidden{" "}
                  <strong>Treasure Chest Vault</strong> among 3 Sealed Vaults.
                </li>
                <li>
                  <strong>Impostors:</strong> Secretly break explorer tools, drop
                  dead-ends, and stall routes until the Expedition Deck and hands
                  run dry!
                </li>
              </ul>
            </div>

            <div className="rounded-2xl bg-oat-100 p-5">
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-espresso">
                <BookOpen className="h-5 w-5 text-amberwarm-600" /> Turn Actions
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Place Path Tile:</strong> Extend the connected trail (Flip
                  180° anytime!).
                </li>
                <li>
                  <strong>Action Cards:</strong> Break or Fix a{" "}
                  <strong>Lantern</strong>, <strong>Compass</strong>, or{" "}
                  <strong>Pickaxe</strong>; scout a sealed vault with{" "}
                  <strong>Peek Vault</strong>; remove a blocker with{" "}
                  <strong>Blast Tile</strong>.
                </li>
                <li>
                  <strong>Quick Fix Twist:</strong> Discard 2 cards face-down to fix 1
                  of your own broken tools — never get soft-locked!
                </li>
              </ul>
            </div>
          </div>

          <GamesWardrobeRuleButton gameSlug="treasure-trails" />
        </article>

        {/* Upcoming Teasers */}
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Matcha Tiles",
              meta: "2–4 Players • Easy Strategy • Wave 2",
              desc: "Relaxed ceramic pattern-building café tile game.",
            },
            {
              title: "Lantern Duel",
              meta: "2 Players • Quick Bluffing • Wave 2",
              desc: "Fast two-player tabletop card duel made for Window Nook.",
            },
          ].map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-oat-300 bg-oat-50/70 p-5 opacity-85"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-espresso-muted">
                {g.meta}
              </div>
              <h3 className="mt-1 font-display text-xl font-bold text-espresso">
                {g.title}
              </h3>
              <p className="mt-1 text-sm text-espresso-soft">{g.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
