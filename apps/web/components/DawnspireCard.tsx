"use client";

import React from "react";
import {
  ALL_RESOURCES,
  CARD_NAME_BY_BASE_ID,
  CATEGORY_META,
  RESOURCE_META,
  type CardCost,
  type DawnHandCardEvaluation,
  type DawnResource,
} from "@tablefolk/game-dawnspire";
import { Link2, Sparkles } from "lucide-react";
import { dawnResourceToIconName, GameIcon } from "./GameIcons";

export function DawnCostPills({
  cost,
  compact = false,
}: {
  cost: CardCost;
  compact?: boolean;
}) {
  const resEntries: Array<[DawnResource, number]> = [];
  if (cost.resources) {
    for (const r of ALL_RESOURCES) {
      const q = cost.resources[r] ?? 0;
      if (q > 0) resEntries.push([r, q]);
    }
  }
  const coinCost = cost.coins ?? 0;

  if (coinCost === 0 && resEntries.length === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-black text-emerald-800">
        FREE
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {coinCost > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full border border-amberwarm-400/70 bg-amberwarm-100 px-1.5 py-0.5 text-[9.5px] font-black text-espresso">
          <GameIcon name="coin-gold" className="h-3 w-3" />
          {coinCost}g
        </span>
      )}
      {resEntries.map(([r, qty]) => {
        const meta = RESOURCE_META[r];
        return (
          <span
            key={r}
            title={`${qty} ${meta.label}`}
            className="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9.5px] font-black"
            style={{
              backgroundColor: meta.softBg,
              borderColor: `${meta.hex}66`,
              color: meta.text,
            }}
          >
            <GameIcon
              name={dawnResourceToIconName(r)}
              className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
            />
            {qty > 1 ? `×${qty}` : ""}
          </span>
        );
      })}
    </div>
  );
}

interface DawnspireHandCardProps {
  evaluation: DawnHandCardEvaluation;
  selected: boolean;
  lockedActionType?: "BUILD_CARD" | "BUILD_WONDER" | "SELL_CARD" | null;
  onSelect: () => void;
}

export function DawnspireHandCard({
  evaluation,
  selected,
  lockedActionType,
  onSelect,
}: DawnspireHandCardProps) {
  const { card, buildPlan, canUseWonderFreeBuild } = evaluation;
  const catMeta = CATEGORY_META[card.category];

  const categoryIcon =
    card.category === "civic"
      ? "ds-civic"
      : card.category === "commerce"
        ? "ds-commerce"
        : card.category === "military"
          ? "ds-military"
          : card.category === "science"
            ? "ds-science"
            : card.category === "guild"
              ? "ds-guild"
              : card.category === "craft"
                ? "ds-glass"
                : "ds-wonder";

  let statusPill: React.ReactNode;
  if (buildPlan.isDuplicate) {
    statusPill = (
      <span className="rounded-full bg-oat-200 px-1.5 py-0.5 text-[9px] font-extrabold text-espresso-muted">
        Built Already
      </span>
    );
  } else if (buildPlan.isFreeChain) {
    statusPill = (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
        <Link2 className="h-2.5 w-2.5" /> FREE CHAIN!
      </span>
    );
  } else if (buildPlan.affordable && buildPlan.totalCoins === 0) {
    statusPill = (
      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800">
        Ready · Free
      </span>
    );
  } else if (buildPlan.affordable) {
    const split =
      buildPlan.leftTradeCoins > 0 || buildPlan.rightTradeCoins > 0
        ? ` (${[
            buildPlan.leftTradeCoins > 0 ? `${buildPlan.leftTradeCoins}←` : "",
            buildPlan.rightTradeCoins > 0 ? `${buildPlan.rightTradeCoins}→` : "",
          ]
            .filter(Boolean)
            .join(" ")})`
        : "";
    statusPill = (
      <span className="rounded-full bg-amberwarm-100 px-1.5 py-0.5 text-[9px] font-black text-amberwarm-600">
        Buy · {buildPlan.totalCoins}g{split}
      </span>
    );
  } else if (canUseWonderFreeBuild) {
    statusPill = (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#8B3A62] px-1.5 py-0.5 text-[9px] font-black text-white">
        <Sparkles className="h-2.5 w-2.5" /> Wonder Free!
      </span>
    );
  } else if (buildPlan.missingResources.length > 0) {
    const firstMissing = RESOURCE_META[buildPlan.missingResources[0]!].label;
    statusPill = (
      <span className="rounded-full bg-terracotta-100 px-1.5 py-0.5 text-[9px] font-bold text-terracotta-700">
        Need {firstMissing}
        {buildPlan.missingResources.length > 1 ? `+${buildPlan.missingResources.length - 1}` : ""}
      </span>
    );
  } else {
    statusPill = (
      <span className="rounded-full bg-terracotta-100 px-1.5 py-0.5 text-[9px] font-bold text-terracotta-700">
        Need {buildPlan.totalCoins}g
      </span>
    );
  }

  const chainsToLabels = (card.chainsTo ?? [])
    .slice(0, 2)
    .map((id) => CARD_NAME_BY_BASE_ID[id] ?? id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-[132px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border-2 bg-white text-left transition short:w-[120px] short:rounded-xl ${
        selected
          ? "-translate-y-1 border-[#8B3A62] shadow-cozy ring-2 ring-[#8B3A62]/30"
          : lockedActionType
            ? "border-emerald-500 ring-2 ring-emerald-400/40"
            : buildPlan.affordable && !buildPlan.isDuplicate
              ? "border-emerald-400/80 shadow-sm hover:-translate-y-0.5 hover:border-emerald-600"
              : "border-oat-300 opacity-95 shadow-sm hover:-translate-y-0.5 hover:border-oat-300"
      }`}
    >
      {/* Colored Category Ribbon Header */}
      <div
        className="flex items-center justify-between gap-1 px-2 py-1.5 text-white short:py-1"
        style={{ backgroundColor: catMeta.hex }}
      >
        <span className="truncate text-[10.5px] font-black leading-tight short:text-[10px]">
          {card.name}
        </span>
        <GameIcon name={categoryIcon} className="h-3.5 w-3.5 shrink-0 drop-shadow-sm" />
      </div>

      {/* Main Effect Highlight */}
      <div className="flex flex-1 flex-col justify-between gap-1.5 p-2 short:gap-1 short:p-1.5">
        <div
          className="rounded-xl border px-2 py-1.5 text-center font-display text-xs font-black leading-tight short:py-1 short:text-[11px]"
          style={{
            backgroundColor: catMeta.softBg,
            borderColor: `${catMeta.hex}44`,
            color: catMeta.text,
          }}
        >
          {card.shortEffect}
        </div>

        {/* Cost Row */}
        <div className="min-h-[20px]">
          <DawnCostPills cost={card.cost} compact />
        </div>

        {/* Chain Hint (if Era I/II unlocks future cards) */}
        {chainsToLabels.length > 0 && (
          <div className="truncate text-[9px] font-bold text-espresso-muted">
            ↳ Free: {chainsToLabels.join(", ")}
          </div>
        )}

        {/* Affordability / Trade Plan Badge */}
        <div className="pt-0.5">{statusPill}</div>
      </div>

      {lockedActionType && (
        <div className="bg-emerald-600 py-0.5 text-center text-[9px] font-black uppercase tracking-wider text-white">
          {lockedActionType === "BUILD_CARD"
            ? "✓ Locked: Build"
            : lockedActionType === "BUILD_WONDER"
              ? "✓ Locked: Wonder"
              : "✓ Locked: Sell"}
        </div>
      )}
    </button>
  );
}
