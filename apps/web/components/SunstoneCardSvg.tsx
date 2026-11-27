"use client";

import React from "react";
import { Check, Lock, Sparkles, Zap } from "lucide-react";
import {
  BASE_GEM_COLORS,
  GEM_META,
  type BaseGemColor,
  type CardPaymentBreakdown,
  type GemBonuses,
  type GuildPatron,
  type RelicCard,
  type RelicTier,
  type TokenColor,
} from "@tablefolk/game-sunstone-guild";
import { GameIcon, sunstoneGemToIconName } from "./GameIcons";

const CARD_BANNER_STYLES: Record<
  BaseGemColor,
  { headerBg: string; cardBg: string; border: string; accent: string }
> = {
  ruby: {
    headerBg: "bg-gradient-to-r from-[#D64045] to-[#B83238]",
    cardBg: "bg-gradient-to-b from-[#FFF9F8] to-[#FDEEEB]",
    border: "border-[#E39B9E]",
    accent: "text-[#982126]",
  },
  sapphire: {
    headerBg: "bg-gradient-to-r from-[#2D6CDF] to-[#2354B3]",
    cardBg: "bg-gradient-to-b from-[#F8FBFF] to-[#EBF2FD]",
    border: "border-[#94B6F0]",
    accent: "text-[#1D4A9E]",
  },
  emerald: {
    headerBg: "bg-gradient-to-r from-[#28965A] to-[#1E7847]",
    cardBg: "bg-gradient-to-b from-[#F7FDF9] to-[#E9F7EE]",
    border: "border-[#8AD1A8]",
    accent: "text-[#18643A]",
  },
  amethyst: {
    headerBg: "bg-gradient-to-r from-[#8B4CC6] to-[#6E37A3]",
    cardBg: "bg-gradient-to-b from-[#FCF9FF] to-[#F2E9FB]",
    border: "border-[#BE9AE3]",
    accent: "text-[#5A2A89]",
  },
  pearl: {
    headerBg: "bg-gradient-to-r from-[#587D8F] to-[#436475]",
    cardBg: "bg-gradient-to-b from-[#F9FCFD] to-[#EAF2F6]",
    border: "border-[#9EBBC9]",
    accent: "text-[#355160]",
  },
};

const TIER_STYLES: Record<RelicTier, { label: string; bg: string; border: string; dots: string }> = {
  1: {
    label: "Tier I",
    bg: "bg-gradient-to-b from-[#E5F2E6] to-[#CBE3CD]",
    border: "border-[#7AA980]",
    dots: "●",
  },
  2: {
    label: "Tier II",
    bg: "bg-gradient-to-b from-[#FEF2D6] to-[#F5DC9F]",
    border: "border-[#D49F3B]",
    dots: "●●",
  },
  3: {
    label: "Tier III",
    bg: "bg-gradient-to-b from-[#EFE6FA] to-[#DAC6F2]",
    border: "border-[#9368C4]",
    dots: "●●●",
  },
};

export function GemChipIcon({
  color,
  size = "md",
}: {
  color: TokenColor;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const cls =
    size === "xs"
      ? "h-3.5 w-3.5"
      : size === "sm"
        ? "h-4 w-4"
        : size === "lg"
          ? "h-6 w-6"
          : "h-5 w-5";
  return <GameIcon name={sunstoneGemToIconName(color)} className={cls} />;
}

export function GemBankButton({
  color,
  count,
  selectedCount = 0,
  disabled = false,
  highlightDouble = false,
  onClick,
}: {
  color: TokenColor;
  count: number;
  selectedCount?: number;
  disabled?: boolean;
  highlightDouble?: boolean;
  onClick?: () => void;
}) {
  const meta = GEM_META[color];
  const isGold = color === "gold";
  const interactive = Boolean(onClick) && !disabled && !isGold;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      title={
        isGold
          ? `${meta.label} (${count} left) — Earned by Reserving a Relic`
          : `${meta.label} (${count} in bank)${highlightDouble ? " · Tap again to take 2!" : ""}`
      }
      className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 px-2 py-1.5 transition short:rounded-xl short:px-1.5 short:py-1 ${
        selectedCount > 0
          ? "scale-[1.04] border-emerald-500 bg-white shadow-md ring-2 ring-emerald-400/50"
          : isGold
            ? "cursor-default border-amberwarm-400/70 bg-amberwarm-100/70"
            : disabled || count <= 0
              ? "cursor-not-allowed border-oat-200 bg-oat-100/60 opacity-45"
              : "cursor-pointer border-oat-300 bg-white hover:-translate-y-0.5 hover:border-espresso/40 hover:shadow-sm active:scale-95"
      }`}
    >
      {/* Weighted porcelain chip disc */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 shadow-inner sm:h-10 sm:w-10 short:h-7 short:w-7"
        style={{
          backgroundColor: meta.softBg,
          borderColor: meta.border,
        }}
      >
        <GameIcon
          name={sunstoneGemToIconName(color)}
          className="h-5 w-5 sm:h-6 sm:w-6 short:h-4 short:w-4"
        />
      </div>

      {/* Label + Stock */}
      <span
        className="mt-1 text-[10px] font-extrabold leading-none short:mt-0.5 short:text-[9px]"
        style={{ color: meta.text }}
      >
        {isGold ? "Wild ★" : meta.label}
      </span>

      {/* Top-right Stock Pill */}
      <span
        className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-extrabold shadow-sm short:h-4 short:min-w-4 short:text-[9px] ${
          count === 0
            ? "border-oat-300 bg-oat-200 text-espresso-muted"
            : count >= 4 && !isGold
              ? "border-espresso/20 bg-espresso text-white"
              : "border-oat-300 bg-white text-espresso"
        }`}
      >
        {count}
      </span>

      {/* Staged Selection Pill */}
      {selectedCount > 0 && (
        <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-extrabold text-white shadow">
          +{selectedCount}
        </span>
      )}
    </button>
  );
}

export function TierDeckPile({
  tier,
  count,
  canReserve,
  onReserveBlind,
}: {
  tier: RelicTier;
  count: number;
  canReserve: boolean;
  onReserveBlind?: () => void;
}) {
  const st = TIER_STYLES[tier];
  const clickable = canReserve && count > 0 && Boolean(onReserveBlind);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onReserveBlind}
      title={
        clickable
          ? `Reserve top hidden ${st.label} Relic (+1 Wild Gold)`
          : `${st.label} Deck (${count} cards left)`
      }
      className={`relative flex h-full min-h-[104px] flex-col items-center justify-between rounded-2xl border-2 p-2 text-center shadow-sm transition short:min-h-[76px] short:rounded-xl short:p-1.5 ${st.bg} ${st.border} ${
        clickable
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-95"
          : "cursor-default opacity-80"
      }`}
    >
      <span className="text-[10px] font-black tracking-wider text-espresso/75 short:text-[9px]">
        {st.dots}
      </span>
      <div className="flex flex-col items-center">
        <span className="font-display text-xs font-extrabold text-espresso short:text-[10px]">
          {st.label}
        </span>
        <span className="mt-0.5 rounded-full bg-white/75 px-2 py-0.5 text-[10px] font-extrabold text-espresso short:px-1.5 short:text-[9px]">
          {count} left
        </span>
      </div>
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-espresso-soft short:hidden">
        {clickable ? (
          <>
            <Lock className="h-2.5 w-2.5" /> Blind +★
          </>
        ) : (
          "Deck"
        )}
      </span>
    </button>
  );
}

export function RelicCardTile({
  card,
  payment,
  bonuses,
  isSelected,
  isInteractive,
  compact = false,
  onClick,
}: {
  card: RelicCard;
  payment?: CardPaymentBreakdown;
  bonuses?: GemBonuses;
  isSelected?: boolean;
  isInteractive?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const style = CARD_BANNER_STYLES[card.gem];
  const canAfford = Boolean(payment?.canAfford);
  const costEntries = BASE_GEM_COLORS.filter((c) => (card.cost[c] ?? 0) > 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border-2 text-left transition short:rounded-xl ${
        style.cardBg
      } ${
        isSelected
          ? "scale-[1.02] border-espresso shadow-lg ring-2 ring-amberwarm-400"
          : canAfford && isInteractive
            ? "border-emerald-500 shadow-md ring-2 ring-emerald-400/45 hover:-translate-y-0.5 hover:shadow-lg"
            : `${style.border} shadow-sm ${
                isInteractive ? "hover:-translate-y-0.5 hover:border-espresso/50 hover:shadow-md" : ""
              }`
      } ${compact ? "min-h-[82px]" : "min-h-[104px] short:min-h-[76px]"}`}
    >
      {/* Top Jewel Header Band */}
      <div
        className={`flex items-center justify-between px-2 py-1 text-white short:px-1.5 short:py-0.5 ${style.headerBg}`}
      >
        <div className="flex items-center gap-1">
          {card.prestige > 0 ? (
            <span className="font-display text-base font-black leading-none drop-shadow-sm short:text-sm">
              {card.prestige}
            </span>
          ) : (
            <span className="text-[10px] font-bold opacity-75">·</span>
          )}
          {card.catalyst && (
            <span
              title="Catalyst: Gain +1 free matching gem from bank when crafted!"
              className="inline-flex items-center gap-0.5 rounded-full bg-amberwarm-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-espresso shadow-sm"
            >
              <Zap className="h-2.5 w-2.5 fill-espresso" /> +1
            </span>
          )}
          {card.bonusCount === 2 && (
            <span
              title="Grand Masterwork: Grants 2× permanent gem discount!"
              className="inline-flex items-center gap-0.5 rounded-full bg-amberwarm-400 px-1.5 py-0.5 text-[9px] font-black leading-none text-espresso shadow-sm"
            >
              <Sparkles className="h-2.5 w-2.5" /> 2×
            </span>
          )}
        </div>

        {/* Permanent Gem Emblem */}
        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/95 shadow-sm short:h-5 short:w-5">
          <GameIcon
            name={sunstoneGemToIconName(card.gem)}
            className="h-4 w-4 short:h-3.5 short:w-3.5"
          />
        </div>
      </div>

      {/* Card Title + Ready Badge */}
      <div className="flex flex-1 flex-col justify-center px-2 py-1 short:px-1.5 short:py-0.5">
        <div
          className={`line-clamp-1 font-display text-[11px] font-bold leading-tight short:text-[10px] ${style.accent}`}
        >
          {card.name}
        </div>
        {canAfford && isInteractive && (
          <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 short:text-[8.5px]">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
            {payment && payment.goldUsed > 0
              ? `Ready (${payment.goldUsed}★)`
              : "Ready to Craft"}
          </div>
        )}
      </div>

      {/* Bottom Cost Pip Chips */}
      <div className="flex flex-wrap items-center gap-1 border-t border-black/5 bg-white/75 px-1.5 py-1 short:gap-0.5 short:px-1 short:py-0.5">
        {costEntries.map((c) => {
          const raw = card.cost[c] ?? 0;
          const discount = bonuses?.[c] ?? 0;
          const net = Math.max(0, raw - discount);
          const meta = GEM_META[c];
          const coveredByEngine = discount > 0 && net === 0;

          return (
            <span
              key={c}
              title={`${meta.label}: ${raw} cost${discount > 0 ? ` (−${discount} engine = ${net})` : ""}`}
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-black leading-none short:px-1 short:text-[9px] ${
                coveredByEngine ? "opacity-55 line-through" : ""
              }`}
              style={{
                backgroundColor: meta.softBg,
                borderColor: meta.border,
                color: meta.text,
              }}
            >
              <GameIcon name={sunstoneGemToIconName(c)} className="h-3 w-3 short:h-2.5 short:w-2.5" />
              <span>{raw}</span>
            </span>
          );
        })}
      </div>
    </button>
  );
}

export function PatronTile({
  patron,
  bonuses,
  selectable = false,
  onSelect,
}: {
  patron: GuildPatron;
  bonuses?: GemBonuses;
  selectable?: boolean;
  onSelect?: () => void;
}) {
  const reqEntries = BASE_GEM_COLORS.filter((c) => (patron.requirements[c] ?? 0) > 0);

  return (
    <button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      className={`flex shrink-0 items-center gap-2 rounded-2xl border-2 px-2.5 py-1.5 text-left transition short:rounded-xl short:px-2 short:py-1 ${
        selectable
          ? "animate-pulse cursor-pointer border-amberwarm-600 bg-amberwarm-100 shadow-md ring-2 ring-amberwarm-400 hover:scale-[1.03]"
          : "cursor-default border-amberwarm-400/65 bg-gradient-to-br from-[#FFFDF7] to-[#FEF3D5] shadow-sm"
      }`}
    >
      <div className="flex flex-col items-center justify-center rounded-xl bg-amberwarm-400/30 px-1.5 py-1 text-center">
        <span className="font-display text-sm font-black leading-none text-amberwarm-600 short:text-xs">
          +{patron.prestige}
        </span>
        <GameIcon name="sg-crown" className="mt-0.5 h-3.5 w-3.5 short:h-3 short:w-3" />
      </div>

      <div className="min-w-0">
        <div className="truncate font-display text-[11px] font-bold leading-tight text-espresso short:text-[10px]">
          {patron.name}
        </div>
        <div className="mt-1 flex items-center gap-1 short:mt-0.5">
          {reqEntries.map((c) => {
            const req = patron.requirements[c] ?? 0;
            const have = bonuses?.[c] ?? 0;
            const met = have >= req;
            const meta = GEM_META[c];
            return (
              <span
                key={c}
                className={`inline-flex items-center gap-0.5 rounded-md border px-1 py-0.5 text-[10px] font-black leading-none short:text-[9px] ${
                  met ? "ring-1 ring-emerald-500" : ""
                }`}
                style={{
                  backgroundColor: met ? "#DCFCE7" : meta.softBg,
                  borderColor: met ? "#22C55E" : meta.border,
                  color: met ? "#166534" : meta.text,
                }}
              >
                <GameIcon name={sunstoneGemToIconName(c)} className="h-2.5 w-2.5" />
                <span>
                  {have}/{req}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </button>
  );
}
