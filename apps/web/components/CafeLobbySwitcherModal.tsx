"use client";

import React, { useEffect, useState } from "react";
import { KeyRound, Lock, Plus, Users, X } from "lucide-react";
import type { CafeInstanceSummaryDTO } from "@tablefolk/shared";
import {
  createPrivateCafe,
  fetchPublicCafes,
  resolvePrivateCafeCode,
} from "@/lib/api";

interface CafeLobbySwitcherModalProps {
  currentRoomId: string;
  onJoinPublic: (roomId?: string) => void;
  onJoinPrivate: (roomId: string, accessCode: string) => void;
  onClose: () => void;
}

export function CafeLobbySwitcherModal({
  currentRoomId,
  onJoinPublic,
  onJoinPrivate,
  onClose,
}: CafeLobbySwitcherModalProps) {
  const [cafes, setCafes] = useState<CafeInstanceSummaryDTO[]>([]);
  const [privateName, setPrivateName] = useState("Friday Night Board Games");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPublicCafes().then(setCafes).catch(console.error);
  }, []);

  async function handleCreatePrivate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await createPrivateCafe(privateName);
      onJoinPrivate(created.roomId, created.accessCode);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await resolvePrivateCafeCode(joinCode);
      onJoinPrivate(res.roomId, res.accessCode);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
        <div className="flex items-center justify-between border-b border-oat-200 px-6 py-4">
          <h2 className="font-display text-xl font-bold text-espresso">
            ☕ Switch or Create Café
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-espresso-muted hover:bg-oat-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Public Café Instances */}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-espresso-muted">
              Public Sunlit Oak Instances
            </h3>
            <div className="space-y-2">
              {cafes.map((c) => (
                <div
                  key={c.roomId}
                  className="flex items-center justify-between rounded-2xl border border-oat-300 bg-white px-4 py-3"
                >
                  <div>
                    <div className="font-display text-sm font-bold text-espresso">
                      {c.name} — {c.instanceLabel}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-espresso-muted">
                      <Users className="h-3.5 w-3.5 text-sage-700" />
                      {c.playerCount}/{c.maxPlayers} visitors
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={c.roomId === currentRoomId}
                    onClick={() => {
                      onJoinPublic(c.roomId);
                      onClose();
                    }}
                    className="rounded-xl bg-sage-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sage-700 disabled:bg-oat-200 disabled:text-espresso-muted"
                  >
                    {c.roomId === currentRoomId ? "Current" : "Visit"}
                  </button>
                </div>
              ))}
              {cafes.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onJoinPublic();
                    onClose();
                  }}
                  className="w-full rounded-2xl bg-sage-500 py-2.5 text-xs font-bold text-white"
                >
                  Join Public Sunlit Oak Café
                </button>
              )}
            </div>
          </div>

          {/* Create Private Café */}
          <form
            onSubmit={handleCreatePrivate}
            className="space-y-2.5 rounded-2xl bg-oat-100 p-4"
          >
            <div className="flex items-center gap-1.5 font-display text-sm font-bold text-espresso">
              <Lock className="h-4 w-4 text-amberwarm-600" /> Create Private
              Invite-Only Café
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={privateName}
                onChange={(e) => setPrivateName(e.target.value)}
                maxLength={40}
                className="flex-1 rounded-xl border border-oat-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-sage-500"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-xl bg-espresso px-4 py-2 text-xs font-bold text-oat-50 hover:bg-espresso-soft"
              >
                <Plus className="h-3.5 w-3.5" /> Create
              </button>
            </div>
          </form>

          {/* Join by Code */}
          <form
            onSubmit={handleJoinByCode}
            className="space-y-2.5 rounded-2xl bg-oat-100 p-4"
          >
            <div className="flex items-center gap-1.5 font-display text-sm font-bold text-espresso">
              <KeyRound className="h-4 w-4 text-sage-700" /> Join Private Café
              with Code
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3"
                maxLength={10}
                className="flex-1 rounded-xl border border-oat-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-sage-500"
              />
              <button
                type="submit"
                disabled={busy || !joinCode.trim()}
                className="rounded-xl bg-sage-500 px-4 py-2 text-xs font-bold text-white hover:bg-sage-700 disabled:opacity-50"
              >
                Join
              </button>
            </div>
          </form>

          {error && (
            <div className="rounded-xl bg-terracotta-100 px-3.5 py-2 text-xs font-bold text-terracotta-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
