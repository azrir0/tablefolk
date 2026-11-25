import React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Compass, Users } from "lucide-react";

export const metadata = {
  title: "Game Wardrobe & Treasure Trails Rules — TableFolk",
  description:
    "Explore the TableFolk board game collection and learn how to play Treasure Trails, our original hidden-role path-building card game.",
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
          <h1 className="font-display text-4xl font-bold text-espresso">
            The Game Wardrobe
          </h1>
          <p className="mt-2 text-espresso-soft">
            Browse every tabletop game available inside Sunlit Oak Café. Walk up to
            the wooden bookshelf in-game to pick up a box and carry it to your table!
          </p>
        </div>

        {/* Featured Launch Game */}
        <article className="rounded-3xl border-2 border-oat-300 bg-oat-50 p-7 shadow-cozy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-bold text-sage-700">
                Available Now • Hidden-Role
              </span>
              <h2 className="mt-2 font-display text-3xl font-bold text-espresso">
                Treasure Trails
              </h2>
              <p className="mt-1 text-espresso-soft">
                Chart sunlit botanical ruins to the Golden Compass — while secret
                Tricksters plot from inside the crew.
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
                <Compass className="h-5 w-5 text-sage-700" /> Roles & Win Conditions
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-espresso-soft">
                <li>
                  <strong>Trailblazers:</strong> Build an unbroken open trail from{" "}
                  <strong>Base Camp</strong> to the hidden{" "}
                  <strong>Golden Compass Vault</strong> among 3 Sealed Vaults.
                </li>
                <li>
                  <strong>Tricksters:</strong> Secretly sabotage gear, drop
                  dead-ends, and misdirect routes until the Expedition Deck and hands
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
                  <strong>Action Cards:</strong> Break/repair Lantern, Compass, or
                  Grapple; peek privately with a <strong>Spyglass</strong>; remove
                  tiles with <strong>Boulder Clear</strong>.
                </li>
                <li>
                  <strong>Field-Patch Twist:</strong> Discard 2 cards face-down to
                  patch 1 of your own broken gears — never get soft-locked!
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
