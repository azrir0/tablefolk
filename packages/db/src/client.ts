import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import pg from "pg";
import * as schema from "./schema.js";

export type TableFolkDb = NodePgDatabase<typeof schema>;

const BOOTSTRAP_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  supabase_uid TEXT UNIQUE,
  is_guest BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avatar_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cafe_definitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  map_id TEXT NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 30,
  is_public BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS private_cafes (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  max_players INTEGER NOT NULL DEFAULT 16,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_catalogue (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  min_players INTEGER NOT NULL,
  max_players INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  cover_theme TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  tutorial_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS game_tutorials (
  id TEXT PRIMARY KEY,
  game_slug TEXT NOT NULL UNIQUE REFERENCES game_catalogue(slug) ON DELETE CASCADE,
  locale TEXT NOT NULL DEFAULT 'en',
  summary TEXT NOT NULL,
  rules_markdown TEXT NOT NULL,
  card_reference_json JSONB NOT NULL,
  faq_json JSONB NOT NULL,
  video_url TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  game_slug TEXT NOT NULL,
  cafe_room_id TEXT NOT NULL,
  table_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  config_json JSONB NOT NULL,
  state_snapshot_json JSONB,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  seat_index INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  role_revealed TEXT
);

CREATE TABLE IF NOT EXISTS player_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  context_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

let dbSingleton: TableFolkDb | null = null;
let initializedPromise: Promise<TableFolkDb> | null = null;

export async function getDb(): Promise<TableFolkDb> {
  if (dbSingleton) return dbSingleton;
  if (initializedPromise) return initializedPromise;

  initializedPromise = (async () => {
    const databaseUrl = process.env.DATABASE_URL?.trim();

    if (databaseUrl) {
      const isLocal =
        databaseUrl.includes("localhost") ||
        databaseUrl.includes("127.0.0.1") ||
        databaseUrl.includes("sslmode=disable");
      const pool = new pg.Pool({
        connectionString: databaseUrl,
        max: 10,
        idleTimeoutMillis: 30_000,
        ssl: isLocal ? undefined : { rejectUnauthorized: false },
      });
      await pool.query(BOOTSTRAP_DDL);
      dbSingleton = drizzlePg(pool, { schema });
      console.log("[TableFolk DB] Connected to PostgreSQL via DATABASE_URL.");
    } else {
      const dataDir = path.resolve(
        process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".pglite", "tablefolk")
      );
      fs.mkdirSync(dataDir, { recursive: true });
      const client = new PGlite(dataDir);
      await client.exec(BOOTSTRAP_DDL);
      dbSingleton = drizzlePglite(client, { schema }) as unknown as TableFolkDb;
      console.log(`[TableFolk DB] Running embedded local PostgreSQL (PGlite) at ${dataDir}`);
    }

    await seedDefaultData(dbSingleton);
    return dbSingleton;
  })();

  return initializedPromise;
}

export async function seedDefaultData(db: TableFolkDb): Promise<void> {
  await db
    .insert(schema.cafeDefinitions)
    .values({
      id: "cafe_sunlit_oak",
      slug: "sunlit-oak",
      name: "Sunlit Oak Café",
      mapId: "cozy-cafe-v1",
      maxPlayers: 30,
      isPublic: true,
    })
    .onConflictDoNothing();

  const games = [
    {
      id: "game_treasure_trails",
      slug: "treasure-trails",
      title: "Treasure Trails",
      tagline: "Chart the sunlit ruins — and unmask the secret Impostors!",
      description:
        "A hidden-role path-building card game for 3–8 players. Explorers build a continuous trail from Base Camp to the hidden Treasure Chest while Impostors break tools, drop dead-ends, and bluff Peek Vault intel.",
      category: "Hidden-Role",
      minPlayers: 3,
      maxPlayers: 8,
      estimatedMinutes: 15,
      difficulty: "Medium",
      coverTheme: "from-amber-200 via-emerald-100 to-teal-200",
      isAvailable: true,
      tutorialAvailable: true,
    },
    {
      id: "game_hearthvale",
      slug: "hearthvale",
      title: "Hearthvale",
      tagline: "Build a sunlit valley of towns, lantern roads & hilltop windmills!",
      description:
        "A cozy tile-laying strategy game for 2–5 architects. Always hold a 2-tile hand, double completed road scores with Roadside Lanterns, surround Windmills for 9 points, and deploy your double-strength Mayor pawn to win big town majorities.",
      category: "Strategy",
      minPlayers: 2,
      maxPlayers: 5,
      estimatedMinutes: 6,
      difficulty: "Easy",
      coverTheme: "from-amber-100 via-lime-100 to-emerald-200",
      isAvailable: true,
      tutorialAvailable: true,
    },
    {
      id: "game_velvet_masque",
      slug: "velvet-masque",
      title: "Velvet Masque",
      tagline: "Swap masks under the curtain, bluff your role & race to 13 Gold!",
      description:
        "A chaotic social bluffing & memory party game for 3–8 guests. Memorize the masks at Curtain Call, secretly swap (or fake-swap!) cards under the Velvet Cloak, announce bold powers, and dare rivals to a simultaneous Showdown!",
      category: "Social Bluffing",
      minPlayers: 3,
      maxPlayers: 8,
      estimatedMinutes: 10,
      difficulty: "Easy",
      coverTheme: "from-rose-200 via-amber-100 to-purple-200",
      isAvailable: true,
      tutorialAvailable: true,
    },
    {
      id: "game_matcha_dominoes",
      slug: "matcha-dominoes",
      title: "Matcha Tiles",
      tagline: "Cozy pattern-building café classic (Coming in Wave 2)",
      description:
        "Draft hand-painted ceramic tea tiles and arrange matching botanical sets around the table. Relaxed strategy for 2–4 players.",
      category: "Strategy",
      minPlayers: 2,
      maxPlayers: 4,
      estimatedMinutes: 12,
      difficulty: "Easy",
      coverTheme: "from-emerald-100 via-lime-100 to-amber-100",
      isAvailable: false,
      tutorialAvailable: false,
    },
    {
      id: "game_lantern_duel",
      slug: "lantern-duel",
      title: "Lantern Duel",
      tagline: "Quick 2-player bluffing card duel (Coming in Wave 2)",
      description:
        "Outwit a single opponent across three quick rounds of hidden bids and lantern light tricks.",
      category: "Card Games",
      minPlayers: 2,
      maxPlayers: 2,
      estimatedMinutes: 8,
      difficulty: "Easy",
      coverTheme: "from-rose-100 via-orange-100 to-amber-200",
      isAvailable: false,
      tutorialAvailable: false,
    },
  ];

  for (const g of games) {
    await db
      .insert(schema.gameCatalogue)
      .values(g)
      .onConflictDoUpdate({
        target: schema.gameCatalogue.id,
        set: {
          tagline: g.tagline,
          description: g.description,
          isAvailable: g.isAvailable,
          tutorialAvailable: g.tutorialAvailable,
        },
      });
  }

  const ttTutorial = {
    id: "tut_treasure_trails_en",
    gameSlug: "treasure-trails",
    locale: "en",
    summary:
      "Explorers work together to build an unbroken trail from Base Camp to the hidden Treasure Chest. Secret Impostors try to break tools, block paths, and run the deck out before the chest is reached.",
    rulesMarkdown: `### Goal of the Game
- **Explorers** win the round the instant an unbroken open trail connects **Base Camp (0,2)** to the **Treasure Chest** hidden among the 3 Sealed Vaults on the right edge.
- **Impostors** win if the **Expedition Deck** and all player hands run empty without reaching the Treasure Chest.

### On Your Turn (Choose 1 Action)
1. **Place a Path Tile** on a highlighted green cell (requires all 3 of your tools working: **Lantern**, **Compass**, and **Pickaxe**). You can **Flip 180°** before placing!
2. **Play an Action Card** — break a rival's tool with a **Break** card, repair an ally's tool with a **Fix** card (matching the exact tool icon!), peek privately inside a Sealed Vault with **Peek Vault**, or destroy any placed tile with **Blast Tile**.
3. **Discard 1 Card** face-down to pass quietly.
4. **Quick Fix (Self-Rescue):** Stuck with a broken tool? Discard **2 cards** face-down to repair 1 of your own broken tools immediately!

### Scoring
- **Explorers Win:** +2 Stars each, plus **+1 Clutch Star** to the Explorer who placed the final connecting tile.
- **Impostors Win:** +4 Stars (if 1 Impostor), +3 Stars each (if 2), or +2 Stars each (if 3).`,
    cardReferenceJson: [
      {
        name: "Open Path Tiles (31)",
        category: "Path",
        icon: "game-trails",
        description:
          "Crossroads, T-forks, straights, and corners that extend the trail from Base Camp.",
      },
      {
        name: "Blocked Dead-Ends (9)",
        category: "Path",
        icon: "boulder",
        description:
          "Rockfalls and blocked corners that legally attach to a path and stop progress until blasted.",
      },
      {
        name: "Break Tool Cards (9)",
        category: "Sabotage",
        icon: "break-pickaxe",
        description:
          "Break a player's Lantern, Compass, or Pickaxe (exact matching tool icon!). Broken players cannot place paths.",
      },
      {
        name: "Fix Tool & Dual Fix Cards (9)",
        category: "Support",
        icon: "fix-lantern",
        description:
          "Repair 1 broken tool on yourself or a trusted teammate. Dual Fix cards can repair either of 2 shown tools.",
      },
      {
        name: "Peek Vault (5)",
        category: "Intel",
        icon: "action-peek-vault",
        description:
          "Secretly peek inside 1 unrevealed Sealed Vault to spot the Treasure Chest — share the truth or bluff!",
      },
      {
        name: "Blast Tile (3)",
        category: "Clear",
        icon: "action-blast-tile",
        description:
          "Remove any placed path or dead-end tile from the board (Base Camp and Vaults are protected).",
      },
    ],
    faqJson: [
      {
        q: "Can I place a path tile next to a Dead-End to go past it?",
        a: "No! Every new tile must connect to an unbroken Open Path traceable back to Base Camp. Clear dead-ends with Blast Tile or route around them.",
      },
      {
        q: "What happens if I uncover an Empty Ruins decoy vault?",
        a: "The decoy flips into an open tile and the round keeps going! Now everyone knows the Treasure Chest is in one of the remaining vaults.",
      },
      {
        q: "What if nobody fixes my broken tool?",
        a: "Use Quick Fix! Discard any 2 cards from your hand on your turn to repair 1 of your own broken tools.",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(ttTutorial)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: ttTutorial.summary,
        rulesMarkdown: ttTutorial.rulesMarkdown,
        cardReferenceJson: ttTutorial.cardReferenceJson,
        faqJson: ttTutorial.faqJson,
      },
    });

  const hvTutorialValues = {
    id: "tut_hearthvale_en",
    gameSlug: "hearthvale",
    locale: "en",
    summary:
      "Lay scenic landscape tiles to grow walled Towns, Lantern Roads, and Hilltop Windmills. Claim features with your Villagers and double-strength Mayor to earn the most Stars when the final tile is placed!",
    rulesMarkdown: `### Goal of the Game
- Score the most **Stars** by placing tiles and claiming **Walled Towns**, **Cobble Roads**, and **Hilltop Windmills**.
- Choose **Cozy (36 tiles, ~5m)** for a quick café session or **Grand (54 tiles, ~9m)** for sprawling shared kingdoms!

### On Your Turn (2 Quick Steps)
1. **Place 1 of Your 2 Tiles:** You always hold a **2-tile Architect Hand**. Tap any glowing green frontier spot, spin **Rotate 90°** to match neighboring roads, towns, and meadows, then confirm!
2. **Claim a Feature (Optional):** Place 1 available Folk (**Villager = 1** or **Mayor = 2**) onto an **unclaimed** Town, Road, or Windmill on the tile you just laid — or tap **Skip**. (Skipped automatically if nothing on the tile is unclaimed.)

### Instant Scoring & Folk Return
- **Completed Town:** A tiny 2-tile town scores **3 Stars**; a 3+ tile town scores **2 Stars per tile + 2 Stars per Crest Banner**.
- **Completed Road:** **1 Star per tile** — or **2 Stars per tile** if the road passes any glowing **Roadside Lantern**!
- **Hilltop Windmill:** **9 Stars** as soon as all 8 surrounding spots are filled.
- **Majorities & Ties:** Highest total Folk strength wins full points (ties share full points!), and all Folk immediately return to your supply.
- **Game End:** Unfinished Towns (1/tile + 1/Crest), unfinished Roads (1/tile), and unfinished Windmills (1 + neighbors) award final bonus Stars!`,
    cardReferenceJson: [
      {
        name: "Walled Towns & Crests",
        category: "Feature",
        icon: "hv-town",
        description:
          "Close all town walls to score 3 Stars (2 tiles) or 2 Stars/tile + 2 Stars per golden Crest Shield (3+ tiles).",
      },
      {
        name: "Cobble & Lantern Roads",
        category: "Feature",
        icon: "hv-lantern",
        description:
          "Close both ends (or loop) to score 1 Star/tile — doubled to 2 Stars/tile if the road includes a glowing Lantern!",
      },
      {
        name: "Hilltop Windmills",
        category: "Landmark",
        icon: "hv-windmill",
        description:
          "Place a Folk on the Windmill and fill all 8 surrounding spots for a huge 9-Star burst!",
      },
      {
        name: "The Mayor Pawn",
        category: "Special Folk",
        icon: "hv-mayor",
        description:
          "Every player has 5 Villagers (strength 1) + 1 Mayor (strength 2). Merge adjacent towns or roads to steal or tie majority!",
      },
      {
        name: "2-Tile Architect Hand",
        category: "Twist",
        icon: "game-hearthvale",
        description:
          "Always choose between 2 tiles in your hand so you can plan ahead during rivals' turns and avoid dead draws.",
      },
      {
        name: "Twin Walls (Split Towns)",
        category: "Tactical Tile",
        icon: "hv-wall",
        description:
          "Two separate town edges on opposite sides — great for capping one town while starting a sneaky merger nearby!",
      },
    ],
    faqJson: [
      {
        q: "Can I place a Folk onto a Town or Road that someone already claimed?",
        a: "Not directly — you can only place a Folk on an unclaimed feature. However, you CAN claim a separate nearby town/road and later connect them with a tile to merge and contest majority!",
      },
      {
        q: "What happens if two players tie for the highest Folk strength in a Town?",
        a: "Both tied players receive the FULL score for that feature, and all Folk return to their owners!",
      },
      {
        q: "Do I lose my Mayor forever if I place them?",
        a: "No! Your Mayor returns to your supply as soon as their Town, Road, or Windmill is completed, ready to deploy again.",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(hvTutorialValues)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: hvTutorialValues.summary,
        rulesMarkdown: hvTutorialValues.rulesMarkdown,
        cardReferenceJson: hvTutorialValues.cardReferenceJson,
        faqJson: hvTutorialValues.faqJson,
      },
    });

  const vmTutorialValues = {
    id: "tut_velvet_masque_en",
    gameSlug: "velvet-masque",
    locale: "en",
    summary:
      "Memorize everyone's Mask during Curtain Call, juggle cards under the Velvet Cloak (really swapping—or faking it!), announce bold powers, and race to 13 Gold (or 10 in Blitz)!",
    rulesMarkdown: `### Goal of the Game
- Every guest starts with **6 Gold** and **1 Secret Mask**.
- First player to reach **13 Gold** *(or **10 Gold** in Quick Blitz)* wins the Velvet Crown immediately!

### Curtain Call & Opening Shuffle
- All Masks start **face-up for 6 seconds** so you can memorize who holds what—then flip face-down!
- In 3–5 player games, extra Masks sit on the **Velvet Stage** in the center so there are always 6 Masks in play.
- **Turns 1 & 2** are Opening Shuffle turns *(Swap / Fake-Swap only)* so mystery erupts right away. From **Turn 3 onward**, all 3 actions unlock!

### On Your Turn — Pick 1 of 3 Actions
1. **Under the Cloak (Swap or Fake-Swap):** Pick any rival or Velvet Stage slot. Both face-down cards glide under the crimson curtain—secretly choose **Really Swap** or **Fake Swap**. Everyone sees the exact same shuffle!
2. **Peek at Your Mask:** Privately flip your own card face-up for 3.5 seconds to refresh your memory.
3. **Announce a Mask:** Claim ANY active Mask without peeking! All rivals with 1+ Gold get **7 seconds** simultaneously to click **Let It Slide** or **Challenge ("No, I'M that Mask!")**:
   - **Unchallenged:** Your mask stays hidden and you trigger its power!
   - **Challenged (Showdown!):** All claimants flip simultaneously. Whoever **truly holds** the Mask activates its power immediately *(even out of turn!)*—every wrong claimant pays **1 Gold** into the **Fine Box**!

### Balance Upgrades
- **No Sudden Bankruptcy:** Hitting 0 Gold never ends the match abruptly—you simply can't Challenge while broke until you earn Gold back.
- **Capped Swings:** Magistrate takes at most **4 Gold** from the Fine Box (+1 from Bank if empty), and Illusionist swaps fortunes capped at **±4 Gold**.`,
    cardReferenceJson: [
      {
        name: "Monarch (3–8p)",
        category: "Gold Engine",
        icon: "vm-monarch",
        description: "Collect +3 Gold from the Royal Bank. Huge payout—and a lightning rod for challenges!",
      },
      {
        name: "Patron (3–8p)",
        category: "Gold + Intel",
        icon: "vm-patron",
        description: "Collect +2 Gold from the Bank AND secretly peek at any 1 rival or Velvet Stage mask.",
      },
      {
        name: "Magistrate (3–8p)",
        category: "Fine Box",
        icon: "vm-magistrate",
        description: "Collect up to 4 Gold from the Fine Box (or +1 Gold stipend from the Bank if empty).",
      },
      {
        name: "Trickster (3–8p)",
        category: "Steal",
        icon: "vm-trickster",
        description: "Steal 1 Gold from your left neighbor and 1 Gold from your right neighbor.",
      },
      {
        name: "Illusionist (3–8p)",
        category: "Comeback",
        icon: "vm-illusionist",
        description: "Choose any rival and swap Gold totals—capped at 4 Gold transferred.",
      },
      {
        name: "Jester (3–8p)",
        category: "Chaos",
        icon: "vm-jester",
        description: "Gain +1 Gold AND secretly swap (or fake-swap!) any 2 OTHER masks on the table!",
      },
      {
        name: "Taxmaster (7–8p)",
        category: "Anti-Leader",
        icon: "vm-taxmaster",
        description: "Steal 2 Gold directly from the richest rival (pick if tied).",
      },
      {
        name: "Smuggler (8p)",
        category: "Heist Win",
        icon: "vm-smuggler",
        description: "Hold 10+ Gold (8+ in Blitz) to WIN IMMEDIATELY! Otherwise gain +1 Gold & Peek your mask.",
      },
    ],
    faqJson: [
      {
        q: "Can I bluff a Mask even if I genuinely forgot what card I'm holding?",
        a: "YES! That's the best part of Velvet Masque. If nobody challenges you, your card stays face-down and you get the power anyway—and sometimes you accidentally hold the exact Mask you bluffed!",
      },
      {
        q: "What happens if multiple players challenge the same announcement?",
        a: "All claimants flip at the same time in a Showdown! At most one person truly holds that Mask—they immediately use its power, and EVERY other claimant pays 1 Gold into the Fine Box!",
      },
      {
        q: "What if I hit 0 Gold?",
        a: "You're still in the gala! You cannot Challenge while at 0 Gold (since challenging risks a 1-Gold fine), but on your turn you can Announce any Mask, Swap, or Peek to bounce right back.",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(vmTutorialValues)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: vmTutorialValues.summary,
        rulesMarkdown: vmTutorialValues.rulesMarkdown,
        cardReferenceJson: vmTutorialValues.cardReferenceJson,
        faqJson: vmTutorialValues.faqJson,
      },
    });
}
