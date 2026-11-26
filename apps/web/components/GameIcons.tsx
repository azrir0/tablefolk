"use client";

import React from "react";
import type { GearType } from "@tablefolk/game-treasure-trails";
import type { MasqueId } from "@tablefolk/game-velvet-masque";

export type GameIconName =
  // Café Game Box Emblems
  | "game-trails"
  | "game-hearthvale"
  | "game-masque"
  // Treasure Trails Tools (1-to-1 shared between player gear slots & Break/Fix cards)
  | "tool-lantern"
  | "tool-compass"
  | "tool-pickaxe"
  // Treasure Trails Roles, Actions & Board
  | "role-explorer"
  | "role-impostor"
  | "action-peek-vault"
  | "action-blast-tile"
  | "vault-treasure"
  | "vault-decoy"
  | "base-camp"
  | "boulder"
  | "card-deck"
  | "quick-fix"
  // Hearthvale Features & Folk
  | "hv-town"
  | "hv-road"
  | "hv-lantern"
  | "hv-windmill"
  | "hv-crest"
  | "hv-villager"
  | "hv-mayor"
  | "hv-wall"
  // Velvet Masque 8 Royal Masks
  | "vm-monarch"
  | "vm-patron"
  | "vm-magistrate"
  | "vm-trickster"
  | "vm-illusionist"
  | "vm-jester"
  | "vm-taxmaster"
  | "vm-smuggler"
  // Universal Tabletop Tokens & Café UI
  | "coin-gold"
  | "star-gold"
  | "trophy"
  | "cafe-cup"
  | "bookshelf"
  | "notice-pin"
  | "window-nook"
  // Cozy Café Emotes
  | "emote-wave"
  | "emote-laugh"
  | "emote-dance"
  | "emote-party"
  | "emote-cry"
  | "emote-love"
  | "emote-wow"
  | "emote-cheers";

export function gearToIconName(gear: GearType): "tool-lantern" | "tool-compass" | "tool-pickaxe" {
  if (gear === "lantern") return "tool-lantern";
  if (gear === "compass") return "tool-compass";
  return "tool-pickaxe";
}

export function masqueToIconName(maskId: MasqueId): GameIconName {
  return `vm-${maskId}` as GameIconName;
}

export function gameSlugToIconName(slug: string): GameIconName {
  if (slug === "hearthvale") return "game-hearthvale";
  if (slug === "velvet-masque") return "game-masque";
  return "game-trails";
}

export function emoteIdToIconName(id: string): GameIconName {
  const valid: Record<string, GameIconName> = {
    wave: "emote-wave",
    laugh: "emote-laugh",
    dance: "emote-dance",
    party: "emote-party",
    cry: "emote-cry",
    love: "emote-love",
    wow: "emote-wow",
    cheers: "emote-cheers",
  };
  return valid[id] ?? "emote-wave";
}

interface GameIconProps {
  name: GameIconName;
  className?: string;
}

/**
 * Hand-crafted, multi-tone illustrated SVG game icons built for TableFolk's
 * warm wood & botanical board-game aesthetic. Crisp at 14px through 64px.
 */
export function GameIcon({ name, className = "h-5 w-5" }: GameIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`inline-block shrink-0 select-none ${className}`}
    >
      {renderIconArt(name)}
    </svg>
  );
}

/**
 * Renders the exact SVG path group for any icon inside a 32x32 coordinate box.
 * Exported so full card/tile SVGs (PathTileSvg, VelvetMasqueCardSvg) can embed
 * the exact same vector art natively inside <g transform="...">!
 */
export function renderIconArt(name: GameIconName): React.ReactNode {
  const INK = "#3B2B26";

  switch (name) {
    /* ===================== CAFÉ GAME EMBLEMS ===================== */
    case "game-trails":
      return (
        <g>
          <path
            d="M4 8.5L11.5 5.5L20.5 8.5L28 5.5V23.5L20.5 26.5L11.5 23.5L4 26.5V8.5Z"
            fill="#F6E2B8"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M11.5 5.5V23.5M20.5 8.5V26.5" stroke="#C8A26A" strokeWidth="1.5" />
          <path
            d="M8 19C10.5 14 14 13.5 17 16.5C19 18.5 21.5 18 23.5 14"
            stroke="#528A62"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="2.5 2.5"
          />
          <path
            d="M21.5 11.5L25.5 15.5M25.5 11.5L21.5 15.5"
            stroke="#D9594C"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>
      );

    case "game-hearthvale":
      return (
        <g>
          <circle cx="16" cy="16" r="13.5" fill="#DFEAD2" stroke={INK} strokeWidth="2" />
          <path d="M4.5 22C9 18.5 14 18 27.5 21.5C25.5 26 21 29 16 29C10.5 29 6.5 26 4.5 22Z" fill="#78AD74" />
          <rect x="10.5" y="12.5" width="11" height="10" rx="1.2" fill="#F2DFC2" stroke={INK} strokeWidth="1.8" />
          <path d="M9 13L16 6.5L23 13H9Z" fill="#D9594C" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="14.2" y="17.5" width="3.6" height="5" rx="1.5" fill="#7A4E33" />
          <circle cx="23.5" cy="9.5" r="2.6" fill="#F6C84C" stroke={INK} strokeWidth="1.3" />
        </g>
      );

    case "game-masque":
      return (
        <g>
          <path
            d="M3.5 15.5C5.5 9 11.5 9.5 16 13C20.5 9.5 26.5 9 28.5 15.5C27.5 22.5 22 24.5 17.5 20.5L16 18.8L14.5 20.5C10 24.5 4.5 22.5 3.5 15.5Z"
            fill="#9E2440"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 14.5C8.5 11.5 12 12 15 14.2M25.5 14.5C23.5 11.5 20 12 17 14.2"
            stroke="#F5CA63"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <ellipse cx="11" cy="16.2" rx="3.1" ry="2.1" fill="#FFF8E8" stroke={INK} strokeWidth="1.3" />
          <ellipse cx="21" cy="16.2" rx="3.1" ry="2.1" fill="#FFF8E8" stroke={INK} strokeWidth="1.3" />
          <circle cx="16" cy="12" r="2" fill="#F5CA63" stroke={INK} strokeWidth="1.2" />
        </g>
      );

    /* ===================== TREASURE TRAILS 3 TOOLS ===================== */
    case "tool-lantern":
      return (
        <g>
          {/* Brass handle */}
          <path d="M11 8C11 4.8 21 4.8 21 8" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          {/* Top cap */}
          <path d="M9.5 9.5H22.5L20.5 12H11.5L9.5 9.5Z" fill="#C97B36" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          {/* Glowing glass chamber */}
          <rect x="9.5" y="12" width="13" height="12.5" rx="3" fill="#FDE68A" stroke={INK} strokeWidth="2" />
          {/* Warm flame inside */}
          <path
            d="M16 14C17.8 16.3 18.8 17.8 18.8 19.6C18.8 21.2 17.5 22.4 16 22.4C14.5 22.4 13.2 21.2 13.2 19.6C13.2 17.8 14.2 16.3 16 14Z"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth="1.2"
          />
          <circle cx="16" cy="19.8" r="1.4" fill="#FFFBEB" />
          {/* Brass ribs & base */}
          <path d="M12.5 12V24.5M19.5 12V24.5" stroke={INK} strokeWidth="1.2" strokeOpacity="0.45" />
          <rect x="8.5" y="24.5" width="15" height="3.5" rx="1.5" fill="#B86B2B" stroke={INK} strokeWidth="1.8" />
        </g>
      );

    case "tool-compass":
      return (
        <g>
          {/* Top loop */}
          <circle cx="16" cy="5.5" r="2.2" stroke={INK} strokeWidth="1.8" fill="#E9B84A" />
          {/* Outer brass ring */}
          <circle cx="16" cy="17.5" r="11" fill="#E9B84A" stroke={INK} strokeWidth="2" />
          {/* Teal-cream dial */}
          <circle cx="16" cy="17.5" r="8" fill="#E0F2F1" stroke={INK} strokeWidth="1.4" />
          {/* Cardinal ticks */}
          <path d="M16 10.6V12.2M16 22.8V24.4M9.1 17.5H10.7M21.3 17.5H22.9" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
          {/* Red North / Slate South needle */}
          <polygon points="16,11.5 18.4,17.5 13.6,17.5" fill="#D9483B" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
          <polygon points="16,23.5 18.4,17.5 13.6,17.5" fill="#475569" stroke={INK} strokeWidth="1" strokeLinejoin="round" />
          <circle cx="16" cy="17.5" r="1.7" fill="#FFF8E8" stroke={INK} strokeWidth="1.1" />
        </g>
      );

    case "tool-pickaxe":
      return (
        <g>
          {/* Wooden oak handle */}
          <path
            d="M8 25.5L20.5 13"
            stroke="#A86938"
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <path
            d="M8 25.5L20.5 13"
            stroke={INK}
            strokeWidth="4.4"
            strokeLinecap="round"
            opacity="0.22"
          />
          <line x1="8" y1="25.5" x2="20.5" y2="13" stroke="#C5834B" strokeWidth="2.4" strokeLinecap="round" />
          {/* Curved forged steel pick head */}
          <path
            d="M9.5 7.5C15.5 6 22.5 9.5 26 16.5L22.5 18C20 13.5 15.5 11.2 10.5 11.5L9.5 7.5Z"
            fill="#94A3B8"
            stroke={INK}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Steel collar */}
          <rect
            x="16.5"
            y="10.2"
            width="5"
            height="5"
            rx="1.2"
            transform="rotate(45 19 12.7)"
            fill="#64748B"
            stroke={INK}
            strokeWidth="1.6"
          />
          {/* Gleam highlight */}
          <path d="M13 9.2C17 9 20.5 10.8 23 14" stroke="#F8FAFC" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      );

    /* ===================== TREASURE TRAILS ROLES & ACTIONS ===================== */
    case "role-explorer":
      return (
        <g>
          <circle cx="16" cy="16" r="13.5" fill="#D5EDD9" stroke={INK} strokeWidth="2" />
          {/* Explorer adventure hat */}
          <ellipse cx="16" cy="21" rx="10.5" ry="3.6" fill="#C98A4B" stroke={INK} strokeWidth="1.8" />
          <path
            d="M9.5 19.5C9.5 12.5 12 9 16 9C20 9 22.5 12.5 22.5 19.5Z"
            fill="#E3AC6B"
            stroke={INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9.8 17.8H22.2" stroke="#3D9468" strokeWidth="2.6" />
          <circle cx="16" cy="14" r="2.2" fill="#FDE047" stroke={INK} strokeWidth="1.2" />
        </g>
      );

    case "role-impostor":
      return (
        <g>
          <circle cx="16" cy="16" r="13.5" fill="#FDE2DF" stroke={INK} strokeWidth="2" />
          {/* Hooded crimson bandana / mask */}
          <path
            d="M7 18C7 11.5 11 7.5 16 7.5C21 7.5 25 11.5 25 18V22.5C22 25 19 26 16 26C13 26 10 25 7 22.5V18Z"
            fill="#C9453B"
            stroke={INK}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          {/* Domino mask across eyes */}
          <rect x="8.8" y="13.2" width="14.4" height="5.4" rx="2.7" fill="#2E201C" />
          <path d="M11.5 15.5L14 16.5M20.5 15.5L18 16.5" stroke="#FDE047" strokeWidth="1.8" strokeLinecap="round" />
          {/* Sly grin */}
          <path d="M12.5 21.5C14.5 22.8 17.5 22.8 19.5 21.2" stroke="#FFF8EC" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );

    case "action-peek-vault":
      return (
        <g>
          {/* Golden vaulted eye / brass spyglass */}
          <path
            d="M3.5 16C7 10.2 11.5 8 16 8C20.5 8 25 10.2 28.5 16C25 21.8 20.5 24 16 24C11.5 24 7 21.8 3.5 16Z"
            fill="#FEF3C7"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="5.6" fill="#2F855A" stroke={INK} strokeWidth="1.8" />
          <circle cx="16" cy="16" r="2.6" fill="#1E293B" />
          <circle cx="17.8" cy="14.2" r="1.2" fill="#FFFFFF" />
          <path d="M16 4V6.2M9.5 6L10.8 7.8M22.5 6L21.2 7.8" stroke="#E5A020" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case "action-blast-tile":
      return (
        <g>
          {/* Dynamite bundle */}
          <rect x="7" y="12.5" width="5.5" height="14.5" rx="2" fill="#DC4C3E" stroke={INK} strokeWidth="1.8" />
          <rect x="13" y="11" width="5.8" height="16" rx="2" fill="#EF5B4C" stroke={INK} strokeWidth="1.8" />
          <rect x="19" y="12.5" width="5.5" height="14.5" rx="2" fill="#C93B2E" stroke={INK} strokeWidth="1.8" />
          {/* Band strap */}
          <rect x="6.5" y="17.5" width="18.5" height="3.8" rx="1" fill="#3B2B26" />
          {/* Fuse & spark */}
          <path d="M16 11C16 7.8 18.8 6.8 21.5 7.2" stroke="#D4A359" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M23 4L24 6.5L26.8 6.8L24.6 8.5L25.4 11L23 9.4L20.6 11L21.4 8.5L19.2 6.8L22 6.5Z"
            fill="#FDE047"
            stroke="#D97706"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </g>
      );

    case "vault-treasure":
      return (
        <g>
          {/* Open Treasure Chest brimming with gold */}
          <path d="M5 13C5 8.5 10 6.5 16 6.5C22 6.5 27 8.5 27 13H5Z" fill="#9E5A2B" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          {/* Glowing coins inside */}
          <circle cx="11.5" cy="13.5" r="2.6" fill="#FDE047" stroke="#B45309" strokeWidth="1.2" />
          <circle cx="16" cy="12.5" r="3" fill="#FACC15" stroke="#B45309" strokeWidth="1.2" />
          <circle cx="20.5" cy="13.5" r="2.6" fill="#FDE047" stroke="#B45309" strokeWidth="1.2" />
          {/* Chest body */}
          <rect x="5" y="14.5" width="22" height="12" rx="2.5" fill="#B86B35" stroke={INK} strokeWidth="2" />
          {/* Gold bands & lock */}
          <rect x="8.5" y="14.5" width="2.5" height="12" fill="#F4C145" />
          <rect x="21" y="14.5" width="2.5" height="12" fill="#F4C145" />
          <rect x="13.5" y="16.5" width="5" height="6" rx="1.2" fill="#FDE047" stroke={INK} strokeWidth="1.5" />
          <circle cx="16" cy="19.5" r="1.1" fill={INK} />
        </g>
      );

    case "vault-decoy":
      return (
        <g>
          {/* Cracked ancient stone urn */}
          <ellipse cx="16" cy="9.5" rx="5.5" ry="2.2" fill="#C4B5A5" stroke={INK} strokeWidth="1.8" />
          <path
            d="M12 11.2C8.5 13.5 7.5 18 9.5 22.8C10.5 25 12.8 26.5 16 26.5C19.2 26.5 21.5 25 22.5 22.8C24.5 18 23.5 13.5 20 11.2Z"
            fill="#B5A492"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Jagged crack */}
          <path d="M16 12L14 16L17.5 18.5L15 23" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );

    case "base-camp":
      return (
        <g>
          {/* Warm expedition canvas tent */}
          <path d="M4 25L16 6.5L28 25H4Z" fill="#F3D69A" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 6.5L12 25H20L16 6.5Z" fill="#D97C5E" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M13 25L16 17.5L19 25H13Z" fill="#4A312C" />
          <path d="M16 4V6.8" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 4L21 5.6L16 7.2Z" fill="#3D9468" stroke={INK} strokeWidth="1" />
        </g>
      );

    case "boulder":
      return (
        <g>
          <polygon
            points="6,23 9.5,11 19,8 26,15.5 24,24.5 11,26"
            fill="#9B8B80"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M12 14L20 22M20 14L12 22" stroke="#D9594C" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      );

    case "card-deck":
      return (
        <g>
          <rect x="6" y="7" width="15" height="20" rx="3" fill="#E6D2B5" stroke={INK} strokeWidth="1.8" />
          <rect x="11" y="5" width="15" height="20" rx="3" fill="#FFF8EC" stroke={INK} strokeWidth="2" />
          <circle cx="18.5" cy="15" r="3.5" fill="#F4C145" stroke={INK} strokeWidth="1.4" />
        </g>
      );

    case "quick-fix":
      return (
        <g>
          <circle cx="16" cy="16" r="12.5" fill="#D5F0DF" stroke={INK} strokeWidth="2" />
          <path
            d="M16 9V23M9 16H23"
            stroke="#2F855A"
            strokeWidth="4.2"
            strokeLinecap="round"
          />
        </g>
      );

    /* ===================== HEARTHVALE ICONS ===================== */
    case "hv-town":
      return (
        <g>
          <rect x="6" y="13" width="20" height="14" rx="1.5" fill="#EBD7B7" stroke={INK} strokeWidth="2" />
          <path d="M6 13V8H10.5V11H13.8V8H18.2V11H21.5V8H26V13" fill="#D9594C" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13 27V20C13 18.3 14.3 17 16 17C17.7 17 19 18.3 19 20V27Z" fill="#7A4E33" stroke={INK} strokeWidth="1.6" />
        </g>
      );

    case "hv-road":
      return (
        <g>
          <rect x="4" y="4" width="24" height="24" rx="5" fill="#A8C98F" stroke={INK} strokeWidth="2" />
          <path d="M12 28C12 20 20 18 20 4" stroke="#EED6A9" strokeWidth="7" strokeLinecap="round" />
          <path d="M12 28C12 20 20 18 20 4" stroke="#B28B59" strokeWidth="1.5" strokeDasharray="3 3" />
        </g>
      );

    case "hv-lantern":
      return (
        <g>
          <path d="M10 27V7H20" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="20" y1="7" x2="20" y2="11" stroke={INK} strokeWidth="1.8" />
          <rect x="16" y="11" width="8" height="10" rx="2.5" fill="#FDE047" stroke={INK} strokeWidth="1.8" />
          <circle cx="20" cy="16" r="2.2" fill="#F59E0B" />
        </g>
      );

    case "hv-windmill":
      return (
        <g>
          <path d="M11 27L13.5 13H18.5L21 27H11Z" fill="#EBD7B7" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M16 14L7 7M16 14L25 7M16 14L8 21M16 14L24 21" stroke="#C97B36" strokeWidth="2.8" strokeLinecap="round" />
          <circle cx="16" cy="14" r="2.5" fill="#D9594C" stroke={INK} strokeWidth="1.5" />
        </g>
      );

    case "hv-crest":
      return (
        <g>
          <path
            d="M16 4L26 7.5V15.5C26 21.8 21.5 26 16 28C10.5 26 6 21.8 6 15.5V7.5L16 4Z"
            fill="#F4C145"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 9L17.8 13.4L22.5 13.8L18.9 16.9L20 21.5L16 19L12 21.5L13.1 16.9L9.5 13.8L14.2 13.4Z" fill="#FFF8E8" stroke="#9A6708" strokeWidth="1" />
        </g>
      );

    case "hv-villager":
      return (
        <g>
          <circle cx="16" cy="9.5" r="4.5" fill="#529B76" stroke={INK} strokeWidth="2" />
          <path
            d="M7.5 26.5L10.5 15.5H21.5L24.5 26.5H19L17.5 22H14.5L13 26.5H7.5Z"
            fill="#529B76"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </g>
      );

    case "hv-mayor":
      return (
        <g>
          <path d="M10.5 8.5L12 4.5L16 7L20 4.5L21.5 8.5Z" fill="#FDE047" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="16" cy="11.5" r="4" fill="#E5A020" stroke={INK} strokeWidth="1.9" />
          <path
            d="M7 27L10 16.5H22L25 27H19L17.5 22.5H14.5L13 27H7Z"
            fill="#E5A020"
            stroke={INK}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
        </g>
      );

    case "hv-wall":
      return (
        <g>
          <rect x="4" y="8" width="24" height="16" rx="2.5" fill="#D97C5E" stroke={INK} strokeWidth="2" />
          <path d="M4 16H28M12 8V16M20 8V16M16 16V24" stroke="#FFF8EC" strokeWidth="1.6" />
        </g>
      );

    /* ===================== VELVET MASQUE 8 ROYAL MASKS ===================== */
    case "vm-monarch":
      return (
        <g>
          <path
            d="M4.5 23.5L7 10L12.5 15.5L16 7.5L19.5 15.5L25 10L27.5 23.5H4.5Z"
            fill="#F4C145"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect x="5.5" y="23.5" width="21" height="3.5" rx="1.5" fill="#C98A1A" stroke={INK} strokeWidth="1.6" />
          <circle cx="16" cy="18.5" r="2.2" fill="#D9483B" stroke={INK} strokeWidth="1.1" />
          <circle cx="10.2" cy="19.2" r="1.4" fill="#3A7CC4" />
          <circle cx="21.8" cy="19.2" r="1.4" fill="#3A7CC4" />
        </g>
      );

    case "vm-patron":
      return (
        <g>
          <circle cx="16" cy="16" r="13" fill="#DEF7EC" stroke={INK} strokeWidth="1.9" />
          {/* Graceful stylized swan */}
          <path
            d="M8.5 21C11.5 24 21 24 24 19.5C22 18.5 18.5 18 16 19C14.5 16 16 12.5 18.5 11.5C20 11 21 12 20.5 13.2"
            fill="#FFFFFF"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M20.8 12.2L23.5 12.8L21 14Z" fill="#E5A020" />
          <path d="M9.5 23.5C13 22 19 22 22.5 23.5" stroke="#3D9468" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case "vm-magistrate":
      return (
        <g>
          {/* Golden Scales of Justice */}
          <path d="M16 6V25M10.5 25H21.5M7 11H25" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
          <path d="M7 11L4.5 18H9.5L7 11Z" fill="#F4C145" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M25 11L22.5 18H27.5L25 11Z" fill="#F4C145" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="16" cy="7" r="2.2" fill="#6366F1" stroke={INK} strokeWidth="1.4" />
        </g>
      );

    case "vm-trickster":
      return (
        <g>
          {/* Crossed gleaming daggers */}
          <path d="M7 7L21 21" stroke="#CBD5E1" strokeWidth="3.8" strokeLinecap="round" />
          <path d="M7 7L21 21" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M25 7L11 21" stroke="#E2E8F0" strokeWidth="3.8" strokeLinecap="round" />
          <path d="M25 7L11 21" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M18 22L24 16M14 22L8 16" stroke="#C53030" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M21 21L25 25M11 21L7 25" stroke="#855508" strokeWidth="3" strokeLinecap="round" />
        </g>
      );

    case "vm-illusionist":
      return (
        <g>
          {/* Mystic amethyst crystal orb */}
          <circle cx="16" cy="14" r="9.5" fill="#9F7AEA" stroke={INK} strokeWidth="2" />
          <circle cx="13" cy="11" r="2.6" fill="#EDE9FE" opacity="0.85" />
          <path d="M18.5 14L19.5 16.5L22 17.5L19.5 18.5L18.5 21L17.5 18.5L15 17.5L17.5 16.5Z" fill="#FDE047" />
          <path d="M9.5 23.5H22.5L24.5 27H7.5L9.5 23.5Z" fill="#E5A020" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        </g>
      );

    case "vm-jester":
      return (
        <g>
          {/* Split crimson & gold jester hat with bells */}
          <path d="M6 23C6 14 11 10 16 14C13 9 8 8 5.5 11.5C7.5 13 8 15.5 6 23Z" fill="#D9594C" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M26 23C26 14 21 10 16 14C19 9 24 8 26.5 11.5C24.5 13 24 15.5 26 23Z" fill="#3A7CC4" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 23.5C11 16 13.5 13 16 13C18.5 13 21 16 22.5 23.5H9.5Z" fill="#F4C145" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="5.5" cy="11.5" r="2.2" fill="#FDE047" stroke={INK} strokeWidth="1.3" />
          <circle cx="26.5" cy="11.5" r="2.2" fill="#FDE047" stroke={INK} strokeWidth="1.3" />
          <circle cx="16" cy="9.5" r="2.2" fill="#FDE047" stroke={INK} strokeWidth="1.3" />
        </g>
      );

    case "vm-taxmaster":
      return (
        <g>
          {/* Winged teal & gold imperial seal */}
          <path d="M3.5 12.5C7.5 11 12 12.5 16 16C20 12.5 24.5 11 28.5 12.5C26 18 22 20.5 16 20C10 20.5 6 18 3.5 12.5Z" fill="#0E7490" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="16" cy="16" r="5.5" fill="#F4C145" stroke={INK} strokeWidth="1.8" />
          <path d="M16 12.5V19.5M13.5 16H18.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );

    case "vm-smuggler":
      return (
        <g>
          {/* Sly masked ruby fox */}
          <path d="M7 9L13 13.5H19L25 9L24 20.5L16 26.5L8 20.5L7 9Z" fill="#D9594C" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M8.5 19.5L16 26.5L23.5 19.5L19.5 18.5L16 21L12.5 18.5Z" fill="#FFF8EC" />
          <rect x="9.5" y="14" width="13" height="3.8" rx="1.9" fill="#2E1A1E" />
          <circle cx="13" cy="15.9" r="1.1" fill="#FDE047" />
          <circle cx="19" cy="15.9" r="1.1" fill="#FDE047" />
          <circle cx="16" cy="24" r="1.4" fill={INK} />
        </g>
      );

    /* ===================== UNIVERSAL TABLETOP TOKENS ===================== */
    case "coin-gold":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#F4C145" stroke={INK} strokeWidth="2" />
          <circle cx="16" cy="16" r="8.5" fill="#FDE047" stroke="#B45309" strokeWidth="1.4" />
          <path d="M16 10.5L17.5 14L21 14.5L18.4 17L19.1 20.5L16 18.8L12.9 20.5L13.6 17L11 14.5L14.5 14Z" fill="#D97706" />
        </g>
      );

    case "star-gold":
      return (
        <g>
          <path
            d="M16 3.5L19.6 11.1L28 12.2L21.9 18L23.4 26.3L16 22.3L8.6 26.3L10.1 18L4 12.2L12.4 11.1L16 3.5Z"
            fill="#F6C33D"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M16 7.5L18.1 12L23 12.6L19.5 16L20.3 20.8L16 18.4" fill="#FEF08A" opacity="0.55" />
        </g>
      );

    case "trophy":
      return (
        <g>
          <path d="M9 6H23V13.5C23 17.5 20 20.5 16 20.5C12 20.5 9 17.5 9 13.5V6Z" fill="#F4C145" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 8.5H5.5C5.5 13 7.2 15 9.5 15.5M23 8.5H26.5C26.5 13 24.8 15 22.5 15.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 20.5V25M11 26.5H21" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );

    case "cafe-cup":
      return (
        <g>
          <path d="M12 6C12 4.5 13.5 4.5 13.5 3M17.5 6C17.5 4.5 19 4.5 19 3" stroke="#C98A1A" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M6.5 10H22V18.5C22 22 19 25 14.5 25H14C9.5 25 6.5 22 6.5 18.5V10Z" fill="#FFF8EC" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 12.5H25C26.8 12.5 27.8 13.8 27.8 15.5C27.8 17.2 26.8 18.5 25 18.5H22" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M8.5 12.5H20V14.5H8.5Z" fill="#7A4E33" />
          <line x1="6" y1="27.5" x2="23" y2="27.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        </g>
      );

    case "bookshelf":
      return (
        <g>
          <rect x="4.5" y="5" width="23" height="22" rx="3" fill="#B57B4C" stroke={INK} strokeWidth="2" />
          <rect x="7" y="7.5" width="5" height="9" rx="1" fill="#D9594C" stroke={INK} strokeWidth="1.4" />
          <rect x="13" y="8.5" width="5" height="8" rx="1" fill="#529B76" stroke={INK} strokeWidth="1.4" />
          <rect x="19" y="7.5" width="6" height="9" rx="1" fill="#F4C145" stroke={INK} strokeWidth="1.4" />
          <line x1="5" y1="17.5" x2="27" y2="17.5" stroke={INK} strokeWidth="2" />
          <rect x="7.5" y="19.5" width="7.5" height="5.5" rx="1" fill="#7E42B8" stroke={INK} strokeWidth="1.4" />
          <rect x="16.5" y="19.5" width="8.5" height="5.5" rx="1" fill="#3B82F6" stroke={INK} strokeWidth="1.4" />
        </g>
      );

    case "notice-pin":
      return (
        <g>
          <rect x="5" y="7" width="22" height="20" rx="3" fill="#F6E2B8" stroke={INK} strokeWidth="2" />
          <line x1="9" y1="14" x2="23" y2="14" stroke="#9C7A54" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="19" x2="20" y2="19" stroke="#9C7A54" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="7.5" r="3.5" fill="#D9594C" stroke={INK} strokeWidth="1.8" />
        </g>
      );

    case "window-nook":
      return (
        <g>
          <rect x="5" y="5" width="22" height="22" rx="4" fill="#93C5FD" stroke={INK} strokeWidth="2" />
          <circle cx="21" cy="10.5" r="2.5" fill="#FDE047" />
          <path d="M5 16H27M16 5V27" stroke="#8B5A2B" strokeWidth="2.4" />
          <rect x="3.5" y="25" width="25" height="3" rx="1.5" fill="#B57B4C" stroke={INK} strokeWidth="1.6" />
        </g>
      );

    /* ===================== COZY CAFÉ EMOTES ===================== */
    case "emote-wave":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#FDE68A" stroke={INK} strokeWidth="2" />
          <path d="M11 20C11 16 12.5 11.5 14 11.5C15 11.5 15 14.5 15 14.5C15 14.5 16 10 17.5 10C18.8 10 18.5 14.5 18.5 14.5C18.5 14.5 20.5 11 21.8 12C22.8 12.8 21.5 17 20.5 19.5C19.5 22 17.5 23 15.5 23C12.5 23 11 21.5 11 20Z" fill="#FFF8EC" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
          <path d="M7.5 10C8.5 8.5 10 7.8 11.5 7.5" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case "emote-laugh":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#FDE047" stroke={INK} strokeWidth="2" />
          <path d="M9.5 13.5C10.5 11.8 12.5 11.8 13.5 13.5M18.5 13.5C19.5 11.8 21.5 11.8 22.5 13.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M10.5 17.5H21.5C21.5 21 19 23 16 23C13 23 10.5 21 10.5 17.5Z" fill="#D9594C" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
        </g>
      );

    case "emote-dance":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#FBCFE8" stroke={INK} strokeWidth="2" />
          <path d="M13 21V11.5L22 9.5V19" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="11" cy="21" r="2.6" fill="#BE185D" stroke={INK} strokeWidth="1.5" />
          <circle cx="20" cy="19" r="2.6" fill="#BE185D" stroke={INK} strokeWidth="1.5" />
        </g>
      );

    case "emote-party":
      return (
        <g>
          <path d="M7 25L12.5 11L21 19.5L7 25Z" fill="#F4C145" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M10.5 16L16 21.5" stroke="#D9594C" strokeWidth="2.2" />
          <circle cx="19" cy="8.5" r="2" fill="#529B76" />
          <circle cx="24.5" cy="12" r="1.8" fill="#D9594C" />
          <circle cx="23" cy="6.5" r="1.5" fill="#7E42B8" />
          <path d="M16 11L20 7M19 14L25 13" stroke="#E5A020" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );

    case "emote-cry":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#BAE6FD" stroke={INK} strokeWidth="2" />
          <circle cx="12" cy="14" r="1.6" fill={INK} />
          <circle cx="20" cy="14" r="1.6" fill={INK} />
          <path d="M12.5 21.5C13.8 19.8 18.2 19.8 19.5 21.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <path d="M21 16.5C21 16.5 23 19 23 20.5C23 21.6 22.1 22.3 21 22.3C19.9 22.3 19 21.6 19 20.5C19 19 21 16.5 21 16.5Z" fill="#3B82F6" stroke={INK} strokeWidth="1.2" />
        </g>
      );

    case "emote-love":
      return (
        <g>
          <path
            d="M16 26.5C16 26.5 5.5 20 5.5 12.8C5.5 9.2 8.2 6.5 11.5 6.5C13.6 6.5 15.2 7.7 16 9.3C16.8 7.7 18.4 6.5 20.5 6.5C23.8 6.5 26.5 9.2 26.5 12.8C26.5 20 16 26.5 16 26.5Z"
            fill="#E05A4E"
            stroke={INK}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M9.5 12C9.5 10.5 10.6 9.5 12 9.5" stroke="#FFF8EC" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
        </g>
      );

    case "emote-wow":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#FDE047" stroke={INK} strokeWidth="2" />
          <circle cx="11.8" cy="13" r="1.8" fill={INK} />
          <circle cx="20.2" cy="13" r="1.8" fill={INK} />
          <ellipse cx="16" cy="20" rx="3" ry="3.8" fill="#7A4E33" stroke={INK} strokeWidth="1.8" />
        </g>
      );

    case "emote-cheers":
      return (
        <g>
          <circle cx="16" cy="16" r="12" fill="#D5F0DF" stroke={INK} strokeWidth="2" />
          <path d="M10.5 22L13 11H19L21.5 22H10.5Z" fill="#F4C145" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M16 6V8.5M10 8.5L11.8 10.3M22 8.5L20.2 10.3" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      );
  }
}

/**
 * Exact 1-to-1 Explorer Tool Slot icon (shown on each player card in Treasure Trails).
 * Uses the EXACT same vector icon as Break/Fix cards, with a clear red diagonal slash when broken!
 */
export function ToolSlotIcon({
  gear,
  broken,
  className = "h-4 w-4",
}: {
  gear: GearType;
  broken: boolean;
  className?: string;
}) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <GameIcon
        name={gearToIconName(gear)}
        className={`${className} ${broken ? "opacity-50 grayscale-[40%]" : ""}`}
      />
      {broken && (
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <line
            x1="4"
            y1="20"
            x2="20"
            y2="4"
            stroke="#DC2626"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}

/**
 * Hand & flying card visual for Break Tool (HAZARD) and Fix Tool (REPAIR) cards.
 * Displays the EXACT same tool SVG(s) as the player tool slots, plus unmistakable
 * red Break (✕) or green Fix (+) framing so users instantly see which tool(s) match!
 */
export function ToolCardArt({
  kind,
  gears,
  size = "md",
}: {
  kind: "HAZARD" | "REPAIR";
  gears: GearType[];
  size?: "sm" | "md";
}) {
  const isBreak = kind === "HAZARD";
  const isDual = gears.length > 1;
  const iconCls = isDual
    ? size === "sm"
      ? "h-5 w-5"
      : "h-6 w-6 sm:h-7 sm:w-7"
    : size === "sm"
      ? "h-6 w-6"
      : "h-8 w-8 sm:h-9 sm:w-9";

  return (
    <div
      className={`relative flex items-center justify-center gap-0.5 rounded-xl border-2 px-1.5 py-1 shadow-inner ${
        isBreak
          ? "border-terracotta-500/70 bg-terracotta-100/85"
          : "border-sage-500/70 bg-sage-100/85"
      }`}
    >
      {gears.map((g) => (
        <span key={g} className="relative inline-flex items-center justify-center">
          <GameIcon name={gearToIconName(g)} className={iconCls} />
          {isBreak && (
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <line
                x1="4"
                y1="20"
                x2="20"
                y2="4"
                stroke="#DC2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
      ))}
      <span
        className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-white text-[10px] font-black leading-none text-white shadow ${
          isBreak ? "bg-terracotta-500" : "bg-sage-500"
        }`}
      >
        {isBreak ? "✕" : "+"}
      </span>
    </div>
  );
}

const TUTORIAL_ICON_MAP: Record<string, GameIconName> = {
  "game-trails": "game-trails",
  "game-hearthvale": "game-hearthvale",
  "game-masque": "game-masque",
  boulder: "boulder",
  "action-peek-vault": "action-peek-vault",
  "action-blast-tile": "action-blast-tile",
  "hv-town": "hv-town",
  "hv-road": "hv-road",
  "hv-lantern": "hv-lantern",
  "hv-windmill": "hv-windmill",
  "hv-crest": "hv-crest",
  "hv-villager": "hv-villager",
  "hv-mayor": "hv-mayor",
  "hv-wall": "hv-wall",
  "vm-monarch": "vm-monarch",
  "vm-patron": "vm-patron",
  "vm-magistrate": "vm-magistrate",
  "vm-trickster": "vm-trickster",
  "vm-illusionist": "vm-illusionist",
  "vm-jester": "vm-jester",
  "vm-taxmaster": "vm-taxmaster",
  "vm-smuggler": "vm-smuggler",
  // Legacy emoji fallbacks for any pre-migration database entries
  "🗺️": "game-trails",
  "🪨": "boulder",
  "⚡": "tool-pickaxe",
  "🔧": "tool-lantern",
  "🔭": "action-peek-vault",
  "💥": "action-blast-tile",
  "🏰": "hv-town",
  "🏮": "hv-lantern",
  "🌬️": "hv-windmill",
  "👑": "vm-monarch",
  "🧱": "hv-wall",
  "🦢": "vm-patron",
  "⚖️": "vm-magistrate",
  "🗡️": "vm-trickster",
  "🔮": "vm-illusionist",
  "🃏": "vm-jester",
  "🦅": "vm-taxmaster",
  "🦊": "vm-smuggler",
};

/**
 * Renders rich illustrated icons in the Cashier Rulebook & Tutorial cards.
 */
export function TutorialCardIcon({
  icon,
  gameSlug,
  className = "h-7 w-7",
}: {
  icon: string;
  gameSlug?: string;
  className?: string;
}) {
  if (icon === "break-pickaxe") {
    return <ToolCardArt kind="HAZARD" gears={["grapple"]} size="sm" />;
  }
  if (icon === "fix-lantern") {
    return <ToolCardArt kind="REPAIR" gears={["lantern", "compass"]} size="sm" />;
  }
  if (gameSlug === "hearthvale") {
    if (icon === "👑") return <GameIcon name="hv-mayor" className={className} />;
    if (icon === "🗺️") return <GameIcon name="game-hearthvale" className={className} />;
  }
  const mapped = TUTORIAL_ICON_MAP[icon];
  if (mapped) {
    return <GameIcon name={mapped} className={className} />;
  }
  return <GameIcon name="star-gold" className={className} />;
}
