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
  | "vm-table-tools"
  | "sg-goal"
  | "sg-bank"
  | "sg-market"
  | "sg-engine"
  | "sg-reserve"
  | "sg-patrons"
  | "hr-goal"
  | "hr-island"
  | "hr-hand"
  | "hr-build"
  | "hr-scrolls"
  | "hr-awards"
  | "ds-goal"
  | "ds-wonder"
  | "ds-hand"
  | "ds-actions"
  | "ds-neighbors"
  | "ds-kingdoms"
  | "lw-goal"
  | "lw-council"
  | "lw-actions"
  | "lw-dossier"
  | "lw-ledger"
  | "lw-chronicle";

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

  "sunstone-guild": {
    slug: "sunstone-guild",
    title: "Sunstone Guild",
    subtitle: "6-step interactive tour of gems, Relic engines, Catalysts & Patrons",
    estimatedSec: 45,
    icon: "game-sunstone",
    steps: [
      {
        id: "sg-step-1",
        targetId: "sg-header",
        badge: "GOAL & PACE",
        title: "Race to 15 Prestige (Final Round!)",
        icon: "game-sunstone",
        accent: "amber",
        summary:
          "Track the **Round**, **Prestige Goal** (12★ Quick or 15★ Classic), and **Turn Clock** up top. Reaching the goal triggers an equal-turns **Final Round**!",
        features: [
          {
            label: "Clean Tiebreaker",
            detail: "Tied at highest Prestige? The artisan with FEWER crafted Relics wins the Crown!",
          },
          {
            label: "Tour & Rules Anytime",
            detail: "Tap Tour or Rules in the top bar whenever you want a quick refresher.",
          },
        ],
        tryItHint: "Watch for the glowing FINAL ROUND badge once someone reaches the target!",
        visualId: "sg-goal",
      },
      {
        id: "sg-step-2",
        targetId: "sg-bank",
        badge: "GEM BANK",
        title: "Draft 3 Different or 2 Matching Gems",
        icon: "sg-ruby",
        accent: "sage",
        summary:
          "Tap gem chips in the **Gem Bank** to stage your pick, then tap **Take Gems**. You can hold up to **10 gems** at the end of your turn.",
        features: [
          {
            label: "3 Different Base Colors",
            detail: "Take 1 each of up to 3 distinct colors (Ruby, Sapphire, Emerald, Amethyst, Pearl).",
          },
          {
            label: "2 of the Same Color",
            detail: "Tap one color twice to take 2 — ONLY allowed when 4+ remain in that stack!",
          },
        ],
        tryItHint: "Try tapping gem chips in the bank — valid double-takes highlight automatically!",
        visualId: "sg-bank",
      },
      {
        id: "sg-step-3",
        targetId: "sg-market",
        badge: "ARTISAN MARKET",
        title: "3 Tiers of Relics, ⚡ Catalysts & 2× Masterworks",
        icon: "sg-emerald",
        accent: "sage",
        summary:
          "Every crafted **Relic** stays in your workshop forever, permanently discounting future cards of its color! Cards you can buy right now glow **emerald**.",
        features: [
          {
            label: "⚡ Tier I Catalysts",
            detail: "Spark-badged Tier I cards immediately refund +1 free matching gem from the bank!",
          },
          {
            label: "2× Tier III Masterworks",
            detail: "Select high-tier Masterworks award 2× permanent discounts to skyrocket toward Patrons!",
          },
        ],
        tryItHint: "Tap any Market card to inspect exact discounts & auto-Gold fill before crafting.",
        visualId: "sg-market",
      },
      {
        id: "sg-step-4",
        targetId: "sg-atelier",
        badge: "YOUR ATELIER",
        title: "Permanent Discounts & Wild Sunstone Gold",
        icon: "sg-gold",
        accent: "amber",
        summary:
          "Your **Atelier Panel** tracks held gems on top and permanent **−Discount** badges underneath — discounts are NEVER spent when crafting!",
        features: [
          {
            label: "Reserve (+1 ★ Wild Gold)",
            detail: "Lock up to 3 Relics (face-up OR blind from a Tier deck) to claim Wild Sunstone Gold!",
          },
          {
            label: "Auto-Gold Bridge",
            detail: "Sunstone Gold automatically covers any missing gem when you tap Craft Relic.",
          },
        ],
        tryItHint: "Tap any glowing card inside your Reserved Relics tray to craft it directly!",
        visualId: "sg-reserve",
      },
      {
        id: "sg-step-5",
        targetId: "sg-patrons",
        badge: "ROYAL PATRONS",
        title: "Attract Guild Patrons for Free +3★",
        icon: "sg-crown",
        accent: "terracotta",
        summary:
          "Royal **Guild Patrons** watch your permanent **Engine Discounts** (not loose gems in hand). Match a Patron's requirements to welcome them automatically!",
        features: [
          {
            label: "Instant +3 Prestige",
            detail: "Patrons visit automatically at the end of your turn — no extra action needed!",
          },
          {
            label: "Max 1 Per Turn",
            detail: "If you qualify for 2 Patrons on the same turn, tap whichever glowing Patron you prefer.",
          },
        ],
        tryItHint: "Check the green have/req pills on Patrons early to steer your Tier I picks!",
        visualId: "sg-patrons",
      },
      {
        id: "sg-step-6",
        targetId: "sg-players",
        badge: "GUILD STANDINGS",
        title: "Scout Rivals & Block Key Masterworks",
        icon: "sg-sapphire",
        accent: "sage",
        summary:
          "Keep an eye on **Guild Artisans** on the right — each chip shows Discounts / Held Gems, ★ Gold wilds, and locked Reserves!",
        features: [
          {
            label: "Spot Incoming Crafts",
            detail: "See which colors rivals are hoarding so you can Reserve a key Masterwork first!",
          },
          {
            label: "Blind Reserve Secrecy",
            detail: "Blind Tier deck reserves show only T1/T2/T3 to rivals — keeping your endgame secret!",
          },
        ],
        tryItHint: "You're ready to forge your legacy — may the Sunstone shine on your atelier!",
        visualId: "sg-engine",
      },
    ],
  },

  harborreach: {
    slug: "harborreach",
    title: "Harborreach",
    subtitle: "6-step interactive tour of hex harvests, Compass charges, Harbors & Scrolls",
    estimatedSec: 45,
    icon: "game-harbor",
    steps: [
      {
        id: "hr-step-1",
        targetId: "hr-header",
        badge: "GOAL & PACE",
        title: "Race to 10 Victory Points",
        icon: "game-harbor",
        accent: "amber",
        summary:
          "Track the **Round**, **2d6 Dice Roll**, **VP Goal** (8★ Quick or 10★ Classic), and **Turn Clock** up top. Hit the target VP on your turn to win instantly!",
        features: [
          {
            label: "Founding Snake Draft",
            detail: "Place 2 free Cottages + 2 Roads first — your 2nd Cottage harvests immediately!",
          },
          {
            label: "Instant Victory",
            detail: "Secret +1★ Landmark Charter Scrolls count automatically on your turn.",
          },
        ],
        tryItHint: "Watch the pulsing green status badge up top — it always tells you what to tap next!",
        visualId: "hr-goal",
      },
      {
        id: "hr-step-2",
        targetId: "hr-board",
        badge: "COASTAL ISLAND",
        title: "19 Hexes, Glowing Corners & 9 Harbors",
        icon: "hr-cottage",
        accent: "sage",
        summary:
          "Every Cottage touching a rolled hex number harvests **+1 resource** (Towns harvest **+2**!). Red **6** and **8** tokens roll most often and never sit adjacent!",
        features: [
          {
            label: "Tap-Safe Glowing Targets",
            detail: "Valid Road edges, Cottage corners, and Town upgrades pulse automatically on the map.",
          },
          {
            label: "Coastal Harbor Ports",
            detail: "Settle on a pier corner to unlock permanent 3:1 wild or 2:1 specialty swaps!",
          },
        ],
        tryItHint: "Tap glowing green corners during Founding Setup — pick spots touching 3 rich terrains!",
        visualId: "hr-island",
      },
      {
        id: "hr-step-3",
        targetId: "hr-hand",
        badge: "HAND & COMPASS",
        title: "5 Resources & Dry-Spell Compass",
        icon: "hr-grain",
        accent: "amber",
        summary:
          "Track your **Timber, Clay, Wool, Grain & Ore** here. Stay at **7 or fewer cards** when ending your turn to avoid discarding half if a **7** is rolled!",
        features: [
          {
            label: "Dry-Spell Harbor Compass",
            detail: "Miss a non-7 roll? Gain +1 Compass charge — spend 3 charges for ANY 1 resource!",
          },
          {
            label: "Bandit-Proof Charges",
            detail: "Compass charges never count toward the 7-card cap and can't be stolen!",
          },
        ],
        tryItHint: "Once your Compass reaches 3/3, tap Redeem Wild to grab the exact resource you need!",
        visualId: "hr-hand",
      },
      {
        id: "hr-step-4",
        targetId: "hr-build",
        badge: "BUILD & TRADE",
        title: "Roads, Cottages, Towns & Smart Trading",
        icon: "hr-town",
        accent: "sage",
        summary:
          "After rolling dice, trade and build in any order! Tap **Road**, **Cottage**, or **Town** to light up valid placements on the island, or tap **Trade** to swap!",
        features: [
          {
            label: "Harbor & Bank Swaps",
            detail: "Instant 4:1 Bank swaps — automatically upgraded to 3:1 or 2:1 at your Harbors.",
          },
          {
            label: "Player & Bot Offers",
            detail: "Propose 1-click deals to rivals — Practice Bots gladly accept fair 1:1 swaps!",
          },
        ],
        tryItHint: "Tap a build button once to activate targeting, then tap any glowing spot on the map!",
        visualId: "hr-build",
      },
      {
        id: "hr-step-5",
        targetId: "hr-scrolls",
        badge: "GUILD SCROLLS",
        title: "Scouts, Road Builders, Plenty & Monopoly",
        icon: "hr-scroll",
        accent: "terracotta",
        summary:
          "Spend **1 Wool · 1 Grain · 1 Ore** to draw from the 25-card **Guild Scroll** deck. Play 1 action Scroll per turn (bought on an earlier turn)!",
        features: [
          {
            label: "Ranger Scouts (14)",
            detail: "Move the Bandit Fox (even BEFORE rolling!) and steal 1 card — 3+ earns +2★ Watch!",
          },
          {
            label: "Big Swing Scrolls",
            detail: "Road Builder (+2 Roads), Harvest Plenty (+2 Wild), Monopoly, & secret +1★ Charters.",
          },
        ],
        tryItHint: "Got the Bandit Fox sitting on your 8 hex? Play a Ranger Scout before clicking Roll 2d6!",
        visualId: "hr-scrolls",
      },
      {
        id: "hr-step-6",
        targetId: "hr-players",
        badge: "ISLAND AWARDS",
        title: "Longest Route, Largest Watch & Standings",
        icon: "hr-bandit",
        accent: "amber",
        summary:
          "Track every Pioneer's public VP, cards in hand, continuous road length, and Ranger Scouts played — two **+2★ Island Awards** can swing any close race!",
        features: [
          {
            label: "Longest Trade Route (+2★)",
            detail: "Claimed at 5+ unbroken Roads (enemy Cottages split rival routes!).",
          },
          {
            label: "Largest Harbor Watch (+2★)",
            detail: "Claimed at 3+ played Ranger Scouts — rivals must strictly beat you to steal!",
          },
        ],
        tryItHint: "You're ready to settle Harborreach — pick a rich corner and chart your coastline!",
        visualId: "hr-awards",
      },
    ],
  },

  dawnspire: {
    slug: "dawnspire",
    title: "Dawnspire",
    subtitle: "6-step interactive tour of simultaneous drafting, Wonders, auto-trade & 7-path scoring",
    estimatedSec: 45,
    icon: "game-dawnspire",
    steps: [
      {
        id: "ds-step-1",
        targetId: "ds-header",
        badge: "3 ERAS · ZERO WAIT",
        title: "Simultaneous Card Drafting",
        icon: "game-dawnspire",
        accent: "amber",
        summary:
          "Play across **3 Eras (I, II, III)** of **6 turns each**. Everyone drafts **at the exact same time** — then remaining hands pass **Left**, **Right**, and **Left**!",
        features: [
          {
            label: "Pass Direction Badge",
            detail: "Watch Pass Left / Pass Right up top so you know which neighbor receives your leftovers.",
          },
          {
            label: "Sunlit vs Starlit Wonders",
            detail: "Sunlit offers balanced wonders; Starlit unlocks bold asymmetric empire powers!",
          },
        ],
        tryItHint: "No waiting for slow turns — lock in your pick and the whole table flips together!",
        visualId: "ds-goal",
      },
      {
        id: "ds-step-2",
        targetId: "ds-wonder",
        badge: "YOUR WONDER & REALM",
        title: "Wonder Stages & 7-Color Tableau",
        icon: "ds-wonder",
        accent: "sage",
        summary:
          "Your **Wonder** grants a permanent **Starting Resource** and 2–3 iconic **Stages**. Every structure you build lines up underneath by color!",
        features: [
          {
            label: "Renewable Production",
            detail: "Brown Raw & Silver Craft resources produce fresh EVERY turn — they are never spent!",
          },
          {
            label: "Live VP & KPI Bar",
            detail: "Track your Gold (3g = +1★), Red Shields, and live Victory Point estimate anytime.",
          },
        ],
        tryItHint: "Aim to complete at least 2 Wonder Stages — they unlock massive points & unique powers!",
        visualId: "ds-wonder",
      },
      {
        id: "ds-step-3",
        targetId: "ds-hand",
        badge: "YOUR HAND",
        title: "Smart Cost Badges & Free Chains",
        icon: "ds-civic",
        accent: "sage",
        summary:
          "Every card in your hand automatically calculates your exact status: **Ready · Free**, **FREE CHAIN!**, **Buy · 2g (1← 1→)**, or missing resources!",
        features: [
          {
            label: "Free Chaining (0 Gold!)",
            detail: "Building Era I prerequisites unlocks powerful Era II & III structures completely FREE!",
          },
          {
            label: "No Duplicates",
            detail: "You can only build each structure name once — tuck extras under your Wonder or Sell them!",
          },
        ],
        tryItHint: "Tap any card in your hand to inspect its Auto-Trade split in the action bar below!",
        visualId: "ds-hand",
      },
      {
        id: "ds-step-4",
        targetId: "ds-actions",
        badge: "3 ACTIONS",
        title: "Build, Raise Wonder Stage, or Sell",
        icon: "ds-commerce",
        accent: "amber",
        summary:
          "With a card selected, choose **1 of 3 instant moves**: **Build** the card, tuck it to raise your **Next Wonder Stage**, or **Sell** it for Gold!",
        features: [
          {
            label: "Sunlit Caravan Bonus (+4g)",
            detail: "Selling always gives +3 Gold — or +4 Gold whenever you hold the lowest Gold at the table!",
          },
          {
            label: "Wonder Stage Tuck",
            detail: "Raising a Wonder Stage pays the Stage's cost (NOT the card's) — great for denying rival cards!",
          },
        ],
        tryItHint: "You can switch your choice before the final player locks in!",
        visualId: "ds-actions",
      },
      {
        id: "ds-step-5",
        targetId: "ds-neighbors",
        badge: "TRADE & BORDERS",
        title: "Neighbor Trade & Era Military Clashes",
        icon: "ds-military",
        accent: "terracotta",
        summary:
          "You only **Trade** and **Clash Shields** with your immediate **Left & Right Neighbors**! Borrowing costs **2g** (cut to **1g** by Markets!).",
        features: [
          {
            label: "Non-Blocking Trade",
            detail: "Paying a neighbor for Stone or Glass never removes it from them — both realms use it!",
          },
          {
            label: "Escalating Era Clashes",
            detail: "Beat a neighbor's Shields at Era end for +1★ (Era I), +3★ (Era II), or +5★ (Era III)!",
          },
        ],
        tryItHint: "Check your neighbors' Shields around Turn 5 of each Era to snatch easy Military wins!",
        visualId: "ds-neighbors",
      },
      {
        id: "ds-step-6",
        targetId: "ds-kingdoms",
        badge: "7 SCORING PATHS",
        title: "Science Combos, Grand Guilds & Standings",
        icon: "ds-science",
        accent: "sage",
        summary:
          "Tap any rival realm to inspect all their built cards! After Era III, score **Military, Gold, Wonders, Blue, Yellow, Purple Guilds & Green Science**!",
        features: [
          {
            label: "Exponential Science",
            detail: "Tablets, Compasses & Gears score n² each PLUS +7★ per complete set of all 3!",
          },
          {
            label: "Era III Grand Guilds",
            detail: "Purple Guilds score huge bonuses from your neighbors' cards, Wonders, or Wild Science!",
          },
        ],
        tryItHint: "You're ready to raise a timeless realm — tap a card in your Era I hand to begin!",
        visualId: "ds-kingdoms",
      },
    ],
  },

  "lantern-watch": {
    slug: "lantern-watch",
    title: "Lantern Watch",
    subtitle: "6-step interactive guide to covert crews, public votes & secret roles",
    estimatedSec: 45,
    icon: "game-lantern",
    steps: [
      {
        id: "lw-step-1",
        targetId: "lw-header",
        badge: "GOAL & BEACONS",
        title: "5 Coastal Beacons & Chaos Track",
        icon: "game-lantern",
        accent: "amber",
        summary:
          "First faction to win **3 of 5 Coastal Beacons** claims the harbor — with **zero player elimination** so everyone stays in every vote!",
        features: [
          {
            label: "Beacon Crew Sizes",
            detail: "Each glowing circle shows how many couriers depart (7–8p Beacon 4 needs 2 Fails!).",
          },
          {
            label: "Chaos Track (0/5)",
            detail: "5 rejected proposals in a row collapses the Council — instant Shadow Mole win!",
          },
        ],
        tryItHint: "Tap the Role Privacy pill in the top bar anytime to hide your secret identity!",
        visualId: "lw-goal",
      },
      {
        id: "lw-step-2",
        targetId: "lw-council",
        badge: "HARBOR COUNCIL",
        title: "Commander Seal, Crew & Secret Sightings",
        icon: "lw-commander",
        accent: "sage",
        summary:
          "The **Lantern Commander** rotates clockwise after every vote. Watch for Commander badges, Brass Spyglass icons, and flipped public votes!",
        features: [
          {
            label: "Tap Seats to Nominate",
            detail: "When you hold the Commander Seal, tap any seats here to assemble your mission crew.",
          },
          {
            label: "Private Intel Halos",
            detail: "Oracle, Warden, Shadow Allies, and Spyglass checks mark seats privately for your eyes only.",
          },
        ],
        tryItHint: "Every player's most recent Approve or Reject vote appears right on their seat card.",
        visualId: "lw-council",
      },
      {
        id: "lw-step-3",
        targetId: "lw-actions",
        badge: "ROUND LOOP",
        title: "Propose, Vote Publicly & Execute Secretly",
        icon: "lw-beacon",
        accent: "amber",
        summary:
          "Every beacon follows **3 crisp steps**: Commander proposes a team, everyone votes **Approve** or **Reject**, then the crew plays secret cards!",
        features: [
          {
            label: "Strict Majority Vote",
            detail: "More Approves than Rejects launches the crew — ties count as Reject and raise Chaos.",
          },
          {
            label: "Anonymous Mission Shuffle",
            detail: "Loyal couriers can only play Light; Shadow Moles may Extinguish or bluff Light!",
          },
        ],
        tryItHint: "At Chaos 4/5, Loyal players must Approve to prevent Shadow Council Collapse!",
        visualId: "lw-actions",
      },
      {
        id: "lw-step-4",
        targetId: "lw-dossier",
        badge: "SECRET ROLES",
        title: "Your Dossier, Oracle & Brass Spyglass",
        icon: "lw-oracle",
        accent: "terracotta",
        summary:
          "Check your **Secret Dossier** for your faction, special role sightings, and any private **Brass Spyglass** inspections you perform!",
        features: [
          {
            label: "Oracle & Warden",
            detail: "Oracle sees Shadow Moles (except Veiled Mole at 7–8p); Warden sees Oracle + Mirage.",
          },
          {
            label: "Brass Spyglass (5–8p)",
            detail: "After Missions 2, 3, and 4 in Oracle mode, privately check 1 unchecked courier's faction!",
          },
        ],
        tryItHint: "Use the Hide button on your Dossier whenever playing side-by-side or sharing a screen.",
        visualId: "lw-dossier",
      },
      {
        id: "lw-step-5",
        targetId: "lw-ledger",
        badge: "CORE WEAPON",
        title: "Always-Visible Council Vote Ledger",
        icon: "lw-warden",
        accent: "sage",
        summary:
          "Deduction lives in the **Council Vote Ledger** — every proposed team, every player's **Approve/Reject** dot, and every shuffled Beacon tally!",
        features: [
          {
            label: "Spot Voting Blocs",
            detail: "Gold rings mark who was on each crew; see who pushed failed teams through!",
          },
          {
            label: "Nightblade Clues",
            detail: "Careful if you are The Oracle — voting too perfectly reveals you to the Nightblade!",
          },
        ],
        tryItHint: "Look for players who rejected clean teams or eagerly approved sabotaged crews.",
        visualId: "lw-ledger",
      },
      {
        id: "lw-step-6",
        targetId: "lw-chronicle",
        badge: "FINAL CLIMAX",
        title: "Watch Chronicle & Nightblade Unmasking",
        icon: "lw-nightblade",
        accent: "terracotta",
        summary:
          "Follow live Harbor Chronicle events and debate in **Table Chat**. In Oracle mode, 3 Lit Beacons triggers the **Nightblade's Final Shot**!",
        features: [
          {
            label: "One Final Call",
            detail: "The Nightblade names 1 Loyal courier as The Oracle — a direct hit steals Shadow victory!",
          },
          {
            label: "Full Role Reveal",
            detail: "Every identity reveals together at game end with instant 1-click Rematch!",
          },
        ],
        tryItHint: "You're ready to take the Watch — study your Secret Dossier and trust the Ledger!",
        visualId: "lw-chronicle",
      },
    ],
  },
};

export function getGameQuickTour(slug?: string): GameQuickTourConfig {
  if (slug === "hearthvale") return GAME_QUICK_TOURS.hearthvale;
  if (slug === "velvet-masque") return GAME_QUICK_TOURS["velvet-masque"];
  if (slug === "sunstone-guild") return GAME_QUICK_TOURS["sunstone-guild"];
  if (slug === "harborreach") return GAME_QUICK_TOURS.harborreach;
  if (slug === "dawnspire") return GAME_QUICK_TOURS.dawnspire;
  if (slug === "lantern-watch") return GAME_QUICK_TOURS["lantern-watch"];
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
