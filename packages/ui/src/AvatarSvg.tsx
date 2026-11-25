import React from "react";
import { DEFAULT_AVATAR_CONFIG, type AvatarConfig } from "@tablefolk/shared";

interface AvatarSvgProps {
  config?: AvatarConfig | null;
  size?: number;
  className?: string;
}

/**
 * Crisp vector SVG counterpart to the Phaser PaperDollAvatar.
 * Renders the exact same tintable stylized layers for UI previews, customizer & badges.
 */
export function AvatarSvg({
  config,
  size = 96,
  className = "",
}: AvatarSvgProps) {
  const c = config ?? DEFAULT_AVATAR_CONFIG;
  const stroke = "#3B2B26";

  return (
    <svg
      width={size}
      height={size}
      viewBox="-32 -72 64 84"
      className={className}
      aria-label="Character avatar"
    >
      {/* Ground shadow */}
      <ellipse cx="0" cy="5" rx="18" ry="6" fill="#3A2A20" opacity="0.16" />

      {/* Shoes */}
      <rect x="-10" y="-4" width="8" height="6" rx="3" fill={c.shoeColor} stroke={stroke} strokeWidth="1.8" />
      <rect x="2" y="-4" width="8" height="6" rx="3" fill={c.shoeColor} stroke={stroke} strokeWidth="1.8" />

      {/* Bottoms */}
      {c.bottomStyle === "skirt" ? (
        <rect x="-11" y="-14" width="22" height="10" rx="4" fill={c.bottomColor} stroke={stroke} strokeWidth="1.8" />
      ) : c.bottomStyle === "shorts" ? (
        <rect x="-10" y="-15" width="20" height="8" rx="3" fill={c.bottomColor} stroke={stroke} strokeWidth="1.8" />
      ) : (
        <>
          <rect x="-10" y="-15" width="9" height="12" rx="3" fill={c.bottomColor} stroke={stroke} strokeWidth="1.8" />
          <rect x="1" y="-15" width="9" height="12" rx="3" fill={c.bottomColor} stroke={stroke} strokeWidth="1.8" />
        </>
      )}

      {/* Arms */}
      <rect x="-16" y="-29" width="6" height="13" rx="3" fill={c.topColor} stroke={stroke} strokeWidth="1.8" />
      <rect x="10" y="-29" width="6" height="13" rx="3" fill={c.topColor} stroke={stroke} strokeWidth="1.8" />

      {/* Torso */}
      <rect x="-13" y="-31" width="26" height="20" rx="8" fill={c.topColor} stroke={stroke} strokeWidth="2" />
      {c.topStyle === "cardigan" && <rect x="-4" y="-30" width="8" height="18" rx="2" fill={c.topAccent} />}
      {c.topStyle === "hoodie" && <rect x="-7" y="-18" width="14" height="6" rx="3" fill={c.topAccent} />}
      {c.topStyle === "apron" && (
        <rect x="-8" y="-26" width="16" height="16" rx="3" fill={c.topAccent} stroke={stroke} strokeWidth="1.3" />
      )}
      {c.topStyle === "sweater" && <rect x="-7" y="-31" width="14" height="4" rx="2" fill={c.topAccent} />}

      {/* Scarf */}
      {c.accessory === "scarf" && (
        <>
          <rect x="-11" y="-33" width="22" height="6" rx="3" fill={c.topAccent} stroke={stroke} strokeWidth="1.5" />
          <rect x="3" y="-29" width="5" height="9" rx="2" fill={c.topAccent} stroke={stroke} strokeWidth="1.3" />
        </>
      )}

      {/* Back Hair */}
      {(c.hairStyle === "wavy" || c.hairStyle === "bob") && (
        <rect x="-17" y="-48" width="34" height="22" rx="10" fill={c.hairColor} stroke={stroke} strokeWidth="2" />
      )}

      {/* Head */}
      <circle cx="0" cy="-43" r="14.5" fill={c.skinTone} stroke={stroke} strokeWidth="2" />

      {/* Cheeks */}
      <ellipse cx="-7" cy="-39" rx="2.7" ry="1.6" fill="#F29CA3" opacity="0.5" />
      <ellipse cx="7" cy="-39" rx="2.7" ry="1.6" fill="#F29CA3" opacity="0.5" />

      {/* Eyes + Sparkles */}
      <circle cx="-5" cy="-42" r="2.2" fill={stroke} />
      <circle cx="5" cy="-42" r="2.2" fill={stroke} />
      <circle cx="-5.7" cy="-42.8" r="0.8" fill="#FFFFFF" />
      <circle cx="4.3" cy="-42.8" r="0.8" fill="#FFFFFF" />

      {/* Smile */}
      <path d="M -3.2 -38.5 Q 0 -35.2 3.2 -38.5" fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />

      {/* Hair Styles */}
      {c.hairStyle === "beanie" ? (
        <>
          <rect x="-15" y="-60" width="30" height="14" rx="8" fill={c.topAccent} stroke={stroke} strokeWidth="2" />
          <circle cx="0" cy="-62" r="4.5" fill={c.topAccent} stroke={stroke} strokeWidth="1.8" />
        </>
      ) : c.hairStyle === "curly" ? (
        <>
          <circle cx="-12" cy="-52" r="6.5" fill={c.hairColor} stroke={stroke} strokeWidth="1.8" />
          <circle cx="-5" cy="-57" r="7" fill={c.hairColor} stroke={stroke} strokeWidth="1.8" />
          <circle cx="4" cy="-57" r="7" fill={c.hairColor} stroke={stroke} strokeWidth="1.8" />
          <circle cx="12" cy="-52" r="6.5" fill={c.hairColor} stroke={stroke} strokeWidth="1.8" />
        </>
      ) : c.hairStyle === "spiky" ? (
        <>
          <rect x="-15" y="-58" width="30" height="13" rx="6" fill={c.hairColor} stroke={stroke} strokeWidth="2" />
          <polygon points="-9,-57 -4,-66 1,-57" fill={c.hairColor} stroke={stroke} strokeWidth="1.6" />
          <polygon points="0,-57 6,-65 10,-57" fill={c.hairColor} stroke={stroke} strokeWidth="1.6" />
        </>
      ) : (
        <>
          {c.hairStyle === "bun" && (
            <circle cx="0" cy="-61" r="6.5" fill={c.hairColor} stroke={stroke} strokeWidth="2" />
          )}
          {c.hairStyle === "ponytail" && (
            <circle cx="13" cy="-52" r="6" fill={c.hairColor} stroke={stroke} strokeWidth="2" />
          )}
          <path
            d="M -15 -45 A 15 15 0 0 1 15 -45 L 15 -44 L 6 -48 L -2 -44 Z"
            fill={c.hairColor}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Accessories */}
      {c.accessory === "glasses" && (
        <g stroke="#3A2D28" strokeWidth="1.7" fill="none">
          <circle cx="-5" cy="-42" r="4.4" />
          <circle cx="5" cy="-42" r="4.4" />
          <line x1="-0.6" y1="-42" x2="0.6" y2="-42" />
        </g>
      )}
      {c.accessory === "headphones" && (
        <>
          <path d="M -16 -45 A 16 16 0 0 1 16 -45" fill="none" stroke="#5C4B51" strokeWidth="3" />
          <rect x="-18" y="-48" width="5" height="10" rx="2.5" fill="#E5808A" stroke={stroke} strokeWidth="1.5" />
          <rect x="13" y="-48" width="5" height="10" rx="2.5" fill="#E5808A" stroke={stroke} strokeWidth="1.5" />
        </>
      )}
      {c.accessory === "beret" && (
        <ellipse cx="2" cy="-58" rx="13" ry="5.5" fill="#C86B85" stroke={stroke} strokeWidth="1.8" />
      )}
      {c.accessory === "star_pin" && (
        <circle cx="9" cy="-51" r="3.6" fill="#F6C945" stroke={stroke} strokeWidth="1.2" />
      )}
    </svg>
  );
}
