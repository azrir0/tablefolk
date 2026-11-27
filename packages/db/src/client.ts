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
      id: "game_sunstone_guild",
      slug: "sunstone-guild",
      title: "Sunstone Guild",
      tagline: "Draft radiant gems, craft permanent Relic discounts & attract Royal Patrons!",
      description:
        "A cozy gem-drafting engine builder for 2–4 artisans inspired by Splendor. Collect Ruby, Sapphire, Emerald, Amethyst, Pearl, and Wild Sunstone Gold to forge Relic cards that permanently reduce future costs, spark Tier I Catalysts, build 2× Grand Masterworks, and race to 15 Prestige!",
      category: "Engine Builder",
      minPlayers: 2,
      maxPlayers: 4,
      estimatedMinutes: 8,
      difficulty: "Easy",
      coverTheme: "from-indigo-200 via-amber-100 to-emerald-200",
      isAvailable: true,
      tutorialAvailable: true,
    },
    {
      id: "game_harborreach",
      slug: "harborreach",
      title: "Harborreach",
      tagline: "Chart a sunlit hex island, trade at coastal harbors & build bustling Towns!",
      description:
        "A cozy resource-trading & island settlement strategy game for 2–4 pioneers inspired by Catan. Roll 2d6 to harvest Timber, Clay, Wool, Grain, and Ore, beat dry spells with the Harbor Compass, trade at 2:1 Harbors or with rivals, outfox the Bandit Fox, and race to 10 VP!",
      category: "Trading & Strategy",
      minPlayers: 2,
      maxPlayers: 4,
      estimatedMinutes: 12,
      difficulty: "Medium",
      coverTheme: "from-teal-200 via-amber-100 to-emerald-200",
      isAvailable: true,
      tutorialAvailable: true,
    },
    {
      id: "game_dawnspire",
      slug: "dawnspire",
      title: "Dawnspire",
      tagline: "Draft three eras of sunlit wonders, trade with neighbors & score 7 paths — all at once!",
      description:
        "A zero-downtime simultaneous card-drafting civilization builder for 2–7 players inspired by 7 Wonders. Draft hands Left → Right → Left across 3 Eras, chain structures for free, borrow neighbor resources automatically, clash Shields each Era, and raise your Sunlit or Starlit Wonder!",
      category: "Card Drafting",
      minPlayers: 2,
      maxPlayers: 7,
      estimatedMinutes: 8,
      difficulty: "Medium",
      coverTheme: "from-fuchsia-200 via-amber-100 to-rose-200",
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
    cardReferenceJson: [
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
    faqJson: [
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
    cardReferenceJson: [
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
    faqJson: [
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
    cardReferenceJson: [
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
    faqJson: [
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

  const sgTutorialValues = {
    id: "tut_sunstone_guild_en",
    gameSlug: "sunstone-guild",
    locale: "en",
    summary:
      "Draft radiant gems, craft Artisan Relics for permanent discounts, spark Tier I Catalysts & 2× Masterworks, welcome Royal Patrons (+3★), and race to 15 Prestige!",
    rulesMarkdown: `### Goal of the Game
- Race to **15 Prestige** *(or **12 Prestige** in Quick mode)* by crafting **Artisan Relics** and welcoming **Royal Guild Patrons**.
- Reaching the target triggers the **Final Round** so every artisan finishes an equal number of turns. Ties break by **fewest crafted Relics**, then **most gems**.

### On Your Turn — Pick 1 Action
1. **Take 3 Different Gems:** Pick **1 each** of up to 3 different base colors *(Ruby, Sapphire, Emerald, Amethyst, Pearl — never Gold directly)*.
2. **Take 2 Matching Gems:** Pick **2 of the same base color**, ONLY if that bank stack currently has **4 or more** gems remaining.
3. **Reserve a Relic (+1 Wild Gold):** Lock any **face-up Market card** *(or draw blind from a Tier I / II / III deck)* into your private Reserve Tray *(max 3)* and gain **+1 Sunstone Gold Wild** if available!
4. **Craft a Relic:** Spend gems matching the card's cost minus your **permanent Engine Discounts** *(Sunstone Gold automatically covers any shortfall)*. You gain its **Prestige** and a **permanent Gem Discount** for the rest of the match!

### Cozy Signature Twists & End-of-Turn Rules
- **⚡ Tier I Catalysts:** Crafting a spark-badged Tier I Relic immediately refunds **+1 free gem** of its color from the bank!
- **2× Grand Masterworks:** Select Tier III Relics grant **double (+2) permanent gem discounts**, propelling you toward Royal Patrons!
- **10-Gem Hand Cap:** Hold at most **10 gems** at the end of your turn — if over, return excess gems of your choice.
- **Royal Guild Patrons (+3★):** The instant your permanent discounts match a face-up Patron's requirements, they visit your guild permanently for **+3 Prestige** *(max 1 Patron per turn)*!`,
    cardReferenceJson: [
      {
        name: "5 Base Gems (Ruby, Sapphire, Emerald, Amethyst, Pearl)",
        category: "Gem Bank",
        icon: "sg-ruby",
        description:
          "Take 3 different colors OR 2 of one color (when 4+ remain in stock). Max 10 total gems in hand.",
      },
      {
        name: "Sunstone Gold (Wild)",
        category: "Wild Token",
        icon: "sg-gold",
        description:
          "Earned ONLY when Reserving a Relic. Counts as any gem color automatically when crafting!",
      },
      {
        name: "Tier I — Workshop & ⚡ Catalysts",
        category: "Engine Starters",
        icon: "sg-emerald",
        description:
          "Low-cost relics (0–1★) that build permanent gem discounts. ⚡ Catalyst cards refund +1 matching gem immediately!",
      },
      {
        name: "Tier II — Atelier Relics",
        category: "Mid-Game",
        icon: "sg-sapphire",
        description:
          "Balanced 1–3★ relics that bridge your engine toward Royal Patrons and Tier III crown jewels.",
      },
      {
        name: "Tier III — Grand Masterworks (2×)",
        category: "High Prestige",
        icon: "sg-amethyst",
        description:
          "Worth 3–5 Prestige! Select Masterworks grant 2× permanent gem discounts to unlock Patrons in a single leap.",
      },
      {
        name: "Royal Guild Patrons (+3★)",
        category: "Bonus Milestone",
        icon: "sg-patron",
        description:
          "Automatically visit your guild when your permanent discounts match their requirement — free +3 Prestige!",
      },
    ],
    faqJson: [
      {
        q: "Do permanent Engine Discounts get spent when I craft a new Relic?",
        a: "Never! Every Relic you craft stays in your workshop forever, permanently lowering future costs — eventually making Tier I Relics completely FREE!",
      },
      {
        q: "Why can't I take 2 of the same gem sometimes?",
        a: "Taking 2 matching gems requires at least 4 gems of that color in the bank BEFORE you take them (leaving 2+ behind).",
      },
      {
        q: "Can opponents see cards I reserve?",
        a: "If you reserve a face-up Market card, rivals can see what you locked away. If you reserve blind from a Tier deck top, it stays strictly private until you craft it!",
      },
      {
        q: "How do ties break at the end of the Final Round?",
        a: "Highest Prestige wins. If tied, the artisan with FEWER crafted Relic cards wins (rewarding a leaner engine!), then most remaining gems.",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(sgTutorialValues)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: sgTutorialValues.summary,
        rulesMarkdown: sgTutorialValues.rulesMarkdown,
        cardReferenceJson: sgTutorialValues.cardReferenceJson,
        faqJson: sgTutorialValues.faqJson,
      },
    });

  const hrTutorialValues = {
    id: "tut_harborreach_en",
    gameSlug: "harborreach",
    locale: "en",
    summary:
      "Found 2 coastal Cottages, roll 2d6 to harvest Timber/Clay/Wool/Grain/Ore, beat droughts with the Harbor Compass, trade with Harbors or rivals, and race to 10 VP (8 VP in Quick mode)!",
    rulesMarkdown: `### Goal of the Game
- Race to **10 Victory Points** *(or **8 VP** in Quick mode)* on your turn!
- Earn VP from **Cottages (+1 VP)**, **Towns (+2 VP)**, **Longest Trade Route (+2 VP, 5+ roads)**, **Largest Harbor Watch (+2 VP, 3+ Scouts)**, and secret **Landmark Charter Scrolls (+1 VP)**.

### Founding Setup (Snake Draft)
- Place **1 free Cottage + 1 adjacent Road**, then in reverse turn order place your **2nd Cottage + Road**.
- Your **2nd Cottage** immediately harvests **1 starting resource** from every bordering terrain hex!

### On Your Turn
1. **Roll 2d6:** Unblocked hexes matching the sum produce **1 resource per Cottage** and **2 per Town**!
   - **Dry-Spell Compass (🧭):** Every non-7 roll where you harvest **0 resources** gives **+1 Compass Charge** *(max 3)*. Redeem 3 Charges on your turn for **any 1 resource**!
   - **Rolling 7 (Bandit Fox 🦊):** Pioneers holding **8+ cards** discard half; the roller moves the Fox to block a hex and steals **1 random card** from an adjacent rival!
2. **Trade & Build (Any Order):**
   - **Road** *(1 Timber + 1 Clay)* · **Cottage** *(1 Timber + 1 Clay + 1 Wool + 1 Grain)* · **Town Upgrade** *(2 Grain + 3 Ore)* · **Guild Scroll** *(1 Wool + 1 Grain + 1 Ore)*.
   - **Harbor & Bank Swaps:** Trade **4:1** anytime, **3:1** on any General Harbor, or **2:1** on a matching Resource Harbor — or post a **Player Trade Offer** to rivals & bots!
3. **End Turn:** Passes clockwise.`,
    cardReferenceJson: [
      {
        name: "5 Island Resources",
        category: "Harvest",
        icon: "hr-timber",
        description:
          "Timber (Forest), Clay (Hills), Wool (Pasture), Grain (Fields), and Ore (Mountains). Never adjacent 6 & 8 tokens!",
      },
      {
        name: "Cottage (1 VP) & Town (2 VP)",
        category: "Settlements",
        icon: "hr-cottage",
        description:
          "Cottages harvest 1 resource per adjacent roll (must sit 2+ roads from other buildings). Upgrade to Towns for 2 VP & 2× harvest!",
      },
      {
        name: "Coastal Harbors (3:1 & 2:1)",
        category: "Maritime Trade",
        icon: "hr-harbor",
        description:
          "Settle on a glowing dock vertex to unlock instant 3:1 Any or 2:1 specialized resource trading!",
      },
      {
        name: "Harbor Compass (Dry-Spell Relief)",
        category: "Signature Twist",
        icon: "tool-compass",
        description:
          "Gain +1 Charge on dry non-7 rolls. At 3 Charges, claim ANY 1 resource you choose on your turn!",
      },
      {
        name: "Bandit Fox (Roll 7 / Ranger Scout)",
        category: "Take-That",
        icon: "hr-bandit",
        description:
          "Blocks harvest on its hex and steals 1 random card from an adjacent rival. 3+ Ranger Scouts earn Largest Watch (+2 VP)!",
      },
      {
        name: "Guild Scrolls (5 Types)",
        category: "Tactics",
        icon: "hr-scroll",
        description:
          "Ranger Scout, Road Builder (2 free roads), Harvest Plenty (+2 any), Guild Monopoly, and secret Landmark Charter (+1 VP)!",
      },
    ],
    faqJson: [
      {
        q: "Why can't I build a Cottage next to another Cottage?",
        a: "By the Distance Rule, every Cottage or Town must sit at least 2 road edges away from ALL existing buildings (yours or rivals').",
      },
      {
        q: "How does the Dry-Spell Compass work?",
        a: "Whenever a non-7 roll produces 0 resources for you, you gain +1 Compass Charge (up to 3). On your turn, tap Redeem Compass to claim any 1 resource you want!",
      },
      {
        q: "Can I play a Guild Scroll on the same turn I bought it?",
        a: "Action Scrolls (Scout, Road Builder, Plenty, Monopoly) can be played starting on your NEXT turn (max 1 per turn). Secret Landmark Charter (+1 VP) scrolls count immediately!",
      },
      {
        q: "Do Practice Bots accept player trade offers?",
        a: "Yes! When you post a trade offer, Bots evaluate whether it helps their next build and accept fair offers or decline within a second!",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(hrTutorialValues)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: hrTutorialValues.summary,
        rulesMarkdown: hrTutorialValues.rulesMarkdown,
        cardReferenceJson: hrTutorialValues.cardReferenceJson,
        faqJson: hrTutorialValues.faqJson,
      },
    });

  const dsTutorialValues = {
    id: "tut_dawnspire_en",
    gameSlug: "dawnspire",
    locale: "en",
    summary:
      "Draft 3 Eras of sunlit wonders simultaneously! Build structures, chain upgrades for free, borrow neighbor resources automatically, clash Shields each Era, and score across 7 paths!",
    rulesMarkdown: `### Goal of the Game
- Build the most illustrious ancient kingdom across **3 Eras** *(18 simultaneous drafting turns)* and finish with the highest **7-Category Victory Point** total!
- Choose **Sunlit Wonders (Balanced)** or **Starlit Wonders (Asymmetric Powers)** before starting.

### Simultaneous Turn Loop (Zero Downtime!)
1. **Pick 1 Card from Your Hand** and choose **1 of 3 Actions** at the same time as every other player:
   - **Build Structure:** Pay its resource/coin cost, use a **Free Chain** prerequisite *(0 Gold!)*, or borrow missing neighbor resources automatically (**2g**, or **1g** with Markets!).
   - **Raise Wonder Stage:** Tuck any card under your Wonder to build the next Stage *(pays the Stage's cost, NOT the card's!)*.
   - **Sell Card:** Discard face-down for **+3 Gold** *(or **+4 Gold** with the **Sunlit Caravan Bonus** if you have the lowest Gold!)*.
2. **Pass Remaining Hand:** **Left** in Era I, **Right** in Era II, and **Left** in Era III!
3. **End-of-Era Military Clashes:** Compare **Shields** against both Neighbors — win **+1★ / +3★ / +5★** per Era, or take **−1★** on defeat!`,
    cardReferenceJson: [
      {
        name: "Raw Materials (Brown) & Fine Crafts (Silver)",
        category: "Production",
        icon: "ds-wonder",
        description:
          "Produce Timber, Stone, Clay, Ore, Glass & Silk every turn — neighbors can also pay you Gold to borrow them!",
      },
      {
        name: "Civic Monuments (Blue)",
        category: "Direct VP",
        icon: "ds-civic",
        description:
          "Reliable, massive Victory Points (+2★ to +8★) — many unlock for FREE via Era I → II → III chains!",
      },
      {
        name: "Commerce & Markets (Yellow)",
        category: "Trade & Gold",
        icon: "ds-commerce",
        description:
          "Lower neighbor trade rates from 2g → 1g, add Wild resources, grant Gold bursts, and score Era III bonuses!",
      },
      {
        name: "Military Garrisons (Red)",
        category: "Shields ⚔",
        icon: "ds-military",
        description:
          "Out-muscle Left & Right neighbors at the end of each Era for +1★, +3★, and +5★ Victory Tokens!",
      },
      {
        name: "Science Academies (Green)",
        category: "Exponential VP",
        icon: "ds-science",
        description:
          "Collect Tablets, Compasses & Gears: score n² per matching symbol PLUS +7★ per complete set of all 3!",
      },
      {
        name: "Grand Guilds (Purple — Era III)",
        category: "Endgame Combos",
        icon: "ds-guild",
        description:
          "High-impact Era III cards scoring off your and your neighbors' cards, Wonder stages, defeats, or Wild Science!",
      },
    ],
    faqJson: [
      {
        q: "Does borrowing a neighbor's resource remove it from them?",
        a: "Never! Resources are renewable every turn — you simply pay them 2 Gold (or 1 Gold with a Trade Market) and both kingdoms can still use that resource on the same turn!",
      },
      {
        q: "How does Free Chaining work?",
        a: "Certain Era II and Era III structures show a green FREE CHAIN badge if you already built their prerequisite (like Sunlit Altar → Sun Temple → Pantheon) — build them for 0 Gold and 0 resources!",
      },
      {
        q: "How does 2-Player Dawnspire work?",
        a: "In 2-player Caravan Duel mode, 3 hands rotate around the table and the neutral Caravan discards 1 card each turn so drafting stays full of fresh choices while you duel head-to-head!",
      },
      {
        q: "What is the Sunlit Caravan Bonus?",
        a: "Whenever you sell a card for Gold while holding the lowest Gold at the table (or tied for lowest), the Sunlit Caravan adds +1 bonus Gold (+4g instead of +3g)!",
      },
    ],
    videoUrl: null,
  };

  await db
    .insert(schema.gameTutorials)
    .values(dsTutorialValues)
    .onConflictDoUpdate({
      target: schema.gameTutorials.id,
      set: {
        summary: dsTutorialValues.summary,
        rulesMarkdown: dsTutorialValues.rulesMarkdown,
        cardReferenceJson: dsTutorialValues.cardReferenceJson,
        faqJson: dsTutorialValues.faqJson,
      },
    });
}
