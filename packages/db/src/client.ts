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
      tagline: "Chart the sunlit ruins — and unmask the secret Tricksters!",
      description:
        "An original hidden-role path-building card game for 3–8 explorers. Build a continuous trail from Base Camp to the Golden Compass Vault while sabotaging rivals, scouting sealed vaults with Spyglasses, and using Field-Patch rescues.",
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
    await db.insert(schema.gameCatalogue).values(g).onConflictDoNothing();
  }

  await db
    .insert(schema.gameTutorials)
    .values({
      id: "tut_treasure_trails_en",
      gameSlug: "treasure-trails",
      locale: "en",
      summary:
        "Trailblazers work together to build an unbroken trail from Base Camp to the hidden Golden Compass Vault. Secret Tricksters try to stall, misdirect, and exhaust the deck before the vault is reached.",
      rulesMarkdown: `### Goal of the Game
- **Trailblazers** win the round the instant an unbroken open trail connects **Base Camp (0,2)** to the **Golden Compass Vault** hidden among the 3 Sealed Vaults on the right edge.
- **Tricksters** win if the **Expedition Deck** and all player hands run empty without reaching the Golden Compass.

### On Your Turn (Choose 1 Action)
1. **Place a Path Tile** on a highlighted green cell (requires all 3 of your expedition gears intact). You can **Flip 180°** before placing!
2. **Play an Action Card** — break a rival's gear with a Hazard, fix an ally's gear with a Repair/Multi-Tool, peek privately at an unrevealed Vault with a **Spyglass**, or remove any placed tile with **Boulder Clear**.
3. **Discard 1 Card** face-down to pass quietly.
4. **Field-Patch (Self-Rescue):** Stuck with broken gear? Discard **2 cards** face-down to patch 1 of your own broken gears immediately!

### Scoring
- **Trailblazers Win:** +2 Stars each, plus **+1 Clutch Star** to the explorer who placed the final connecting tile.
- **Tricksters Win:** +4 Stars (if 1 Trickster), +3 Stars each (if 2), or +2 Stars each (if 3).`,
      cardReferenceJson: [
        {
          name: "Open Path Tiles (31)",
          category: "Path",
          icon: "🗺️",
          description:
            "Crossroads, forks, straights, and curves that extend the expedition trail from Base Camp.",
        },
        {
          name: "Dead-End Blockers (9)",
          category: "Path",
          icon: "🪨",
          description:
            "Rockfalls and bramble walls that legally attach to a path and block progress until cleared.",
        },
        {
          name: "Gear Hazards (9)",
          category: "Sabotage",
          icon: "⚡",
          description:
            "Break a player's Lantern, Compass, or Grapple. Broken explorers cannot place path tiles.",
        },
        {
          name: "Repairs & Multi-Tools (9)",
          category: "Support",
          icon: "🔧",
          description:
            "Fix 1 broken gear on yourself or a trusted teammate. Multi-Tools choose between 2 gears.",
        },
        {
          name: "Spyglass (5)",
          category: "Intel",
          icon: "🔭",
          description:
            "Secretly peek at 1 unrevealed Sealed Vault. Share the truth — or bluff the whole table!",
        },
        {
          name: "Boulder Clear (3)",
          category: "Clear",
          icon: "💥",
          description:
            "Remove any placed path or dead-end tile from the grid (Base Camp and Vaults are protected).",
        },
      ],
      faqJson: [
        {
          q: "Can I place a path tile next to a Dead-End to go past it?",
          a: "No! Every new tile must connect to an unbroken Open Path traceable back to Base Camp. Clear dead-ends with Boulder Clear or route around them.",
        },
        {
          q: "What happens if I uncover a Hollow Decoy Vault?",
          a: "The decoy flips into an open sanctuary tile and the round keeps going! Now everyone knows the Golden Compass is in one of the remaining vaults.",
        },
        {
          q: "What if nobody repairs my broken gear?",
          a: "Use Field-Patch! Discard any 2 cards from your hand on your turn to fix 1 of your own broken gears.",
        },
      ],
      videoUrl: null,
    })
    .onConflictDoNothing();

  await db
    .insert(schema.gameTutorials)
    .values({
      id: "tut_hearthvale_en",
      gameSlug: "hearthvale",
      locale: "en",
      summary:
        "Lay scenic landscape tiles to grow walled Towns, Lantern Roads, and Hilltop Windmills. Claim features with your Villagers and double-strength Mayor to earn the most Stars when the final tile is placed!",
      rulesMarkdown: `### Goal of the Game
- Score the most **Stars (★)** by placing tiles and claiming **Walled Towns**, **Cobble Roads**, and **Hilltop Windmills**.
- Choose **Cozy (36 tiles, ~5m)** for a quick café session or **Grand (54 tiles, ~9m)** for sprawling shared kingdoms!

### On Your Turn (2 Quick Steps)
1. **Place 1 of Your 2 Tiles:** You always hold a **2-tile Architect Hand**. Tap any glowing green frontier spot, spin **Rotate 90°** to match neighboring roads, towns, and meadows, then confirm!
2. **Claim a Feature (Optional):** Place 1 available Folk (**Villager = 1** or **👑 Mayor = 2**) onto an **unclaimed** Town, Road, or Windmill on the tile you just laid — or tap **Skip**. (Skipped automatically if nothing on the tile is unclaimed.)

### Instant Scoring & Folk Return
- **Completed Town:** A tiny 2-tile town scores **3 ★**; a 3+ tile town scores **2 ★ per tile + 2 ★ per Crest Banner (🛡️)**.
- **Completed Road:** **1 ★ per tile** — or **2 ★ per tile** if the road passes any glowing **Roadside Lantern (🏮)**!
- **Hilltop Windmill (🌬️):** **9 ★** as soon as all 8 surrounding spots are filled.
- **Majorities & Ties:** Highest total Folk strength wins full points (ties share full points!), and all Folk immediately return to your supply.
- **Game End:** Unfinished Towns (1/tile + 1/Crest), unfinished Roads (1/tile), and unfinished Windmills (1 + neighbors) award final bonus Stars!`,
      cardReferenceJson: [
        {
          name: "Walled Towns & Crests",
          category: "Feature",
          icon: "🏰",
          description:
            "Close all town walls to score 3 ★ (2 tiles) or 2 ★/tile + 2 ★ per golden Crest Shield (3+ tiles).",
        },
        {
          name: "Cobble & Lantern Roads",
          category: "Feature",
          icon: "🏮",
          description:
            "Close both ends (or loop) to score 1 ★/tile — doubled to 2 ★/tile if the road includes a glowing Lantern!",
        },
        {
          name: "Hilltop Windmills",
          category: "Landmark",
          icon: "🌬️",
          description:
            "Place a Folk on the Windmill and fill all 8 surrounding spots for a huge 9 ★ burst!",
        },
        {
          name: "The Mayor Pawn (👑)",
          category: "Special Folk",
          icon: "👑",
          description:
            "Every player has 5 Villagers (strength 1) + 1 Mayor (strength 2). Merge adjacent towns or roads to steal or tie majority!",
        },
        {
          name: "2-Tile Architect Hand",
          category: "Twist",
          icon: "🗺️",
          description:
            "Always choose between 2 tiles in your hand so you can plan ahead during rivals' turns and avoid dead draws.",
        },
        {
          name: "Twin Walls (Split Towns)",
          category: "Tactical Tile",
          icon: "🧱",
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
    })
    .onConflictDoNothing();
}
