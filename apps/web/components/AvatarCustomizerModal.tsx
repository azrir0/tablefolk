"use client";

import React, { useState } from "react";
import { Shuffle, X } from "lucide-react";
import {
  ACCESSORIES,
  BOTTOM_STYLES,
  CLOTHING_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  SHOE_STYLES,
  SKIN_TONES,
  TOP_STYLES,
  generateRandomAvatarConfig,
  type AvatarConfig,
} from "@tablefolk/shared";
import { AvatarSvg } from "@tablefolk/ui";

interface AvatarCustomizerModalProps {
  initialConfig: AvatarConfig;
  initialDisplayName: string;
  onSave: (config: AvatarConfig, displayName: string) => Promise<void>;
  onClose: () => void;
}

export function AvatarCustomizerModal({
  initialConfig,
  initialDisplayName,
  onSave,
  onClose,
}: AvatarCustomizerModalProps) {
  const [config, setConfig] = useState<AvatarConfig>(initialConfig);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [saving, setSaving] = useState(false);

  const patch = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(config, displayName.trim() || initialDisplayName);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-cozy">
        <div className="flex items-center justify-between border-b border-oat-200 px-6 py-4">
          <h2 className="font-display text-xl font-bold text-espresso">
            Customize Your Character
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-espresso-muted hover:bg-oat-200 hover:text-espresso"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-6 md:grid-cols-12">
          {/* Left Preview */}
          <div className="flex flex-col items-center justify-center rounded-2xl bg-oat-100 p-5 md:col-span-4">
            <div className="flex h-40 w-40 items-center justify-center rounded-3xl border-2 border-oat-300 bg-oat-50 shadow-inner">
              <AvatarSvg config={config} size={145} />
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={24}
              placeholder="Display Name"
              className="mt-4 w-full rounded-xl border border-oat-300 bg-white px-3 py-2 text-center text-sm font-bold text-espresso outline-none focus:border-sage-500"
            />
            <button
              type="button"
              onClick={() => setConfig(generateRandomAvatarConfig(Date.now()))}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-oat-200 px-3.5 py-2 text-xs font-bold text-espresso hover:bg-oat-300"
            >
              <Shuffle className="h-3.5 w-3.5" /> Surprise Me
            </button>
          </div>

          {/* Right Controls */}
          <div className="space-y-4 md:col-span-8">
            {/* Skin Tone */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                Skin Tone
              </label>
              <div className="flex flex-wrap gap-2">
                {SKIN_TONES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    title={s.label}
                    onClick={() => patch("skinTone", s.hex)}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      config.skinTone === s.hex
                        ? "scale-110 border-espresso ring-2 ring-sage-500/40"
                        : "border-oat-300"
                    }`}
                    style={{ backgroundColor: s.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Hair Style & Color */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                Hairstyle
              </label>
              <div className="flex flex-wrap gap-1.5">
                {HAIR_STYLES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => patch("hairStyle", h.id)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                      config.hairStyle === h.id
                        ? "bg-sage-500 text-white"
                        : "bg-oat-100 text-espresso-soft hover:bg-oat-200"
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {HAIR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => patch("hairColor", c.hex)}
                    className={`h-6 w-6 rounded-full border-2 ${
                      config.hairColor === c.hex
                        ? "scale-110 border-espresso"
                        : "border-oat-300"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Top Style & Colors */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                Top & Outfit Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TOP_STYLES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => patch("topStyle", t.id)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      config.topStyle === t.id
                        ? "bg-sage-500 text-white"
                        : "bg-oat-100 text-espresso-soft hover:bg-oat-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CLOTHING_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => patch("topColor", c.hex)}
                    className={`h-6 w-6 rounded-full border-2 ${
                      config.topColor === c.hex
                        ? "scale-110 border-espresso"
                        : "border-oat-300"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>

            {/* Bottoms & Shoes */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                  Bottoms
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {BOTTOM_STYLES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => patch("bottomStyle", b.id)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                        config.bottomStyle === b.id
                          ? "bg-sage-500 text-white"
                          : "bg-oat-100 text-espresso-soft"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CLOTHING_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => patch("bottomColor", c.hex)}
                      className={`h-5 w-5 rounded-full border-2 ${
                        config.bottomColor === c.hex ? "border-espresso" : "border-oat-300"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                  Shoes
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SHOE_STYLES.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => patch("shoeStyle", sh.id)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                        config.shoeStyle === sh.id
                          ? "bg-sage-500 text-white"
                          : "bg-oat-100 text-espresso-soft"
                      }`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Accessories */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-espresso-muted">
                Accessory
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ACCESSORIES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => patch("accessory", a.id)}
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      config.accessory === a.id
                        ? "bg-amberwarm-400 text-espresso"
                        : "bg-oat-100 text-espresso-soft hover:bg-oat-200"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-oat-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold text-espresso-soft hover:bg-oat-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-xl bg-sage-500 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-sage-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Character"}
          </button>
        </div>
      </div>
    </div>
  );
}
