import type { GameTutorialDTO } from "@tablefolk/shared";
import type { GameIconName } from "@/components/GameIcons";

export type SupportedGameSlug = "treasure-trails" | "hearthvale" | "velvet-masque";

export interface WalkthroughChapter {
  id: string;
  title: string;
  badge: string;
  startSec: number;
  endSec: number;
  caption: string;
  narration: string;
}

export interface ShortClipDefinition {
  id: string;
  title: string;
  durationSec: number;
  tag: string;
  icon: GameIconName;
  explanation: string;
  proTip: string;
}

export interface TurnStepDefinition {
  step: number;
  title: string;
  icon: GameIconName;
  accent: "sage" | "amber" | "terracotta";
  summary: string;
}

export interface ScoringPillar {
  label: string;
  value: string;
  detail: string;
  icon: GameIconName;
  tone: "sage" | "amber" | "terracotta";
}

export interface OnboardingTip {
  kind: "do" | "watch";
  text: string;
}

export interface GameOnboardingCurriculum {
  slug: SupportedGameSlug;
  title: string;
  icon: GameIconName;
  accentBg: string;
  accentBorder: string;
  atAGlance: {
    players: string;
    duration: string;
    category: string;
    difficulty: string;
    winGoal: string;
    signatureTwist: string;
  };
  turnSteps: TurnStepDefinition[];
  scoringPillars: ScoringPillar[];
  firstMatchTips: OnboardingTip[];
  walkthroughDurationSec: number;
  walkthroughChapters: WalkthroughChapter[];
  shortClips: ShortClipDefinition[];
  fallbackTutorial: GameTutorialDTO;
}

export const GAME_ONBOARDING: Record<SupportedGameSlug, GameOnboardingCurriculum> = {
  "treasure-trails": {
    slug: "treasure-trails",
    title: "Treasure Trails",
    icon: "game-trails",
    accentBg: "from-amber-100/90 via-oat-50 to-emerald-100/75",
    accentBorder: "border-sage-300",
    atAGlance: {
      players: "3–8 Players",
      duration: "10–20 min",
      category: "Hidden-Role",
      difficulty: "Medium",
      winGoal:
        "Explorers connect an unbroken open trail from Base Camp to the hidden Treasure Chest. Impostors stall until the deck and hands run empty.",
      signatureTwist:
        "1-to-1 Tool Icons (Lantern, Compass, Pickaxe) plus Quick Fix Self-Rescue so you are never permanently soft-locked.",
    },
    turnSteps: [
      {
        step: 1,
        title: "Place a Path Tile",
        icon: "game-trails",
        accent: "sage",
        summary:
          "If all 3 of your tools are working, drop a Path Tile onto any glowing green spot connected to **Base Camp**. Tap **Flip 180°** anytime before placing!",
      },
      {
        step: 2,
        title: "Or Play an Action Card",
        icon: "action-peek-vault",
        accent: "amber",
        summary:
          "**Break** a rival's tool, **Fix** a teammate's matching tool, secretly scout a vault with **Peek Vault**, or clear a boulder with **Blast Tile**.",
      },
      {
        step: 3,
        title: "Or Discard / Quick Fix",
        icon: "quick-fix",
        accent: "terracotta",
        summary:
          "Discard **1 card** face-down to pass quietly — or discard **2 cards** with **Quick Fix** to repair 1 of your own broken tools on the spot!",
      },
    ],
    scoringPillars: [
      {
        label: "Explorers Win",
        value: "+2 Stars each",
        detail: "Plus +1 Clutch Star to the Explorer who connects the Treasure Chest!",
        icon: "vault-treasure",
        tone: "sage",
      },
      {
        label: "Impostors Win",
        value: "+2 to +4 Stars",
        detail: "+4 Stars (1 Impostor), +3 each (2 Impostors), or +2 each (3 Impostors).",
        icon: "role-impostor",
        tone: "terracotta",
      },
      {
        label: "3 Sealed Vaults",
        value: "1 Chest · 2 Empty",
        detail: "Connecting an Empty Ruins flips it open and the round keeps going!",
        icon: "action-peek-vault",
        tone: "amber",
      },
    ],
    firstMatchTips: [
      {
        kind: "do",
        text: "Match tool icons 1-to-1: a **Break Pickaxe** card breaks the Pickaxe slot, and only a **Fix Pickaxe** (or **Dual Fix** with Pickaxe) repairs it.",
      },
      {
        kind: "do",
        text: "Use **Peek Vault** early — then decide whether to guide your team to the true Treasure Chest or mislead them as an Impostor!",
      },
      {
        kind: "watch",
        text: "Don't waste turns sitting broken: if nobody fixes your tool, tap **Quick Fix** and discard 2 cards to repair yourself immediately.",
      },
    ],
    walkthroughDurationSec: 55,
    walkthroughChapters: [
      {
        id: "tt-ch-1",
        title: "Secret Roles & Goal",
        badge: "GOAL",
        startSec: 0,
        endSec: 11,
        caption:
          "Everyone gets a secret role: Explorers race to connect Base Camp to the hidden Treasure Chest while Impostors try to run the deck dry.",
        narration:
          "Welcome to Treasure Trails! Each player secretly becomes an Explorer or an Impostor. Explorers must connect Base Camp to the hidden Treasure Chest among three Sealed Vaults, while Impostors stall until the deck runs out.",
      },
      {
        id: "tt-ch-2",
        title: "Place & Flip Path Tiles",
        badge: "YOUR TURN",
        startSec: 11,
        endSec: 23,
        caption:
          "Pick an open Path Tile, tap Flip 180° if you want to spin it, and drop it on a glowing green cell attached to the active trail.",
        narration:
          "On your turn, pick a Path Tile from your hand. You can tap Flip 180 degrees to match the turn you need, then place it on any highlighted green square linked back to Base Camp.",
      },
      {
        id: "tt-ch-3",
        title: "Break & Fix Tools (1-to-1)",
        badge: "SABOTAGE",
        startSec: 23,
        endSec: 35,
        caption:
          "Break cards slash a matching Lantern, Compass, or Pickaxe so that player cannot lay paths. Match the exact icon with a Fix or Dual Fix card to repair!",
        narration:
          "Watch the three tool icons next to every player: Lantern, Compass, and Pickaxe. Playing a red Break card disables that exact tool and blocks path placement until a matching green Fix or Dual Fix card clears the slash.",
      },
      {
        id: "tt-ch-4",
        title: "Peek, Blast & Quick Fix",
        badge: "ACTIONS",
        startSec: 35,
        endSec: 45,
        caption:
          "Peek Vault reveals a private Chest or Empty badge for your eyes only. Blast Tile clears dead-end boulders, and Quick Fix swaps 2 discards to self-repair!",
        narration:
          "Need intel or a rescue? Peek Vault secretly labels one vault for your eyes only. Blast Tile clears blocked dead-end boulders, and Quick Fix lets you discard any two cards to fix one of your own broken tools.",
      },
      {
        id: "tt-ch-5",
        title: "Vault Reveal & Victory",
        badge: "WIN",
        startSec: 45,
        endSec: 55,
        caption:
          "Connect a Sealed Vault to flip it dramatically! Empty Ruins keep the hunt alive — uncover the Treasure Chest to win Stars for the Explorers!",
        narration:
          "The moment an unbroken path touches a Sealed Vault, it flips open! Empty Ruins keep the round alive, while uncovering the Treasure Chest wins the round with bonus Stars for the Explorers!",
      },
    ],
    shortClips: [
      {
        id: "tt-connect-flip",
        title: "Connecting & Flipping Paths",
        durationSec: 9,
        tag: "Core Rule",
        icon: "game-trails",
        explanation:
          "Every Path Tile must match all touching edges and connect along an unbroken open route back to Base Camp. Tap Flip 180° to rotate a corner or T-fork before dropping it — Dead-Ends legally attach but stop the route cold!",
        proTip:
          "As an Explorer, avoid leaving single narrow corridors that one Dead-End boulder can choke off — fork your trail into two lanes!",
      },
      {
        id: "tt-tools-match",
        title: "1-to-1 Tool Icons: Break vs. Fix",
        durationSec: 10,
        tag: "1-to-1 Match",
        icon: "tool-pickaxe",
        explanation:
          "Each player has three tool slots: Lantern, Compass, and Pickaxe. A red Break card slashes the exact same tool icon and blocks path-laying until a matching green Fix (or 2-icon Dual Fix) repairs it.",
        proTip:
          "Notice someone refusing to fix a teammate's broken tool when they had plenty of cards? They might be a hidden Impostor!",
      },
      {
        id: "tt-peek-blast",
        title: "Peek Vault & Blast Tile",
        durationSec: 10,
        tag: "Intel & Clear",
        icon: "action-peek-vault",
        explanation:
          "Peek Vault reveals a private badge (★ CHEST or ✕ EMPTY) visible ONLY on your screen — you can call it out honestly or bluff. Blast Tile vaporizes any placed path or Dead-End boulder blocking the expedition.",
        proTip:
          "Hold a Blast Tile for the final stretch! Impostors often save their nastiest Dead-End boulders for the square right next to the Treasure Chest.",
      },
      {
        id: "tt-quick-fix",
        title: "Quick Fix: Never Get Soft-Locked",
        durationSec: 9,
        tag: "TableFolk Twist",
        icon: "quick-fix",
        explanation:
          "Stuck with a broken tool and nobody fixing you? Click Quick Fix, select which broken tool to mend, and discard 2 cards face-down to immediately restore it on your turn.",
        proTip:
          "Use Quick Fix when you hold Dead-Ends or unneeded Break cards — you clear junk from your hand AND get back to laying paths!",
      },
    ],
    fallbackTutorial: {
      gameSlug: "treasure-trails",
      title: "Treasure Trails",
      summary:
        "Explorers build an unbroken trail from Base Camp to the hidden Treasure Chest among 3 Sealed Vaults. Secret Impostors break tools, drop Dead-Ends, and bluff Peek Vault intel to run the deck dry.",
      rulesMarkdown: `### Goal of the Game
- **Explorers** win the round the instant an unbroken open trail connects **Base Camp (0,2)** to the hidden **Treasure Chest** among the 3 Sealed Vaults.
- **Impostors** win if the **Expedition Deck** and all player hands run empty without reaching the Treasure Chest.

### On Your Turn (Choose 1 Action)
1. **Place a Path Tile:** Requires all 3 tools working (**Lantern**, **Compass**, **Pickaxe**). Tap **Flip 180°** before dropping onto a glowing green cell linked to Base Camp.
2. **Play an Action Card:** **Break** or **Fix** a matching tool icon, privately scout a vault with **Peek Vault**, or clear a blocking tile with **Blast Tile**.
3. **Discard 1 Card:** Toss 1 card face-down to pass quietly and draw a fresh card.
4. **Quick Fix (Self-Rescue):** Discard **2 cards** face-down to immediately repair 1 of your own broken tools!

### Scoring
- **Explorers Win:** **+2 Stars** each, plus **+1 Clutch Star** to the Explorer who connects the Treasure Chest.
- **Impostors Win:** **+4 Stars** (1 Impostor), **+3 Stars** each (2 Impostors), or **+2 Stars** each (3 Impostors).`,
      cardReference: [
        {
          name: "Open Path Tiles (31)",
          category: "Path",
          icon: "game-trails",
          description:
            "Crossroads, T-forks, straights, and corners that extend the open route from Base Camp toward the Vaults.",
        },
        {
          name: "Blocked Dead-Ends (9)",
          category: "Sabotage Path",
          icon: "boulder",
          description:
            "Rockfalls and blocked corners that legally snap to paths and halt progress until cleared by Blast Tile.",
        },
        {
          name: "Break Tool Cards (9)",
          category: "Sabotage",
          icon: "break-pickaxe",
          description:
            "Break a rival's Lantern, Compass, or Pickaxe (exact matching tool icon). Broken players cannot lay path tiles.",
        },
        {
          name: "Fix Tool & Dual Fix (9)",
          category: "Support",
          icon: "fix-lantern",
          description:
            "Repair 1 broken tool on yourself or an ally. Dual Fix cards mend either of the 2 icons shown.",
        },
        {
          name: "Peek Vault (5)",
          category: "Intel",
          icon: "action-peek-vault",
          description:
            "Privately inspect 1 unrevealed Sealed Vault to learn whether it hides the Treasure Chest or Empty Ruins.",
        },
        {
          name: "Blast Tile (3)",
          category: "Clear",
          icon: "action-blast-tile",
          description:
            "Destroy any placed Path or Dead-End tile on the board (Base Camp and Vaults stay protected).",
        },
      ],
      faq: [
        {
          q: "Can I place a path tile next to a Dead-End to go past it?",
          a: "No! Every new tile must connect to an unbroken Open Path traceable back to Base Camp. Clear Dead-Ends with Blast Tile or route around them.",
        },
        {
          q: "What happens if we connect an Empty Ruins decoy vault?",
          a: "The decoy flips open into a regular connector and the round keeps going! Now the whole table knows the Treasure Chest is in one of the remaining vaults.",
        },
        {
          q: "What if I have 2 broken tools and use Quick Fix?",
          a: "Quick Fix lets you pick which broken tool to repair in exchange for discarding 2 cards face-down. You can still be fixed by teammates too!",
        },
        {
          q: "Can an Impostor use Peek Vault and lie in chat?",
          a: "100% yes! Peek Vault badges only appear on the caster's screen, so bluffing vault locations is a classic Impostor move.",
        },
      ],
      videoUrl: null,
    },
  },

  hearthvale: {
    slug: "hearthvale",
    title: "Hearthvale",
    icon: "game-hearthvale",
    accentBg: "from-amber-100/90 via-oat-50 to-lime-100/75",
    accentBorder: "border-amberwarm-400/70",
    atAGlance: {
      players: "2–5 Players",
      duration: "5–10 min",
      category: "Tile Strategy",
      difficulty: "Easy",
      winGoal:
        "Lay valley tiles to complete Walled Towns, Lantern Roads, and Hilltop Windmills — score the most Stars by the final tile!",
      signatureTwist:
        "Always hold a 2-Tile Architect Hand, double entire roads with Roadside Lanterns, and contest Towns with your Strength-2 Mayor.",
    },
    turnSteps: [
      {
        step: 1,
        title: "Pick & Rotate 1 of 2 Tiles",
        icon: "game-hearthvale",
        accent: "sage",
        summary:
          "Choose either tile in your **2-Tile Hand**, tap **Rotate 90°** so roads match roads, towns match towns, and fields match fields, then place on a glowing green spot.",
      },
      {
        step: 2,
        title: "Claim with a Villager or Mayor",
        icon: "hv-mayor",
        accent: "amber",
        summary:
          "Optionally drop 1 available Folk (**Villager = 1**, **Mayor = 2**) onto any **unclaimed** Town, Road, or Windmill on the tile you just placed — or tap **Skip**.",
      },
      {
        step: 3,
        title: "Score Completed Features",
        icon: "star-gold",
        accent: "terracotta",
        summary:
          "Whenever a Town closes, a Road ends, or a Windmill hits 8 neighbors, the highest Folk strength scores **immediately** and all Folk return to your supply!",
      },
    ],
    scoringPillars: [
      {
        label: "Walled Towns",
        value: "2 ★ / tile (+2 Crest)",
        detail: "Quick 2-tile mini-towns score 3 Stars (+2/Crest). Ties share full points!",
        icon: "hv-town",
        tone: "terracotta",
      },
      {
        label: "Lantern Roads",
        value: "2× Road Score",
        detail: "Normal roads = 1 Star/tile. Even ONE Roadside Lantern doubles every tile to 2 Stars!",
        icon: "hv-lantern",
        tone: "amber",
      },
      {
        label: "Hilltop Windmill",
        value: "9 Stars Instant",
        detail: "Fill all 8 surrounding spots (9/9) for a massive 9-Star burst + Folk return!",
        icon: "hv-windmill",
        tone: "sage",
      },
    ],
    firstMatchTips: [
      {
        kind: "do",
        text: "Save your **Mayor (Strength 2)** for a big multi-Crest Town — claim a separate nearby town piece and connect them to steal majority!",
      },
      {
        kind: "do",
        text: "Never run out of Folk! Completing quick 2-tile towns and short Lantern roads keeps points flowing AND returns your Villagers.",
      },
      {
        kind: "watch",
        text: "You can only claim a feature on the tile you **just laid**, and only if nobody already occupies that connected Town or Road.",
      },
    ],
    walkthroughDurationSec: 55,
    walkthroughChapters: [
      {
        id: "hv-ch-1",
        title: "Build the Sunlit Valley",
        badge: "GOAL",
        startSec: 0,
        endSec: 11,
        caption:
          "Start from Valley Gate in the center. Hold 2 tiles at all times and earn the most Stars before all 36 Cozy (or 54 Grand) tiles are placed!",
        narration:
          "Welcome to Hearthvale! Every player holds a two-tile Architect Hand so you can always plan ahead. Build towns, lantern roads, and windmills to score the most Stars when the valley is complete.",
      },
      {
        id: "hv-ch-2",
        title: "Rotate 90° & Match Edges",
        badge: "STEP 1",
        startSec: 11,
        endSec: 23,
        caption:
          "Tap Rotate 90° until terracotta towns meet towns, cobble roads meet roads, and green meadows meet meadows — then confirm on any glowing frontier square.",
        narration:
          "Step one on your turn: choose one of your two tiles, tap Rotate 90 degrees so every touching edge matches seamlessly, and place it onto a highlighted green square.",
      },
      {
        id: "hv-ch-3",
        title: "Claim with Villagers & Mayor",
        badge: "STEP 2",
        startSec: 23,
        endSec: 35,
        caption:
          "Deploy 1 Villager (Strength 1) or your Mayor (Strength 2) onto an unclaimed feature on that tile. When the feature completes, your Folk pop right back!",
        narration:
          "Step two is optional: drop a Villager of strength one, or your golden Mayor of strength two, onto any unclaimed town, road, or windmill on the tile you just laid. Completed features instantly return your Folk!",
      },
      {
        id: "hv-ch-4",
        title: "Lantern Roads & Windmills",
        badge: "BIG POINTS",
        startSec: 35,
        endSec: 45,
        caption:
          "One glowing Roadside Lantern doubles the ENTIRE completed road to 2 Stars per tile! Surround a Hilltop Windmill on all 8 sides for an instant 9 Stars!",
        narration:
          "Keep an eye out for power bonuses! A single Roadside Lantern doubles every tile of a completed road to two Stars each, and surrounding a Hilltop Windmill on all eight sides awards nine Stars immediately.",
      },
      {
        id: "hv-ch-5",
        title: "Mayor Mergers & Endgame",
        badge: "STRATEGY",
        startSec: 45,
        endSec: 55,
        caption:
          "Can't drop onto a rival's town? Claim a separate town nearby with your Mayor and merge them to steal majority! Unfinished features still score bonus Stars at game end.",
        narration:
          "Want to steal a huge rival town? Claim a nearby disconnected town with your strength-two Mayor, then bridge them together to seize majority! Even unfinished features award endgame bonus Stars.",
      },
    ],
    shortClips: [
      {
        id: "hv-hand-rotate",
        title: "2-Tile Hand & Edge Matching",
        durationSec: 9,
        tag: "Core Rule",
        icon: "game-hearthvale",
        explanation:
          "You always hold 2 tiles in hand, play 1 per turn, and immediately draw back to 2. Rotate 90° so every touching side matches (Town-to-Town, Road-to-Road, Field-to-Field) on any green square.",
        proTip:
          "Use rivals' turns to preview both tiles in your hand — holding a handy cap or road curve lets you react the second an opening appears!",
      },
      {
        id: "hv-mayor-merge",
        title: "Stealing Towns with the Mayor (Str 2)",
        durationSec: 10,
        tag: "Power Play",
        icon: "hv-mayor",
        explanation:
          "You cannot place a Folk directly onto an already-claimed Town. Instead, claim a separate nearby town edge with your Mayor (Strength 2) and connect the two towns on a later turn to outnumber a single Villager!",
        proTip:
          "Even tying strength (e.g. 2 vs 2) gives BOTH players the FULL point payout — sharing a massive 14-Star town with a rival is often better than fighting alone!",
      },
      {
        id: "hv-lantern-road",
        title: "Roadside Lanterns Double Roads",
        durationSec: 9,
        tag: "2× Bonus",
        icon: "hv-lantern",
        explanation:
          "Standard completed roads score 1 Star per tile. If a completed road passes even ONE glowing Roadside Lantern, EVERY tile along that entire road doubles to 2 Stars each!",
        proTip:
          "Lanterns only double COMPLETED roads! Make sure you close both ends before the deck runs out — unfinished roads score 1 Star/tile at game end.",
      },
      {
        id: "hv-windmill-ring",
        title: "Hilltop Windmill 9-Star Ring",
        durationSec: 9,
        tag: "Landmark",
        icon: "hv-windmill",
        explanation:
          "Place a Folk on a Hilltop Windmill and watch its counter climb as ANY player lays tiles in the 8 surrounding spaces. Hit 9/9 for an instant 9 Stars and get your Folk right back!",
        proTip:
          "Drop Windmills near busy town/road hubs so OTHER players accidentally help fill your 8 surrounding spaces for you!",
      },
    ],
    fallbackTutorial: {
      gameSlug: "hearthvale",
      title: "Hearthvale",
      summary:
        "Lay scenic valley tiles from a 2-tile hand to build Walled Towns, double-scoring Lantern Roads, and 9-Star Hilltop Windmills. Deploy Villagers and your Strength-2 Mayor to claim the most Stars!",
      rulesMarkdown: `### Goal of the Game
- Score the most **Stars** by placing tiles and claiming **Walled Towns**, **Cobble Roads**, and **Hilltop Windmills**.
- Pick **Cozy (36 tiles, ~5m)** for a fast café match or **Grand (54 tiles, ~9m)** for sprawling shared kingdoms!

### On Your Turn (2 Quick Steps)
1. **Place 1 of Your 2 Tiles:** You always hold a **2-tile Architect Hand**. Tap a glowing green spot, spin **Rotate 90°** to match every touching edge, and confirm!
2. **Claim a Feature (Optional):** Place 1 available Folk (**Villager = 1** or **Mayor = 2**) onto an **unclaimed** Town, Road, or Windmill on the tile you just placed — or tap **Skip**.

### Scoring & Folk Return
- **Completed Town:** 2-tile mini-town = **3 Stars** (+2/Crest); 3+ tile town = **2 Stars/tile + 2 Stars/Crest**.
- **Completed Road:** **1 Star/tile** — doubled to **2 Stars/tile** if the road includes any glowing **Roadside Lantern**!
- **Hilltop Windmill:** **9 Stars** as soon as all 8 surrounding spots are filled (9/9).
- **Majorities & Ties:** Highest total Folk strength wins full points (**ties share full points!**), and all Folk return to your supply immediately.
- **Game End:** Unfinished Towns (1/tile + 1/Crest), unfinished Roads (1/tile), and unfinished Windmills (1 + neighbors) award final Stars!`,
      cardReference: [
        {
          name: "Walled Towns & Crests",
          category: "Feature",
          icon: "hv-town",
          description:
            "Close every town wall to score 3 Stars (2 tiles) or 2 Stars/tile + 2 Stars per golden Crest Shield (3+ tiles).",
        },
        {
          name: "Cobble & Lantern Roads",
          category: "Feature",
          icon: "hv-lantern",
          description:
            "Close both ends (or loop) for 1 Star/tile — doubled to 2 Stars/tile if the road contains a glowing Lantern!",
        },
        {
          name: "Hilltop Windmills",
          category: "Landmark",
          icon: "hv-windmill",
          description:
            "Claim the Windmill and fill all 8 surrounding squares (9/9) for an instant 9-Star payout.",
        },
        {
          name: "5 Villagers + 1 Mayor",
          category: "Your Folk",
          icon: "hv-mayor",
          description:
            "Villagers have Strength 1; your golden Mayor has Strength 2. Merge separate towns or roads to steal or tie majority!",
        },
        {
          name: "2-Tile Architect Hand",
          category: "Twist",
          icon: "game-hearthvale",
          description:
            "Always choose between 2 valley tiles so you can plan ahead on rivals' turns and avoid dead draws.",
        },
        {
          name: "Twin Walls (Split Towns)",
          category: "Tactical Tile",
          icon: "hv-wall",
          description:
            "Two separate town edges on opposite sides — perfect for capping one town while launching a sneaky merger!",
        },
      ],
      faq: [
        {
          q: "Can I place a Folk onto a Town or Road someone already claimed?",
          a: "Not directly — you can only place on an unclaimed feature. However, you CAN claim a separate nearby town/road and later bridge them together to merge and contest majority!",
        },
        {
          q: "What happens if two players tie for the highest Folk strength?",
          a: "Both tied players earn the FULL score for that feature, and all Folk immediately return to their owners!",
        },
        {
          q: "Do I lose my Mayor forever after placing them?",
          a: "Never! Your Mayor returns to your supply the instant their Town, Road, or Windmill is completed.",
        },
        {
          q: "Do two Lanterns on the same road make it 4× points?",
          a: "No — having 1 or more Roadside Lanterns activates the 2× Lantern Road bonus (2 Stars per tile) once the road is completed.",
        },
      ],
      videoUrl: null,
    },
  },

  "velvet-masque": {
    slug: "velvet-masque",
    title: "Velvet Masque",
    icon: "game-masque",
    accentBg: "from-rose-100/90 via-oat-50 to-amber-100/75",
    accentBorder: "border-terracotta-500/70",
    atAGlance: {
      players: "3–8 Players",
      duration: "8–12 min",
      category: "Bluff & Memory",
      difficulty: "Easy",
      winGoal:
        "Memorize masks, juggle cards under the crimson curtain, bluff powers boldly, and be first to reach 13 Gold (or 10 Gold in Blitz)!",
      signatureTwist:
        "You can announce ANY mask even if you forgot your own card — and hitting 0 Gold never eliminates you abruptly!",
    },
    turnSteps: [
      {
        step: 1,
        title: "Under the Cloak (Swap or Fake-Swap)",
        icon: "game-masque",
        accent: "terracotta",
        summary:
          "Pull any rival or **Velvet Stage** card behind the crimson curtain and secretly choose **Really Swap** or **Fake Swap**. Everyone sees the exact same swirl!",
      },
      {
        step: 2,
        title: "Or Peek Your Mask",
        icon: "vm-patron",
        accent: "amber",
        summary:
          "Privately flip your own card face-up for **3.5 seconds** to refresh your memory (unlocks after the 2-turn Opening Shuffle).",
      },
      {
        step: 3,
        title: "Or Announce Any Mask!",
        icon: "vm-monarch",
        accent: "sage",
        summary:
          "Claim ANY active Mask without peeking! Rivals get **7s simultaneously** to **Let It Slide** (you score hidden!) or **Challenge** into a Showdown!",
      },
    ],
    scoringPillars: [
      {
        label: "Victory Target",
        value: "13 Gold (10 Blitz)",
        detail: "Everyone begins with 6 Gold and 1 face-up Mask for 6s Curtain Call.",
        icon: "coin-gold",
        tone: "amber",
      },
      {
        label: "Showdown Fines",
        value: "1 Gold → Fine Box",
        detail: "Wrong claimants pay 1g to the Fine Box; the true holder activates immediately!",
        icon: "vm-magistrate",
        tone: "terracotta",
      },
      {
        label: "Zero Bankruptcy",
        value: "Always In Play",
        detail: "At 0 Gold you can't Challenge, but you can still Announce, Swap, or Peek to rally!",
        icon: "vm-illusionist",
        tone: "sage",
      },
    ],
    firstMatchTips: [
      {
        kind: "do",
        text: "During the **6s Curtain Call**, memorize your own Mask plus the **Monarch (+3g)** and **Magistrate** — those drive the biggest gold swings!",
      },
      {
        kind: "do",
        text: "Mix in **Fake Swaps**! Making a confident rival doubt whether they still hold the Monarch stops them from challenging your bluff.",
      },
      {
        kind: "watch",
        text: "Remember **Turns 1 & 2** are Opening Shuffle (Swap / Fake-Swap only). Starting **Turn 3**, all 3 actions — including bold bluffs — unlock!",
      },
    ],
    walkthroughDurationSec: 55,
    walkthroughChapters: [
      {
        id: "vm-ch-1",
        title: "6-Second Curtain Call",
        badge: "SETUP",
        startSec: 0,
        endSec: 11,
        caption:
          "Every guest starts with 6 Gold and 1 Mask face-up for 6 seconds. Study the table fast — then every Mask flips face-down!",
        narration:
          "Welcome to Velvet Masque! Every guest begins with six Gold and one Venetian Mask face-up for six seconds during Curtain Call. Memorize who holds what before the masks flip face-down!",
      },
      {
        id: "vm-ch-2",
        title: "Swap or Fake-Swap",
        badge: "THE CLOAK",
        startSec: 11,
        endSec: 23,
        caption:
          "Pull any rival or Velvet Stage card under the crimson curtain. Secretly pick Really Swap or Fake Swap — rivals see the exact same swirl!",
        narration:
          "Turns one and two kick off with Under the Cloak. Pull any rival or Velvet Stage card behind the crimson curtain and secretly choose Really Swap or Fake Swap. Everyone else sees the exact same juggled swirl!",
      },
      {
        id: "vm-ch-3",
        title: "Peek or Announce Boldly",
        badge: "3 ACTIONS",
        startSec: 23,
        endSec: 35,
        caption:
          "From Turn 3 onward, Swap, Peek privately for 3.5 seconds, or Announce ANY active Mask without peeking — even if you're bluffing!",
        narration:
          "From turn three onward, you can Swap, privately Peek at your own mask for three and a half seconds, or Announce any active Mask power without looking—even if you are completely bluffing!",
      },
      {
        id: "vm-ch-4",
        title: "7s Simultaneous Showdown",
        badge: "CHALLENGE",
        startSec: 35,
        endSec: 45,
        caption:
          "Every rival with 1+ Gold chooses Let It Slide or Challenge at once! Unchallenged bluffs stay hidden; Challenges flip all claimants and fine every wrong guess 1 Gold!",
        narration:
          "When you announce a Mask, rivals have seven seconds simultaneously to Let It Slide or Challenge. If nobody challenges, your card stays hidden and you trigger the power! If challenged, claimants flip—the true holder triggers immediately and every wrong guess pays one Gold into the Fine Box!",
      },
      {
        id: "vm-ch-5",
        title: "Fine Box & Race to 13 Gold",
        badge: "WIN",
        startSec: 45,
        endSec: 55,
        caption:
          "Use Magistrate to scoop up to 4 Gold from the Fine Box or Illusionist to swap fortunes — first guest to hit 13 Gold (10 in Blitz) claims the Velvet Crown!",
        narration:
          "Hitting zero Gold never knocks you out! Claim Magistrate to scoop up to four Gold from the Fine Box, or Illusionist to swap fortunes, and race to thirteen Gold to claim the Velvet Crown!",
      },
    ],
    shortClips: [
      {
        id: "vm-cloak-swap",
        title: "Really Swap vs. Fake Swap",
        durationSec: 10,
        tag: "Signature Move",
        icon: "game-masque",
        explanation:
          "When you select Under the Cloak, both cards glide behind the crimson curtain and only YOU choose whether they actually trade. To every other guest, both cards display the exact same JUGGLED animation!",
        proTip:
          "Fake-Swap with whoever holds the Monarch right before their turn — they may waste their turn Peeking instead of grabbing +3 Gold!",
      },
      {
        id: "vm-bluff-slide",
        title: "Unchallenged Bluffs Stay Hidden",
        durationSec: 9,
        tag: "Bluffing",
        icon: "vm-monarch",
        explanation:
          "You never have to reveal your Mask unless someone challenges you! If you announce Monarch (+3g) while secretly holding Jester and everyone clicks Let It Slide, you pocket +3 Gold with your card still face-down.",
        proTip:
          "Best time to bluff a big role is right after two players juggle cards — nobody is 100% sure who actually holds that Mask!",
      },
      {
        id: "vm-showdown-fines",
        title: "Simultaneous Showdowns & Fine Box",
        durationSec: 10,
        tag: "Showdown",
        icon: "vm-magistrate",
        explanation:
          "Multiple rivals can Challenge the same claim within the 7-second window. All claimants flip together: the single true holder triggers the Mask immediately (even out of turn!), and every wrong claimant pays 1 Gold into the Fine Box.",
        proTip:
          "If nobody at the table truly holds the announced Mask (because it's sitting on the Velvet Stage!), EVERY claimant pays 1 Gold — feeding a huge Magistrate payday!",
      },
      {
        id: "vm-comeback-masks",
        title: "Zero Bankruptcy & Comeback Masks",
        durationSec: 9,
        tag: "Balance Twist",
        icon: "vm-illusionist",
        explanation:
          "Dropping to 0 Gold never ends the match early — you simply can't Challenge until you earn Gold again. Use Magistrate (up to 4g Fine Box), Illusionist (swap Gold up to ±4g), or Trickster (±1g neighbors) to surge back!",
        proTip:
          "In 8-player Galas, watch the Smuggler! Anyone holding 10+ Gold (8+ in Blitz) who triggers Smuggler wins the match on the spot!",
      },
    ],
    fallbackTutorial: {
      gameSlug: "velvet-masque",
      title: "Velvet Masque",
      summary:
        "Memorize every Mask during 6s Curtain Call, swap (or fake-swap!) cards under the crimson curtain, announce bold powers without peeking, and race to 13 Gold (10 in Blitz)!",
      rulesMarkdown: `### Goal of the Game
- Every guest begins with **6 Gold** and **1 Secret Mask**.
- First player to reach **13 Gold** *(or **10 Gold** in Quick Blitz)* wins the Velvet Crown immediately!

### Curtain Call & Opening Shuffle
- All Masks start **face-up for 6 seconds** so you can memorize who holds what — then flip face-down!
- In 3–5 player games, extra Masks sit on the **Velvet Stage** so 6 Masks are always in play.
- **Turns 1 & 2** are Opening Shuffle turns *(Swap / Fake-Swap only)* to stir instant mystery. From **Turn 3 onward**, all 3 actions unlock!

### On Your Turn — Pick 1 of 3 Actions
1. **Under the Cloak (Swap or Fake-Swap):** Pull any rival or Velvet Stage card behind the crimson curtain and secretly choose **Really Swap** or **Fake Swap**. Everyone sees the exact same swirl!
2. **Peek at Your Mask:** Privately flip your own card face-up for **3.5 seconds** to refresh your memory.
3. **Announce a Mask:** Claim ANY active Mask without peeking! All rivals with 1+ Gold get **7 seconds** simultaneously to click **Let It Slide** or **Challenge**:
   - **Unchallenged:** Your mask stays hidden and you trigger its power!
   - **Challenged (Showdown!):** All claimants flip at once. Whoever **truly holds** the Mask triggers its power immediately *(even out of turn!)* — every wrong claimant pays **1 Gold** into the **Fine Box**!

### Balance Upgrades
- **Zero Bankruptcy Anti-Climax:** Hitting 0 Gold never ends the match abruptly — you simply can't Challenge while broke until you earn Gold back.
- **Capped Swings:** Magistrate collects up to **4 Gold** from the Fine Box (+1g from Bank if empty), and Illusionist swaps fortunes capped at **±4 Gold**.`,
      cardReference: [
        {
          name: "Monarch (3–8p)",
          category: "Gold Engine",
          icon: "vm-monarch",
          description:
            "Collect +3 Gold from the Royal Bank. Huge payout — and a magnet for Showdowns!",
        },
        {
          name: "Patron (3–8p)",
          category: "Gold + Intel",
          icon: "vm-patron",
          description:
            "Collect +2 Gold from the Bank AND secretly peek at any 1 rival or Velvet Stage mask.",
        },
        {
          name: "Magistrate (3–8p)",
          category: "Fine Box",
          icon: "vm-magistrate",
          description:
            "Scoop up to 4 Gold from the Fine Box (or +1 Gold stipend from the Bank if empty).",
        },
        {
          name: "Trickster (3–8p)",
          category: "Steal",
          icon: "vm-trickster",
          description:
            "Steal 1 Gold from your left neighbor and 1 Gold from your right neighbor.",
        },
        {
          name: "Illusionist (3–8p)",
          category: "Comeback",
          icon: "vm-illusionist",
          description:
            "Choose any rival and swap Gold totals — capped at ±4 Gold transferred.",
        },
        {
          name: "Jester (3–8p)",
          category: "Chaos",
          icon: "vm-jester",
          description:
            "Gain +1 Gold AND secretly swap (or fake-swap!) any 2 OTHER masks on the table!",
        },
        {
          name: "Taxmaster (7–8p)",
          category: "Anti-Leader",
          icon: "vm-taxmaster",
          description:
            "Steal 2 Gold directly from the richest rival (choose if tied).",
        },
        {
          name: "Smuggler (8p)",
          category: "Heist Win",
          icon: "vm-smuggler",
          description:
            "Hold 10+ Gold (8+ in Blitz) to WIN IMMEDIATELY! Otherwise gain +1 Gold & Peek your mask.",
        },
      ],
      faq: [
        {
          q: "Can I bluff a Mask even if I genuinely forgot what card I'm holding?",
          a: "YES! That's the heart of Velvet Masque. If nobody challenges you, your card stays face-down and you trigger the power anyway — and sometimes you accidentally hold the exact Mask you claimed!",
        },
        {
          q: "What happens if multiple players challenge the same announcement?",
          a: "All claimants flip together in a Showdown! At most one guest truly holds that Mask — they immediately trigger its power (even out of turn), and EVERY other claimant pays 1 Gold into the Fine Box!",
        },
        {
          q: "What if nobody in the Showdown holds the claimed Mask?",
          a: "Every claimant — including the announcer — pays 1 Gold into the Fine Box, and no power triggers. Great news for whoever claims Magistrate next!",
        },
        {
          q: "What happens if I drop to 0 Gold?",
          a: "You stay in the gala! You cannot Challenge while at 0 Gold, but on your turn you can Announce any Mask, Swap, or Peek to bounce straight back.",
        },
      ],
      videoUrl: null,
    },
  },
};

export function getOnboardingCurriculum(slug: string): GameOnboardingCurriculum {
  if (slug === "hearthvale") return GAME_ONBOARDING.hearthvale;
  if (slug === "velvet-masque") return GAME_ONBOARDING["velvet-masque"];
  return GAME_ONBOARDING["treasure-trails"];
}
