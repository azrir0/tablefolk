import type { SupportedGameSlug } from "./gameTutorials";

export interface GuidedCoachStep {
  id: string;
  shortTitle: string;
  done: boolean;
  targetId: string;
  title: string;
  instruction: string;
  actionChip: string;
  tip: string;
}

export interface GuidedCoachModel {
  gameSlug: SupportedGameSlug;
  gameTitle: string;
  botSummary: string;
  /** True when the human can take an interactive action right now */
  isYourTurn: boolean;
  /** True when the tutorial match reached a final result */
  isComplete: boolean;
  /** Index into `steps` representing the live recommended step */
  liveStepIndex: number;
  /** Live dynamic status pill (e.g. "YOUR TURN", "BOT TURN", "TUTORIAL COMPLETE") */
  statusLabel: string;
  /** Live override headline/instruction reacting directly to current phase/selection */
  liveTitle: string;
  liveInstruction: string;
  liveActionChip: string;
  liveTip: string;
  liveTargetId: string;
  steps: GuidedCoachStep[];
}

export const GUIDED_TUTORIAL_META: Record<
  SupportedGameSlug,
  { title: string; botCount: number; botSummary: string; quickPitch: string }
> = {
  "treasure-trails": {
    title: "Treasure Trails",
    botCount: 3,
    botSummary: "1 vs 3 Café Bots · Quick 1-Round Practice",
    quickPitch: "Play a live round with 3 bots while the Coach guides tiles, tools & Quick Fix!",
  },
  hearthvale: {
    title: "Hearthvale",
    botCount: 1,
    botSummary: "1 vs 1 Café Bot · Cozy 36-Tile Valley",
    quickPitch: "Learn tile matching, Folk placement & Mayor majorities in a live 1v1 bot match!",
  },
  "velvet-masque": {
    title: "Velvet Masque",
    botCount: 3,
    botSummary: "1 vs 3 Café Bots · Blitz 10g Masquerade",
    quickPitch: "Practice Curtain Call, Velvet Cloak swaps & Showdown bluffs with live guidance!",
  },
  "sunstone-guild": {
    title: "Sunstone Guild",
    botCount: 1,
    botSummary: "1 vs 1 Café Bot · Quick 12★ Workshop",
    quickPitch: "Draft gems, forge permanent discounts & trigger Catalysts with live step coaching!",
  },
  harborreach: {
    title: "Harborreach",
    botCount: 1,
    botSummary: "1 vs 1 Café Bot · Quick 8★ Coastal Island",
    quickPitch: "Place founding Cottages, roll 2d6, trade & use Harbor Compass step by step!",
  },
  dawnspire: {
    title: "Dawnspire",
    botCount: 2,
    botSummary: "1 vs 2 Café Bots · Sunlit Wonders Circle",
    quickPitch: "Draft simultaneously with Left & Right bot neighbors, Free Chains & Era clashes!",
  },
  "lantern-watch": {
    title: "Lantern Watch",
    botCount: 4,
    botSummary: "1 vs 4 Café Bots · 5p Oracle & Shade Mode",
    quickPitch: "Practice team proposals, Council Ledger votes, secret beacons & Brass Spyglass!",
  },
};

/* ============================================================================
 * 1. TREASURE TRAILS LIVE COACH
 * ============================================================================ */
export interface TreasureTrailsGuideInput {
  phase: string;
  isMyTurn: boolean;
  myRole: "EXPLORER" | "IMPOSTOR" | null;
  hasBrokenTool: boolean;
  selectedCardKind: string | null;
  handCount: number;
  tilesOnBoard: number;
  turnNumber: number;
}

export function buildTreasureTrailsGuide(ctx: TreasureTrailsGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "COMPLETED" || ctx.phase === "ROUND_END";
  const isImpostor = ctx.myRole === "IMPOSTOR";
  const placedAny = ctx.tilesOnBoard > 4; // Base camp + 3 vaults = 4 initial cells
  const playedMultiple = ctx.turnNumber >= 4;

  const steps: GuidedCoachStep[] = [
    {
      id: "tt-1",
      shortTitle: "Secret Role",
      done: ctx.turnNumber > 1 || ctx.selectedCardKind !== null,
      targetId: "tt-header",
      title: isImpostor ? "You are a Secret Impostor!" : "You are a Loyal Explorer!",
      instruction: isImpostor
        ? "Your goal is to stall the trail until the deck runs out — break tools, drop dead-ends, and bluff Peek Vault!"
        : "Your goal is to build an unbroken open path from Base Camp (left) to the hidden Treasure Chest on the right!",
      actionChip: "Check your Role badge in the top bar",
      tip: "Never reveal your role directly — watch who discards often or builds dead-end paths!",
    },
    {
      id: "tt-2",
      shortTitle: "Pick a Card",
      done: ctx.selectedCardKind !== null || placedAny,
      targetId: "tt-hand",
      title: "Select a Card from Your Hand",
      instruction:
        "Tap any Path Tile or Action Card in your hand at the bottom. You automatically draw a fresh replacement card after every play!",
      actionChip: "Tap a Path Tile or Action Card below",
      tip: "Path tiles expand the cave; Break/Fix cards target tools; Peek Vault secretly reveals 1 vault!",
    },
    {
      id: "tt-3",
      shortTitle: "Place / Act",
      done: placedAny,
      targetId: "tt-board",
      title: "Play onto a Glowing Green Spot",
      instruction:
        "With a Path Tile selected, tap any glowing green cell on the expedition grid. Tap Flip 180° anytime before dropping it!",
      actionChip: "Tap a glowing green board cell",
      tip: "Every open edge touching an adjacent tile must match — green highlights show 100% legal placements.",
    },
    {
      id: "tt-4",
      shortTitle: "Tools & Rescue",
      done: playedMultiple,
      targetId: "tt-actions",
      title: "Tools, Discards & Quick Fix Rescue",
      instruction:
        "If a rival breaks one of your 3 tools (Lantern, Compass, Pickaxe), you cannot lay Path Tiles until repaired — or use Quick Fix (discard 2 cards) to repair yourself immediately!",
      actionChip: "Use Fix, Discard 1, or Quick Fix (2 cards)",
      tip: "Tool icons match 1-to-1 between cards and player badges — no guessing!",
    },
    {
      id: "tt-5",
      shortTitle: "Find Vault",
      done: isComplete,
      targetId: "tt-players",
      title: "Watch Bot Tells & Reach the Vault",
      instruction:
        "Follow the bot players' tool statuses and plays! Connect a path to any Vault card on the right to flip it open and check for the Treasure Chest.",
      actionChip: "Connect Base Camp to a right-edge Vault",
      tip: "Two vaults are Decoys and one holds the true Treasure Chest — Peek Vault gives you a private badge!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Tutorial Round Complete!";
    liveInstruction =
      "Awesome job! You've seen hidden roles, path placement, tools, and vault reveals in action. Play another round or head to any café table!";
    liveActionChip = "Review results or Exit Tutorial";
    liveTip = "Try 5–8 player tables in Sunlit Oak Café for even wilder Impostor mind games!";
    liveTargetId = "tt-header";
  } else if (!ctx.isMyTurn) {
    liveStepIndex = placedAny ? 3 : 2;
    liveTitle = "Watching the Café Bots Play...";
    liveInstruction =
      "Watch which bots build open paths toward the vaults versus who breaks tools or discards secretly — that's how you spot Impostors!";
    liveActionChip = "Wait a moment for your turn";
    liveTip = "Check the player strip on top to see everyone's working vs broken tools.";
    liveTargetId = "tt-players";
  } else if (ctx.hasBrokenTool) {
    liveStepIndex = 3;
    liveTitle = "Your Tool Is Broken — Repair or Quick Fix!";
    liveInstruction =
      "While a tool is broken, you can play an Action card (like a matching Fix card), Discard 1 card, or tap Quick Fix to discard 2 cards and repair yourself right now!";
    liveActionChip = "Play Fix, Action Card, or tap Quick Fix";
    liveTip = "Quick Fix guarantees you are never soft-locked out of laying tiles!";
    liveTargetId = "tt-actions";
  } else if (!ctx.selectedCardKind) {
    liveStepIndex = placedAny ? 1 : 0;
    liveTitle = "Your Turn — Tap a Card in Your Hand";
    liveInstruction = isImpostor
      ? "As an Impostor, pick a Break Tool card, a sneaky dead-end tile, or discard quietly to stall the Explorers!"
      : "Pick a Path Tile from your hand below to extend the trail toward the vaults, or select an Action Card!";
    liveActionChip = "Tap any card in your hand below";
    liveTip = "You always draw back up after your play — keep moving the expedition forward!";
    liveTargetId = "tt-hand";
  } else if (ctx.selectedCardKind === "PATH") {
    liveStepIndex = 2;
    liveTitle = "Drop Your Path Tile on a Glowing Cell";
    liveInstruction =
      "Tap any glowing green spot on the cave map to place this tile! Use Flip 180° in the action bar if you want to spin its exits first.";
    liveActionChip = "Tap a green glowing grid spot";
    liveTip = "Connect cleanly toward the three Vaults on the far right edge!";
    liveTargetId = "tt-board";
  } else {
    liveStepIndex = 3;
    liveTitle = "Choose a Target for Your Action Card";
    liveInstruction =
      ctx.selectedCardKind === "PEEK_VAULT"
        ? "Tap any unrevealed Vault on the right side of the map to secretly inspect whether it hides the Treasure Chest!"
        : ctx.selectedCardKind === "BLAST_TILE"
          ? "Tap a placed tunnel tile on the board to blast it clear!"
          : "Tap a matching player in the top strip to apply your Break or Fix Tool card — or tap Discard 1 to pass quietly.";
    liveActionChip = "Tap a highlighted target";
    liveTip = "You can tap a different card in your hand anytime before confirming.";
    liveTargetId =
      ctx.selectedCardKind === "PEEK_VAULT" || ctx.selectedCardKind === "BLAST_TILE"
        ? "tt-board"
        : "tt-players";
  }

  return {
    gameSlug: "treasure-trails",
    gameTitle: "Treasure Trails",
    botSummary: GUIDED_TUTORIAL_META["treasure-trails"].botSummary,
    isYourTurn: ctx.isMyTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : ctx.isMyTurn
        ? "YOUR TURN"
        : "BOTS ACTING",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 2. HEARTHVALE LIVE COACH
 * ============================================================================ */
export interface HearthvaleGuideInput {
  phase: string;
  turnStep: string;
  isMyTurn: boolean;
  tilesRemaining: number;
  myScore: number;
  myFolkRemaining: number;
  hasPreviewSpot: boolean;
  turnsPlayed: number;
}

export function buildHearthvaleGuide(ctx: HearthvaleGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED" || ctx.phase === "COMPLETED";
  const placedFirst = ctx.turnsPlayed >= 1 || ctx.myFolkRemaining < 6 || ctx.myScore > 0;
  const scoredPoints = ctx.myScore > 0;

  const steps: GuidedCoachStep[] = [
    {
      id: "hv-1",
      shortTitle: "Pick & Rotate",
      done: ctx.hasPreviewSpot || placedFirst,
      targetId: "hv-hand",
      title: "Choose 1 of Your 2 Valley Tiles",
      instruction:
        "You always hold a 2-tile Architect Hand! Tap either tile below, then tap Rotate 90° to line up its Roads, Towns, and Meadows.",
      actionChip: "Tap a tile in your hand & Rotate 90°",
      tip: "Look for Roadside Lantern icons — they DOUBLE a completed road's score!",
    },
    {
      id: "hv-2",
      shortTitle: "Place Tile",
      done: ctx.turnStep === "PLACE_FOLK" || placedFirst,
      targetId: "hv-board",
      title: "Place Your Tile on a Glowing Spot",
      instruction:
        "Tap any glowing green cell on the valley grid (matching Roads to Roads and Towns to Towns), then confirm placement!",
      actionChip: "Tap a glowing green cell on the valley map",
      tip: "Surrounding a Hilltop Windmill on all 8 sides awards a huge +9 Victory Points!",
    },
    {
      id: "hv-3",
      shortTitle: "Claim Folk",
      done: ctx.myFolkRemaining < 6 || ctx.turnsPlayed >= 2,
      targetId: "hv-board",
      title: "Claim with a Villager or Mayor (or Skip)",
      instruction:
        "Right after placing a tile, you may drop a Villager (strength 1) or your double-strength Mayor (strength 2) onto an unclaimed feature on that tile — or tap Skip to save Folk!",
      actionChip: "Tap a golden claim pin on your tile — or tap Skip",
      tip: "Claimed Folk return to your hand the instant their Road, Town, or Windmill finishes!",
    },
    {
      id: "hv-4",
      shortTitle: "Score Features",
      done: scoredPoints,
      targetId: "hv-scoring",
      title: "Finish Roads, Towns & Windmills",
      instruction:
        "Closing off a Road or enclosed Town immediately awards Victory Points and returns your Folk! Check the compact Scoring Key anytime.",
      actionChip: "Close a Road or Town to score immediately",
      tip: "Don't spend your last Villager too early — keep 1–2 ready for Windmills and big Towns!",
    },
    {
      id: "hv-5",
      shortTitle: "Final Valley",
      done: isComplete,
      targetId: "hv-players",
      title: "Outscore the Bot Before 0 Tiles Left",
      instruction:
        "When the valley stack reaches 0 tiles, every incomplete Road, Town, and Windmill still scores partial points!",
      actionChip: "Keep expanding & watch the tile stack",
      tip: "Use your double-strength Mayor to steal a rival's big unfinished Town by merging into it!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Hearthvale Practice Complete!";
    liveInstruction =
      "Well played! You've mastered the 2-tile Architect Hand, edge matching, Folk placement, and Valley scoring.";
    liveActionChip = "Play Again or Exit Tutorial";
    liveTip = "Try 3–5 player tables for exciting shared-Town Mayor battles!";
    liveTargetId = "hv-players";
  } else if (!ctx.isMyTurn) {
    liveStepIndex = scoredPoints ? 4 : 3;
    liveTitle = "Café Bot Is Placing a Valley Tile...";
    liveInstruction =
      "Watch where the bot builds its Towns and Roads — you can merge into its Town later with your double-strength Mayor!";
    liveActionChip = "Watch the bot's move";
    liveTip = "Notice how completed features immediately return Folk back to their owner.";
    liveTargetId = "hv-board";
  } else if (ctx.turnStep === "PLACE_FOLK") {
    liveStepIndex = 2;
    liveTitle = "Step 2 of Turn: Claim with Folk or Skip!";
    liveInstruction =
      ctx.myFolkRemaining > 0
        ? "Tap a glowing feature pin on the tile you just placed to claim it with a Villager or Mayor — or tap Skip Claim to save your Folk!"
        : "You have 0 Folk in reserve right now — tap Skip Claim to end your turn (your Folk return when their features finish!).";
    liveActionChip = ctx.myFolkRemaining > 0 ? "Tap a pin to Claim, or tap Skip" : "Tap Skip Claim";
    liveTip = "Windmills and enclosed Towns with Crests give the biggest point bursts!";
    liveTargetId = "hv-board";
  } else if (ctx.hasPreviewSpot) {
    liveStepIndex = 1;
    liveTitle = "Confirm Your Tile Placement!";
    liveInstruction =
      "Looks great! Rotate if desired, or tap Confirm Place (or tap the preview spot again) to lock this tile into the valley.";
    liveActionChip = "Confirm Tile Placement";
    liveTip = "Next you'll get the option to place a Villager or Mayor on this tile!";
    liveTargetId = "hv-board";
  } else {
    liveStepIndex = placedFirst ? 1 : 0;
    liveTitle = placedFirst ? "Your Turn: Place Your Next Tile" : "Step 1: Pick a Tile & Tap a Green Spot";
    liveInstruction =
      "Select either of your 2 hand tiles below, rotate it to match adjacent Roads/Towns, and tap any glowing green cell on the valley grid!";
    liveActionChip = "Pick a tile below → Tap a green spot";
    liveTip = "Roadside Lanterns double road points (2 pts/tile instead of 1)!";
    liveTargetId = placedFirst ? "hv-board" : "hv-hand";
  }

  return {
    gameSlug: "hearthvale",
    gameTitle: "Hearthvale",
    botSummary: GUIDED_TUTORIAL_META.hearthvale.botSummary,
    isYourTurn: ctx.isMyTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : ctx.isMyTurn
        ? ctx.turnStep === "PLACE_FOLK"
          ? "CLAIM FOLK"
          : "PLACE TILE"
        : "BOT TURN",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 3. VELVET MASQUE LIVE COACH
 * ============================================================================ */
export interface VelvetMasqueGuideInput {
  phase: string;
  step: string;
  isMyChooseAction: boolean;
  isMyCloakChoice: boolean;
  isMyPowerChoice: boolean;
  needsMyChallengeResponse: boolean;
  isOpeningSwapOnly: boolean;
  myCoins: number;
  targetCoins: number;
  turnNumber: number;
}

export function buildVelvetMasqueGuide(ctx: VelvetMasqueGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED" || ctx.phase === "COMPLETED";
  const pastCurtain = ctx.step !== "CURTAIN_CALL";
  const pastOpening = ctx.turnNumber > 2;

  const steps: GuidedCoachStep[] = [
    {
      id: "vm-1",
      shortTitle: "Curtain Call",
      done: pastCurtain,
      targetId: "vm-stage",
      title: "Memorize Everyone's Mask!",
      instruction:
        "At Curtain Call, every guest's starting Royal Mask flashes face-up before flipping face-down! Remember yours and the table's masks.",
      actionChip: "Study the face-up masks before the curtain drops",
      tip: "You don't need to memorize all 4 — focus on your own mask and 1–2 neighbors!",
    },
    {
      id: "vm-2",
      shortTitle: "Cloak Swap",
      done: pastOpening,
      targetId: "vm-dock",
      title: "Secretly Swap (or Fake-Swap!) Under the Cloak",
      instruction:
        "On the opening turns (or anytime later!), pick another guest or Center Mask to go under the Velvet Cloak — then secretly choose Swap or Keep!",
      actionChip: "Pick a target → Choose Swap or Fake-Swap",
      tip: "Nobody knows if you actually swapped or bluffed Keep — pure mind games!",
    },
    {
      id: "vm-3",
      shortTitle: "Declare Mask",
      done: ctx.turnNumber > 3 && ctx.myCoins > 6,
      targetId: "vm-dock",
      title: "Declare a Mask Power (Truth or Bluff!)",
      instruction:
        "Announce ANY of the 8 Royal Masks (like Monarch +3g or Taxmaster +2g) to claim its Gold power — even if you aren't holding it!",
      actionChip: "Choose Declare Mask to claim Gold!",
      tip: "If nobody challenges you, you collect the power without ever flipping your card!",
    },
    {
      id: "vm-4",
      shortTitle: "Showdown",
      done: ctx.turnNumber >= 4,
      targetId: "vm-players",
      title: "Pass or Challenge Rival Claims",
      instruction:
        "Whenever a bot declares a Mask, choose Pass (let it happen) or Challenge! Challenging triggers a simultaneous reveal — wrong guess pays 1g fine to the Royal Stage!",
      actionChip: "Tap Pass or Challenge when prompted",
      tip: "Check the Royal Stage fine pot — Magistrate collects ALL coins sitting on the Stage!",
    },
    {
      id: "vm-5",
      shortTitle: `Hit ${ctx.targetCoins}g`,
      done: isComplete,
      targetId: "vm-roster",
      title: `First Guest to ${ctx.targetCoins} Gold Wins!`,
      instruction:
        "Use Peek anytime if you forget your own mask, watch who swaps with whom, and race to the Gold goal (or watch out if anyone hits 0g!).",
      actionChip: `Race to ${ctx.targetCoins} Gold!`,
      tip: "Tap any mask icon in the top Mask Roster strip to check its exact power!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  const isYourTurn =
    ctx.isMyChooseAction ||
    ctx.isMyCloakChoice ||
    ctx.isMyPowerChoice ||
    ctx.needsMyChallengeResponse;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Masquerade Practice Complete!";
    liveInstruction =
      "Bravo! You now know Curtain Call, Velvet Cloak swaps, bluffing Mask powers, and Showdown challenges!";
    liveActionChip = "Play Again or Exit Tutorial";
    liveTip = "Velvet Masque shines with 4–8 friends at the Cushion Tatami Lounge or Grand Lantern Table!";
    liveTargetId = "vm-players";
  } else if (ctx.step === "CURTAIN_CALL") {
    liveStepIndex = 0;
    liveTitle = "Curtain Call — Memorize Your Mask!";
    liveInstruction =
      "Quick! Look at your face-up Royal Mask (and the bots' masks) before they flip face-down for the Masquerade!";
    liveActionChip = "Memorize the masks — countdown running!";
    liveTip = "Forgot later? You can always use a turn to secretly Peek at your own mask.";
    liveTargetId = "vm-players";
  } else if (ctx.isMyCloakChoice) {
    liveStepIndex = 1;
    liveTitle = "Under the Velvet Cloak: Swap or Bluff Keep!";
    liveInstruction =
      "Only YOU know what happens under the cloak! Tap Actually Swap to trade masks, or Fake Swap (Keep) to trick the table!";
    liveActionChip = "Choose Swap Masks or Fake Swap (Keep)";
    liveTip = "Fake-swapping makes rivals doubt their own memory!";
    liveTargetId = "vm-dock";
  } else if (ctx.isMyPowerChoice) {
    liveStepIndex = 2;
    liveTitle = "Resolve Your Mask Power!";
    liveInstruction =
      "Your Royal Mask power activated! Pick a target guest or card in the action dock to collect your reward.";
    liveActionChip = "Choose your power target below";
    liveTip = "Every resolved power pushes you closer to victory!";
    liveTargetId = "vm-dock";
  } else if (ctx.needsMyChallengeResponse) {
    liveStepIndex = 3;
    liveTitle = "Showdown Decision: Pass or Challenge!";
    liveInstruction =
      "A bot just declared a Royal Mask! Tap Pass if you believe them (or don't want to risk 1g), OR tap Challenge if you think you hold that mask (or they're bluffing)!";
    liveActionChip = "Tap Pass or Challenge below";
    liveTip = "If you challenge and YOU hold the announced mask, you steal the power AND fine the bluffer!";
    liveTargetId = "vm-dock";
  } else if (ctx.isMyChooseAction) {
    liveStepIndex = ctx.isOpeningSwapOnly ? 1 : 2;
    liveTitle = ctx.isOpeningSwapOnly
      ? "Opening Shuffle: Pick Someone to Cloak-Swap With!"
      : "Your Turn: Declare a Mask, Swap, or Peek!";
    liveInstruction = ctx.isOpeningSwapOnly
      ? "For the first 2 turns, everyone shuffles masks under the Velvet Cloak! Pick a guest or center mask below to start a secret swap."
      : "Use the dock below to Declare a Royal Mask for Gold (truth or bluff!), secretly Swap under the cloak, or Peek at your own mask!";
    liveActionChip = ctx.isOpeningSwapOnly
      ? "Select a swap target below"
      : "Declare a Mask, Swap, or Peek below";
    liveTip = "Declaring Monarch (+3g) or Patron (+2g) unchallenged is the fastest way to climb!";
    liveTargetId = "vm-dock";
  } else {
    liveStepIndex = pastOpening ? 3 : 1;
    liveTitle = "Watching the Bots Under the Masquerade...";
    liveInstruction =
      "Keep an eye on who swaps with whom! Tracking even one mask makes calling bluffs super rewarding.";
    liveActionChip = "Watch the bots' moves";
    liveTip = "Check the Gold counters next to each guest — don't let anyone sneak up to 10g!";
    liveTargetId = "vm-players";
  }

  return {
    gameSlug: "velvet-masque",
    gameTitle: "Velvet Masque",
    botSummary: GUIDED_TUTORIAL_META["velvet-masque"].botSummary,
    isYourTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : isYourTurn
        ? "YOUR MOVE"
        : "BOTS ACTING",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 4. SUNSTONE GUILD LIVE COACH
 * ============================================================================ */
export interface SunstoneGuildGuideInput {
  phase: string;
  step: string;
  isMyTurn: boolean;
  stagedGemCount: number;
  myTokenCount: number;
  myRelicCount: number;
  myPrestige: number;
  targetPrestige: number;
  canAffordAnyRelic: boolean;
  reservedCount: number;
}

export function buildSunstoneGuildGuide(ctx: SunstoneGuildGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED" || ctx.phase === "GAME_END";
  const hasDrafted = ctx.myTokenCount > 0 || ctx.myRelicCount > 0;
  const hasCrafted = ctx.myRelicCount > 0;
  const hasEngine = ctx.myRelicCount >= 2;

  const steps: GuidedCoachStep[] = [
    {
      id: "sg-1",
      shortTitle: "Draft Gems",
      done: hasDrafted,
      targetId: "sg-bank",
      title: "Draft 3 Different Gems (or 2 Matching)",
      instruction:
        "Tap up to 3 different colored gems in the Gem Bank — OR tap the same color twice when 4+ remain — then tap Take Gems!",
      actionChip: "Tap 3 different gems in the Bank → Take Gems",
      tip: "Max 10 gems fit in your pouch, so spend gems on Relics regularly!",
    },
    {
      id: "sg-2",
      shortTitle: "Craft Relic",
      done: hasCrafted,
      targetId: "sg-market",
      title: "Craft Your First Relic Card!",
      instruction:
        "Affordable Relics glow bright green in the Workshop Market! Tap any glowing card and hit Craft to add its permanent gem discount to your Atelier!",
      actionChip: "Tap a green glowing Relic → Craft",
      tip: "Look for Tier I Catalyst sparks (⚡) — they immediately refund +1 matching gem when crafted!",
    },
    {
      id: "sg-3",
      shortTitle: "Engine Discounts",
      done: hasEngine,
      targetId: "sg-atelier",
      title: "Grow Your Permanent Discount Engine",
      instruction:
        "Every Relic in your Atelier permanently lowers future card costs forever! Wild Sunstone Gold auto-fills any missing gems when you craft.",
      actionChip: "Keep crafting Tier I & II Relics",
      tip: "Aim for discounts that line up with the Royal Patrons at the top!",
    },
    {
      id: "sg-4",
      shortTitle: "Reserve + Gold",
      done: ctx.reservedCount > 0 || ctx.myPrestige >= 4,
      targetId: "sg-market",
      title: "Reserve Key Relics for +1 Wild Gold",
      instruction:
        "Want to block the bot or save a high-Prestige Tier II/III card? Tap any card and choose Reserve to hold it (up to 3) AND claim +1 Wild Sunstone Gold!",
      actionChip: "Tap a high-VP Relic → Reserve (+1 Wild Gold)",
      tip: "You can also craft Reserved cards straight from your Atelier anytime you afford them!",
    },
    {
      id: "sg-5",
      shortTitle: `Patrons & ${ctx.targetPrestige}★`,
      done: isComplete,
      targetId: "sg-patrons",
      title: `Attract Royal Patrons & Hit ${ctx.targetPrestige}★!`,
      instruction:
        "Match a Royal Patron's required Relic discounts to earn an automatic +3★ visit at the end of your turn! First to hit the Prestige target wins!",
      actionChip: `Reach ${ctx.targetPrestige}★ Prestige!`,
      tip: "Tier III 2× Grand Masterworks grant DOUBLE permanent discounts to leap into Patrons!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Sunstone Guild Practice Complete!";
    liveInstruction =
      "Brilliant crafting! You've learned gem drafting, permanent Relic discounts, Catalysts, Reserving, and Royal Patrons.";
    liveActionChip = "Play Again or Exit Tutorial";
    liveTip = "Try 3–4 player tables in the café for fierce Relic reserving races!";
    liveTargetId = "sg-players";
  } else if (!ctx.isMyTurn) {
    liveStepIndex = hasCrafted ? 2 : 0;
    liveTitle = "Café Bot Is Taking Its Turn...";
    liveInstruction =
      "Check which Relic colors the bot is collecting — you can Reserve a juicy card before it grabs it!";
    liveActionChip = "Wait a moment for your turn";
    liveTip = "Plan your next 3 gem colors while the bot acts!";
    liveTargetId = "sg-market";
  } else if (ctx.step === "DISCARD_GEMS") {
    liveStepIndex = 0;
    liveTitle = "Pouch Full (Max 10 Gems) — Return Excess";
    liveInstruction =
      "Your pouch holds at most 10 gems. Tap excess gems in the return strip to bring your pouch back down to 10!";
    liveActionChip = "Return excess gems down to 10";
    liveTip = "Next turn, spend gems on a Relic so your pouch stays light!";
    liveTargetId = "sg-bank";
  } else if (ctx.step === "CHOOSE_PATRON") {
    liveStepIndex = 4;
    liveTitle = "Royal Patron Visit! Pick +3★!";
    liveInstruction =
      "Multiple Royal Patrons want to visit your Atelier! Tap one at the top to claim +3★ Prestige!";
    liveActionChip = "Tap a glowing Royal Patron (+3★)";
    liveTip = "Patron visits are free bonuses on top of your normal turn!";
    liveTargetId = "sg-patrons";
  } else if (ctx.canAffordAnyRelic) {
    liveStepIndex = hasCrafted ? 2 : 1;
    liveTitle = hasCrafted
      ? "You Can Craft Another Relic!"
      : "You Can Afford Your First Relic — Craft It!";
    liveInstruction =
      "See the glowing green Relic card(s) in the Market? Tap one and click Craft to earn its permanent gem discount (and any ★ Prestige or ⚡ Catalyst refund)!";
    liveActionChip = "Tap a glowing green Relic → Craft";
    liveTip = "Permanent discounts never get spent — they make every future turn stronger!";
    liveTargetId = "sg-market";
  } else if (ctx.stagedGemCount > 0) {
    liveStepIndex = 0;
    liveTitle =
      ctx.stagedGemCount < 3
        ? `Pick ${3 - ctx.stagedGemCount} More Different Gem(s) — or Tap Take!`
        : "3 Gems Staged — Tap Take Gems!";
    liveInstruction =
      "Look at the cheapest Tier I Relics in the Market and grab matching colors, then confirm Take Gems in the Bank bar!";
    liveActionChip = "Tap Take Gems to confirm";
    liveTip = "Tapping the same color twice takes 2 matching gems (when 4+ remain in the bank).";
    liveTargetId = "sg-bank";
  } else {
    liveStepIndex = hasEngine ? 4 : hasCrafted ? 2 : 0;
    liveTitle = "Your Turn: Draft 3 Gems from the Bank!";
    liveInstruction =
      "Pick 3 different gem colors that help you afford a Tier I Relic (or tap a card you love and Reserve it for +1 Wild Gold!).";
    liveActionChip = "Tap 3 gems in the Gem Bank";
    liveTip = "Check the Royal Patrons at the top so your early Relics build toward +3★ bonuses!";
    liveTargetId = "sg-bank";
  }

  return {
    gameSlug: "sunstone-guild",
    gameTitle: "Sunstone Guild",
    botSummary: GUIDED_TUTORIAL_META["sunstone-guild"].botSummary,
    isYourTurn: ctx.isMyTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : ctx.isMyTurn
        ? "YOUR TURN"
        : "BOT TURN",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 5. HARBORREACH LIVE COACH
 * ============================================================================ */
export interface HarborreachGuideInput {
  phase: string;
  step: string;
  isMyTurn: boolean;
  mustDiscard: number;
  myVP: number;
  targetVP: number;
  totalResources: number;
  compassCharges: number;
  cottagesBuilt: number;
  roadsBuilt: number;
}

export function buildHarborreachGuide(ctx: HarborreachGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED" || ctx.phase === "GAME_END";
  const setupDone = ctx.step !== "SETUP_SETTLE" && ctx.step !== "SETUP_ROAD";
  const hasExpanded = ctx.cottagesBuilt >= 3 || ctx.roadsBuilt >= 3 || ctx.myVP >= 3;

  const steps: GuidedCoachStep[] = [
    {
      id: "hr-1",
      shortTitle: "Founding Setup",
      done: setupDone,
      targetId: "hr-board",
      title: "Place 2 Founding Cottages & Roads",
      instruction:
        "In snake draft order, place 2 free Cottages and 2 free Roads on glowing island corners! Your 2nd Cottage immediately harvests its touching hexes!",
      actionChip: "Tap a glowing corner (or road edge) on the island",
      tip: "Red numbers 6 and 8 roll most often — grab intersections touching 3 varied resources!",
    },
    {
      id: "hr-2",
      shortTitle: "Roll 2d6",
      done: setupDone && ctx.step !== "ROLL_DICE",
      targetId: "hr-build",
      title: "Roll 2d6 to Harvest Resources",
      instruction:
        "Every turn starts with Roll 2d6! Matching hex numbers pay out Timber, Clay, Wool, Grain & Ore to everyone with adjacent Cottages (or 2× for Towns!).",
      actionChip: "Tap Roll 2d6 in the Build & Actions dock",
      tip: "Missed a non-7 roll? Your Dry-Spell Harbor Compass gains +1 charge — spend 3 charges for ANY resource!",
    },
    {
      id: "hr-3",
      shortTitle: "Build & Trade",
      done: hasExpanded,
      targetId: "hr-build",
      title: "Build Roads, Cottages, Towns — or Trade!",
      instruction:
        "Spend resources in your hand to build Roads (Timber+Clay), Cottages (+1★), Towns (+2★, 2× harvest!), or Trade 4:1 / at coastal Harbors / with Bots!",
      actionChip: "Build an item, Trade, or tap End Turn",
      tip: "Practice Bots evaluate and accept fair player Trade Offers live!",
    },
    {
      id: "hr-4",
      shortTitle: "Scrolls & Fox",
      done: ctx.myVP >= 4,
      targetId: "hr-scrolls",
      title: "Bandit Fox & Guild Scrolls",
      instruction:
        "Rolling a 7 (or playing a Ranger Scout scroll) moves the Bandit Fox to block a rival hex and steal 1 card! Play 3 Scouts for Largest Watch (+2★).",
      actionChip: "Check Guild Scrolls & Compass Charges",
      tip: "Keep 7 or fewer resource cards in hand so a 7-roll never forces you to discard half!",
    },
    {
      id: "hr-5",
      shortTitle: `Hit ${ctx.targetVP}★`,
      done: isComplete,
      targetId: "hr-players",
      title: `Race to ${ctx.targetVP} Victory Points!`,
      instruction:
        "Combine Cottages (+1★), Towns (+2★), Longest Trade Route (5+ roads, +2★), Largest Watch (+2★), and hidden Landmark Charters to win!",
      actionChip: `Reach ${ctx.targetVP}★ to claim Harborreach!`,
      tip: "Upgrading a Cottage on a 6 or 8 hex into a Town doubles your income every roll!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  const isYourTurn = ctx.isMyTurn || ctx.mustDiscard > 0;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Harborreach Practice Complete!";
    liveInstruction =
      "Well charted, Pioneer! You've mastered snake-draft settling, 2d6 harvests, Harbor Compass, trading, and island expansion.";
    liveActionChip = "Play Again or Exit Tutorial";
    liveTip = "Try 3–4 player tables in the café for bustling multi-player resource trading!";
    liveTargetId = "hr-players";
  } else if (ctx.mustDiscard > 0) {
    liveStepIndex = 3;
    liveTitle = `A 7 Rolled! Discard ${ctx.mustDiscard} Card(s)`;
    liveInstruction =
      "Anyone holding 8+ resource cards on a 7 must discard half. Select cards in your hand bar to discard and keep the game moving!";
    liveActionChip = `Discard ${ctx.mustDiscard} resource card(s)`;
    liveTip = "Spend extra resources before ending your turn so you stay at 7 or fewer cards!";
    liveTargetId = "hr-hand";
  } else if (!ctx.isMyTurn) {
    liveStepIndex = setupDone ? 2 : 0;
    liveTitle = "Café Bot Is Taking Its Turn...";
    liveInstruction =
      "Watch what the bot rolls — remember, YOU still harvest resources on the bot's dice rolls whenever your Cottages match!";
    liveActionChip = "Watch the bot's roll & build";
    liveTip = "Even on an opponent's roll, missing a non-7 roll charges your Harbor Compass!";
    liveTargetId = "hr-board";
  } else if (ctx.step === "SETUP_SETTLE") {
    liveStepIndex = 0;
    liveTitle = `Place Founding Cottage #${ctx.cottagesBuilt + 1}!`;
    liveInstruction =
      "Tap any glowing intersection dot on the island! Aim for corners touching 3 hexes with high-probability numbers (6, 8, 5, 9).";
    liveActionChip = "Tap a glowing corner on the island";
    liveTip =
      ctx.cottagesBuilt === 1
        ? "Your 2nd Cottage immediately gives you 1 starting resource from each touching hex!"
        : "Try to cover Timber & Clay early so you can build Roads right away!";
    liveTargetId = "hr-board";
  } else if (ctx.step === "SETUP_ROAD") {
    liveStepIndex = 0;
    liveTitle = "Place Your Free Starting Road!";
    liveInstruction =
      "Tap any glowing edge connected to the Cottage you just built to point your expansion toward coastal Harbors or great hexes!";
    liveActionChip = "Tap a glowing road edge next to your Cottage";
    liveTip = "Coastal 2:1 Harbors let you trade 2 matching resources for ANY 1 resource!";
    liveTargetId = "hr-board";
  } else if (ctx.step === "ROLL_DICE") {
    liveStepIndex = 1;
    liveTitle = "Start Your Turn: Roll 2d6!";
    liveInstruction =
      "Tap Roll 2d6 to harvest Timber, Clay, Wool, Grain, and Ore across the island (or play a Ranger Scout scroll before rolling)!";
    liveActionChip = "Tap Roll 2d6 below";
    liveTip = "If the roll misses your hexes, your Harbor Compass still charges up (+1)!";
    liveTargetId = "hr-build";
  } else if (ctx.step === "MOVE_BANDIT") {
    liveStepIndex = 3;
    liveTitle = "Move the Bandit Fox to a Rival Hex!";
    liveInstruction =
      "Tap any hex tile touching your opponent's Cottage or Town to block its production and steal 1 random resource card from them!";
    liveActionChip = "Tap a rival hex on the island";
    liveTip = "Blocking a rival's 6 or 8 hex slows them down while filling your hand!";
    liveTargetId = "hr-board";
  } else {
    liveStepIndex = hasExpanded ? 4 : 2;
    liveTitle =
      ctx.compassCharges >= 3
        ? "Harbor Compass Ready! Claim Any Free Resource, Build, or End Turn"
        : "Main Phase: Build, Trade, or End Turn!";
    liveInstruction =
      ctx.compassCharges >= 3
        ? "You have 3 Compass Charges! Tap Redeem Compass for any 1 resource you need, then build a Road/Cottage/Town or End Turn."
        : "Check which Build buttons are lit up (Road, Cottage, Town, Scroll), try a 4:1/Harbor/Bot Trade, or tap End Turn when ready!";
    liveActionChip = "Build, Trade, or tap End Turn";
    liveTip = "Upgrading a Cottage into a Town costs 2 Grain + 3 Ore and doubles that corner's harvest!";
    liveTargetId = "hr-build";
  }

  return {
    gameSlug: "harborreach",
    gameTitle: "Harborreach",
    botSummary: GUIDED_TUTORIAL_META.harborreach.botSummary,
    isYourTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : isYourTurn
        ? "YOUR TURN"
        : "BOT TURN",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 6. DAWNSPIRE LIVE COACH
 * ============================================================================ */
export interface DawnspireGuideInput {
  phase: string;
  era: number;
  turnInEra: number;
  hasSelectedCard: boolean;
  hasLockedIn: boolean;
  selectedCardName: string | null;
  selectedCardCanBuild: boolean;
  selectedCardIsFreeChain: boolean;
  selectedCardTradeCost: number;
  builtCount: number;
  wonderStagesBuilt: number;
}

export function buildDawnspireGuide(ctx: DawnspireGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED";
  const playedTurn1 = ctx.builtCount > 0 || ctx.wonderStagesBuilt > 0 || ctx.turnInEra > 1 || ctx.era > 1;
  const reachedEra2 = ctx.era >= 2;

  const steps: GuidedCoachStep[] = [
    {
      id: "ds-1",
      shortTitle: "Your Wonder",
      done: playedTurn1,
      targetId: "ds-wonder",
      title: "Inspect Your Ancient Wonder & Starting Resource",
      instruction:
        "Your Wonder banner shows your free starting resource (renews every turn!) and 3 Wonder Stages you can raise by tucking any hand card beneath them!",
      actionChip: "Check your starting resource & Stage 1 cost",
      tip: "Resources never get consumed — every Raw Material or Craft produces every single turn!",
    },
    {
      id: "ds-2",
      shortTitle: "Pick 1 Card",
      done: ctx.hasSelectedCard || playedTurn1,
      targetId: "ds-hand",
      title: "Select 1 Card from Your Era Hand",
      instruction:
        "Everyone drafts simultaneously! Tap any card in your hand to inspect its instant badge: Free, Free Chain, Auto-Trade Gold cost, or Missing.",
      actionChip: "Tap a card in your hand below",
      tip: "Remaining cards pass Left in Era I, Right in Era II, and Left in Era III!",
    },
    {
      id: "ds-3",
      shortTitle: "Build / Wonder / Sell",
      done: playedTurn1,
      targetId: "ds-actions",
      title: "Choose 1 of 3 Simultaneous Actions",
      instruction:
        "With a card selected, choose: Build Structure (adds to your realm), Raise Wonder Stage (tucks card face-down), or Sell (+3g, or +4g with Sunlit Caravan Bonus!).",
      actionChip: "Click Build, Raise Wonder, or Sell",
      tip: "After you lock in, all bots reveal simultaneously — zero waiting!",
    },
    {
      id: "ds-4",
      shortTitle: "Trade & Clash",
      done: reachedEra2,
      targetId: "ds-neighbors",
      title: "Auto-Trade Neighbors & Era Military Clashes",
      instruction:
        "Missing a resource? If your Left or Right neighbor produces it, Dawnspire auto-calculates the cheapest 2g trade (1g with Markets)! Compare Shields at the end of each Era (+1/+3/+5★).",
      actionChip: "Check Left & Right neighbors' resources & Shields",
      tip: "Borrowing a neighbor's resource does NOT take it away from them — you just pay them Gold!",
    },
    {
      id: "ds-5",
      shortTitle: "7 Paths to Win",
      done: isComplete,
      targetId: "ds-kingdoms",
      title: "Chain Free Upgrades & Score All 7 Paths",
      instruction:
        "Look for green FREE CHAIN badges in Eras II & III, collect matching Science symbols (n² + 7★ per set!), and grab Era III Purple Grand Guilds!",
      actionChip: "Draft through Era III for final 7-path scoring!",
      tip: "Building 1–2 Brown/Silver resource cards in Era I makes Eras II & III smooth and cheap!",
    },
  ];

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  const isYourTurn = !isComplete && !ctx.hasLockedIn;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Dawnspire Practice Complete!";
    liveInstruction =
      "Magnificent realm! You've mastered simultaneous 3-Era drafting, Auto-Trade, Free Chains, Wonders, and 7-Category Scoring.";
    liveActionChip = "Inspect breakdown or Exit Tutorial";
    liveTip = "Try Starlit Wonders in the café lobby for asymmetric powers like Free Builds and Copy Guild!";
    liveTargetId = "ds-kingdoms";
  } else if (ctx.hasLockedIn) {
    liveStepIndex = reachedEra2 ? 4 : 3;
    liveTitle = "Choice Locked In — Revealing Simultaneously!";
    liveInstruction =
      "Your move is sealed! As soon as the bot neighbors finish locking in, everyone's cards reveal at once and hands pass around the table.";
    liveActionChip = "Waiting a second for bot locks...";
    liveTip = "Notice how fast even a 7-player Dawnspire match plays with simultaneous drafting!";
    liveTargetId = "ds-neighbors";
  } else if (!ctx.hasSelectedCard) {
    liveStepIndex = playedTurn1 ? 1 : 0;
    liveTitle = `Era ${ctx.era} · Turn ${ctx.turnInEra}: Tap a Card in Your Hand`;
    liveInstruction =
      "Tap any card in your hand to preview its effect and build cost. Look for Brown/Silver resources early, Blue Civic VP, Red Shields, or Green Science!";
    liveActionChip = "Tap a card in your Era hand";
    liveTip = "Green badges mean you can build it immediately (including Free Chains!).";
    liveTargetId = "ds-hand";
  } else {
    liveStepIndex = 2;
    const cardLabel = ctx.selectedCardName ?? "Selected Card";
    liveTitle = ctx.selectedCardIsFreeChain
      ? `FREE CHAIN! Build ${cardLabel} for 0 Gold!`
      : ctx.selectedCardCanBuild
        ? ctx.selectedCardTradeCost > 0
          ? `Build ${cardLabel} (Auto-Trade ${ctx.selectedCardTradeCost}g)`
          : `Ready to Build ${cardLabel}!`
        : `Tuck ${cardLabel} for Wonder or Sell for Gold!`;
    liveInstruction = ctx.selectedCardCanBuild
      ? `Click Build to add ${cardLabel} to your kingdom — or choose Raise Wonder Stage / Sell (+3g/+4g) in the action bar!`
      : `You're missing a resource to build ${cardLabel} right now — pick another card with a green badge, tuck it to Raise your Wonder, or Sell it for Gold!`;
    liveActionChip = ctx.selectedCardCanBuild
      ? `Click Build, Wonder, or Sell`
      : "Pick an affordable card, Raise Wonder, or Sell";
    liveTip =
      ctx.era === 1
        ? "Era I resource cards unlock huge Era II & III combos — plus neighbors pay YOU to borrow them!"
        : "Watch for Era II/III Free Chain icons and compare Shields before the Era ends!";
    liveTargetId = "ds-actions";
  }

  return {
    gameSlug: "dawnspire",
    gameTitle: "Dawnspire",
    botSummary: GUIDED_TUTORIAL_META.dawnspire.botSummary,
    isYourTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : isYourTurn
        ? `ERA ${ctx.era} · PICK CARD`
        : "RESOLVING TURN",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}

/* ============================================================================
 * 7. LANTERN WATCH LIVE COACH
 * ============================================================================ */
export interface LanternWatchGuideInput {
  phase: string;
  roleName: string;
  faction: "loyal" | "shadow";
  role: string;
  canPropose: boolean;
  canVote: boolean;
  canPlayMissionCard: boolean;
  canUseSpyglass: boolean;
  canAssassinate: boolean;
  draftCount: number;
  requiredTeamSize: number;
  missionNumber: number;
  rejectTrack: number;
  ledgerRows: number;
  loyalWins: number;
  shadowWins: number;
}

export function buildLanternWatchGuide(ctx: LanternWatchGuideInput): GuidedCoachModel {
  const isComplete = ctx.phase === "FINISHED";
  const isShadow = ctx.faction === "shadow";
  const hasVotedOnce = ctx.ledgerRows >= 1;
  const hasMissionDone = ctx.loyalWins + ctx.shadowWins >= 1;

  const steps: GuidedCoachStep[] = [
    {
      id: "lw-1",
      shortTitle: "Secret Dossier",
      done: hasVotedOnce || ctx.draftCount > 0,
      targetId: "lw-dossier",
      title: `Your Identity: ${ctx.roleName} (${isShadow ? "Shadow Moles" : "Loyal Watch"})`,
      instruction: isShadow
        ? "Check your Secret Dossier on the right to see your fellow Shadow Ally! Sabotage 3 Beacons, force 5 rejected votes, or unmask The Oracle!"
        : ctx.role === "oracle"
          ? "You are THE ORACLE! Your Dossier secretly reveals the Shadow Moles — steer votes subtly so the Nightblade cannot spot you!"
          : "You are Loyal Watch! Help light 3 Coastal Beacons — read every public vote in the Council Ledger to expose the hidden Shadow Moles!",
      actionChip: "Read your Secret Dossier & Private Sightings",
      tip: "Nobody is ever eliminated in Lantern Watch — every player votes on every proposal!",
    },
    {
      id: "lw-2",
      shortTitle: "Propose Crew",
      done: ctx.phase !== "PROPOSE_TEAM" || hasVotedOnce,
      targetId: "lw-council",
      title: "Lantern Commander Proposes a Courier Team",
      instruction:
        "Each attempt, the rotating Commander picks the exact number of couriers required for the current Beacon. Tap seats in the Harbor Council when it's your command!",
      actionChip: "Watch who the Commander nominates (or pick seats yourself!)",
      tip: "The Commander Seal rotates clockwise after EVERY vote — approved or rejected!",
    },
    {
      id: "lw-3",
      shortTitle: "Council Vote",
      done: hasVotedOnce,
      targetId: "lw-actions",
      title: "Simultaneous Public Approve / Reject Vote",
      instruction:
        "Everyone votes Approve or Reject together, then all votes flip publicly! Strict majority launches the crew; ties count as Reject and raise Chaos (+1).",
      actionChip: "Tap Approve Team or Reject Team",
      tip: "At Chaos 4/5, Loyal Watch MUST Approve — 5 consecutive rejections gives Shadow an instant Collapse win!",
    },
    {
      id: "lw-4",
      shortTitle: "Secret Beacon",
      done: hasMissionDone,
      targetId: "lw-actions",
      title: "Secret Mission Cards (Shuffled Anonymously)",
      instruction:
        "Approved crew members secretly play Light Beacon (Loyal only) or Extinguish (Shadow option). Cards shuffle anonymously before reveal!",
      actionChip: "If on crew, play Light Beacon (or Extinguish if Shadow)",
      tip: "As Shadow on Mission 1, occasionally bluffing Light earns huge trust for later missions!",
    },
    {
      id: "lw-5",
      shortTitle: "Ledger & Climax",
      done: isComplete,
      targetId: "lw-ledger",
      title: "Read the Council Ledger, Brass Spyglass & Finale",
      instruction:
        "After Mission 2, the Brass Spyglass privately checks 1 courier! Use the Council Vote Ledger to see who approved sabotaged crews — and watch for the Nightblade's Final Unmasking at 3 Lit Beacons!",
      actionChip: "Study every row of the Council Vote Ledger",
      tip: "Gold rings in the Ledger mark who was on each crew; green/red dots show who voted them through!",
    },
  ];

  const isYourTurn =
    ctx.canPropose ||
    ctx.canVote ||
    ctx.canPlayMissionCard ||
    ctx.canUseSpyglass ||
    ctx.canAssassinate;

  let liveStepIndex = 0;
  let liveTitle = steps[0]!.title;
  let liveInstruction = steps[0]!.instruction;
  let liveActionChip = steps[0]!.actionChip;
  let liveTip = steps[0]!.tip;
  let liveTargetId = steps[0]!.targetId;

  if (isComplete) {
    liveStepIndex = 4;
    liveTitle = "Lantern Watch Practice Complete!";
    liveInstruction =
      "Well deduced! Check the Full Role Reveal to see who was hiding in the Shadows — you're ready for a live 4–8p café council!";
    liveActionChip = "Inspect Role Reveal or Exit Tutorial";
    liveTip = "Try 6–8 player tables to unlock The Warden, Mirage, Veiled Mole & 2-Fail Beacon 4!";
    liveTargetId = "lw-ledger";
  } else if (ctx.canPropose) {
    liveStepIndex = 1;
    liveTitle = `Your Command! Select ${ctx.requiredTeamSize} Couriers (${ctx.draftCount}/${ctx.requiredTeamSize})`;
    liveInstruction =
      ctx.draftCount < ctx.requiredTeamSize
        ? `Tap ${ctx.requiredTeamSize - ctx.draftCount} more courier card(s) in the Harbor Council above, then click Propose Team!`
        : `All ${ctx.requiredTeamSize} couriers selected! Click Propose Team in the action bar to open the Council Vote.`;
    liveActionChip =
      ctx.draftCount < ctx.requiredTeamSize
        ? `Tap ${ctx.requiredTeamSize} seats in Harbor Council`
        : "Click Propose Team below";
    liveTip = isShadow
      ? "Include yourself (or your Shadow Ally) alongside trusted Loyal players so the vote passes!"
      : "Include yourself (you know you're Loyal!) plus couriers with clean records in the Ledger!";
    liveTargetId = ctx.draftCount < ctx.requiredTeamSize ? "lw-council" : "lw-actions";
  } else if (ctx.canVote) {
    liveStepIndex = 2;
    liveTitle =
      ctx.rejectTrack >= 4
        ? "FINAL VOTE (Chaos 4/5)! Decide Carefully!"
        : `Cast Your Public Council Vote (Beacon ${ctx.missionNumber})`;
    liveInstruction =
      ctx.rejectTrack >= 4
        ? isShadow
          ? "Rejecting now hands Shadow an instant Council Collapse win!"
          : "Approve now — rejecting this 5th proposal hands Shadow an instant Collapse victory!"
        : "Look at who has the golden CREW badge above (and check your Secret Dossier sightings!), then vote Approve Team or Reject Team!";
    liveActionChip = "Click Approve Team or Reject Team";
    liveTip = "Remember: everyone's Approve/Reject vote flips publicly and stays logged in the Ledger!";
    liveTargetId = "lw-actions";
  } else if (ctx.canPlayMissionCard) {
    liveStepIndex = 3;
    liveTitle = "You're on the Crew — Seal Your Secret Mission Card!";
    liveInstruction = isShadow
      ? "Choose Extinguish (✕) to sabotage this coastal beacon — OR bluff Light Beacon (✓) to look innocent for future missions!"
      : "Tap Light Beacon (✓) to fuel the harbor flame! Cards shuffle anonymously so nobody knows who played what.";
    liveActionChip = isShadow
      ? "Choose Light Beacon or Extinguish"
      : "Tap Light Beacon (✓)";
    liveTip = "First faction to win 3 of 5 Beacons advances to the finale!";
    liveTargetId = "lw-actions";
  } else if (ctx.canUseSpyglass) {
    liveStepIndex = 4;
    liveTitle = "Brass Spyglass Active! Inspect 1 Courier Privately!";
    liveInstruction =
      "Tap any cyan-highlighted courier in the Harbor Council above, then confirm Inspect to secretly learn whether they are Loyal Watch or Shadow Mole!";
    liveActionChip = "Tap a cyan-highlighted seat → Inspect";
    liveTip = "You pass the Spyglass to whoever you check — the result saves privately in your Dossier!";
    liveTargetId = "lw-council";
  } else if (ctx.canAssassinate) {
    liveStepIndex = 4;
    liveTitle = "Final Unmasking! Name The Oracle to Steal Victory!";
    liveInstruction =
      "Study the Council Vote Ledger to see which Loyal courier consistently dodged Shadow teams — tap them above and strike!";
    liveActionChip = "Tap a rose-highlighted Loyal seat → Unmask";
    liveTip = "A direct hit on The Oracle steals victory for the Shadow Moles!";
    liveTargetId = "lw-council";
  } else {
    liveStepIndex = hasMissionDone ? 4 : hasVotedOnce ? 3 : 0;
    liveTitle = "Watching the Harbor Council...";
    liveInstruction =
      ctx.phase === "EXECUTE_MISSION"
        ? "The approved crew is secretly submitting Light or Extinguish cards — watch the anonymous reveal!"
        : "Read your Secret Dossier on the right and check the Council Vote Ledger while the bots finish their step.";
    liveActionChip = "Watch the bots' moves & read the Ledger";
    liveTip = "Look at who approved failed crews — voting patterns are your best deduction weapon!";
    liveTargetId = hasVotedOnce ? "lw-ledger" : "lw-dossier";
  }

  return {
    gameSlug: "lantern-watch",
    gameTitle: "Lantern Watch",
    botSummary: GUIDED_TUTORIAL_META["lantern-watch"].botSummary,
    isYourTurn,
    isComplete,
    liveStepIndex,
    statusLabel: isComplete
      ? "TUTORIAL COMPLETE"
      : isYourTurn
        ? "YOUR ACTION"
        : "BOTS ACTING",
    liveTitle,
    liveInstruction,
    liveActionChip,
    liveTip,
    liveTargetId,
    steps,
  };
}
