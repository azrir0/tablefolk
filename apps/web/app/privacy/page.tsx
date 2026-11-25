import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy & Community Guidelines — TableFolk",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-oat-100 px-6 py-10">
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border-2 border-oat-300 bg-oat-50 p-7 shadow-cozy">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-espresso-soft hover:text-espresso"
        >
          <ArrowLeft className="h-4 w-4" /> Back to TableFolk
        </Link>

        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-7 w-7 text-sage-700" />
          <h1 className="font-display text-3xl font-bold text-espresso">
            Privacy &amp; Café Guidelines
          </h1>
        </div>

        <section className="space-y-2 text-sm leading-relaxed text-espresso-soft">
          <h2 className="font-display text-lg font-bold text-espresso">
            1. What Data TableFolk Stores (Beta)
          </h2>
          <p>
            When you enter as a Guest or create an account, we store your display
            name, avatar customization, optional email/hashed password, and board
            game session results so you can reconnect and keep your look.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-espresso-soft">
          <h2 className="font-display text-lg font-bold text-espresso">
            2. Community Conduct &amp; Moderation
          </h2>
          <p>
            TableFolk is a welcoming social café. Harassment, hate speech, and
            spam are not tolerated. You can mute players locally or submit a
            moderation report directly from any chat message.
          </p>
        </section>

        <section className="space-y-2 text-sm leading-relaxed text-espresso-soft">
          <h2 className="font-display text-lg font-bold text-espresso">
            3. Fair Play
          </h2>
          <p>
            All board game rules, card shuffles, hidden roles, and win checks are
            executed authoritatively on our game server. Private cards are never
            shared with other players.
          </p>
        </section>
      </div>
    </div>
  );
}
