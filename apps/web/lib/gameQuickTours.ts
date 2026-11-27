import type { GameIconName } from "@/components/GameIcons";
import type { SupportedGameSlug } from "./gameTutorials";

export type QuickTourVisualId =
  | "tt-roles"
  | "tt-board-flip"
  | "tt-tools"
  | "tt-actions"
  | "tt-quickfix"
  | "tt-table-tools"
  | "hv-goal"
  | "hv-folk"
  | "hv-match-rotate"
  | "hv-architect-hand"
  | "hv-scoring"
  | "hv-table-tools"
  | "vm-goal"
  | "vm-curtain"
  | "vm-stage-fine"
  | "vm-cloak-swap"
  | "vm-challenge"
  | "vm-table-tools";

export interface QuickTourFeatureBullet {
  label: string;
  detail: string;
}

export interface QuickTourStep {
  id: string;
  /** Matches `data-tour="..."` on the live game UI for spotlight coachmarks */
  targetId: string;
  badge: string;
  title: string;
  icon: GameIconName;
  accent: "sage" | "amber" | "terracotta";
  summary: string;
  features: QuickTourFeatureBullet[];
  tryItHint: string;
  visualId: QuickTourVisualId;
}

export interface GameQuickTourConfig {
  slug: SupportedGameSlug;
  title: string;
  subtitle: string;
  estimatedSec: number;
  icon: GameIconName;
  steps: QuickTourStep[];
}

export const GAME_QUICK_TOURS: Record<SupportedGameSlug, GameQuickTourConfig> = {
  "treasure-trails": {
    slug: "treasure-trails",
    title: "Treasure Trails",
    subtitle: "6-step interactive walkthrough of hidden roles, paths & tools",
    estimatedSec: 45,
    icon: "game-trails",
    steps: [
      {
        id: "tt-step-1",
        targetId: "tt-header",
        badge: "GOAL & HUD",
        title: "Secret Role & Turn Clock",
        icon: "role-explorer",
        accent: "sage",
        summary:
          "Track the **Round**, remaining **Deck**, and live **Turn Timer** up top. Your private role pill sits on the right — tap it anytime to hide from shoulder-peekers!",
        features: [
          {
            label: "Explorers",
            detail: "Connect an open trail from Base Camp to the hidden Treasure Chest.",
          },
          {
            label: "Impostors",
            detail: "Stall and sabotage until the deck and all hands run empty.",
          },
        ],
        tryItHint: "Tap your Explorer / Impostor badge anytime to toggle privacy mode.",
        visualId: "tt-roles",
      },
      {
        id: "tt-step-2",
        targetId: "tt-board",
        badge: "THE BOARD",
        title: "9×5 Trail & 3 Sealed Vaults",
        icon: "game-trails",
        accent: "sage",
        summary:
          "All trails grow out of **Base Camp** on the left toward **3 Sealed Vaults** on the right — **1 Treasure Chest** and **2 Empty Ruins**.",
        features: [
          {
            label: "Glowing Green Cells",
            detail: "When you pick a Path Tile, every valid connected slot lights up automatically.",
          },
          {
            label: "Zoom / Fit All",
            detail: "Tap Zoom on mobile anytime to inspect tight junctions closely.",
          },
        ],
        tryItHint: "Reaching an Empty Ruins flips it open and the expedition keeps going!",
        visualId: "tt-board-flip",
      },
      {
        id: "tt-step-3",
        targetId: "tt-players",
        badge: "TOOL SLOTS",
        title: "1-to-1 Tools: Break & Fix",
        icon: "tool-pickaxe",
        accent: "terracotta",
        summary:
          "Every player shows **3 Tool Slots**: **Lantern**, **Compass**, and **Pickaxe**. A red slash blocks that player from placing Path Tiles!",
        features: [
          {
            label: "Red Break Cards",
            detail: "Target any player's intact matching tool icon to stall their progress.",
          },
          {
            label: "Green Fix / Dual Fix",
            detail: "Tap a slashed matching tool to repair yourself or a trusted teammate.",
          },
        ],
        tryItHint: "Icons always match 1-to-1 — look for bouncing rings when a target is valid.",
        visualId: "tt-tools",
      },
      {
        id: "tt-step-4",
        targetId: "tt-hand",
        badge: "YOUR HAND",
        title: "Paths, Flip 180° & Action Cards",
        icon: "action-peek-vault",
        accent: "amber",
        summary:
          "On your turn, select **1 card** from your hand to play onto the board or a player — you automatically draw back up afterward.",
        features: [
          {
            label: "Flip 180°",
            detail: "Spin any selected Path Tile before dropping it on a green cell.",
          },
          {
            label: "Peek Vault & Blast Tile",
            detail: "Secretly inspect 1 vault (private badge!) or blast dead-end boulders.",
          },
        ],
        tryItHint: "Only you see the badge after using Peek Vault — guide or bluff wisely!",
        visualId: "tt-actions",
      },
      {
        id: "tt-step-5",
        targetId: "tt-actions",
        badge: "SELF-RESCUE",
        title: "Discard & Quick Fix (2-for-1)",
        icon: "quick-fix",
        accent: "terracotta",
        summary:
          "Stuck with awkward cards or a broken tool? You are **never permanently locked out** of the round.",
        features: [
          {
            label: "Discard 1 Card",
            detail: "Pass quietly face-down to refresh your hand without revealing it.",
          },
          {
            label: "Quick Fix Rescue",
            detail: "Discard any 2 cards to repair 1 of your own broken tools immediately!",
          },
        ],
        tryItHint: "If nobody fixes your tool, tap Quick Fix as soon as it appears in your bar.",
        visualId: "tt-quickfix",
      },
      {
        id: "tt-step-6",
        targetId: "tt-tools",
        badge: "TABLE TOOLS",
        title: "Board Marker, Quick Bluffs & Rules",
        icon: "cafe-cup",
        accent: "amber",
        summary:
          "Coordinate routes — or sow chaos — using TableFolk's live social tools right in the top bar.",
        features: [
          {
            label: "Live Board Marker",
            detail: "Tap Mark to draw paths or ping suspicious vaults for everyone to see.",
          },
          {
            label: "Table Chat & Rules",
            detail: "Send 1-tap Quick Bluffs in Chat, or reopen Rules / Tour anytime.",
          },
        ],
        tryItHint: "You're ready! Watch who discards often or builds dead ends.",
        visualId: "tt-table-tools",
      },
    ],
  },

  hearthvale: {
    slug: "hearthvale",
    title: "Hearthvale",
    subtitle: "6-step interactive walkthrough of tile-laying, Folk & scoring",
    estimatedSec: 45,
    icon: "game-hearthvale",
    steps: [
      {
        id: "hv-step-1",
        targetId: "hv-header",
        badge: "GOAL & HUD",
        title: "Valley Stack & Turn Phase",
        icon: "game-hearthvale",
        accent: "amber",
        summary:
          "Build the sunlit valley together and score the most **Victory Points** before the tile stack hits **0 left**.",
        features: [
          {
            label: "2-Step Turn Rhythm",
            detail: "Every turn is simple: (1) Place 1 Tile, then (2) optionally Claim with Folk.",
          },
          {
            label: "Final Scoring",
            detail: "When the last tile drops, incomplete Roads, Towns & Windmills still score!",
          },
        ],
        tryItHint: "Watch the pulsing turn badge — green means Place Tile, gold means Claim Folk.",
        visualId: "hv-goal",
      },
      {
        id: "hv-step-2",
        targetId: "hv-players",
        badge: "YOUR FOLK",
        title: "Scoreboard, Villagers & Mayor",
        icon: "hv-mayor",
        accent: "sage",
        summary:
          "Track everyone's score and remaining Folk supply. Claimed Folk **return to your hand** the moment their feature finishes!",
        features: [
          {
            label: "6 Villagers (Strength 1)",
            detail: "Your everyday builders for Roads, Towns, and Windmills.",
          },
          {
            label: "1 Mayor (Strength 2)",
            detail: "Counts as 2 Folk — breaks ties when two rivals merge into the same Town!",
          },
        ],
        tryItHint: "Don't burn all your Folk early — keep 1–2 free for surprise Windmills.",
        visualId: "hv-folk",
      },
      {
        id: "hv-step-3",
        targetId: "hv-board",
        badge: "THE VALLEY",
        title: "Matching Edges & Glowing Slots",
        icon: "hv-town",
        accent: "sage",
        summary:
          "Every touching edge must match cleanly: **Towns meet Towns**, **Roads meet Roads**, and **Meadows meet Meadows**.",
        features: [
          {
            label: "Glowing Green + Slots",
            detail: "Tap any glowing spot on the valley map to preview your tile right in place.",
          },
          {
            label: "Rotate 90° & Confirm",
            detail: "Tap the previewed tile again (or Rotate 90° / R) to spin before confirming.",
          },
        ],
        tryItHint: "Use the Zoom toggle anytime on mobile as the valley expands outward.",
        visualId: "hv-match-rotate",
      },
      {
        id: "hv-step-4",
        targetId: "hv-hand",
        badge: "ARCHITECT HAND",
        title: "2-Tile Choice Every Turn",
        icon: "card-deck",
        accent: "amber",
        summary:
          "You always hold **2 Tiles** in your Architect Hand — compare how many open spots each tile fits and pick the stronger play!",
        features: [
          {
            label: "Bonus Badges",
            detail: "Look for Crest (+2 Town pts), Lantern (×2 Road pts), and Windmill (9 pts).",
          },
          {
            label: "Zero Dead Turns",
            detail: "Tap between Tile 1 and Tile 2 to preview their valid spots instantly.",
          },
        ],
        tryItHint: "Hold onto a tricky Town Cap to close a rival's mega-town — or finish yours!",
        visualId: "hv-architect-hand",
      },
      {
        id: "hv-step-5",
        targetId: "hv-scoring",
        badge: "CLAIM & SCORE",
        title: "Towns, Roads & Windmills",
        icon: "hv-windmill",
        accent: "terracotta",
        summary:
          "After placing a tile, tap any glowing pin on that new tile to drop a **Villager** or **Mayor** — or tap **Skip Folk** to save supply.",
        features: [
          {
            label: "Towns",
            detail: "3 pts for a 2-tile town; 2 pts/tile + 2 per Crest for 3+ tile walled towns.",
          },
          {
            label: "Roads & Windmills",
            detail: "Roads score 1/tile (2/tile with a Lantern); Windmills score 9 when surrounded!",
          },
        ],
        tryItHint: "You can only claim an unclaimed feature — merge two towns later to contest!",
        visualId: "hv-scoring",
      },
      {
        id: "hv-step-6",
        targetId: "hv-tools",
        badge: "TABLE TOOLS",
        title: "Valley Marker, Chat & Rules",
        icon: "cafe-cup",
        accent: "amber",
        summary:
          "Point out shared town merges, celebrate clutch draws, or double-check scoring anytime from the top bar.",
        features: [
          {
            label: "Live Marker Pen",
            detail: "Tap Mark to circle prime windmill spots or sketch road plans on the valley.",
          },
          {
            label: "Quick Reactions & Rules",
            detail: "Cheer in Table Chat or tap Rules / Tour whenever you need a refresher.",
          },
        ],
        tryItHint: "You're all set — claim your first Road or Town to get on the board!",
        visualId: "hv-table-tools",
      },
    ],
  },

  "velvet-masque": {
    slug: "velvet-masque",
    title: "Velvet Masque",
    subtitle: "6-step interactive walkthrough of Curtain Call, swaps & bluffs",
    estimatedSec: 45,
    icon: "game-masque",
    steps: [
      {
        id: "vm-step-1",
        targetId: "vm-header",
        badge: "GOAL & HUD",
        title: "Gold Goal & Gala Phase",
        icon: "trophy",
        accent: "amber",
        summary:
          "Every guest starts with **6 Gold**. Reach the **Gold Goal** (**13g** standard / **10g** quick) first to win the masquerade!",
        features: [
          {
            label: "Instant Victory",
            detail: "Hit the Gold Goal on any turn to claim the Gala crown immediately.",
          },
          {
            label: "Bankruptcy End",
            detail: "If any guest drops to 0 Gold, the match ends and the richest guest wins!",
          },
        ],
        tryItHint: "Keep an eye on the pulsing phase pill — red means it's time to Challenge or act!",
        visualId: "vm-goal",
      },
      {
        id: "vm-step-2",
        targetId: "vm-players",
        badge: "CURTAIN CALL",
        title: "Memorize, Then Face-Down!",
        icon: "game-masque",
        accent: "terracotta",
        summary:
          "At match start, all masks are briefly **face-up** during Curtain Call — then the curtain closes and every mask flips **face-down**!",
        features: [
          {
            label: "Memory Under Pressure",
            detail: "Even you don't see your own mask after swaps unless you spend a turn to Peek.",
          },
          {
            label: "Gold & Turn Highlight",
            detail: "Watch each guest's Gold stack to spot who's closing in on the win.",
          },
        ],
        tryItHint: "During Curtain Call, memorize your own mask and at least two neighbors!",
        visualId: "vm-curtain",
      },
      {
        id: "vm-step-3",
        targetId: "vm-stage",
        badge: "STAGE & FINES",
        title: "Velvet Stage & The Fine Box",
        icon: "coin-gold",
        accent: "amber",
        summary:
          "Extra unassigned masks rest face-down on the **Velvet Stage**, while failed bluffs and wrong challenges drop **1 Gold** into the **Fine Box**.",
        features: [
          {
            label: "Velvet Stage Swaps",
            detail: "Swap your card with a Stage mask to quietly steal an unclaimed power!",
          },
          {
            label: "Magistrate Jackpot",
            detail: "Claiming the Magistrate sweeps up to 4 Gold straight out of the Fine Box.",
          },
        ],
        tryItHint: "Watch the Fine Box — once it holds 3–4 Gold, someone will bluff Magistrate!",
        visualId: "vm-stage-fine",
      },
      {
        id: "vm-step-4",
        targetId: "vm-dock",
        badge: "YOUR TURN",
        title: "Swap, Secret Peek, or Announce",
        icon: "vm-jester",
        accent: "sage",
        summary:
          "The **first 4 turns** are Swap-only to scramble everyone's memory. After that, choose **1 of 3 Gala Moves** each turn:",
        features: [
          {
            label: "Velvet Cloak Swap",
            detail: "Pull 2 masks under the cloak — then secretly Actually Swap OR Fake-Swap (Keep)!",
          },
          {
            label: "Peek or Announce Mask",
            detail: "Privately check your own card, OR claim ANY of the 8 Masks (truth or bluff!).",
          },
        ],
        tryItHint: "Fake-swapping lets you keep your true mask while convincing rivals you traded it!",
        visualId: "vm-cloak-swap",
      },
      {
        id: "vm-step-5",
        targetId: "vm-roster",
        badge: "SHOWDOWN",
        title: "8-Mask Ribbon & Challenges",
        icon: "vm-monarch",
        accent: "terracotta",
        summary:
          "The top ribbon shows every **In-Play Mask** and its power. Whenever someone announces a Mask, every other guest chooses **Pass** or **Challenge**!",
        features: [
          {
            label: "Unchallenged Claim",
            detail: "Nobody challenges? The announced power fires automatically — even a bold bluff!",
          },
          {
            label: "Challenged Showdown",
            detail: "Claimed cards flip face-up: the true holder uses the power; every fake pays 1g Fine!",
          },
        ],
        tryItHint: "Even if you're bluffing, stay calm — hesitation gives away a fake claim!",
        visualId: "vm-challenge",
      },
      {
        id: "vm-step-6",
        targetId: "vm-tools",
        badge: "TABLE TOOLS",
        title: "Board Marker, Quick Bluffs & Rules",
        icon: "cafe-cup",
        accent: "amber",
        summary:
          "Use the salon's social tools to accuse rivals, track swaps, or inspect all 8 Mask powers at a glance.",
        features: [
          {
            label: "Salon Marker Pen",
            detail: "Tap Mark to circle suspicious guests or draw swap arrows on the velvet table.",
          },
          {
            label: "Quick Bluffs & Rules",
            detail: "Drop 1-tap theatrical bluffs in Chat, or tap Rules / Tour anytime.",
          },
        ],
        tryItHint: "You're ready for the Gala — trust nobody, not even your own memory!",
        visualId: "vm-table-tools",
      },
    ],
  },
};

export function getGameQuickTour(slug?: string): GameQuickTourConfig {
  if (slug === "hearthvale") return GAME_QUICK_TOURS.hearthvale;
  if (slug === "velvet-masque") return GAME_QUICK_TOURS["velvet-masque"];
  return GAME_QUICK_TOURS["treasure-trails"];
}

const TOUR_STORAGE_PREFIX = "tablefolk:quick-tour-done:v1:";

export function hasCompletedQuickTour(slug: SupportedGameSlug): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(`${TOUR_STORAGE_PREFIX}${slug}`) === "1";
  } catch {
    return false;
  }
}

export function markQuickTourCompleted(slug: SupportedGameSlug): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${TOUR_STORAGE_PREFIX}${slug}`, "1");
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function resetQuickTour(slug: SupportedGameSlug): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${TOUR_STORAGE_PREFIX}${slug}`);
  } catch {
    // Ignore
  }
}
