"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Coffee,
  Compass,
  Dice5,
  DoorOpen,
  Shuffle,
  Sparkles,
  Users,
} from "lucide-react";
import { generateRandomAvatarConfig, type AvatarConfig } from "@tablefolk/shared";
import { AvatarSvg } from "@tablefolk/ui";
import { loginAccount, loginAsGuest, registerAccount } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"guest" | "login" | "register">("guest");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [avatar, setAvatar] = useState<AvatarConfig>(() =>
    generateRandomAvatarConfig(2026)
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const previewFriends = useMemo(
    () => [
      generateRandomAvatarConfig(101),
      generateRandomAvatarConfig(202),
      generateRandomAvatarConfig(303),
    ],
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "guest") {
        await loginAsGuest(nickname.trim() || "Cozy Explorer", avatar);
      } else if (mode === "register") {
        await registerAccount(email, password, nickname.trim() || "Explorer", avatar);
      } else {
        await loginAccount(email, password);
      }

      const code = inviteCode.trim().toUpperCase();
      router.push(code ? `/cafe?code=${encodeURIComponent(code)}` : "/cafe");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-oat-50 via-oat-100 to-oat-200">
      {/* Top Navbar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage-500 text-white shadow-sm">
            <Coffee className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display text-2xl font-bold tracking-tight text-espresso">
              TableFolk
            </span>
            <span className="ml-2 rounded-full bg-amberwarm-100 px-2 py-0.5 text-xs font-bold text-amberwarm-600">
              Beta Café
            </span>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-sm font-bold text-espresso-soft">
          <Link href="/games" className="transition hover:text-sage-700">
            Game Wardrobe
          </Link>
          <Link
            href="/cafe"
            className="rounded-full bg-espresso px-4 py-2 text-oat-50 shadow-sm transition hover:bg-espresso-soft"
          >
            Enter Café
          </Link>
        </nav>
      </header>

      {/* Main Hero */}
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-8 lg:grid-cols-12 lg:items-center lg:py-12">
        {/* Left: Café Pitch & Visual */}
        <section className="space-y-6 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-sage-300/60 bg-sage-100 px-3.5 py-1.5 text-xs font-bold text-sage-700">
            <Sparkles className="h-3.5 w-3.5" />
            Virtual Board Game Café • Play Together in Browser
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight text-espresso sm:text-5xl">
            Pull up a chair.{" "}
            <span className="text-sage-700">Carry a box from the shelf.</span>{" "}
            Play with friends.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-espresso-soft">
            TableFolk recreates the warmth of visiting your favorite board game café.
            Stroll around in your customized character, learn rules from the cashier,
            grab a seat at a table, and play server-authoritative tabletop hits like{" "}
            <strong>Treasure Trails</strong> and <strong>Hearthvale</strong>.
          </p>

          {/* Cozy Café Scene Preview Card */}
          <div className="rounded-3xl border border-oat-300 bg-oat-50/90 p-5 shadow-cozy">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center -space-x-3">
                {previewFriends.map((cfg, i) => (
                  <div
                    key={i}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-oat-50 bg-oat-100 shadow-sm"
                  >
                    <AvatarSvg config={cfg} size={58} />
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sage-700">
                  <Compass className="h-4 w-4" /> 2 Playable Café Games
                </div>
                <h2 className="font-display text-xl font-bold text-espresso">
                  🗺️ Treasure Trails &amp; 🌾 Hearthvale
                </h2>
                <p className="text-sm text-espresso-soft">
                  Play hidden-role sabotage (3–8p) or cozy tile-laying valley
                  strategy with Lantern Roads &amp; Mayor takeovers (2–5p)!
                </p>
              </div>
              <Link
                href="/games"
                className="rounded-xl border border-oat-300 bg-oat-100 px-4 py-2 text-xs font-bold text-espresso transition hover:bg-oat-200"
              >
                Read Rules →
              </Link>
            </div>
          </div>

          {/* Key Highlights */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { icon: Users, title: "Public & Private", sub: "Drop in or share a code" },
              { icon: Dice5, title: "Hybrid Seating", sub: "Walk up & pick a chair" },
              { icon: Sparkles, title: "Solo-Friendly", sub: "Add Practice Bots anytime" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-oat-300/70 bg-oat-50/70 p-3.5"
              >
                <item.icon className="mb-1.5 h-4 w-4 text-sage-700" />
                <div className="font-display text-sm font-bold text-espresso">
                  {item.title}
                </div>
                <div className="text-xs text-espresso-muted">{item.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Right: Instant Guest / Auth Entry Card */}
        <section className="lg:col-span-5">
          <div className="rounded-3xl border-2 border-oat-300 bg-oat-50 p-6 shadow-cozy">
            {/* Mode Switcher */}
            <div className="mb-5 grid grid-cols-3 rounded-2xl bg-oat-200/70 p-1 text-xs font-bold">
              {(
                [
                  ["guest", "Instant Guest"],
                  ["register", "Create Account"],
                  ["login", "Sign In"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`rounded-xl py-2 transition ${
                    mode === m
                      ? "bg-oat-50 text-espresso shadow-sm"
                      : "text-espresso-muted hover:text-espresso"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Live Avatar Preview for Guest / Register */}
            {mode !== "login" && (
              <div className="mb-5 flex items-center gap-4 rounded-2xl bg-oat-100 p-3.5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-oat-300 bg-oat-50">
                  <AvatarSvg config={avatar} size={74} />
                </div>
                <div className="flex-1">
                  <div className="font-display text-sm font-bold text-espresso">
                    Your Café Character
                  </div>
                  <p className="mb-2 text-xs text-espresso-muted">
                    Customize hair, outfits & accessories anytime inside!
                  </p>
                  <button
                    type="button"
                    onClick={() => setAvatar(generateRandomAvatarConfig(Date.now()))}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-3 py-1.5 text-xs font-bold text-espresso transition hover:bg-oat-300"
                  >
                    <Shuffle className="h-3.5 w-3.5" /> Randomize Look
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode !== "login" && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-espresso-soft">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. MatchaMilo"
                    maxLength={24}
                    required={mode === "guest"}
                    className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-espresso outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-300/40"
                  />
                </div>
              )}

              {mode !== "guest" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-espresso-soft">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-espresso outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-300/40"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-espresso-soft">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      minLength={6}
                      required
                      className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-espresso outline-none transition focus:border-sage-500 focus:ring-2 focus:ring-sage-300/40"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-espresso-soft">
                  Private Café Code <span className="font-normal text-espresso-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="Leave blank for Sunlit Oak Public Café"
                  maxLength={10}
                  className="w-full rounded-xl border border-oat-300 bg-white px-3.5 py-2 text-sm font-bold tracking-widest text-espresso uppercase outline-none transition focus:border-sage-500"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-terracotta-100 px-3.5 py-2.5 text-xs font-bold text-terracotta-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sage-500 py-3 font-display text-base font-bold text-white shadow-sm transition hover:bg-sage-700 disabled:opacity-60"
              >
                <DoorOpen className="h-5 w-5" />
                {submitting
                  ? "Opening Café Doors..."
                  : mode === "guest"
                    ? "Step Into the Café"
                    : mode === "register"
                      ? "Create Account & Enter"
                      : "Sign In & Enter"}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-6 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-oat-300/60 px-6 py-5 text-xs font-semibold text-espresso-muted">
        <div>TableFolk Wave 1 Public Beta · Built for friends &amp; board game lovers</div>
        <div className="flex items-center gap-4">
          <Link href="/games" className="hover:text-espresso">
            Treasure Trails Rules
          </Link>
          <Link href="/privacy" className="hover:text-espresso">
            Privacy &amp; Guidelines
          </Link>
        </div>
      </footer>
    </div>
  );
}
