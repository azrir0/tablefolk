import React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Compass, Crown, Map, Users } from "lucide-react";
import { GameIcon } from "@/components/GameIcons";

export const metadata = {
  title: "Game Wardrobe & Rules — TableFolk",
  description:
    "Explore the TableFolk board game collection and learn how to play Treasure Trails, Hearthvale, and Velvet Masque inside Sunlit Oak Café.",
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
            The Game Wardrobe
          </h1>
          <p className="mt-2 text-espresso-soft">
            Browse every tabletop game available inside Sunlit Oak Café. Walk up to
            the wooden bookshelf in-game to pick up a box and carry it to your table!
          </p>
        </div>

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
